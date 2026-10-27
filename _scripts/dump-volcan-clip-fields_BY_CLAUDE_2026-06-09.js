'use strict';
/** READ-ONLY: full field dump of the Global Views Volcan Jar product + its cloud-rolling-hills clip,
 *  to find what the Product Library / Room Board renderers filter on. No writes. */
const path = require('path');
const admin = require('firebase-admin');
const KEY = require(path.join(__dirname, '..', '_debug', 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json'));
const db = admin.initializeApp({ credential: admin.credential.cert(KEY) }, 'PROD').firestore();
const str = (v) => String(v == null ? '' : v).trim();
const show = (label, p) => {
  console.log('\n=== ' + label + ' ===');
  const keys = ['title','name','vendor','manufacturer','sku','category','room','source','isClipperMaster','libraryItemKind','itemKind','productLifecycle','_quarantineLocked','hiddenFromRoomBoard','hiddenFromClientPortal','clientSelectionStatus','approvalStatus','status','costPrice','unitCost','cost','sellPrice','clientPrice','price','imageUrl','image','heroImageIndex','projectId','project','libraryProductId','linkedLibraryProductId','createdAt','updatedAt','owner'];
  keys.forEach((k) => { if (p[k] !== undefined) console.log('  ' + k + ': ' + JSON.stringify(p[k])); });
  console.log('  images: ' + (Array.isArray(p.images) ? p.images.length + ' urls' : JSON.stringify(p.images)));
  const extra = Object.keys(p).filter((k) => keys.indexOf(k) < 0 && k !== 'images');
  console.log('  (other keys: ' + extra.join(', ') + ')');
};
(async () => {
  const ps = await db.collection('products').get();
  let prod = null;
  ps.forEach((d) => { const p = d.data() || {}; if (/global\s*views/i.test(str(p.vendor)) && str(p.createdAt) >= '2026-06-08') prod = Object.assign({ _id: d.id }, p); });
  if (!prod) { console.log('Volcan product not found'); process.exit(0); }
  console.log('PRODUCT doc id:', prod._id, '| collection: products');
  show('PRODUCT (library row)', prod);
  // its clip
  const pid = str(prod.projectId) || 'cloud-rolling-hills';
  const cs = await db.collection('boards').doc(pid).collection('clips').get();
  let clip = null;
  cs.forEach((c) => { const cd = c.data() || {}; if (str(cd.libraryProductId) === prod._id || /volcan/i.test(str(cd.title || cd.name))) clip = Object.assign({ _id: c.id }, cd); });
  console.log('\nBOARD: ' + pid + ' | clips in board: ' + cs.size);
  if (clip) { console.log('CLIP doc id:', clip._id); show('CLIP (room board row)', clip); }
  else console.log('\nNO matching clip found in board ' + pid);
  // is the productLibrary mirror present?
  const lib = await db.collection('productLibrary').doc(prod._id).get();
  console.log('\nproductLibrary mirror (same id) exists:', lib.exists);
  process.exit(0);
})().catch((e) => { console.error('ERROR', e.message || e); process.exit(1); });
