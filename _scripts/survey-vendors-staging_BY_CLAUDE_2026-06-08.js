'use strict';
/** READ-ONLY: survey STAGING products/ by vendor — rows, unique houzzIds, duplicate count,
 *  and how many rows have a valid Firebase hero already. Helps pick a good test vendor
 *  (has dups to dedup + houzz galleries). ZERO writes. */
const admin = require('firebase-admin');
const path = require('path');
const stgKey = require(path.join(__dirname, '..', '_debug', 'service-account.json', 'cch-studio-staging-firebase-adminsdk-fbsvc-b93c6f1cf4.json'));
const db = admin.initializeApp({ credential: admin.credential.cert(stgKey) }, 'stg').firestore();
const str = (v) => String(v == null ? '' : v).trim();
const hz = (o) => str(o && (o.houzzId || o.houzzProductId || o.catalogId));
const isFb = (u) => /firebasestorage\.googleapis|\.firebasestorage\.app/i.test(str(u));

(async () => {
  const snap = await db.collection('products').get();
  const byV = {};
  snap.forEach((d) => {
    const p = d.data() || {}; const v = str(p.vendor) || '(blank)';
    if (!byV[v]) byV[v] = { rows: 0, houzz: new Set(), withHouzz: 0, fbHero: 0 };
    const b = byV[v]; b.rows++;
    const h = hz(p); if (h) { b.houzz.add(h); b.withHouzz++; }
    if (isFb(p.imageUrl || p.image)) b.fbHero++;
  });
  const rows = Object.entries(byV).map(([v, b]) => ({ vendor: v, rows: b.rows, uniqueHouzz: b.houzz.size, dupRows: b.withHouzz - b.houzz.size, fbHero: b.fbHero }))
    .filter((r) => r.dupRows > 0 && r.vendor !== 'Somerset Bay')
    .sort((a, b) => b.dupRows - a.dupRows);
  console.log('Top non-Somerset vendors WITH duplicate houzz rows (staging products/):\n');
  console.log('vendor'.padEnd(34) + ' | rows | uniqHz | dupRows | fbHero');
  rows.slice(0, 20).forEach((r) => console.log(r.vendor.slice(0, 33).padEnd(34) + ' | ' + String(r.rows).padStart(4) + ' | ' + String(r.uniqueHouzz).padStart(6) + ' | ' + String(r.dupRows).padStart(7) + ' | ' + String(r.fbHero).padStart(6)));
  process.exit(0);
})().catch((e) => { console.error('ERROR', e); process.exit(1); });
