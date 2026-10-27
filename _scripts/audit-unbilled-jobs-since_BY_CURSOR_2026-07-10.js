'use strict';
const path = require('path');
const admin = require('firebase-admin');
const KEY = require(path.join(__dirname, '..', '_debug', 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json'));
const db = admin.initializeApp({ credential: admin.credential.cert(KEY) }, 'u').firestore();
const str = (v) => String(v == null ? '' : v).trim();
const n = (v) => parseFloat(v) || 0;
const r2 = (v) => Math.round(n(v) * 100) / 100;
const NB = /\b(personal|pto|vacation|sick|holiday)\b/i;
const CCH = /^(cch|cbh)|^(internal|admin|overhead|marketing|business development)$/i;
function bill(t) {
  if (t.billable === false) return false;
  const p = str(t.project || t.projectName).toLowerCase();
  if (!p || NB.test(p) || CCH.test(p)) return false;
  return true;
}
function inv(t) {
  return !!(str(t.invoiceId) || str(t.invoiceNumber) || str(t.invoiceNum) || str(t.invoiceRef) || str(t.houzzInvoice));
}
(async () => {
  const since = process.argv[2] || '2025-01';
  const by = {};
  (await db.collection('timeEntries').get()).forEach((d) => {
    const t = d.data();
    if (!bill(t)) return;
    const h = n(t.hours);
    if (h <= 0) return;
    if (str(t.date).slice(0, 7) < since) return;
    const p = str(t.project || t.projectName) || '?';
    const o = by[p] = by[p] || { log: 0, log$: 0, inv: 0, inv$: 0, studio: 0, unb: 0, unb$: 0 };
    o.log += h;
    o.log$ += n(t.total);
    if (inv(t)) {
      o.inv += h;
      o.inv$ += n(t.total);
      if (str(t.invoiceId)) o.studio += h;
    } else {
      o.unb += h;
      o.unb$ += n(t.total);
    }
  });
  const rows = Object.entries(by)
    .map(([name, v]) => ({
      name, log: r2(v.log), log$: r2(v.log$), inv: r2(v.inv), inv$: r2(v.inv$),
      studio: r2(v.studio), unb: r2(v.unb), unb$: r2(v.unb$)
    }))
    .filter((r) => r.unb > 10)
    .sort((a, b) => b.unb$ - a.unb$);
  console.log('Since ' + since + ' — jobs with 10h+ UNBILLED billable:');
  rows.forEach((r) => console.log('  ' + r.name + ' | unb ' + r.unb + 'h $' + r.unb$ + ' | logged ' + r.log + 'h | studio-linked ' + r.studio + 'h'));
  console.log('count:', rows.length);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
