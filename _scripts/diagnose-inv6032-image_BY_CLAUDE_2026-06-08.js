/**
 * READ-ONLY: why is the image missing on INV-6032's MyKnobs cabinet-hardware line?
 * Pull the invoice line's libraryProductId/clipId/image, then locate that product across
 * prod active (products/productLibrary), prod archives, and staging. ZERO writes.
 */
const admin = require('firebase-admin');
const path = require('path');
const KEY_DIR = path.join(__dirname, '..', '_debug', 'service-account.json');
const prodKey = require(path.join(KEY_DIR, 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json'));
const stgKey = require(path.join(KEY_DIR, 'cch-studio-staging-firebase-adminsdk-fbsvc-b93c6f1cf4.json'));
const prod = admin.initializeApp({ credential: admin.credential.cert(prodKey) }, 'prod').firestore();
const stg = admin.initializeApp({ credential: admin.credential.cert(stgKey) }, 'stg').firestore();

const PROJECT = 'cloud-rolling-hills';
const INV_ID = 'jmzQU1liyC5FUCYG6rxQ';

async function existsIn(db, coll, id) {
  if (!id) return false;
  try { const d = await db.collection(coll).doc(id).get(); return d.exists ? (d.data() || {}) : false; } catch (_e) { return false; }
}

(async () => {
  // Find the invoice wherever it actually lives (top-level, board subcollection, or any board).
  let inv = null, invPath = '';
  const top = await prod.collection('invoices').doc(INV_ID).get();
  if (top.exists) { inv = top; invPath = 'invoices/' + INV_ID; }
  if (!inv) { const sub = await prod.collection('boards').doc(PROJECT).collection('invoices').doc(INV_ID).get(); if (sub.exists) { inv = sub; invPath = sub.ref.path; } }
  if (!inv) {
    console.log('Not at expected paths — scanning collectionGroup(invoices)...');
    const cg = await prod.collectionGroup('invoices').get();
    cg.forEach((d) => { if (d.id === INV_ID) { inv = d; invPath = d.ref.path; } });
  }
  if (!inv) { console.log('Invoice', INV_ID, 'NOT FOUND anywhere on production'); process.exit(0); }
  console.log('Found invoice at:', invPath, '\n');
  const items = (inv.data().items || []);
  console.log('INV-6032 line items:', items.length, '\n');
  for (const it of items) {
    if (typeof it !== 'object' || !it) continue;
    const title = String(it.title || it.description || it.name || '');
    if (!/hardware|knob|pull|myknobs/i.test(title + ' ' + (it.vendor || ''))) continue;
    const lpid = String(it.libraryProductId || it.linkedLibraryProductId || '');
    const clipId = String(it.clipId || it.sourceClipId || '');
    console.log('LINE:', title.slice(0, 70));
    console.log('  vendor:', it.vendor, '| libraryProductId:', lpid || '(none)', '| clipId:', clipId || '(none)');
    console.log('  houzzId:', it.houzzId || it.houzzProductId || '(none)', '| line imageUrl:', it.imageUrl || it.image || '(none)');
    console.log('  _imageLocked:', it._imageLocked, '| _clipSourceTruth:', it._clipSourceTruth);
    if (lpid) {
      console.log('  -- libraryProductId lookup --');
      console.log('   prod products/            :', !!(await existsIn(prod, 'products', lpid)));
      console.log('   prod productLibrary/       :', !!(await existsIn(prod, 'productLibrary', lpid)));
      const pa = await existsIn(prod, 'products_archive', lpid);
      const pla = await existsIn(prod, 'productLibrary_archive', lpid);
      console.log('   prod products_archive/     :', !!pa, pa ? ('(reason: ' + ((pa._archiveMeta && pa._archiveMeta.reason) || pa.reason || '?') + ', img: ' + !!(pa.imageUrl || (pa.images && pa.images.length)) + ')') : '');
      console.log('   prod productLibrary_archive:', !!pla, pla ? ('(reason: ' + ((pla._archiveMeta && pla._archiveMeta.reason) || pla.reason || '?') + ', img: ' + !!(pla.imageUrl || (pla.images && pla.images.length)) + ')') : '');
      console.log('   STAGING products/          :', !!(await existsIn(stg, 'products', lpid)));
      console.log('   STAGING productLibrary/    :', !!(await existsIn(stg, 'productLibrary', lpid)));
    }
    if (clipId) {
      const c = await existsIn(prod, 'boards', PROJECT); // noop placeholder
      const clip = await prod.collection('boards').doc(PROJECT).collection('clips').doc(clipId).get();
      console.log('  -- clip lookup --  prod clip exists:', clip.exists, clip.exists ? ('img: ' + !!((clip.data()||{}).imageUrl)) : '');
    }
    console.log('');
  }
  process.exit(0);
})().catch((e) => { console.error('ERROR', e); process.exit(1); });
