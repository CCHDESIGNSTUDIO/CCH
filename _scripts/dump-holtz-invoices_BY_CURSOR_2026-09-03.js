#!/usr/bin/env node
'use strict';
const path = require('path');
const admin = require('firebase-admin');
const KEY = path.join(__dirname, '..', '_debug', 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
const db = admin.initializeApp({ credential: admin.credential.cert(require(KEY)) }, 'holtzInv').firestore();
function money(v) { return (Math.round((parseFloat(v) || 0) * 100) / 100).toFixed(2); }
function iso(v) {
  if (!v) return '';
  if (typeof v.toDate === 'function') return v.toDate().toISOString();
  return String(v);
}
(async () => {
  const snap = await db.collection('boards').doc('holtz-hill').collection('invoices').get();
  const rows = [];
  snap.forEach((d) => {
    const x = d.data() || {};
    const pays = Array.isArray(x.payments) ? x.payments : [];
    const paySum = pays.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
    rows.push({
      id: d.id,
      num: x.invoiceNum || x.number || d.id,
      status: x.status || '',
      published: !!x.published,
      total: money(x.total),
      tax: money(x.taxAmount || x.tax),
      taxRate: x.taxRate,
      paidAmount: money(x.paidAmount),
      balance: money(x.balance),
      paySum: money(paySum),
      payN: pays.length,
      qbDocId: String(x.qbDocId || x.qbId || '').slice(0, 12),
      qbApiTotal: money(x.qbApiTotalAmt),
      qbApiBal: x.qbApiBalance == null ? '' : money(x.qbApiBalance),
      ds: !!(x.designServices || x.isDesignServices || x.invoiceKind === 'design-services'),
      kind: x.invoiceKind || x.kind || x.source || '',
      updated: iso(x.updatedAt).slice(0, 10)
    });
  });
  rows.sort((a, b) => String(a.num).localeCompare(String(b.num)));
  rows.forEach((r) => {
    console.log([
      String(r.num).padEnd(14),
      String(r.status).padEnd(16),
      '$' + r.total,
      'tax=' + r.tax,
      'paid=' + r.paidAmount,
      'bal=' + r.balance,
      'pays=' + r.payN + '/' + r.paySum,
      'qbTot=' + r.qbApiTotal,
      'qbBal=' + r.qbApiBal,
      r.kind,
      r.ds ? 'DS' : ''
    ].join(' | '));
  });
  const target = rows.filter((r) => String(r.num).includes('6020') || String(r.num).toUpperCase().includes('INV-6020'));
  console.log('--- 6020 ---');
  console.log(JSON.stringify(target, null, 2));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
