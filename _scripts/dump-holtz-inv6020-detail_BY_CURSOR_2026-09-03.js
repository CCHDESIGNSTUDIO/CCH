#!/usr/bin/env node
'use strict';
const path = require('path');
const admin = require('firebase-admin');
const KEY = path.join(__dirname, '..', '_debug', 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
const db = admin.initializeApp({ credential: admin.credential.cert(require(KEY)) }, 'holtzDet').firestore();

function money(v) { return (Math.round((parseFloat(v) || 0) * 100) / 100).toFixed(2); }
function slimPay(p) {
  return {
    amount: money(p.amount),
    date: String(p.date || '').slice(0, 10),
    method: p.method || '',
    source: p.source || '',
    note: String(p.note || p.reference || '').slice(0, 80),
    qbPaymentId: p.qbPaymentId || ''
  };
}

(async () => {
  const snap = await db.collection('boards').doc('holtz-hill').collection('invoices').get();
  const want = ['INV-6020', 'INV-6035', 'INV-6048', 'INV-6011', 'INV-6074', 'INV-6057'];
  snap.forEach((d) => {
    const x = d.data() || {};
    const num = String(x.invoiceNum || x.number || d.id);
    if (!want.some((w) => num === w)) return;
    const pays = Array.isArray(x.payments) ? x.payments : [];
    const items = Array.isArray(x.items) ? x.items : [];
    console.log('\n====', num, d.id, '====');
    console.log(JSON.stringify({
      status: x.status,
      total: x.total,
      subtotal: x.subtotal,
      taxRate: x.taxRate,
      taxAmount: x.taxAmount,
      tax: x.tax,
      paidAmount: x.paidAmount,
      balance: x.balance,
      qbDocId: x.qbDocId,
      qbApiTotalAmt: x.qbApiTotalAmt,
      qbApiBalance: x.qbApiBalance,
      qbTotalMismatch: x.qbTotalMismatch,
      source: x.source,
      invoiceKind: x.invoiceKind,
      designServices: x.designServices,
      published: x.published,
      itemCount: items.length,
      payments: pays.map(slimPay)
    }, null, 2));
    items.slice(0, 8).forEach((it, i) => {
      console.log('  line', i, (it.title || it.name || '').slice(0, 50), 'amt=' + money(it.amount), 'et=' + (it.expenseType || ''), 'taxable=' + it.taxable);
    });
    if (items.length > 8) console.log('  …', items.length - 8, 'more lines');
  });
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
