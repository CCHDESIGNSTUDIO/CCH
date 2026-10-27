/**
 * PRODUCTION read-only: 3/4 Matisse library + clips full keys.
 */
'use strict';
const path = require('path');
const admin = require('firebase-admin');
const KEY = path.join(__dirname, '..', '_debug', 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
const db = admin.initializeApp({ credential: admin.credential.cert(require(KEY)) }, 'wo222lib').firestore();
const BOARD = 'cloud-rolling-hills';
const LIB_34 = '3_4_slab_calacatta_matisse_polished__walker_zanger__stone___tile__finish_polished';

function pick(o) {
  o = o || {};
  const keys = Object.keys(o).sort();
  const imgKeys = keys.filter(function (k) {
    return /image|photo|thumb|url|sku|title|name|finish|dim|size|vendor|houzz/i.test(k);
  });
  const out = { _allKeys: keys };
  imgKeys.forEach(function (k) {
    var v = o[k];
    if (Array.isArray(v)) out[k] = v.slice(0, 3);
    else if (v && typeof v === 'object') out[k] = JSON.stringify(v).slice(0, 200);
    else out[k] = v;
  });
  return out;
}

(async function main() {
  const lib = await db.collection('productLibrary').doc(LIB_34).get();
  console.log('productLibrary exists', lib.exists);
  if (lib.exists) console.log(JSON.stringify(pick(lib.data()), null, 2));

  const prod = await db.collection('products').doc(LIB_34).get();
  console.log('products exists', prod.exists);
  if (prod.exists) console.log(JSON.stringify(pick(prod.data()), null, 2));

  const clips = await db.collection('boards').doc(BOARD).collection('clips').get();
  clips.forEach(function (d) {
    const c = d.data() || {};
    const t = String(c.title || c.name || '');
    if (!/matisse|matise/i.test(t)) return;
    console.log('CLIP', JSON.stringify({
      id: d.id,
      room: c.room,
      title: t,
      sku: c.sku,
      dims: c.dimensions || c.size,
      libraryProductId: c.libraryProductId || c.linkedLibraryProductId,
      imageUrl: c.imageUrl || c.image || '',
      images0: (c.images && c.images[0]) || ''
    }, null, 2));
  });
  process.exit(0);
})().catch(function (e) {
  console.error(e);
  process.exit(1);
});
