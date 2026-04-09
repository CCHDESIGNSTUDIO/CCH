const functions = require("firebase-functions");
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
admin.initializeApp();

const db = admin.firestore();

const TIMELY_CLIENT_ID = "X0t2mXABI8R81qN8PDzX1iSAfMybb6cdpzfUT1Z1Otc";
const TIMELY_CLIENT_SECRET = "f71829f106a93ce3e692b7f392d457a6d95bec579932095fa368430a16b884ca";
const TIMELY_REDIRECT_URI = "https://cch-platform.web.app";
const TIMELY_ACCOUNT_ID = "874495";

exports.healthCheck = functions.https.onCall(
  { invoker: "public" },
  (request) => {
    return { status: "ok", timestamp: new Date().toISOString() };
  }
);

// Exchange Timely OAuth code for access token
exports.timelyAuth = functions.https.onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "https://cch-platform.web.app");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).send("");

  const { code } = req.body || {};
  if (!code) return res.status(400).json({ error: "Missing code parameter" });

  try {
    const fetch = (await import("node-fetch")).default;
    const resp = await fetch("https://api.timelyapp.com/1.1/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: TIMELY_CLIENT_ID,
        client_secret: TIMELY_CLIENT_SECRET,
        redirect_uri: TIMELY_REDIRECT_URI,
        code: code
      }).toString()
    });
    const data = await resp.json();
    if (data.error) return res.status(400).json(data);

    // Store token in Firestore
    await db.collection("settings").doc("timely").set({
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
      tokenType: data.token_type,
      scope: data.scope || "",
      connectedAt: new Date().toISOString(),
      accountId: TIMELY_ACCOUNT_ID
    });

    return res.status(200).json({ status: "connected", expiresIn: data.expires_in });
  } catch (err) {
    console.error("[Timely Auth] Error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// Pull time entries from Timely API
exports.timelySyncEntries = functions.https.onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "https://cch-platform.web.app");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).send("");

  try {
    const tokenDoc = await db.collection("settings").doc("timely").get();
    if (!tokenDoc.exists) return res.status(400).json({ error: "Timely not connected" });
    const { accessToken, accountId } = tokenDoc.data();

    const startDate = req.body.startDate || new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    const endDate = req.body.endDate || new Date().toISOString().slice(0, 10);

    const fetch = (await import("node-fetch")).default;
    const resp = await fetch(`https://api.timelyapp.com/1.1/${accountId}/events?since=${startDate}&upto=${endDate}`, {
      headers: { "Authorization": `Bearer ${accessToken}` }
    });
    if (resp.status === 401) return res.status(401).json({ error: "Token expired — reconnect Timely" });
    const entries = await resp.json();

    // Write each entry to Firestore
    let saved = 0;
    for (const entry of entries) {
      const docId = "timely-" + entry.id;
      // Timely API v1.1: duration is in entry.duration object
      // { total_seconds, total_hours, total_minutes, hours, minutes, seconds }
      // The top-level entry.hours field is always 0 — ignore it
      const dur = entry.duration || {};
      const durSecs = parseFloat(dur.total_seconds) || 0;
      const hoursVal = parseFloat(dur.total_hours) || (durSecs / 3600) || (parseFloat(dur.total_minutes) / 60) || 0;
      await db.collection("timelyEntries").doc(docId).set({
        source: "timely-api",
        timelyId: entry.id,
        date: entry.day || "",
        hours: hoursVal,
        minutes: Math.round(durSecs / 60),
        note: entry.note || "",
        project: entry.project ? entry.project.name : "",
        timelyProjectId: entry.project_id || "",
        member: entry.user ? entry.user.name : "",
        timelyUserId: entry.user_id || "",
        billed: entry.billed || false,
        label: entry.label_ids || [],
        createdAt: entry.created_at || "",
        updatedAt: entry.updated_at || "",
        raw: entry
      }, { merge: true });
      saved++;
    }

    return res.status(200).json({ status: "ok", fetched: entries.length, saved: saved, startDate, endDate });
  } catch (err) {
    console.error("[Timely Sync] Error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// Timely webhook — receives hours:created, hours:updated events
exports.timelyWebhook = functions.https.onRequest(async (req, res) => {
  // Accept GET for Timely verification ping
  if (req.method === "GET") {
    return res.status(200).send("OK");
  }

  if (req.method !== "POST") {
    return res.status(405).send("Method not allowed");
  }

  try {
    const payload = req.body;
    const event = payload.event || "";
    const data = payload.data || payload;

    console.log("[Timely Webhook]", event, JSON.stringify(data).substring(0, 500));

    // Extract time entry data
    const entry = data.time_entry || data.hour || data;
    if (!entry || !entry.id) {
      return res.status(200).send("No entry data");
    }

    const timelyId = String(entry.id);
    // Timely sends duration as object {total, total_with_timer} in seconds
    const rawDur = entry.duration;
    const durSecs = (rawDur && typeof rawDur === "object")
      ? (rawDur.total || 0)
      : (typeof rawDur === "number" ? (rawDur > 24 ? rawDur : rawDur * 3600) : 0);
    const durationMin = Math.round(durSecs / 60);
    const duration = durSecs / 3600; // store as decimal hours
    const date = entry.day || entry.date || new Date().toISOString().slice(0, 10);
    const note = entry.note || entry.description || "";
    const projectId = entry.project_id || "";
    const projectName = (entry.project && entry.project.name) || "";
    const userId = entry.user_id || "";
    const userName = (entry.user && entry.user.name) || "";
    const billed = entry.billed || false;

    // Write to Firestore — desktopTimeLogs style for Smart Time compatibility
    const docId = date + "-timely-" + timelyId;
    await db.collection("timelyEntries").doc(docId).set({
      source: "timely-webhook",
      timelyId: timelyId,
      date: date,
      hours: duration,
      duration: duration,
      durationMinutes: durationMin,
      note: note,
      project: projectName,
      timelyProjectId: projectId,
      member: userName,
      timelyUserId: userId,
      billed: billed,
      event: event,
      receivedAt: new Date().toISOString(),
      raw: entry
    }, { merge: true });

    console.log("[Timely Webhook] Saved:", docId, projectName, durationMin + "min");
    return res.status(200).json({ status: "ok", docId: docId });

  } catch (err) {
    console.error("[Timely Webhook] Error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════
// QUICKBOOKS INTEGRATION
// ══════════════════════════════════════════════════════════

// QuickBooks — client id/secret must match Intuit app + qbauth.html; realm defaults until OAuth stores real id.
const QB_CLIENT_ID = "ABANZD7ynJxIwmujoEXbztoyHJHO3AHpoRNBGD0J4AJq7pwL33";
const QB_CLIENT_SECRET = "p6ebqg4HUwBKcuxALaGhvN0BFkWl5xqKCXJCvLUJ";
const QB_REALM_ID = "1389735275";
// Sandbox (only if qbauth.html uses sandbox client id instead):
// const QB_CLIENT_ID = "ABIdgpUOB12gSW5FUrfixcQRQXtLNlRr4SXf0kkpxUSpe35qFR";
// const QB_CLIENT_SECRET = "AWNiPZvn8eFOLeiAhBtXZlUWRwPWulAZpSpiAAEc";
// const QB_REALM_ID = "9341456810119653";

// Studio account IDs in QB (Production)
const QB_ACCOUNTS = {
  R1: "380", // R1 - Studio Product Sales
  R2: "381", // R2 - Studio Design Fees
  R3: "382", // R3 - Studio Shipping
  R4: "383", // R4 - Studio Prepaid Tax
  R5: "384", // R5 - Studio Reimbursable
  C1: "385", // C1 - Studio Product Cost
  C2: "386", // C2 - Studio Freight/Shipping
  C3: "387", // C3 - Studio Sales Tax Paid
  C4: "388", // C4 - Studio Subcontractors
  C5: "389"  // C5 - Studio Samples
};

const QBConfig = () => ({
  clientId: QB_CLIENT_ID,
  clientSecret: QB_CLIENT_SECRET,
  realmId: QB_REALM_ID,
  apiBase: "https://quickbooks.api.intuit.com"
});

/** Allowed redirect_uri values passed to Intuit OAuth (must match developer portal exactly). */
const QB_OAUTH_REDIRECTS = new Set([
  "https://cch-platform.web.app/qbauth.html",
  "https://cch-platform.web.app"
]);

const QB_REDIRECT_URI_DEFAULT = "https://cch-platform.web.app/qbauth.html";

// ─── QB OAUTH: Start authorization flow ─────────────────────────
exports.qbAuthStart = functions.https.onRequest(async (req, res) => {
  const state = Math.random().toString(36).substring(2, 15);
  await db.collection("admin").doc("qb_oauth_state").set({ state, createdAt: new Date().toISOString() });

  const authUrl = "https://appcenter.intuit.com/connect/oauth2?" + new URLSearchParams({
    client_id: QB_CLIENT_ID,
    response_type: "code",
    scope: "com.intuit.quickbooks.accounting",
    redirect_uri: QB_REDIRECT_URI_DEFAULT,
    state: state
  }).toString();

  res.redirect(authUrl);
});

// ─── QB OAUTH: Exchange code for tokens (callable from frontend) ──
exports.qbAuthCallback = functions.https.onCall(
  { invoker: "public" },
  async (request) => {
  assertQbAdmin(request);

  const { code, realmId, redirectUri } = request.data || {};
  if (!code) throw new functions.https.HttpsError("invalid-argument", "Authorization code required");

  const redirect = (redirectUri && QB_OAUTH_REDIRECTS.has(String(redirectUri).trim()))
    ? String(redirectUri).trim()
    : QB_REDIRECT_URI_DEFAULT;

  const fetch = (await import("node-fetch")).default;
  const basicAuth = Buffer.from(QB_CLIENT_ID + ":" + QB_CLIENT_SECRET).toString("base64");

  const tokenRes = await fetch("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Authorization": "Basic " + basicAuth
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: code,
      redirect_uri: redirect
    }).toString()
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    throw new functions.https.HttpsError("internal", "Token exchange failed: " + err);
  }

  const tokens = await tokenRes.json();

  await db.collection("admin").doc("qb").set({
    refreshToken: tokens.refresh_token,
    accessToken: tokens.access_token,
    realmId: realmId || QB_REALM_ID,
    connectedAt: new Date().toISOString(),
    tokenUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  return { success: true, realmId: realmId || QB_REALM_ID };
  }
);

// ─── TOKEN MANAGEMENT ────────────────────────────────────────────
async function getQBAccessToken() {
  const qbDoc = await db.collection("admin").doc("qb").get();
  const config = qbDoc.data();
  if (!config || !config.refreshToken) {
    throw new functions.https.HttpsError("failed-precondition",
      "QuickBooks not connected. Add refreshToken to Firestore admin/qb document.");
  }

  const basicAuth = Buffer.from(QB_CLIENT_ID + ":" + QB_CLIENT_SECRET).toString("base64");
  const fetch = (await import("node-fetch")).default;

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

  return { accessToken: tokens.access_token, realmId: config.realmId || QB_REALM_ID };
}

// ─── QB API HELPER ───────────────────────────────────────────────
async function qbApiCall(method, endpoint, accessToken, realmId, body) {
  const { apiBase } = QBConfig();
  const url = `${apiBase}/v3/company/${realmId}/${endpoint}`;
  const fetch = (await import("node-fetch")).default;

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
    const errMsg = data.Fault.Error ? data.Fault.Error.map(e => e.Message + " (" + e.Detail + ")").join("; ") : "Unknown QB error";
    throw new functions.https.HttpsError("internal", "QB API Error: " + errMsg);
  }

  return data;
}

// Same billing admins as Firestore rules `isAdmin` + platform ADMIN_EMAILS
const QB_ADMIN_EMAILS = [
  "cindy@cchdesign.com",
  "cynthia@cchdesign.com",
  "cynthiacbh@gmail.com"
];

/** Gen2 https.onCall invokes (request) — auth is on request, payload on request.data (not v1's context). */
function assertQbAdmin(request) {
  if (!request || !request.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Sign in required");
  }
  const email = (request.auth.token.email || "").toLowerCase();
  if (!QB_ADMIN_EMAILS.includes(email)) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Only billing admins can use QuickBooks from CCH Studio."
    );
  }
}

// Invoice / PO push — billing admins + Vanessa (creates docs, pushes per workflow)
const QB_PUSH_EMAILS = QB_ADMIN_EMAILS.concat([
  "vanessa@cchdesign.com",
  "vanessaholliday@cchdesign.com",
  "vholliday@cchdesign.com",
]);

function assertQbPushAllowed(request) {
  if (!request || !request.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Sign in required");
  }
  const email = (request.auth.token.email || "").toLowerCase();
  if (!QB_PUSH_EMAILS.includes(email)) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "You are not authorized to push documents to QuickBooks."
    );
  }
}

const QB_PUSH_LOCK_FIELD = "qbPushLockAt";
const QB_PUSH_LOCK_TTL_MS = 3 * 60 * 1000;

/** Serialize concurrent QB pushes so double-clicks do not create duplicate QB docs. */
async function beginQbDocumentPush(docRef) {
  return db.runTransaction(async (transaction) => {
    const snap = await transaction.get(docRef);
    if (!snap.exists) {
      throw new functions.https.HttpsError("not-found", "Document not found");
    }
    const d = snap.data();
    if (d.qbDocId) {
      return { alreadySynced: true, qbDocId: d.qbDocId };
    }
    const lockAt = d[QB_PUSH_LOCK_FIELD];
    if (lockAt && typeof lockAt.toMillis === "function") {
      const ageMs = Date.now() - lockAt.toMillis();
      if (ageMs >= 0 && ageMs < QB_PUSH_LOCK_TTL_MS) {
        throw new functions.https.HttpsError(
          "resource-exhausted",
          "QuickBooks push already in progress for this document. Wait a minute and try again."
        );
      }
    }
    transaction.update(docRef, {
      [QB_PUSH_LOCK_FIELD]: admin.firestore.FieldValue.serverTimestamp()
    });
    return { alreadySynced: false };
  });
}

async function clearQbPushLock(docRef) {
  await docRef.update({
    [QB_PUSH_LOCK_FIELD]: admin.firestore.FieldValue.delete()
  }).catch(() => {});
}

function _httpsErrStatus(code) {
  const m = {
    "invalid-argument": 400,
    "not-found": 404,
    "failed-precondition": 412,
    "resource-exhausted": 429,
    "permission-denied": 403,
    "unauthenticated": 401,
    "internal": 500
  };
  return m[code] || 500;
}

/**
 * QuickBooks invoice create/update path. Intuit OAuth is refreshed automatically from
 * Firestore admin/qb (no Intuit login per push). This function has no Firebase user check.
 */
async function runPushInvoiceToQBCore(projectId, docId, sendEmail) {
  const docRef = db.collection("boards").doc(projectId).collection("invoices").doc(docId);
  const snap = await docRef.get();
  if (!snap.exists) throw new functions.https.HttpsError("not-found", "Invoice not found");
  const invoice = snap.data();

  if (invoice.qbDocId) {
    if (invoice.qbPushPending) {
      await docRef.update({
        qbPushPending: false,
        qbPushSendEmail: admin.firestore.FieldValue.delete()
      }).catch(() => {});
    }
    return { success: true, message: "Already synced to QB", qbDocId: invoice.qbDocId };
  }

  const projSnap = await db.collection("boards").doc(projectId).get();
  const proj = projSnap.exists ? projSnap.data() : {};
  const clientName = proj.clientName || invoice.clientName || "";
  const clientEmail = proj.clientEmail || invoice.clientEmail || "";

  if (!clientName) {
    throw new functions.https.HttpsError("failed-precondition",
      "Client name is required. Set the client name on the project before pushing to QB.");
  }

  if (!invoice.items || invoice.items.length === 0) {
    throw new functions.https.HttpsError("failed-precondition",
      "Invoice has no line items. Add items before pushing to QB.");
  }

  const pushState = await beginQbDocumentPush(docRef);
  if (pushState.alreadySynced) {
    return { success: true, message: "Already synced to QB", qbDocId: pushState.qbDocId };
  }

  try {
    const { accessToken, realmId } = await getQBAccessToken();

    const customerId = await findOrCreateCustomer(accessToken, realmId, clientName, clientEmail);

    const QB_ITEMS = { product: "7718", designFee: "7719", shipping: "7720", tax: "7721", reimbursable: "7722", subcontractor: "7723", sample: "7724" };

    function qbInvoiceLineLabel(item) {
      const t = String((item && (item.title || item.name)) || "").trim();
      const low = t.toLowerCase();
      if (t && low !== "item" && low !== "general item" && low !== "general" && low !== "untitled") return t;
      const svc = String((item && (item.service || item.billingCategory)) || "").trim();
      if (svc) return svc;
      const d = String((item && item.description) || "").trim();
      if (d) {
        const beforeDash = (d.split(/\s[\u2014—]\s/)[0] || d.split(" - ")[0] || d).replace(/\s*\([^)]*\)\s*$/, "").trim();
        if (beforeDash) return beforeDash;
        const p = d.match(/^(.+?)\s*\(/);
        if (p && p[1]) return p[1].trim();
      }
      const cat = String((item && (item.category || item.type)) || "").trim();
      if (cat) return cat;
      return t || "service";
    }

    function pickItemRef(item) {
      const lineLabel = qbInvoiceLineLabel(item);
      const cat = (
        (item.category || item.type || item.itemType || "") +
        " " + lineLabel + " " + (item.description || "") +
        " " + (item.title || "") + " " + (item.name || "")
      ).toLowerCase();
      if (cat.includes("design") || cat.includes("fee") || cat.includes("labor") || cat.includes("time") ||
          cat.includes("project manag") || cat.includes("consult")) return { value: QB_ITEMS.designFee, name: "Studio Design Fee" };
      if (cat.includes("shipping") || cat.includes("freight") || cat.includes("delivery")) return { value: QB_ITEMS.shipping, name: "Studio Shipping" };
      if (cat.includes("tax")) return { value: QB_ITEMS.tax, name: "Studio Prepaid Tax" };
      if (cat.includes("sample")) return { value: QB_ITEMS.sample, name: "Studio Sample" };
      if (cat.includes("reimburse")) return { value: QB_ITEMS.reimbursable, name: "Studio Reimbursable" };
      if (cat.includes("sub") || cat.includes("contractor") || cat.includes("install")) return { value: QB_ITEMS.subcontractor, name: "Studio Subcontractor" };
      return { value: QB_ITEMS.product, name: "Studio Product" };
    }

    const lineItems = (invoice.items || []).map((item, idx) => {
      const qty = Math.max(parseFloat(item.qty || 1) || 1, 0.0001);
      const lineTotal = parseFloat(
        item.amount || item.clientPrice || item.lineTotal || item.total || item.totalSelling || 0
      ) || 0;
      const lineLabel = qbInvoiceLineLabel(item);
      let restDesc = String((item && item.description) || "").trim();
      if (restDesc && lineLabel && restDesc.toLowerCase().startsWith(lineLabel.toLowerCase())) {
        restDesc = restDesc.slice(lineLabel.length).replace(/^\s*\([^)]*\)\s*[\u2014—\-]\s*/, "").trim();
      }
      return {
        LineNum: idx + 1,
        Amount: lineTotal,
        Description: [
          lineLabel,
          restDesc && restDesc.toLowerCase() !== lineLabel.toLowerCase() ? restDesc : "",
          item.vendor ? "(" + item.vendor + ")" : "",
          item.room || item.category || ""
        ].filter(Boolean).join(" — "),
        DetailType: "SalesItemLineDetail",
        SalesItemLineDetail: {
          ItemRef: pickItemRef(item),
          Qty: qty,
          UnitPrice: lineTotal / qty
        }
      };
    });

    if (invoice.tax && parseFloat(invoice.tax) > 0) {
      lineItems.push({
        Amount: parseFloat(invoice.tax),
        Description: "Prepaid Sales Tax",
        DetailType: "SalesItemLineDetail",
        SalesItemLineDetail: {
          ItemRef: { value: QB_ITEMS.tax, name: "Studio Prepaid Tax" },
          Qty: 1,
          UnitPrice: parseFloat(invoice.tax)
        }
      });
    }

    if (invoice.shipping && parseFloat(invoice.shipping) > 0) {
      lineItems.push({
        Amount: parseFloat(invoice.shipping),
        Description: "Shipping & Handling",
        DetailType: "SalesItemLineDetail",
        SalesItemLineDetail: {
          ItemRef: { value: QB_ITEMS.shipping, name: "Studio Shipping" },
          Qty: 1,
          UnitPrice: parseFloat(invoice.shipping)
        }
      });
    }

    const dueDate = invoice.dueDate ||
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    const qbInvoice = {
      Line: lineItems,
      CustomerRef: { value: customerId },
      DocNumber: invoice.invoiceNum || invoice.number || docId.slice(0, 10),
      TxnDate: invoice.date || new Date().toISOString().split("T")[0],
      DueDate: dueDate,
      EmailStatus: sendEmail !== false ? "NeedToSend" : "NotSet",
      BillEmail: clientEmail ? { Address: clientEmail } : undefined,
      CustomerMemo: { value: "Thank you for your business — CCH Design" },
      PrivateNote: "Pushed from CCH Studio. Project: " + (proj.name || projectId)
    };

    const result = await qbApiCall("POST", "invoice", accessToken, realmId, qbInvoice);
    const qbId = result.Invoice.Id;

    await docRef.update({
      qbDocId: qbId,
      qbSyncDate: admin.firestore.FieldValue.serverTimestamp(),
      qbSynced: true,
      qbStatus: "sent",
      qbInvoiceNum: result.Invoice.DocNumber,
      qbPushPending: false,
      qbPushSendEmail: admin.firestore.FieldValue.delete(),
      qbPushLastError: admin.firestore.FieldValue.delete(),
      [QB_PUSH_LOCK_FIELD]: admin.firestore.FieldValue.delete()
    });

    return {
      success: true,
      qbDocId: qbId,
      qbInvoiceNum: result.Invoice.DocNumber,
      emailSent: sendEmail !== false && !!clientEmail
    };
  } catch (err) {
    await clearQbPushLock(docRef);
    throw err;
  }
}

