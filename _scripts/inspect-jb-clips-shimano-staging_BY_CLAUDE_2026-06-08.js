'use strict';
/** READ-ONLY: JB clips in shimano-maverick-cir (id, title, sku, houzzId, libraryProductId, imgs)
 *  + JB library products (sku, houzzId, imgs) to find the match key. ZERO writes. */
const admin = require('firebase-admin');
const path = require('path');
const stgKey = require(path.join(__dirname, '..', '_debug', 'service-account.json', 'cch-studio-staging-firebase-adminsdk-fbsvc-b93c6f1cf4.json'));
const db = admin.initializeApp({ credential: admin.credential.cert(stgKey) }, 'stg').firestore();
const PROJECT = 'shimano-maverick-cir';
const JB = /jonathan\s*browning/i;
const str = (v) => String(v == null ? '' : v).trim();
const hz = (o) => str(o && (o.houzzId || o.houzzProductId || o.catalogId));
function imgc(o) { const s = new Set(); const add = (u) => { u = str(typeof u === 'string' ? u : (u && (u.url || u.imageUrl || u.src))); if (u) s.add(u); }; add(o.imageUrl); add(o.image); ['images', 'imageUrls', 'gallery', 'photos'].forEach((k) => { if (Array.isArray(o[k])) o[k].forEach(add); }); return s.size; }

(async () => {
  console.log('=== JB CLIPS in ' + PROJECT + ' ===');
  const cs = await db.collection('boards').doc(PROJECT).collection('clips').get();
  const clips = []; cs.forEach((d) => { const c = d.data() || {}; if (JB.test(str(c.vendor))) clips.push(Object.assign({ _id: d.id }, c)); });
  clips.forEach((c) => console.log('  ' + c._id + '  "' + str(c.title || c.name).slice(0, 34).padEnd(34) + '"  sku=' + str(c.sku).padEnd(6) + '  hz=' + (hz(c) || '-').padEnd(10) + '  libId=' + (str(c.libraryProductId) || '-') + '  imgs=' + imgc(c)));

  console.log('\n=== JB LIBRARY products (products/) — match candidates ===');
  const ps = await db.collection('products').get();
  ps.forEach((d) => { const p = d.data() || {}; if (JB.test(str(p.vendor))) console.log('  ' + d.id + '  "' + str(p.title || p.name).slice(0, 34).padEnd(34) + '"  sku=' + str(p.sku).padEnd(6) + '  hz=' + (hz(p) || '-').padEnd(10) + '  imgs=' + imgc(p)); });
  process.exit(0);
})().catch((e) => { console.error('ERROR', e); process.exit(1); });
