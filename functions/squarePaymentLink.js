/**
 * Square Payment Link for Studio invoices — hosted checkout (card / Square methods).
 * No card fields in Studio. Staging uses Square Sandbox.
 */
const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const fetch = require("node-fetch");

const SQUARE_ACCESS_TOKEN = defineSecret("SQUARE_ACCESS_TOKEN");
const REGION = "us-central1";
/** Client-facing card fee: 3% (matches Pay page / email copy). No fixed 30¢ — that made $1 invoices ~$1.34. */
const SQUARE_CARD_FEE_RATE = 0.03;

function squareGrossChargeCents(netCents) {
  const net = Math.round(Number(netCents) || 0);
  if (net < 1) return 0;
  /* Gross so Studio nets the invoice due after ~3% Square fee. Ceil to cents (e.g. $1.00 → $1.04). */
  return Math.ceil(net / (1 - SQUARE_CARD_FEE_RATE));
}

function squareEnvName() {
  const explicit = String(process.env.SQUARE_ENVIRONMENT || "").toLowerCase();
  if (explicit === "production" || explicit === "sandbox") return explicit;
  const project = String(process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || "").trim();
  return project === "cch-design-boards" ? "production" : "sandbox";
}

function squareApiBase() {
  return squareEnvName() === "production"
    ? "https://connect.squareup.com"
    : "https://connect.squareupsandbox.com";
}

function moneyCents(v) {
  if (v == null || v === "") return 0;
  if (typeof v === "number" && isFinite(v)) return Math.round(v * 100);
  const n = parseFloat(String(v).replace(/[^0-9.-]/g, ""));
  return isFinite(n) ? Math.round(n * 100) : 0;
}