// ─── FIND OR CREATE CUSTOMER ─────────────────────────────────────
async function findOrCreateCustomer(accessToken, realmId, clientName, clientEmail) {
  if (!clientName) throw new functions.https.HttpsError("invalid-argument", "Client name is required");

  const searchName = clientName.replace(/'/g, "\\'");
  const query = `select * from Customer where DisplayName = '${searchName}'`;
  const searchResult = await qbApiCall("GET",
    "query?query=" + encodeURIComponent(query), accessToken, realmId);

  if (searchResult.QueryResponse && searchResult.QueryResponse.Customer &&
      searchResult.QueryResponse.Customer.length > 0) {
    return searchResult.QueryResponse.Customer[0].Id;
  }

  // Not found — create new customer
  const newCustomer = {
    DisplayName: clientName,
    PrimaryEmailAddr: clientEmail ? { Address: clientEmail } : undefined
  };

  const created = await qbApiCall("POST", "customer", accessToken, realmId, newCustomer);
  return created.Customer.Id;
}

// ─── PUSH INVOICE → QB (callable: requires CCH Firebase sign-in on allow-list) ──
exports.pushInvoiceToQB = functions.https.onCall(
  { invoker: "public" },
  async (request) => {
  assertQbPushAllowed(request);

  const { projectId, docId, sendEmail } = request.data || {};
  if (!projectId || !docId) {
    throw new functions.https.HttpsError("invalid-argument", "projectId and docId required");
  }

  return runPushInvoiceToQBCore(projectId, docId, sendEmail !== false);
  }
);

/**
 * Same push as pushInvoiceToQB without Firebase user — for Zapier/n8n/cron.
 * Set QB_AUTOMATION_SECRET in Functions environment, redeploy, then:
 * POST .../pushInvoiceToQBAutomated
 * Header: Authorization: Bearer <QB_AUTOMATION_SECRET>
 * Body: { "projectId": "...", "docId": "...", "sendEmail": false }
 *
 * QuickBooks OAuth still uses admin/qb refresh token (fully automatic; no Intuit login per request).
 */
exports.pushInvoiceToQBAutomated = functions.https.onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(204).send("");
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const configured = process.env.QB_AUTOMATION_SECRET || "";
  if (!configured) {
    return res.status(503).json({
      error: "Automation not configured: add QB_AUTOMATION_SECRET to Firebase Functions env and redeploy."
    });
  }

  const hdr = req.get("authorization") || "";
  const bearer = hdr.startsWith("Bearer ") ? hdr.slice(7).trim() : "";
  const body = req.body || {};
  const bodySecret = body.secret ? String(body.secret) : "";
  if (bearer !== configured && bodySecret !== configured) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const projectId = body.projectId;
  const docId = body.docId;
  if (!projectId || !docId) {
    return res.status(400).json({ error: "projectId and docId required in JSON body" });
  }

  try {
    const out = await runPushInvoiceToQBCore(projectId, docId, body.sendEmail !== false);
    return res.json(out);
  } catch (e) {
    if (e instanceof functions.https.HttpsError) {
      return res.status(_httpsErrStatus(e.code)).json({ error: e.message, code: e.code });
    }
    console.error("[pushInvoiceToQBAutomated]", e);
    return res.status(500).json({ error: e.message || "Push failed" });
  }
});

