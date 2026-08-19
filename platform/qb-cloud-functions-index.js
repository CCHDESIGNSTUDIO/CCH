/**
 * CCH Studio — QuickBooks Push Functions
 * 
 * SETUP:
 * 1. cd into your cch-deploy folder
 * 2. firebase init functions (choose JavaScript, install deps)
 * 3. cd functions && npm install node-fetch@2
 * 4. Replace functions/index.js with this file
 * 5. Set config:
 *    firebase functions:config:set qb.client_id="YOUR_ID" qb.client_secret="YOUR_SECRET" qb.realm_id="YOUR_REALM"
 * 6. In Firestore Console: create collection "admin" → doc "qb" → field "refreshToken" = your token
 * 7. firebase deploy --only functions
 * 
 * GETTING YOUR REFRESH TOKEN (one-time):
 * - Go to https://developer.intuit.com/app/developer/playground
 * - Select your app, choose "Accounting" scope
 * - Click "Get Token" → copy the refresh_token value
 * - Paste it into Firestore admin/qb document
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const fetch = require("node-fetch");

admin.initializeApp();
const db = admin.firestore();

const QBConfig = () => ({
  clientId: functions.config().qb.client_id,
  clientSecret: functions.config().qb.client_secret,
  realmId: functions.config().qb.realm_id,
  // Toggle this to "https://sandbox-quickbooks.api.intuit.com" for testing
  apiBase: "https://quickbooks.api.intuit.com"
});

// ─── TOKEN MANAGEMENT ────────────────────────────────────────────
async function getAccessToken() {
  const qbDoc = await db.collection("admin").doc("qb").get();
  const config = qbDoc.data();
  if (!config || !config.refreshToken) {
    throw new functions.https.HttpsError("failed-precondition",
      "QuickBooks not connected. Add refreshToken to Firestore admin/qb document.");
  }

  const { clientId, clientSecret } = QBConfig();
  const basicAuth = Buffer.from(clientId + ":" + clientSecret).toString("base64");

  const res = await fetch("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Authorization": "Basic " + basicAuth
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: config.refreshToken
    }).toString()
  });

  if (!res.ok) {
    const err = await res.text();
    throw new functions.https.HttpsError("internal", "Token refresh failed: " + err);
  }

  const tokens = await res.json();

  // Save the new refresh token (they rotate)
  await db.collection("admin").doc("qb").update({
    refreshToken: tokens.refresh_token,
    accessToken: tokens.access_token,
    tokenUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  return tokens.access_token;
}

// ─── QB API HELPER ───────────────────────────────────────────────
async function qbApiCall(method, endpoint, accessToken, body) {
  const { realmId, apiBase } = QBConfig();
  const url = `${apiBase}/v3/company/${realmId}/${endpoint}`;

  const options = {
    method,
    headers: {
      "Authorization": "Bearer " + accessToken,
      "Content-Type": "application/json",
      "Accept": "application/json"
    }
  };
  if (body) options.body = JSON.stringify(body);

  const res = await fetch(url, options);
  const data = await res.json();

  if (data.Fault) {
    const errMsg = data.Fault.Error ? data.Fault.Error.map(e => e.Message).join("; ") : "Unknown QB error";
    throw new functions.https.HttpsError("internal", "QB API Error: " + errMsg);
  }

  return data;
}

// Ordered QuickBooks Customer DisplayName tries (see Functions/index.js).
function qbCustomerDisplayNameCandidates(proj, invoice, projectId) {
  const out = [];
  const seen = new Set();
  function add(raw) {
    const t = String(raw || "").trim();
    if (!t) return;
    const k = t.toLowerCase();
    if (seen.has(k)) return;
    seen.add(k);
    out.push(t);
  }
  const p = proj || {};
  const inv = invoice || {};
  const clientLower = String(p.clientName || inv.clientName || inv.client || "").trim().toLowerCase();

  add(p.name);
  add(p.projectName);
  add(inv.projectName);
  add(p.title);
  add(p.slug);

  const pn = String(p.name || "").trim();
  if (pn) {
    const parts = pn
      .split(/\s*[\u2013\u2014\-]\s*/)
      .map(s => s.trim())
      .filter(Boolean);
    if (parts.length > 1) {
      const sorted = parts.slice().sort((a, b) => {
        const da = /^\d/.test(a);
        const db = /^\d/.test(b);
        if (da !== db) return da ? -1 : 1;
        const la = a.toLowerCase();
        const lb = b.toLowerCase();
        const ea = clientLower && la === clientLower;
        const eb = clientLower && lb === clientLower;
        if (ea !== eb) return ea ? 1 : -1;
        return b.length - a.length;
      });
      sorted.forEach(add);
    }
  }

  add(p.clientName);
  add(inv.clientName);
  add(inv.client);
  if (out.length === 0 && projectId) {
    add(String(projectId).replace(/-/g, " "));
  }
  return out;
}

