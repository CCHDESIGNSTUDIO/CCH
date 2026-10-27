#!/usr/bin/env node
'use strict';
const path = require('path');
const admin = require('firebase-admin');
const KEY = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
const db = admin.initializeApp({ credential: admin.credential.cert(require(KEY)) }, 'in10161pay').firestore();

function slimPay(p) {
  if (!p || typeof p !== 'object') return p;
  const o = {};
  Object.keys(p).forEach((k) => {
    const v = p[k];
    if (v && typeof v.toDate === 'function') o[k] = v.toDate().toISOString();
    else o[k] = v;
  });
  return o;
}

(async () => {
  const ref = db.collection('boards').doc('west-avalon').collection('invoices').doc('vEsvMohWndbv6HqXMd8a');
  const snap = await ref.get();
  if (!snap.exists) {
    console.log(JSON.stringify({ missing: true, path: ref.path }));
    return;
  }
  const x = snap.data() || {};
  const pays = Array.isArray(x.payments) ? x.payments : [];
  console.log(JSON.stringify({
    path: ref.path,
    invoiceNum: x.invoiceNum || x.number || '',
    status: x.status || '',
    total: x.total,
    paidAmount: x.paidAmount,
    paymentCount: x.paymentCount,
    datePaid: x.datePaid || '',
    qbPaymentDate: x.qbPaymentDate || '',
    qbDocId: x.qbDocId || x.qbInvoiceId || '',
    qbPaymentConfirmation: String(x.qbPaymentConfirmation || '').slice(0, 200),
    qbApiTotalAmt: x.qbApiTotalAmt,
    qbApiBalance: x.qbApiBalance,
    payments: pays.map(slimPay)
  }, null, 2));
})().catch((e) => { console.error(e); process.exit(1); });
