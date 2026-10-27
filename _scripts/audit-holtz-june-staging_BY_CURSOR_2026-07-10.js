'use strict';
const path = require('path');
const admin = require('firebase-admin');
const KEY = require(path.join(__dirname, '..', '_debug', 'service-account.json', 'cch-studio-staging-firebase-adminsdk-fbsvc-b93c6f1cf4.json'));
const db = admin.initializeApp({ credential: admin.credential.cert(KEY) }, 'stg').firestore();
const str = (v) => String(v == null ? '' : v).trim();
const n = (v) => parseFloat(v) || 0;
const r2 = (v) => Math.round(n(v) * 100) / 100;
function tracked(t) {
  if (t.trackedHrs != null && t.trackedHrs !== '') return n(t.trackedHrs);
  return Math.max(0, n(t.hours) - n(t.addedHrs));
}
(async () => {
  console.log('=== STAGING Holtz June 2026 ===');
  const rows = [];
  (await db.collection('timeEntries').get()).forEach((d) => {
    const t = d.data();
    if (!str(t.project || t.projectName).toLowerCase().includes('holtz')) return;
    if (!str(t.date).startsWith('2026-06')) return;
    if (t.billable === false) return;
    rows.push({ id: d.id, ...t });
  });
  let T = { tr: 0, ad: 0, bill: 0, amt: 0 };
  rows.forEach((t) => {
    T.tr += tracked(t); T.ad += n(t.addedHrs); T.bill += n(t.hours); T.amt += n(t.total);
    console.log(str(t.date).slice(0, 10), 'tr=' + r2(tracked(t)), '+hrs=' + r2(t.addedHrs), 'bill=' + r2(t.hours), '$' + r2(t.total), str(t.invoiceNumber || t.invoiceNum || '—'), str(t.service).slice(0, 24));
  });
  console.log('TOTAL', rows.length, 'rows | tracked', r2(T.tr), '+hrs', r2(T.ad), 'bill', r2(T.bill), '$' + r2(T.amt));
  const added = rows.filter((t) => n(t.addedHrs) > 0);
  if (added.length) {
    console.log('+Hrs rows:', added.length, 'total +hrs', r2(added.reduce((s, t) => s + n(t.addedHrs), 0)));
    console.log('+Hrs $', r2(added.reduce((s, t) => s + n(t.addedHrs) * (n(t.rate) || n(t.hourlyRate)), 0)));
  }
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
