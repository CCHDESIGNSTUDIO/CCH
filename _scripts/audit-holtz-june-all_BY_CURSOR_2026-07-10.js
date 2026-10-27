'use strict';
const path = require('path');
const admin = require('firebase-admin');
const KEY = require(path.join(__dirname, '..', '_debug', 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json'));
const db = admin.initializeApp({ credential: admin.credential.cert(KEY) }, 'a').firestore();
const str = (v) => String(v == null ? '' : v).trim();
const n = (v) => parseFloat(v) || 0;
const r2 = (v) => Math.round(n(v) * 100) / 100;
function tr(t) {
  if (t.trackedHrs != null && t.trackedHrs !== '') return n(t.trackedHrs);
  return Math.max(0, n(t.hours) - n(t.addedHrs));
}
(async () => {
  const rows = [];
  (await db.collection('timeEntries').get()).forEach((d) => {
    const t = d.data();
    if (!str(t.project || t.projectName).toLowerCase().includes('holtz')) return;
    if (!str(t.date).startsWith('2026-06')) return;
    rows.push({ id: d.id, ...t });
  });
  const bill = rows.filter((t) => t.billable !== false);
  let T = { tr: 0, ad: 0, bill: 0, amt: 0 };
  bill.forEach((t) => { T.tr += tr(t); T.ad += n(t.addedHrs); T.bill += n(t.hours); T.amt += n(t.total); });
  console.log('All Holtz June entries:', rows.length, '| billable:', bill.length);
  console.log('Totals: tracked', r2(T.tr), '+hrs', r2(T.ad), 'bill', r2(T.bill), 'amt', r2(T.amt));
  const byInv = {};
  bill.forEach((t) => {
    const k = str(t.invoiceNumber || t.invoiceNum) || (str(t.invoiceId) ? 'studio-id' : 'no-studio-link');
    if (!byInv[k]) byInv[k] = { h: 0, amt: 0, ad: 0, n: 0 };
    byInv[k].h += n(t.hours);
    byInv[k].amt += n(t.total);
    byInv[k].ad += n(t.addedHrs);
    byInv[k].n++;
  });
  console.log('By ref:');
  Object.keys(byInv).sort().forEach((k) => console.log(' ', k, r2(byInv[k].h) + 'h +hrs' + r2(byInv[k].ad), '$' + r2(byInv[k].amt), byInv[k].n + ' rows'));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