// ─── RESOLVE QB CUSTOMER (no auto-create) ────────────────────────
async function resolveQbCustomerIdForPush(accessToken, displayNameCandidates, clientEmail, projRef, proj) {
  const candidates = Array.isArray(displayNameCandidates)
    ? displayNameCandidates.map(c => String(c || "").trim()).filter(Boolean)
    : [];

  const existingQbId = proj && proj.qbCustomerId != null ? String(proj.qbCustomerId).trim() : "";
  if (existingQbId && /^\d+$/.test(existingQbId)) {
    return existingQbId;
  }

  if (!candidates.length) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "No project or client names available to match a QuickBooks customer."
    );
  }

  for (const tryDisplay of candidates) {
    const searchName = tryDisplay.replace(/'/g, "\\'");
    const query = `select * from Customer where DisplayName = '${searchName}'`;
    const searchResult = await qbApiCall("GET",
      "query?query=" + encodeURIComponent(query), accessToken);

    if (searchResult.QueryResponse && searchResult.QueryResponse.Customer &&
        searchResult.QueryResponse.Customer.length > 0) {
      const id = searchResult.QueryResponse.Customer[0].Id;
      if (projRef) {
        await projRef.update({ qbCustomerId: id }).catch(() => {});
      }
      return id;
    }
  }

  throw new functions.https.HttpsError(
    "failed-precondition",
    "QuickBooks: no customer is linked to this project. Creating new QuickBooks customers from Studio is disabled. " +
      "Set qbCustomerId on the project (board), or match DisplayName in QuickBooks. Names tried (in order): " +
      candidates.slice(0, 8).map(c => "\"" + c + "\"").join(", ") +
      (candidates.length > 8 ? " …" : "") + "."
  );
}