async function squareFetch(path, token, opts) {
  opts = opts || {};
  const clean = String(token || "").replace(/[\r\n\t ]+/g, "").trim();
  if (!clean) {
    throw new HttpsError("failed-precondition", "Square token is empty.");
  }
  const res = await fetch(squareApiBase() + path, {
    method: opts.method || "GET",
    headers: {
      Authorization: "Bearer " + clean,
      "Content-Type": "application/json",
      "Square-Version": "2025-01-23"
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      (json.errors && json.errors[0] && json.errors[0].detail) ||
      json.message ||
      ("Square HTTP " + res.status);
    throw new HttpsError("failed-precondition", msg);
  }
  return json;
}

async function firstActiveLocationId(token) {
  const data = await squareFetch("/v2/locations", token);
  const locs = Array.isArray(data.locations) ? data.locations : [];
  const active = locs.find((l) => String(l.status || "").toUpperCase() === "ACTIVE") || locs[0];
  if (!active || !active.id) {
    throw new HttpsError("failed-precondition", "No Square location found. Open Square Dashboard once, then retry.");
  }
  return active.id;
}

exports.createSquarePaymentLink = onCall(
  {
    region: REGION,
    invoker: "public",
    secrets: [SQUARE_ACCESS_TOKEN],
    timeoutSeconds: 60
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Sign in to CCH Studio first.");
    }
    const email = String((request.auth.token && request.auth.token.email) || "").toLowerCase();
    if (email.indexOf("@cchdesign.com") < 0 && email !== "cynthiacbh@gmail.com") {
      throw new HttpsError("permission-denied", "Square pay links are for CCH staff only.");
    }

    const { projectId, invoiceId } = request.data || {};
    if (!projectId || !invoiceId) {
      throw new HttpsError("invalid-argument", "projectId and invoiceId required");
    }

    const token = String(SQUARE_ACCESS_TOKEN.value() || "").replace(/[\r\n\t ]+/g, "").trim();
    if (!token) {
      throw new HttpsError(
        "failed-precondition",
        "SQUARE_ACCESS_TOKEN is not set. Add square-pat.env and firebase functions:secrets:set on staging."
      );
    }

    try {
    const db = admin.firestore();
    const ref = db.collection("boards").doc(projectId).collection("invoices").doc(invoiceId);
    const snap = await ref.get();
    if (!snap.exists) throw new HttpsError("not-found", "Invoice not found");
    const inv = snap.data() || {};

    const total = moneyCents(inv.total);
    const paid = moneyCents(inv.paidAmount);
    let due = total - paid;
    if (String(inv.status || "").toLowerCase() === "paid") due = 0;
    if (due < 1) {
      throw new HttpsError("failed-precondition", "Invoice has no open balance to collect.");
    }

    const charge = squareGrossChargeCents(due);
    const existing = String(inv.squareCheckoutUrl || "").trim();
    if (existing && inv.squareFeeGrossed && Number(inv.squareCheckoutAmountCents) === charge) {
      return { success: true, url: existing, reused: true, chargeCents: charge, dueCents: due };
    }

    const locationId = await firstActiveLocationId(token);
    const num = String(inv.invoiceNum || inv.number || invoiceId).trim();
    const name = ("CCH Design · " + num).slice(0, 80);
    const idempotencyKey = [projectId, invoiceId, String(charge), Date.now()].join("-").slice(0, 45);

    const created = await squareFetch("/v2/online-checkout/payment-links", token, {
      method: "POST",
      body: {
        idempotency_key: idempotencyKey,
        quick_pay: {
          name: name,
          price_money: { amount: charge, currency: "USD" },
          location_id: locationId
        }
      }
    });

    const link = created.payment_link || {};
    const url = String(link.url || "").trim();
    if (!url) {
      throw new HttpsError("failed-precondition", "Square did not return a checkout URL.");
    }

    const orderId = String(link.order_id || "").trim();
    await ref.update({
      squareCheckoutUrl: url,
      squarePaymentLinkId: link.id || "",
      squareOrderId: orderId,
      squareCheckoutAmountCents: charge,
      squareInvoiceDueCents: due,
      squareFeeGrossed: true,
      squareCheckoutCreatedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    if (orderId) {
      await db.collection("squareCheckouts").doc(orderId).set({
        projectId: projectId,
        invoiceId: invoiceId,
        paymentLinkId: link.id || "",
        createdAt: new Date().toISOString()
      });
    }

    return { success: true, url: url, reused: false };
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      const raw = err && err.message ? String(err.message) : "Square request failed";
      const safe = raw.indexOf("Bearer ") >= 0
        ? "Square token had a line break. Retry now — the function trims it."
        : raw.slice(0, 300);
      throw new HttpsError("failed-precondition", safe);
    }
  }
);

function squareToken() {
  return String(SQUARE_ACCESS_TOKEN.value() || "").replace(/[\r\n\t ]+/g, "").trim();
}

function titleCaseWords(s) {
  return String(s || "")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, function (c) { return c.toUpperCase(); })
    .trim();
}

function squareHowPaidLabel(payment) {
  payment = payment || {};
  const src = String(payment.source_type || "").toUpperCase();
  const card = (payment.card_details && payment.card_details.card) || {};
  const brand = titleCaseWords(card.card_brand || "");
  const last4 = String(card.last_4 || "").trim();
  if (src === "CARD" || brand || last4) {
    const b = brand || "Card";
    return last4 ? ("Square · " + b + " \u2022\u2022\u2022\u2022 " + last4) : ("Square · " + b);
  }
  if (src === "WALLET") {
    const wb = titleCaseWords((payment.wallet_details && payment.wallet_details.brand) || "Wallet");
    return "Square · " + (wb || "Wallet");
  }
  if (src === "BANK_ACCOUNT") {
    const ach = (payment.bank_account_details && payment.bank_account_details.ach_details) || {};
    const suf = String(ach.account_number_suffix || "").trim();
    return suf ? ("Square · Bank \u2022\u2022\u2022\u2022 " + suf) : "Square · Bank";
  }
  if (src === "BUY_NOW_PAY_LATER") {
    const b = titleCaseWords((payment.buy_now_pay_later_details && payment.buy_now_pay_later_details.brand) || "Pay later");
    return "Square · " + b;
  }
  if (src === "CASH") return "Square · Cash";
  if (src) return "Square · " + titleCaseWords(src);
  return "Square";
}

function applySquarePaymentPatch(inv, payment) {
  const payId = String(payment.id || "").trim();
  const cents = payment.amount_money && payment.amount_money.amount;
  const rawAmount = Math.round((Number(cents) || 0)) / 100;
  const how = squareHowPaidLabel(payment);
  const payments = Array.isArray(inv.payments) ? inv.payments.slice() : [];
  const alreadyPaid = payments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
  const invTotal = parseFloat(inv.total || inv.amount) || 0;
  const remaining = Math.round(Math.max(0, invTotal - alreadyPaid) * 100) / 100;
  const amount = remaining > 0.01 ? Math.min(rawAmount, remaining) : rawAmount;
  const existingIdx = payId ? payments.findIndex((p) => String(p.squarePaymentId || "") === payId) : -1;
  if (existingIdx >= 0) {
    const cur = payments[existingIdx] || {};
    if (String(cur.method || "") === how && String(cur.note || "") === how) {
      return { already: true };
    }
    payments[existingIdx] = Object.assign({}, cur, { method: how, note: how });
    return {
      already: true,
      enriched: true,
      patch: { payments: payments, updatedAt: new Date().toISOString() }
    };
  }
  payments.push({
    id: "pay_square_" + (payId || Date.now()),
    amount: amount,
    date: String(payment.created_at || "").slice(0, 10) || new Date().toISOString().slice(0, 10),
    method: how,
    note: how + (rawAmount > amount + 0.01 ? " · card processing included" : ""),
    squarePaymentId: payId,
    recordedAt: new Date().toISOString()
  });
  const total = parseFloat(inv.total || inv.amount) || 0;
  const totalPaid = Math.round(payments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0) * 100) / 100;
  const status = total > 0.01 && totalPaid >= total - 0.02 ? "Paid" : "Partially Paid";
  const patch = {
    payments: payments,
    status: status,
    paidAmount: status === "Paid" && total > 0.01 ? total : totalPaid,
    paymentCount: payments.length,
    balance: Math.max(0, Math.round((total - totalPaid) * 100) / 100),
    updatedAt: new Date().toISOString()
  };
  if (status === "Paid" && !inv.datePaid) {
    patch.datePaid = patch.payments[patch.payments.length - 1].date;
    patch.paidAt = new Date().toISOString();
  }
  return { already: false, patch: patch, status: status, amount: amount };
}

async function findCompletedSquarePayment(token, inv) {
  let orderId = String(inv.squareOrderId || "").trim();
  const linkId = String(inv.squarePaymentLinkId || "").trim();
  if (!orderId && linkId) {
    const pl = await squareFetch("/v2/online-checkout/payment-links/" + encodeURIComponent(linkId), token);
    orderId = String((pl.payment_link && pl.payment_link.order_id) || "").trim();
  }
  if (!orderId) return null;
  const od = await squareFetch("/v2/orders/" + encodeURIComponent(orderId), token);
  const tenders = ((od.order || {}).tenders) || [];
  for (let i = 0; i < tenders.length; i++) {
    const pid = String(tenders[i].payment_id || tenders[i].id || "").trim();
    if (!pid) continue;
    const pr = await squareFetch("/v2/payments/" + encodeURIComponent(pid), token);
    const pay = pr.payment || {};
    if (String(pay.status || "").toUpperCase() === "COMPLETED") return pay;
  }
  return null;
}

async function markInvoicePaidFromSquare(ref, inv, payment) {
  const applied = applySquarePaymentPatch(inv, payment);
  if (applied.already && applied.enriched && applied.patch) {
    await ref.update(applied.patch);
    return { markedPaid: false, already: true, enriched: true, status: inv.status || "" };
  }
  if (applied.already) return { markedPaid: false, already: true, status: inv.status || "" };
  await ref.update(applied.patch);
  return { markedPaid: true, already: false, status: applied.status, amount: applied.amount };
}

exports.checkSquarePayment = onCall(
  {
    region: REGION,
    invoker: "public",
    secrets: [SQUARE_ACCESS_TOKEN],
    timeoutSeconds: 60
  },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Sign in to CCH Studio first.");
    const { projectId, invoiceId } = request.data || {};
    if (!projectId || !invoiceId) throw new HttpsError("invalid-argument", "projectId and invoiceId required");
    const token = squareToken();
    if (!token) throw new HttpsError("failed-precondition", "SQUARE_ACCESS_TOKEN is not set.");
    const db = admin.firestore();
    const ref = db.collection("boards").doc(projectId).collection("invoices").doc(invoiceId);
    const snap = await ref.get();
    if (!snap.exists) throw new HttpsError("not-found", "Invoice not found");
    const inv = snap.data() || {};
    if (!String(inv.squareCheckoutUrl || inv.squarePaymentLinkId || "").trim()) {
      return { markedPaid: false, skipped: true };
    }
    try {
      const pay = await findCompletedSquarePayment(token, inv);
      if (!pay) return { markedPaid: false, pending: true };
      return await markInvoicePaidFromSquare(ref, inv, pay);
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      throw new HttpsError("failed-precondition", String((err && err.message) || err).slice(0, 300));
    }
  }
);

