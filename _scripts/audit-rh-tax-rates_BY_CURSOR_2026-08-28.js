/**
 * PRODUCTION read-only: Rolling Hills project + invoice/proposal taxRate.
 *   node _scripts\audit-rh-tax-rates_BY_CURSOR_2026-08-28.js
 */
'use strict';
const path = require('path');
const admin = require('firebase-admin');
const KEY = path.join(__dirname, '..', '_debug', 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
const app = admin.initializeApp({ credential: admin.credential.cert(require(KEY)) }, 'auditRhTax');
const db = app.firestore();
const BOARD = 'cloud-rolling-hills';

function rateOf(d) {
  const r = parseFloat(d && d.taxRate);
  return Number.isFinite(r) ? r : null;
}

(async function main() {
  const board = await db.collection('boards').doc(BOARD).get();
  if (!board.exists) throw new Error('board missing');
  const b = board.data() || {};
  console.log('PROJECT', BOARD);
  console.log('  name', b.name);
  console.log('  taxRate', JSON.stringify(b.taxRate), 'preset', JSON.stringify(b.taxRatePreset), 'updated', b.taxRateUpdatedAt || b.updatedAt);
  console.log('  city/zip', b.projectCity || b.clientCity, b.projectZip || b.clientZip);

  const rates = await db.collection('settings').doc('serviceRates').get();
  console.log('COMPANY serviceRates.defaultTaxRate', rates.exists ? JSON.stringify(rates.data().defaultTaxRate) : 'missing');

  async function dumpCol(name) {
    const snap = await db.collection('boards').doc(BOARD).collection(name).get();
    const rows = [];
    snap.forEach(function (d) {
      const x = d.data() || {};
      const num = x.invoiceNum || x.number || x.proposalNum || x.name || d.id;
      rows.push({
        id: d.id,
        num: num,
        status: x.status || '',
        taxRate: rateOf(x),
        qbDocId: x.qbDocId || x.qbId || '',
        published: !!x.published,
        sent: !!(x.sentAt || x.emailedAt || x.clientEmailedAt),
        createdAt: String(x.createdAt && x.createdAt.toDate ? x.createdAt.toDate().toISOString() : (x.createdAt || '')).slice(0, 10),
        fromProp: !!x._fromProposal
      });
    });
    rows.sort(function (a, b) { return String(a.num).localeCompare(String(b.num), undefined, { numeric: true }); });
    const byRate = {};
    rows.forEach(function (r) {
      const k = r.taxRate == null ? 'null' : String(r.taxRate);
      byRate[k] = (byRate[k] || 0) + 1;
    });
    console.log('\n' + name.toUpperCase(), 'count', rows.length, 'by taxRate', JSON.stringify(byRate));
    rows.forEach(function (r) {
      console.log([r.num, 'rate=' + r.taxRate, r.status, r.qbDocId ? 'qb=' + r.qbDocId : 'no-qb', r.published ? 'published' : '', r.sent ? 'sent' : '', r.fromProp ? 'from-proposal' : '', r.createdAt.slice(0, 10)].filter(Boolean).join(' | '));
    });
  }

  await dumpCol('invoices');
  await dumpCol('proposals');
  process.exit(0);
})().catch(function (e) {
  console.error(e);
  process.exit(1);
});
