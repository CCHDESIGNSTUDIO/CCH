'use strict';
/** READ-ONLY: show the real structure for a few Houzz ids on STAGING — every clip + product
 *  doc sharing each houzzId, with its imageUrl (so we can see the /N.jpeg image number),
 *  images[] count, sku. Reveals whether the import made one main clip + numbered images,
 *  or split each image into its own clip. ZERO writes. */
const admin = require('firebase-admin');
const path = require('path');
const stgKey = require(path.join(__dirname, '..', '_debug', 'service-account.json', 'cch-studio-staging-firebase-adminsdk-fbsvc-b93c6f1cf4.json'));
const db = admin.initializeApp({ credential: admin.credential.cert(stgKey) }, 'stg').firestore();
const PROJECT = 'cloud-rolling-hills';
const HIDS = ['53034582', '53032493', '53034584'];
const str = (v) => String(v == null ? '' : v).trim();
const hz = (o) => str(o && (o.houzzId || o.houzzProductId || o.catalogId));
function imgNum(u) { u = str(u); const m = u.match(/%2F(\d+)\.(jpe?g|png|webp|gif)/i) || u.match(/\/(\d+)\.(jpe?g|png|webp|gif)/i); return m ? m[1] : '?'; }
function imgs(o) { const a = []; if (str(o.imageUrl)) a.push(str(o.imageUrl)); ['images', 'imageUrls', 'gallery', 'photos'].forEach((k) => { if (Array.isArray(o[k])) o[k].forEach((x) => { const u = str(typeof x === 'string' ? x : (x && (x.url || x.imageUrl))); if (u) a.push(u); }); }); return a; }

(async () => {
  const clipSnap = await db.collection('boards').doc(PROJECT).collection('clips').get();
  const prodSnap = await db.collection('products').get();
  const archSnap = await db.collection('products_archive').get().catch(() => ({ forEach: () => {} }));
  for (const hid of HIDS) {
    console.log('\n================ houzzId ' + hid + ' ================');
    console.log('-- RH clips --');
    clipSnap.forEach((d) => { const c = d.data() || {}; if (hz(c) === hid) { const im = imgs(c); console.log('  clip ' + d.id + '  "' + str(c.title || c.name) + '"  vendor="' + str(c.vendor) + '"  sku=' + str(c.sku) + '  libId=' + str(c.libraryProductId) + '  imgs=' + im.length + '  heroImg#=' + imgNum(c.imageUrl) + '  [' + im.map(imgNum).join(',') + ']'); } });
    console.log('-- products (active) --');
    prodSnap.forEach((d) => { const p = d.data() || {}; if (hz(p) === hid) { const im = imgs(p); console.log('  prod ' + d.id + '  "' + str(p.title || p.name) + '"  sku=' + str(p.sku) + '  imgs=' + im.length + '  heroImg#=' + imgNum(p.imageUrl) + '  [' + im.map(imgNum).join(',') + ']'); } });
    console.log('-- products_archive (Junk) --');
    archSnap.forEach((d) => { const p = d.data() || {}; if (hz(p) === hid) { console.log('  ARCHIVED ' + d.id + '  "' + str(p.title || p.name) + '"  sku=' + str(p.sku) + '  reason=' + ((p._archiveMeta && p._archiveMeta.reason) || '?')); } });
  }
  process.exit(0);
})().catch((e) => { console.error('ERROR', e); process.exit(1); });
