/**
 * PRODUCTION read-only: INV-6064 tax / totals / QB.
 *   node _scripts\dump-inv-6064-tax_BY_CURSOR_2026-08-28.js
 */
'use strict';
const path = require('path');
const admin = require('firebase-admin');
const KEY = path.join(__dirname, '..', '_debug', 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
const app = admin.initializeApp({ credential: admin.credential.cert(require(KEY)) }, 'dump6064');
const db = app.firestore();
const BOARD = 'cloud-rolling-hills';

function money(n) {
  return (Math.round((parseFloat(n) || 0) * 100) / 100).toFixed(2);
}

(async function main() {
  const snap = await db.collection('boards').doc(BOARD).collection('invoices').get();
  let found = null;
  snap.forEach(function (d) {
    const x = d.data() || {};
    const num = String(x.invoiceNum || x.number || d.id);
    if (num === 'INV-6064' || num === 'INV6064' || d.id === 'INV-6064') found = { id: d.id, x: x };
  });
  if (!found) {
    console.log('INV-6064 not found');
    process.exit(1);
  }
  const x = found.x;
  const items = Array.isArray(x.items) ? x.items : [];
  console.log('KEYS tax-ish', {
    taxRate: x.taxRate,
    tax: x.tax,
    taxAmount: x.taxAmount,
    subtotal: x.subtotal,
    total: x.total,
    shipping: x.shipping || x.docShipping,
    qbDocId: x.qbDocId,
    qbApiTotalAmt: x.qbApiTotalAmt,
    qbApiBalance: x.qbApiBalance,
    linkedProposalId: x.linkedProposalId,
    linkedProposalNum: x.linkedProposalNum
  });
  items.forEach(function (it, i) {
    if (!it) return;
    console.log([
      i,
      String(it.title || it.description || '').slice(0, 46),
      'qty=' + it.qty,
      'cost=' + it.cost,
      'mk=' + it.markupPct,
      'amt=' + it.amount,
      'taxable=' + JSON.stringify(it.taxable),
      'et=' + (it.expenseType || '')
    ].join(' | '));
  });
  console.log('qb', {
    qbDocId: x.qbDocId,
    qbId: x.qbId,
    qbSynced: x.qbSynced,
    qbStatus: x.qbStatus,
    qbSyncDate: x.qbSyncDate,
    published: x.published,
    status: x.status,
    taxRate: x.taxRate,
    taxAmount: x.taxAmount,
    tax: x.tax,
    total: x.total
  });
  process.exit(0);
})().catch(function (e) {
  console.error(e);
  process.exit(1);
});