/**
 * When an invoice is saved with qbPushPending: true, run the same QB push as the callable
 * (uses admin/qb token — no Intuit login). Clears the flag on success; on failure sets
 * qbPushLastError and clears pending so the user can fix and queue again.
 */
exports.processInvoiceQBPushPending = onDocumentWritten(
  {
    document: "boards/{projectId}/invoices/{invoiceId}",
    region: "us-central1"
  },
  async (event) => {
    const snap = event.data.after;
    if (!snap || !snap.exists) return;

    const data = snap.data();
    const { projectId, invoiceId } = event.params;

    if (!data.qbPushPending) return;
    if (data.qbDocId) {
      await snap.ref.update({ qbPushPending: false }).catch(() => {});
      return;
    }

    const sendEmail = data.qbPushSendEmail !== false;

    try {
      await runPushInvoiceToQBCore(projectId, invoiceId, sendEmail);
    } catch (e) {
      const msg =
        e instanceof functions.https.HttpsError
          ? e.message
          : (e && e.message) || String(e);
      console.error("[processInvoiceQBPushPending]", projectId, invoiceId, msg);
      await snap.ref
        .update({
          qbPushPending: false,
          qbPushLastError: msg,
          qbPushErrorAt: admin.firestore.FieldValue.serverTimestamp()
        })
        .catch(() => {});
    }
  }
);

