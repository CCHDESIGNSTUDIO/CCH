'use strict';
/**
 * FIXED gallery enrich (any vendor, STAGING products/). Adds Houzz gallery images to images[]
 * and PRESERVES the existing hero (imageUrl) — never overwrites it (that was the bug that put a
 * finish swatch as the main image). Dedups images[]; hero kept first. Respects _imageLocked.
 * Backs up prior {imageUrl,image,images,heroImageIndex}. STAGING ONLY. Dry-run unless --apply.
 *   node _scripts/apply-vendor-library-gallery-staging_BY_CLAUDE_2026-06-08.js --vendor="Visual Comfort"
 *   node _scripts/apply-vendor-library-gallery-staging_BY_CLAUDE_2026-06-08.js --vendor="Visual Comfort" --apply
 */
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const DRY = !process.argv.includes('--apply');
const vArg = (process.argv.find((a) => a.startsWith('--vendor=')) || '').split('=').slice(1).join('=').replace(/^"|"$/g, '').trim();
if (!vArg) { console.error('Pass --vendor="Name"'); process.exit(1); }
const KEY_DIR = path.join(__dirname, '..', '_debug', 'service-account.json');
const prodBucket = admin.initializeApp({ credential: admin.credential.cert(require(path.join(KEY_DIR, 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json'))), storageBucket: 'cch-design-boards.firebasestorage.app' }, 'prod').storage().bucket();
const db = admin.initializeApp({ credential: admin.credential.cert(require(path.join(KEY_DIR, 'cch-studio-staging-firebase-adminsdk-fbsvc-b93c6f1cf4.json'))), }, 'stg').firestore();
const BUCKET = 'cch-design-boards.firebasestorage.app';
const str = (v) => String(v == null ? '' : v).trim();
const hz = (o) => str(o && (o.houzzId || o.houzzProductId || o.catalogId));
const dlUrl = (p, t) => 'https://firebasestorage.googleapis.com/v0/b/' + BUCKET + '/o/' + encodeURIComponent(p) + '?alt=media&token=' + t;
function curImages(o) { const a = []; const add = (u) => { u = str(typeof u === 'string' ? u : (u && (u.url || u.imageUrl || u.src))); if (u && u.indexOf('data:') !== 0) a.push(u); }; add(o.imageUrl); add(o.image); ['images', 'imageUrls', 'gallery', 'photos'].forEach((k) => { if (Array.isArray(o[k])) o[k].forEach(add); }); return a; }
function uniq(arr) { const seen = new Set(); const out = []; arr.forEach((u) => { const k = str(u); if (k && !seen.has(k)) { seen.add(k); out.push(k); } }); return out; }
async function storageUrls(hid) { if (!hid) return []; const [files] = await prodBucket.getFiles({ prefix: 'houzz-products/' + hid + '/', maxResults: 32 }); const imgs = files.filter((f) => /\.(jpe?g|png|webp|gif)$/i.test(f.name)).sort((a, b) => (parseInt(path.basename(a.name), 10) || 0) - (parseInt(path.basename(b.name), 10) || 0)); const urls = []; for (const f of imgs) { try { const [m] = await f.getMetadata(); let t = m.metadata && m.metadata.firebaseStorageDownloadTokens; t = t ? String(t).split(',')[0] : ''; if (t) urls.push(dlUrl(f.name, t)); } catch (e) {} } return urls; }

(async () => {
  console.log((DRY ? 'DRY RUN' : 'APPLY') + ' — gallery enrich (hero PRESERVED) — vendor="' + vArg + '" (STAGING)\n');
  let docs = []; const q = await db.collection('products').where('vendor', '==', vArg).get(); q.forEach((d) => docs.push(Object.assign({ _id: d.id }, d.data())));
  const manifest = []; const backups = []; let enriched = 0, added = 0;
  for (const p of docs) {
    const hid = hz(p); const cur = curImages(p); const gallery = hid ? await storageUrls(hid) : [];
    let action = '', reason = '';
    if (!hid) { action = 'skip'; reason = 'no_houzzId'; }
    else if (gallery.length < 2) { action = 'skip'; reason = 'storage_<2'; }
    else if (p._imageLocked === true) { action = 'skip'; reason = 'image_locked'; }
    else {
      const merged = uniq(cur.concat(gallery)); // hero (cur[0]) stays first; gallery appended; deduped
      if (merged.length <= cur.length) { action = 'skip'; reason = 'already_has_all'; }
      else { action = DRY ? 'would_enrich' : 'enriched'; reason = '+' + (merged.length - cur.length) + ' imgs, hero UNCHANGED';
        if (!DRY) { await db.collection('products').doc(p._id).set({ images: merged, heroImageIndex: 0, _houzzGalleryLinkedAt: '2026-06-08', updatedAt: '2026-06-08T00:00:00.000Z' }, { merge: true }); }
        backups.push({ productId: p._id, prev: { imageUrl: p.imageUrl || null, image: p.image || null, images: p.images || null, heroImageIndex: p.heroImageIndex == null ? null : p.heroImageIndex } });
        enriched++; added += (merged.length - cur.length);
      }
    }
    manifest.push({ id: p._id, title: str(p.title || p.name).slice(0, 40), hz: hid, heroNow: str(p.imageUrl).slice(-22), curImgs: cur.length, gallery: gallery.length, action, reason });
  }
  const outDir = path.join(__dirname, '..', '_backup', 'vendor-gallery-enrich-staging-2026-06-08'); fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, (DRY ? 'DRYRUN' : 'APPLIED') + '_' + vArg.replace(/[^a-z0-9]+/gi, '_') + '.json'), JSON.stringify({ dryRun: DRY, vendor: vArg, heroPolicy: 'PRESERVE existing imageUrl — never overwrite', manifest }, null, 2));
  if (!DRY) fs.writeFileSync(path.join(outDir, 'BACKUP_' + vArg.replace(/[^a-z0-9]+/gi, '_') + '.json'), JSON.stringify(backups, null, 2));
  console.log('products:', docs.length, '| would_enrich:', enriched, '| images added:', added, '| (heroes left unchanged)\n');
  manifest.filter((m) => m.action.indexOf('enrich') >= 0).slice(0, 18).forEach((m) => console.log('  ' + m.action + '  "' + m.title + '"  cur=' + m.curImgs + ' → +' + (m.gallery) + ' gallery  hero(unchanged)=…' + m.heroNow));
  console.log('\nReport saved. Hero/imageUrl is NOT modified by this script.');
  process.exit(0);
})().catch((e) => { console.error('ERROR', e); process.exit(1); });
