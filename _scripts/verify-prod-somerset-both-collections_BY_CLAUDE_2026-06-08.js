'use strict';
/** READ-ONLY: production Somerset Bay split across products/ vs productLibrary/ (+ archives) and
 *  houzzId overlap, to see why the catalog still shows dups. ZERO writes. */
const admin = require('firebase-admin');
const path = require('path');
const KEY = require(path.join(__dirname, '..', '_debug', 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json'));
const db = admin.initializeApp({ credential: admin.credential.cert(KEY) }, 'PROD').firestore();
const str = (v) => String(v == null ? '' : v).trim();
const hz = (o) => str(o && (o.houzzId || o.houzzProductId || o.catalogId));
const RE = /somerset\s*bay/i;
async function sb(coll) { const snap = await db.collection(coll).get(); const rows = []; snap.forEach((d) => { const p = d.data() || {}; if (RE.test(str(p.vendor))) rows.push({ id: d.id, hz: hz(p), title: str(p.title || p.name) }); }); return rows; }
(async () => {
  const prods = await sb('products'); const lib = await sb('productLibrary');
  const pArch = await sb('products_archive'); const lArch = await sb('productLibrary_archive');
  const pHz = new Set(prods.map((r) => r.hz).filter(Boolean));
  const lHz = new Set(lib.map((r) => r.hz).filter(Boolean));
  const overlap = [...pHz].filter((h) => lHz.has(h));
  console.log('=== PRODUCTION Somerset Bay ===');
  console.log('products/ (active):           ', prods.length, '| unique houzzIds:', pHz.size);
  console.log('productLibrary/ (active):     ', lib.length, '| unique houzzIds:', lHz.size);
  console.log('products_archive (Junk):      ', pArch.length);
  console.log('productLibrary_archive (Junk):', lArch.length);
  console.log('houzzIds in BOTH active collections (cross-collection dups):', overlap.length);
  console.log('\nproductLibrary/ active rows (untouched by my dedup):');
  lib.slice(0, 60).forEach((r) => console.log('  ' + r.id + '  hz=' + (r.hz || '-').padEnd(10) + '  "' + r.title.slice(0, 44) + '"'));
  process.exit(0);
})().catch((e) => { console.error('ERROR', e); process.exit(1); });
