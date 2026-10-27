'use strict';
/**
 * START AT THE PRODUCT LIBRARY: attach Houzz Storage galleries to STAGING products/
 * for vendor = Somerset Bay (the canonical source). Clips/selections/lines resolve FROM here.
 * Respects _imageLocked; backs up prior {imageUrl,image,images,heroImageIndex} before write.
 *
 * STAGING ONLY (writes to cch-studio-staging products/). Photos read from PROD storage.
 * Dry-run by default; --apply to write.
 */
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const DRY = !process.argv.includes('--apply');

const KEY_DIR = path.join(__dirname, '..', '_debug', 'service-account.json');
const prodKey = require(path.join(KEY_DIR, 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json'));
const stgKey = require(path.join(KEY_DIR, 'cch-studio-staging-firebase-adminsdk-fbsvc-b93c6f1cf4.json'));
const BUCKET = 'cch-design-boards.firebasestorage.app';
const prodBucket = admin.initializeApp({ credential: admin.credential.cert(prodKey), storageBucket: BUCKET }, 'prod').storage().bucket();
const stgDb = admin.initializeApp({ credential: admin.credential.cert(stgKey) }, 'stg').firestore();

const VENDOR_RE = /somerset\s*bay/i;
const IMG_RE = /\.(jpe?g|png|webp|gif)$/i;
const str = (v) => String(v == null ? '' : v).trim();
const houzzIdOf = (o) => str(o && (o.houzzId || o.houzzProductId || o.catalogId));
const dlUrl = (p, t) => 'https://firebasestorage.googleapis.com/v0/b/' + BUCKET + '/o/' + encodeURIComponent(p) + '?alt=media&token=' + t;
function curImgCount(o) { const s = new Set(); const add = (u) => { u = str(typeof u === 'string' ? u : (u && (u.url || u.imageUrl || u.src))); if (u && u.indexOf('data:') !== 0) s.add(u); }; add(o.imageUrl); add(o.image); ['images', 'imageUrls', 'gallery', 'photos'].forEach((k) => { if (Array.isArray(o[k])) o[k].forEach(add); }); return s.size; }
function isFirebaseUrl(u) { u = str(u).toLowerCase(); return u.includes('firebasestorage.googleapis.com') || u.includes('.firebasestorage.app'); }
async function storageUrlsFor(hid) {
  if (!hid) return [];
  const [files] = await prodBucket.getFiles({ prefix: 'houzz-products/' + hid + '/', maxResults: 32 });
  const imgs = files.filter((f) => IMG_RE.test(f.name)).sort((a, b) => (parseInt(path.basename(a.name), 10) || 0) - (parseInt(path.basename(b.name), 10) || 0) || a.name.localeCompare(b.name));
  const urls = [];
  for (const f of imgs) { try { const [m] = await f.getMetadata(); let t = m.metadata && m.metadata.firebaseStorageDownloadTokens; t = t ? String(t).split(',')[0] : ''; if (t) urls.push(dlUrl(f.name, t)); } catch (e) {} }
  return urls;
}

(async () => {
  console.log(DRY ? '=== DRY RUN (no writes) — Product Library / Somerset Bay (STAGING) ===' : '=== APPLY to STAGING products/ ===');
  // staging products for vendor Somerset Bay
  let docs = [];
  try {
    const q = await stgDb.collection('products').where('vendor', '==', 'Somerset Bay').get();
    q.forEach((d) => docs.push(Object.assign({ _id: d.id }, d.data())));
  } catch (e) {}
  if (!docs.length) { // fallback scan
    const all = await stgDb.collection('products').get();
    all.forEach((d) => { const p = d.data() || {}; if (VENDOR_RE.test(str(p.vendor))) docs.push(Object.assign({ _id: d.id }, p)); });
  }
  console.log('Somerset Bay products on staging:', docs.length, '\n');

  const manifest = [], backups = [];
  for (const p of docs) {
    const hid = houzzIdOf(p);
    const title = str(p.title || p.name);
    const urls = hid ? await storageUrlsFor(hid) : [];
    let action = '', reason = '';
    if (!hid) { action = 'skip'; reason = 'no_houzzId'; }
    else if (urls.length < 2) { action = 'skip'; reason = 'storage_<2'; }
    else if (p._imageLocked === true) { action = 'skip'; reason = 'image_locked'; }
    else if (curImgCount(p) >= urls.length) { action = 'skip'; reason = 'already_has_gallery'; }
    else { action = DRY ? 'would_apply' : 'applied'; }
    manifest.push({ productId: p._id, title: title.slice(0, 46), sku: str(p.sku), houzzId: hid, now: curImgCount(p), storage: urls.length, action, reason });

    if (action === 'would_apply' || action === 'applied') {
      backups.push({ productId: p._id, prev: { imageUrl: p.imageUrl || null, image: p.image || null, images: p.images || null, heroImageIndex: p.heroImageIndex == null ? null : p.heroImageIndex } });
      if (!DRY) {
        const patch = { images: urls, heroImageIndex: 0, _houzzGalleryLinkedAt: '2026-06-08', updatedAt: '2026-06-08T00:00:00.000Z' };
        const cur = str(p.imageUrl || p.image);
        if (!cur || !isFirebaseUrl(cur) || cur.toLowerCase().includes('houzz-products')) { patch.imageUrl = urls[0]; patch.image = urls[0]; }
        await stgDb.collection('products').doc(p._id).set(patch, { merge: true });
      }
    }
  }

  const outDir = path.join(__dirname, '..', '_backup', 'somersetbay-library-gallery-staging-2026-06-08');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, (DRY ? 'DRYRUN' : 'APPLIED') + '_library_manifest.json'), JSON.stringify({ dryRun: DRY, env: 'STAGING', collection: 'products', vendor: 'Somerset Bay', manifest }, null, 2));
  if (!DRY) fs.writeFileSync(path.join(outDir, 'PRODUCT_BACKUP_before_apply.json'), JSON.stringify(backups, null, 2));

  console.log('product                                        | sku       | hzId     | now | strg | action');
  manifest.forEach((m) => console.log(m.title.padEnd(46) + ' | ' + String(m.sku).padEnd(9) + ' | ' + String(m.houzzId).padEnd(8) + ' | ' + String(m.now).padStart(3) + ' | ' + String(m.storage).padStart(4) + ' | ' + m.action + (m.reason ? ' (' + m.reason + ')' : '')));
  const n = manifest.filter((m) => m.action === 'would_apply' || m.action === 'applied').length;
  const gain = manifest.filter((m) => m.action === 'would_apply' || m.action === 'applied').reduce((s, m) => s + (m.storage - m.now), 0);
  console.log('\n' + (DRY ? 'WOULD enrich' : 'ENRICHED') + ' ' + n + ' library products (+' + gain + ' images total).', DRY ? 'Re-run with --apply.' : '');
  process.exit(0);
})().catch((e) => { console.error('ERROR', e); process.exit(1); });
