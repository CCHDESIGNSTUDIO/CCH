'use strict';
const path = require('path');
const admin = require('firebase-admin');
const KEY = require(path.join(__dirname, '..', '_debug', 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json'));
const db = admin.initializeApp({ credential: admin.credential.cert(KEY) }, 'tr').firestore();
const str = (v) => String(v == null ? '' : v).trim();
const n = (v) => parseFloat(v) || 0;
const r2 = (v) => Math.round(n(v) * 100) / 100;
function tracked(t) {
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
  console.log('June Holtz — trackedHrs vs hours vs addedHrs');
  rows.forEach((t) => {
    console.log(
      str(t.date).slice(0, 10),
      'hours=' + n(t.hours),
      'trackedHrs=' + (t.trackedHrs != null ? n(t.trackedHrs) : '(null)'),
      'addedHrs=' + n(t.addedHrs),
      'computedTracked=' + tracked(t),
      'delta=' + r2(n(t.hours) - tracked(t)),
      str(t.invoiceNumber || t.invoiceNum || '')
    );
  });
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