// ─── PUSH PO → QB (as Purchase Order) ───────────────────────────
exports.pushPOToQB = functions.https.onCall(
  { invoker: "public" },
  async (request) => {
  assertQbPushAllowed(request);

  const { projectId, docId } = request.data || {};
  const docRef = db.collection("boards").doc(projectId).collection("purchaseOrders").doc(docId);
  const snap = await docRef.get();
  if (!snap.exists) throw new functions.https.HttpsError("not-found", "PO not found");
  const po = snap.data();

  if (po.qbDocId) {
    return { success: true, message: "Already synced", qbDocId: po.qbDocId };
  }

  // Validation: require vendor
  const vendorName = po.vendor || po.vendorName || "";
  if (!vendorName) {
    throw new functions.https.HttpsError("failed-precondition",
      "Vendor name is required. Set the vendor on this PO before pushing to QB.");
  }

  // Validation: require at least one line item
  if (!po.items || po.items.length === 0) {
    throw new functions.https.HttpsError("failed-precondition",
      "PO has no line items. Add items before pushing to QB.");
  }

  const pushState = await beginQbDocumentPush(docRef);
  if (pushState.alreadySynced) {
    return { success: true, message: "Already synced", qbDocId: pushState.qbDocId };
  }

  try {
  const { accessToken, realmId } = await getQBAccessToken();
  const searchName = vendorName.replace(/'/g, "\\'");
  const query = `select * from Vendor where DisplayName = '${searchName}'`;
  const searchResult = await qbApiCall("GET",
    "query?query=" + encodeURIComponent(query), accessToken, realmId);

  let vendorId;
  if (searchResult.QueryResponse && searchResult.QueryResponse.Vendor &&
      searchResult.QueryResponse.Vendor.length > 0) {
    vendorId = searchResult.QueryResponse.Vendor[0].Id;
  } else {
    const created = await qbApiCall("POST", "vendor", accessToken, realmId, { DisplayName: vendorName });
    vendorId = created.Vendor.Id;
  }

  // Studio QB Item IDs for PO expense mapping
  const QB_ITEMS_PO = { product: "7718", shipping: "7720", tax: "7721", sample: "7724", subcontractor: "7723" };

  function pickPOItemRef(item) {
    const cat = ((item.category || item.type || item.itemType || "").toLowerCase());
    if (cat.includes("shipping") || cat.includes("freight")) return { value: QB_ITEMS_PO.shipping, name: "Studio Shipping" };
    if (cat.includes("tax")) return { value: QB_ITEMS_PO.tax, name: "Studio Prepaid Tax" };
    if (cat.includes("sample")) return { value: QB_ITEMS_PO.sample, name: "Studio Sample" };
    if (cat.includes("sub") || cat.includes("contractor") || cat.includes("install")) return { value: QB_ITEMS_PO.subcontractor, name: "Studio Subcontractor" };
    return { value: QB_ITEMS_PO.product, name: "Studio Product" };
  }

  const lineItems = (po.items || []).map((item, idx) => {
    const qty = Math.max(parseFloat(item.qty || 1) || 1, 0.0001);
    const lineTotal = parseFloat(item.cost || item.amount || item.total || item.lineTotal || 0) || 0;
    return {
      LineNum: idx + 1,
      Amount: lineTotal,
      Description: [item.title || item.name || "Item", item.sku || ""].filter(Boolean).join(" — "),
      DetailType: "ItemBasedExpenseLineDetail",
      ItemBasedExpenseLineDetail: {
        ItemRef: pickPOItemRef(item),
        Qty: qty,
        UnitPrice: lineTotal / qty
      }
    };
  });

  // Add tax line if present
  if (po.tax && parseFloat(po.tax) > 0) {
    lineItems.push({
      Amount: parseFloat(po.tax),
      Description: "Sales Tax",
      DetailType: "ItemBasedExpenseLineDetail",
      ItemBasedExpenseLineDetail: {
        ItemRef: { value: QB_ITEMS_PO.tax, name: "Studio Prepaid Tax" },
        Qty: 1,
        UnitPrice: parseFloat(po.tax)
      }
    });
  }

  // Add shipping line if present
  if (po.shipping && parseFloat(po.shipping) > 0) {
    lineItems.push({
      Amount: parseFloat(po.shipping),
      Description: "Shipping & Freight",
      DetailType: "ItemBasedExpenseLineDetail",
      ItemBasedExpenseLineDetail: {
        ItemRef: { value: QB_ITEMS_PO.shipping, name: "Studio Shipping" },
        Qty: 1,
        UnitPrice: parseFloat(po.shipping)
      }
    });
  }

  const qbPO = {
    Line: lineItems,
    VendorRef: { value: vendorId },
    DocNumber: po.number || po.num || docId.slice(0, 10),
    TxnDate: po.date || new Date().toISOString().split("T")[0],
    PrivateNote: "CCH Studio. Project: " + projectId
  };

  const result = await qbApiCall("POST", "purchaseorder", accessToken, realmId, qbPO);
  const qbId = result.PurchaseOrder.Id;

  await docRef.update({
    qbDocId: qbId,
    qbSyncDate: admin.firestore.FieldValue.serverTimestamp(),
    qbSynced: true,
    qbStatus: "sent",
    [QB_PUSH_LOCK_FIELD]: admin.firestore.FieldValue.delete()
  });

  return { success: true, qbDocId: qbId };
  } catch (err) {
    await clearQbPushLock(docRef);
    throw err;
  }
  }
);

// ─── DELETE FROM QB (when deleted in Studio) ─────────────────────
exports.deleteFromQB = functions.https.onCall(
  { invoker: "public" },
  async (request) => {
  assertQbAdmin(request);

  const { qbDocId, docType } = request.data || {}; // docType: "invoice" or "purchaseorder"
  if (!qbDocId || !docType) {
    throw new functions.https.HttpsError("invalid-argument", "qbDocId and docType required");
  }

  const { accessToken, realmId } = await getQBAccessToken();

  // QB requires SyncToken for delete — fetch the entity first
  const entityType = docType === "invoice" ? "Invoice" : "PurchaseOrder";
  const endpoint = docType === "invoice" ? "invoice" : "purchaseorder";
  const fetched = await qbApiCall("GET", `${endpoint}/${qbDocId}`, accessToken, realmId);
  const entity = fetched[entityType];

  if (!entity) {
    throw new functions.https.HttpsError("not-found", "QB document not found: " + qbDocId);
  }

  // QB delete = POST with Id + SyncToken + operation=delete
  await qbApiCall("POST", `${endpoint}?operation=delete`, accessToken, realmId, {
    Id: qbDocId,
    SyncToken: entity.SyncToken
  });

  return { success: true, deleted: qbDocId };
  }
);

// ─── SETUP STUDIO ACCOUNTS IN QB ─────────────────────────────────
exports.qbSetupAccounts = functions.https.onCall(
  { invoker: "public" },
  async (request) => {
  assertQbAdmin(request);

  const { accessToken, realmId } = await getQBAccessToken();

  const accounts = [
    // Income accounts
    { Name: "R1 - Studio Product Sales", AccountType: "Income", AccountSubType: "SalesOfProductIncome" },
    { Name: "R2 - Studio Design Fees", AccountType: "Income", AccountSubType: "ServiceFeeIncome" },
    { Name: "R3 - Studio Shipping", AccountType: "Income", AccountSubType: "OtherPrimaryIncome" },
    { Name: "R4 - Studio Prepaid Tax", AccountType: "Income", AccountSubType: "OtherPrimaryIncome" },
    { Name: "R5 - Studio Reimbursable", AccountType: "Income", AccountSubType: "OtherPrimaryIncome" },
    // COGS accounts
    { Name: "C1 - Studio Product Cost", AccountType: "Cost of Goods Sold", AccountSubType: "SuppliesMaterialsCogs" },
    { Name: "C2 - Studio Freight/Shipping", AccountType: "Cost of Goods Sold", AccountSubType: "ShippingFreightDeliveryCos" },
    { Name: "C3 - Studio Sales Tax Paid", AccountType: "Cost of Goods Sold", AccountSubType: "OtherCostsOfServiceCos" },
    { Name: "C4 - Studio Subcontractors", AccountType: "Cost of Goods Sold", AccountSubType: "OtherCostsOfServiceCos" },
    { Name: "C5 - Studio Samples", AccountType: "Cost of Goods Sold", AccountSubType: "OtherCostsOfServiceCos" }
  ];

  const created = [];
  const skipped = [];

  for (const acct of accounts) {
    // Check if already exists
    const query = `select * from Account where Name = '${acct.Name.replace(/'/g, "\\'")}'`;
    const search = await qbApiCall("GET", "query?query=" + encodeURIComponent(query), accessToken, realmId);
    if (search.QueryResponse && search.QueryResponse.Account && search.QueryResponse.Account.length > 0) {
      skipped.push({ name: acct.Name, id: search.QueryResponse.Account[0].Id });
      continue;
    }

    const result = await qbApiCall("POST", "account", accessToken, realmId, acct);
    created.push({ name: acct.Name, id: result.Account.Id });
  }

  // Save account IDs to Firestore for use in push functions
  const accountMap = {};
  for (const a of [...created, ...skipped]) {
    const key = a.name.split(" - ")[0].trim(); // R1, R2, C1, etc.
    accountMap[key] = a.id;
  }
  await db.collection("admin").doc("qb").update({ accountMap });

  return { success: true, created, skipped, accountMap };
  }
);

// ─── QB WEBHOOK (receives payment notifications) ─────────────────
exports.qbWebhook = functions.https.onRequest(async (req, res) => {
  if (req.method !== "POST") { res.status(200).send("OK"); return; }

  const body = req.body;
  if (!body.eventNotifications) { res.status(200).send("OK"); return; }

  const { accessToken, realmId } = await getQBAccessToken();

  for (const notification of body.eventNotifications) {
    for (const entity of (notification.dataChangeEvent || {}).entities || []) {
      if (entity.name === "Payment" && entity.operation === "Create") {
        try {
          const payment = await qbApiCall("GET", "payment/" + entity.id, accessToken, realmId);
          const paymentData = payment.Payment;

          for (const line of (paymentData.Line || [])) {
            if (!line.LinkedTxn || !line.LinkedTxn.length) continue;
            const invLinks = line.LinkedTxn.filter((t) => t.TxnType === "Invoice");
            if (!invLinks.length) continue;
            // Each payment line applies `line.Amount` to linked invoice(s); do not use payment TotalAmt per invoice.
            const lineAmt = parseFloat(line.Amount);
            const perInvoice = invLinks.length === 1
              ? (Number.isFinite(lineAmt) ? lineAmt : parseFloat(paymentData.TotalAmt) || 0)
              : (Number.isFinite(lineAmt) ? lineAmt : 0) / invLinks.length;

            for (const txn of invLinks) {
              const invoiceQuery = await db.collectionGroup("invoices")
                .where("qbDocId", "==", String(txn.TxnId)).limit(1).get();

              if (!invoiceQuery.empty) {
                const invDoc = invoiceQuery.docs[0];
                const existing = invDoc.data();
                const payments = existing.payments || [];
                const dup = payments.some((p) =>
                  String(p.qbPaymentId) === String(entity.id) && String(p.qbInvoiceTxnId || "") === String(txn.TxnId)
                );
                if (dup) continue;

                payments.push({
                  amount: perInvoice,
                  date: paymentData.TxnDate,
                  method: paymentData.PaymentMethodRef ? paymentData.PaymentMethodRef.name : "QB Payment",
                  note: "Auto-synced from QuickBooks",
                  qbPaymentId: entity.id,
                  qbInvoiceTxnId: String(txn.TxnId)
                });

                const totalPaid = payments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
                const total = parseFloat(existing.total) || 0;
                const newStatus = totalPaid >= total ? "Paid" : "Partially Paid";
                const qbStatus = totalPaid >= total ? "paid" : "partial";

                await invDoc.ref.update({ payments, status: newStatus, qbStatus });
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

// ══════════════════════════════════════════════════════════
// SEARCH INDEX + FINANCIAL SUMMARY — Denormalized for speed
// ══════════════════════════════════════════════════════════

// Callable via button in platform or scheduled
exports.rebuildSearchIndex = functions.https.onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "https://cch-platform.web.app");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).send("");

  try {
    console.log("[SearchIndex] Starting rebuild...");
    const projSnap = await db.collection("projects").get();
    const projNames = {};
    const projClients = {};
    projSnap.forEach(d => {
      const data = d.data();
      projNames[d.id] = data.name || d.id;
      projClients[d.id] = data.clientName || "";
    });
    const projectIds = Object.keys(projNames);

    // Collect all docs
    let allItems = [];
    let stats = { projects: 0, invoices: 0, pos: 0, proposals: 0, products: 0 };

    // Projects
    projSnap.forEach(d => {
      const data = d.data();
      allItems.push({
        type: "project", id: d.id, projectId: d.id,
        title: data.name || d.id,
        subtitle: data.clientName || "",
        status: data.status || "",
        amount: parseFloat(data.designFee || data.fee || data.budget) || 0,
        vendor: "",
        number: "",
        search: [data.name, data.clientName, data.projectAddress, d.id].filter(Boolean).join(" ").toLowerCase()
      });
      stats.projects++;
    });

    // Invoices, Proposals, POs from each project
    for (const pid of projectIds) {
      const pName = projNames[pid];
      // Invoices
      try {
        const invSnap = await db.collection("boards").doc(pid).collection("invoices").get();
        invSnap.forEach(d => {
          const data = d.data();
          const num = data.invoiceNum || data.number || "";
          const total = parseFloat(data.total) || 0;
          const vendor = data.vendor || "";
          const client = data.clientName || projClients[pid] || "";
          allItems.push({
            type: "invoice", id: d.id, projectId: pid,
            title: num || d.id.slice(0, 8),
            subtitle: pName,
            status: data.status || "Draft",
            amount: total,
            vendor: vendor,
            client: client,
            number: num,
            date: data.date || data.createdAt || "",
            search: [num, pName, vendor, client, data.status, data.memo, String(total)].filter(Boolean).join(" ").toLowerCase()
          });
          stats.invoices++;
        });
      } catch (e) {}

      // Proposals
      try {
        const prSnap = await db.collection("boards").doc(pid).collection("proposals").get();
        prSnap.forEach(d => {
          const data = d.data();
          const num = data.proposalNum || data.name || data.number || "";
          const total = parseFloat(data.total) || 0;
          const itemTitles = (data.items || []).map(it => [it.title, it.vendor].filter(Boolean).join(" ")).join(" ");
          allItems.push({
            type: "proposal", id: d.id, projectId: pid,
            title: num || d.id.slice(0, 8),
            subtitle: pName,
            status: data.status || "Draft",
            amount: total,
            vendor: "",
            number: num,
            date: data.date || data.createdAt || "",
            search: [num, pName, data.status, itemTitles, String(total)].filter(Boolean).join(" ").toLowerCase()
          });
          stats.proposals++;
        });
      } catch (e) {}

      // POs
      try {
        const poSnap = await db.collection("boards").doc(pid).collection("purchaseOrders").get();
        poSnap.forEach(d => {
          const data = d.data();
          const num = data.number || data.num || data.poNum || "";
          const total = parseFloat(data.total) || 0;
          const vendor = data.vendor || "";
          allItems.push({
            type: "po", id: d.id, projectId: pid,
            title: num || d.id.slice(0, 8),
            subtitle: pName,
            status: data.status || "Draft",
            amount: total,
            vendor: vendor,
            number: num,
            date: data.date || data.orderDate || data.createdAt || "",
            search: [num, pName, vendor, data.status, data.eta, String(total)].filter(Boolean).join(" ").toLowerCase()
          });
          stats.pos++;
        });
      } catch (e) {}
    }

    // Products from master library
    try {
      const prodSnap = await db.collection("products").get();
      prodSnap.forEach(d => {
        const p = d.data();
        if (!p.title) return;
        const cost = parseFloat(p.cost || p.costPrice || p.unitCost) || 0;
        const sell = parseFloat(p.clientPrice || p.sellPrice || p.totalSelling) || 0;
        allItems.push({
          type: "product", id: d.id, projectId: "",
          title: p.title,
          subtitle: p.vendor || p.manufacturer || "",
          status: p.category || "",
          amount: sell || cost,
          vendor: p.vendor || p.manufacturer || "",
          number: p.sku || "",
          search: [p.title, p.vendor, p.manufacturer, p.category, p.sku, p.description, p.room, p.finish, p.dimensions, String(cost), String(sell)].filter(Boolean).join(" ").toLowerCase()
        });
        stats.products++;
      });
    } catch (e) {}

    // Write to _searchIndex in batches of 400
    // First, delete old index
    const oldSnap = await db.collection("_searchIndex").get();
    let delBatch = db.batch();
    let delCount = 0;
    for (const doc of oldSnap.docs) {
      delBatch.delete(doc.ref);
      delCount++;
      if (delCount % 400 === 0) { await delBatch.commit(); delBatch = db.batch(); }
    }
    if (delCount % 400 !== 0) await delBatch.commit();

    // Write new index
    let writeBatch = db.batch();
    let writeCount = 0;
    for (let i = 0; i < allItems.length; i++) {
      const item = allItems[i];
      const docRef = db.collection("_searchIndex").doc(item.type + "-" + item.id);
      writeBatch.set(docRef, item);
      writeCount++;
      if (writeCount % 400 === 0) { await writeBatch.commit(); writeBatch = db.batch(); }
    }
    if (writeCount % 400 !== 0) await writeBatch.commit();

    console.log("[SearchIndex] Done:", JSON.stringify(stats));
    return res.status(200).json({ status: "ok", total: allItems.length, stats, deletedOld: delCount });

  } catch (err) {
    console.error("[SearchIndex] Error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// Financial summary — one doc with all KPIs
exports.rebuildFinancialSummary = functions.https.onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "https://cch-platform.web.app");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).send("");

  try {
    console.log("[FinSummary] Starting rebuild...");
    const projSnap = await db.collection("projects").get();
    const projNames = {};
    projSnap.forEach(d => { projNames[d.id] = d.data().name || d.id; });

    let totalInvoiced = 0, totalPaid = 0, totalPOCost = 0;
    let openInvoiceCount = 0, openInvoiceAmount = 0;
    let openPOCount = 0, openPOAmount = 0;
    let invoiceCount = 0, poCount = 0, proposalCount = 0;
    const vendorSpend = {};
    const projectRevenue = {};

    for (const pid of Object.keys(projNames)) {
      const pName = projNames[pid];
      if (!projectRevenue[pName]) projectRevenue[pName] = { invoiced: 0, paid: 0, poCost: 0 };

      try {
        const invSnap = await db.collection("boards").doc(pid).collection("invoices").get();
        invSnap.forEach(d => {
          const data = d.data();
          const total = parseFloat(data.total) || 0;
          totalInvoiced += total;
          invoiceCount++;
          projectRevenue[pName].invoiced += total;
          const pmts = (data.payments || []).reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
          if (pmts > 0) { totalPaid += pmts; projectRevenue[pName].paid += pmts; }
          else if (data.status === "Paid") { totalPaid += total; projectRevenue[pName].paid += total; }
          if (data.status !== "Paid" && data.status !== "Draft" && data.status !== "Cancelled") {
            openInvoiceCount++;
            openInvoiceAmount += total - pmts;
          }
        });
      } catch (e) {}

      try {
        const poSnap = await db.collection("boards").doc(pid).collection("purchaseOrders").get();
        poSnap.forEach(d => {
          const data = d.data();
          const total = parseFloat(data.total) || 0;
          totalPOCost += total;
          poCount++;
          projectRevenue[pName].poCost += total;
          const vendor = data.vendor || "Unknown";
          if (!vendorSpend[vendor]) vendorSpend[vendor] = 0;
          vendorSpend[vendor] += total;
          if (!["Installed", "Received", "Cancelled", "Closed", "Paid"].includes(data.status)) {
            openPOCount++;
            openPOAmount += total;
          }
        });
      } catch (e) {}

      try {
        const prSnap = await db.collection("boards").doc(pid).collection("proposals").get();
        proposalCount += prSnap.size;
      } catch (e) {}
    }

    // Time entries summary
    let totalHours = 0, billableHours = 0, billableValue = 0;
    const memberHours = {};
    try {
      const teSnap = await db.collection("timeEntries").limit(15000).get();
      teSnap.forEach(d => {
        const e = d.data();
        const hrs = parseFloat(e.hours) || 0;
        totalHours += hrs;
        if (e.billable) { billableHours += hrs; billableValue += parseFloat(e.total) || 0; }
        const member = e.member || e.user || "Unknown";
        if (!memberHours[member]) memberHours[member] = { total: 0, billable: 0, value: 0 };
        memberHours[member].total += hrs;
        if (e.billable) { memberHours[member].billable += hrs; memberHours[member].value += parseFloat(e.total) || 0; }
      });
    } catch (e) {}

    // Top vendors by spend
    const topVendors = Object.entries(vendorSpend)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([name, amount]) => ({ name, amount }));

    const summary = {
      updatedAt: new Date().toISOString(),
      totalInvoiced, totalPaid,
      totalOutstanding: totalInvoiced - totalPaid,
      totalPOCost,
      openInvoiceCount, openInvoiceAmount,
      openPOCount, openPOAmount,
      invoiceCount, poCount, proposalCount,
      projectCount: Object.keys(projNames).length,
      totalHours: Math.round(totalHours * 10) / 10,
      billableHours: Math.round(billableHours * 10) / 10,
      billableValue: Math.round(billableValue * 100) / 100,
      topVendors,
      memberHours,
      projectRevenue
    };

    await db.collection("_cache").doc("financialSummary").set(summary);
    console.log("[FinSummary] Done:", invoiceCount, "invoices,", poCount, "POs");
    return res.status(200).json({ status: "ok", summary });

  } catch (err) {
    console.error("[FinSummary] Error:", err);
    return res.status(500).json({ error: err.message });
  }
});
