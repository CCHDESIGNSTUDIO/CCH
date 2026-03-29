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

// ─── FIND OR CREATE CUSTOMER ─────────────────────────────────────
async function findOrCreateCustomer(accessToken, clientName, clientEmail) {
  if (!clientName) throw new functions.https.HttpsError("invalid-argument", "Client name is required");

  // Search by name first
  const searchName = clientName.replace(/'/g, "\\'");
  const query = `select * from Customer where DisplayName = '${searchName}'`;
  const searchResult = await qbApiCall("GET",
    "query?query=" + encodeURIComponent(query), accessToken);

  if (searchResult.QueryResponse && searchResult.QueryResponse.Customer &&
      searchResult.QueryResponse.Customer.length > 0) {
    return searchResult.QueryResponse.Customer[0].Id;
  }

  // Not found — create new customer
  const newCustomer = {
    DisplayName: clientName,
    PrimaryEmailAddr: clientEmail ? { Address: clientEmail } : undefined
  };

  const created = await qbApiCall("POST", "customer", accessToken, newCustomer);
  return created.Customer.Id;
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
  const projSnap = await db.collection("boards").doc(projectId).get();
  const proj = projSnap.exists ? projSnap.data() : {};
  const clientName = proj.clientName || invoice.clientName || "Unknown Client";
  const clientEmail = proj.clientEmail || invoice.clientEmail || "";

  // Find or create customer in QB
  const customerId = await findOrCreateCustomer(accessToken, clientName, clientEmail);

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
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]; // Net 30

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

  // For POs, the vendor is the "customer" equivalent
  const vendorName = po.vendor || po.vendorName || "Unknown Vendor";
  // Search for vendor
  const searchName = vendorName.replace(/'/g, "\\'");
  const query = `select * from Vendor where DisplayName = '${searchName}'`;
  const searchResult = await qbApiCall("GET",
    "query?query=" + encodeURIComponent(query), accessToken);

  let vendorId;
  if (searchResult.QueryResponse && searchResult.QueryResponse.Vendor &&
      searchResult.QueryResponse.Vendor.length > 0) {
    vendorId = searchResult.QueryResponse.Vendor[0].Id;
  } else {
    // Create vendor
    const created = await qbApiCall("POST", "vendor", accessToken, { DisplayName: vendorName });
    vendorId = created.Vendor.Id;
  }

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

          // Find which invoice this payment is for
          for (const line of (paymentData.Line || [])) {
            if (line.LinkedTxn) {
              for (const txn of line.LinkedTxn) {
                if (txn.TxnType === "Invoice") {
                  // Find our invoice by qbDocId
                  const invoiceQuery = await db.collectionGroup("invoices")
                    .where("qbDocId", "==", txn.TxnId).limit(1).get();

                  if (!invoiceQuery.empty) {
                    const invDoc = invoiceQuery.docs[0];
                    const existing = invDoc.data();
                    const payments = existing.payments || [];
                    payments.push({
                      amount: paymentData.TotalAmt,
                      date: paymentData.TxnDate,
                      method: paymentData.PaymentMethodRef ? paymentData.PaymentMethodRef.name : "QB Payment",
                      note: "Auto-synced from QuickBooks",
                      qbPaymentId: entity.id
                    });

                    const totalPaid = payments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
                    const total = parseFloat(existing.total) || 0;
                    const newStatus = totalPaid >= total ? "Paid" : "Partially Paid";

                    await invDoc.ref.update({ payments, status: newStatus });
                  }
                }
              }
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