exports.squarePaymentWebhook = onRequest(
  {
    region: REGION,
    invoker: "public",
    secrets: [SQUARE_ACCESS_TOKEN],
    timeoutSeconds: 60
  },
  async (req, res) => {
    if (req.method === "GET") {
      res.status(200).send("ok");
      return;
    }
    if (req.method !== "POST") {
      res.status(405).send("method");
      return;
    }
    try {
      const token = squareToken();
      if (!token) {
        res.status(500).json({ error: "no token" });
        return;
      }
      const body = req.body || {};
      const obj = (body.data && body.data.object) || {};
      let payment = obj.payment || null;
      const paymentId = String((payment && payment.id) || body.entity_id || "").trim();
      if (paymentId) {
        const pr = await squareFetch("/v2/payments/" + encodeURIComponent(paymentId), token);
        payment = pr.payment || payment;
      }
      if (!payment || String(payment.status || "").toUpperCase() !== "COMPLETED") {
        res.status(200).json({ ok: true, ignored: true });
        return;
      }
      const orderId = String(payment.order_id || "").trim();
      const db = admin.firestore();
      let projectId = "";
      let invoiceId = "";
      if (orderId) {
        const look = await db.collection("squareCheckouts").doc(orderId).get();
        if (look.exists) {
          const row = look.data() || {};
          projectId = String(row.projectId || "");
          invoiceId = String(row.invoiceId || "");
        }
      }
      if (!projectId || !invoiceId) {
        res.status(200).json({ ok: true, unmatched: true });
        return;
      }
      const ref = db.collection("boards").doc(projectId).collection("invoices").doc(invoiceId);
      const snap = await ref.get();
      if (!snap.exists) {
        res.status(200).json({ ok: true, missing: true });
        return;
      }
      await markInvoicePaidFromSquare(ref, snap.data() || {}, payment);
      res.status(200).json({ ok: true, marked: true });
    } catch (err) {
      console.error("[squarePaymentWebhook]", err && err.message ? err.message : err);
      res.status(500).json({ error: "failed" });
    }
  }
);