// ─── RESOLVE QB VENDOR (no auto-create) — legacy functions file ──
async function resolveQbVendorIdForPush(accessToken, vendorName) {
  const vn = (vendorName || "").trim();
  if (!vn) {
    throw new functions.https.HttpsError("invalid-argument", "Vendor name is required on the PO");
  }

  let vendorDocRef = null;
  try {
    const vs = await db.collection("vendors").where("name", "==", vn).limit(1).get();
    if (!vs.empty) {
      vendorDocRef = vs.docs[0].ref;
      const vd = vs.docs[0].data() || {};
      const qid = vd.qbVendorId != null ? String(vd.qbVendorId).trim() : "";
      if (qid && /^\d+$/.test(qid)) {
        return qid;
      }
    }
  } catch (e) {
    console.warn("[resolveQbVendorIdForPush] Firestore:", e && e.message);
  }

  const searchName = vn.replace(/'/g, "\\'");
  const query = `select * from Vendor where DisplayName = '${searchName}'`;
  const searchResult = await qbApiCall("GET",
    "query?query=" + encodeURIComponent(query), accessToken);

  if (searchResult.QueryResponse && searchResult.QueryResponse.Vendor &&
      searchResult.QueryResponse.Vendor.length > 0) {
    const id = searchResult.QueryResponse.Vendor[0].Id;
    if (vendorDocRef) {
      await vendorDocRef.update({ qbVendorId: id }).catch(() => {});
    }
    return id;
  }

  throw new functions.https.HttpsError(
    "failed-precondition",
    "QuickBooks: no vendor is linked for \"" + vn + "\". Set qbVendorId on the vendor in Studio, " +
      "or match DisplayName in QuickBooks exactly. Creating vendors from a PO push is disabled."
  );
}

// ─── PUSH INVOICE → QB (with Payment Request email) ─────────────
exports.pushInvoiceToQB = functions.https.onCall(async (data, context) => {
  // Auth check
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Sign in required");
  }

  const { projectId, docId, sendEmail } = data;
  if (!projectId || !docId) {
    throw new functions.https.HttpsError("invalid-argument", "projectId and docId required");
  }

  // Load invoice from Firestore
  const docRef = db.collection("boards").doc(projectId).collection("invoices").doc(docId);
  const snap = await docRef.get();
  if (!snap.exists) {
    throw new functions.https.HttpsError("not-found", "Invoice not found");
  }
  const invoice = snap.data();

  // Duplicate prevention — the critical piece
  if (invoice.qbDocId) {
    return { success: true, message: "Already synced to QB", qbDocId: invoice.qbDocId };
  }

  const accessToken = await getAccessToken();

  // Get project info for client details
  const projRef = db.collection("boards").doc(projectId);
  const projSnap = await projRef.get();
  const proj = projSnap.exists ? projSnap.data() : {};
  const clientEmail = proj.clientEmail || invoice.clientEmail || "";
  const displayNameCandidates = qbCustomerDisplayNameCandidates(proj, invoice, projectId);

  if (!displayNameCandidates.length) {
    throw new functions.https.HttpsError("failed-precondition",
      "Set the project name and/or client name before pushing to QuickBooks, or set qbCustomerId on the board.");
  }

  const customerId = await resolveQbCustomerIdForPush(accessToken, displayNameCandidates, clientEmail, projRef, proj);

  // Build QB Invoice
  // Use "Description only" lines (SalesItemLineDetail with a generic service item)
  // This avoids needing to map every product to a QB Item
  const lineItems = (invoice.items || []).map((item, idx) => ({
    LineNum: idx + 1,
    Amount: parseFloat(item.amount || item.clientPrice || item.total || 0),
    Description: [
      item.title || item.name || "Item",
      item.vendor ? "(" + item.vendor + ")" : "",
      item.room || item.category || ""
    ].filter(Boolean).join(" — "),
    DetailType: "SalesItemLineDetail",
    SalesItemLineDetail: {
      ItemRef: { value: "1", name: "Services" }, // QB default "Services" item
      Qty: parseFloat(item.qty || 1),
      UnitPrice: parseFloat(item.amount || item.clientPrice || 0) / parseFloat(item.qty || 1)
    }
  }));

  // Add shipping as a line if present
  if (invoice.shipping && parseFloat(invoice.shipping) > 0) {
    lineItems.push({
      Amount: parseFloat(invoice.shipping),
      Description: "Shipping & Handling",
      DetailType: "SalesItemLineDetail",
      SalesItemLineDetail: {
        ItemRef: { value: "1", name: "Services" },
        Qty: 1,
        UnitPrice: parseFloat(invoice.shipping)
      }
    });
  }

  const dueDate = invoice.dueDate ||
    new Date().toISOString().split("T")[0]; // due upon receipt

  const qbInvoice = {
    Line: lineItems,
    CustomerRef: { value: customerId },
    DocNumber: invoice.invoiceNum || invoice.number || docId.slice(0, 10),
    TxnDate: invoice.date || new Date().toISOString().split("T")[0],
    DueDate: dueDate,
    // THIS is what triggers the payment request email
    EmailStatus: sendEmail !== false ? "NeedToSend" : "NotSet",
    BillEmail: clientEmail ? { Address: clientEmail } : undefined,
    CustomerMemo: { value: "Thank you for your business — CCH Design" },
    PrivateNote: "Pushed from CCH Studio. Project: " + (proj.name || projectId)
  };

  // Add tax if present
  if (invoice.taxRate && parseFloat(invoice.taxRate) > 0) {
    qbInvoice.TxnTaxDetail = {
      TotalTax: parseFloat(invoice.tax || 0)
    };
  }

  // Push to QB
  const result = await qbApiCall("POST", "invoice", accessToken, qbInvoice);
  const qbId = result.Invoice.Id;

  // Save QB ID back to our invoice (prevents duplicates forever)
  await docRef.update({
    qbDocId: qbId,
    qbSyncDate: admin.firestore.FieldValue.serverTimestamp(),
    qbSynced: true,
    qbInvoiceNum: result.Invoice.DocNumber
  });

  return {
    success: true,
    qbDocId: qbId,
    qbInvoiceNum: result.Invoice.DocNumber,
    emailSent: sendEmail !== false && !!clientEmail
  };
});

