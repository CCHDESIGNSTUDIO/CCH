/**
 * PRODUCTION read-only: INV-6065 stored balance vs total.
 *   node _scripts\dump-inv-6065-balance_BY_CURSOR_2026-09-24.js
 */
'use strict';
const path = require('path');
const admin = require('firebase-admin');
const KEY = path.join(__dirname, '..', '_debug', 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
const app = admin.initializeApp({ credential: admin.credential.cert(require(KEY)) }, 'dump6065');
const db = app.firestore();

function money(n) {
  const x = parseFloat(n);
  return Number.isFinite(x) ? Math.round(x * 100) / 100 : null;
}

(async function main() {
  const col = db.collection('boards').doc('cloud-rolling-hills').collection('invoices');
  const all = await col.get();
  let snap = null;
  all.forEach(function (d) {
    const x = d.data() || {};
    const num = String(x.invoiceNum || x.number || '');
    if (num === 'INV-6065' || d.id === '657vSJIVEb3pSJtKIGW6') snap = d;
  });
  if (!snap) {
    console.log('missing');
    process.exit(1);
  }
  console.log('id', snap.id);
  const x = snap.data() || {};
  const pays = Array.isArray(x.payments) ? x.payments : [];
  const paidSum = pays.reduce(function (s, p) { return s + (parseFloat(p.amount) || 0); }, 0);
  console.log(JSON.stringify({
    invoiceNum: x.invoiceNum || x.number,
    status: x.status,
    published: x.published,
    total: money(x.total),
    amount: money(x.amount),
    balance: x.balance,
    qbApiBalance: x.qbApiBalance,
    qbApiTotalAmt: x.qbApiTotalAmt,
    paidAmount: money(x.paidAmount),
    taxAmount: money(x.taxAmount),
    taxRate: x.taxRate,
    paymentCount: pays.length,
    paidSum: money(paidSum),
    updatedAt: x.updatedAt || '',
    lastEditedAt: x.lastEditedAt || '',
    dueNowAmount: money(x.dueNowAmount),
    dueNowPercent: x.dueNowPercent,
    hasSquareLink: !!String(x.squareCheckoutUrl || '').trim(),
    squareCheckoutAmountCents: x.squareCheckoutAmountCents,
    squareFeeGrossed: x.squareFeeGrossed === true,
    squareLinkId: x.squarePaymentLinkId || x.squareLinkId || '',
    qbDocId: x.qbDocId || ''
  }, null, 2));
  process.exit(0);
})().catch(function (e) {
  console.error(e.message || e);
  process.exit(1);
});