// ─── PUSH PO → QB (as Purchase Order) ───────────────────────────
exports.pushPOToQB = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Sign in required");
  }

  const { projectId, docId } = data;
  const docRef = db.collection("boards").doc(projectId).collection("purchaseOrders").doc(docId);
  const snap = await docRef.get();
  if (!snap.exists) throw new functions.https.HttpsError("not-found", "PO not found");
  const po = snap.data();

  if (po.qbDocId) {
    return { success: true, message: "Already synced", qbDocId: po.qbDocId };
  }

  const accessToken = await getAccessToken();

  const vendorName = po.vendor || po.vendorName || "";
  const vendorId = await resolveQbVendorIdForPush(accessToken, vendorName);

  const lineItems = (po.items || []).map((item, idx) => ({
    LineNum: idx + 1,
    Amount: parseFloat(item.cost || item.amount || 0),
    Description: [item.title || item.name || "Item", item.sku || ""].filter(Boolean).join(" — "),
    DetailType: "ItemBasedExpenseLineDetail",
    ItemBasedExpenseLineDetail: {
      ItemRef: { value: "1", name: "Services" },
      Qty: parseFloat(item.qty || 1),
      UnitPrice: parseFloat(item.cost || item.amount || 0) / parseFloat(item.qty || 1)
    }
  }));

  const qbPO = {
    Line: lineItems,
    VendorRef: { value: vendorId },
    DocNumber: po.number || po.num || docId.slice(0, 10),
    TxnDate: po.date || new Date().toISOString().split("T")[0],
    PrivateNote: "CCH Studio. Project: " + projectId
  };

  const result = await qbApiCall("POST", "purchaseorder", accessToken, qbPO);
  const qbId = result.PurchaseOrder.Id;

  await docRef.update({
    qbDocId: qbId,
    qbSyncDate: admin.firestore.FieldValue.serverTimestamp(),
    qbSynced: true
  });

  return { success: true, qbDocId: qbId };
});

// ─── QB WEBHOOK (receives payment notifications) ─────────────────
exports.qbWebhook = functions.https.onRequest(async (req, res) => {
  // Intuit sends POST with eventNotifications
  if (req.method !== "POST") { res.status(200).send("OK"); return; }

  const body = req.body;
  if (!body.eventNotifications) { res.status(200).send("OK"); return; }

  const accessToken = await getAccessToken();

  for (const notification of body.eventNotifications) {
    for (const entity of (notification.dataChangeEvent || {}).entities || []) {
      // Payment received
      if (entity.name === "Payment" && entity.operation === "Create") {
        try {
          const payment = await qbApiCall("GET", "payment/" + entity.id, accessToken);
          const paymentData = payment.Payment;

          // Each Payment Line carries the portion applied to that invoice (Amount), not the full TotalAmt.
          // Pushing TotalAmt once per LinkedTxn row re-applies the whole payment for every line — inflating Paid.
          const lineList = paymentData.Line || [];
          for (const line of lineList) {
            if (!line || !line.LinkedTxn) continue;
            const lineAmtRaw = parseFloat(line.Amount);
            const lineAmt = Number.isFinite(lineAmtRaw) && lineAmtRaw > 0
              ? lineAmtRaw
              : (lineList.length === 1 ? parseFloat(paymentData.TotalAmt) || 0 : 0);
            if (!lineAmt) continue;

            for (const txn of line.LinkedTxn) {
              if (txn.TxnType !== "Invoice") continue;

              const invoiceQuery = await db.collectionGroup("invoices")
                .where("qbDocId", "==", txn.TxnId).limit(1).get();

              if (invoiceQuery.empty) continue;

              const invDoc = invoiceQuery.docs[0];
              const existing = invDoc.data();
              const payments = Array.isArray(existing.payments) ? existing.payments.slice() : [];
              const qbPid = String(entity.id || "");
              const lineFingerprint = qbPid + "|" + String(txn.TxnId || "") + "|" + String(Math.round(lineAmt * 100) / 100);
              if (payments.some((p) => String(p.qbPaymentLineKey || "") === lineFingerprint)) continue;

              payments.push({
                amount: lineAmt,
                date: paymentData.TxnDate,
                method: paymentData.PaymentMethodRef ? paymentData.PaymentMethodRef.name : "QB Payment",
                note: "Auto-synced from QuickBooks",
                qbPaymentId: entity.id,
                qbPaymentLineKey: lineFingerprint
              });

              const totalPaid = payments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
              const total = parseFloat(existing.total) || 0;
              const newStatus = totalPaid >= total ? "Paid" : "Partially Paid";

              await invDoc.ref.update({ payments, status: newStatus, paidAmount: totalPaid, paymentCount: payments.length });
            }
          }
        } catch (e) {
          console.error("Webhook payment processing error:", e);
        }
      }
    }
  }

  res.status(200).send("OK");
});
