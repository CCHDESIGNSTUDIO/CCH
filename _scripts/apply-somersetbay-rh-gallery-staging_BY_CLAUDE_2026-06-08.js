'use strict';
/**
 * Attach Houzz Storage gallery images to STAGING Cloud-Rolling-Hills room-board CLIPS
 * for Somerset Bay items. Skips duplicate "category-room/finish" twin clips and _imageLocked.
 * Backs up each clip's prior {imageUrl, images, heroImageIndex} before writing.
 *
 * STAGING ONLY. Firestore writes go to cch-studio-staging. Photo files read from PROD storage.
 * Dry-run by default. Add --apply to write.
 *   node _scripts/apply-somersetbay-rh-gallery-staging_BY_CLAUDE_2026-06-08.js            (dry-run)
 *   node _scripts/apply-somersetbay-rh-gallery-staging_BY_CLAUDE_2026-06-08.js --apply
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

const PROJECT = 'cloud-rolling-hills';
const VENDOR_RE = /somerset\s*bay/i;
const IMG_RE = /\.(jpe?g|png|webp|gif)$/i;
const str = (v) => String(v == null ? '' : v).trim();
const houzzIdOf = (o) => str(o && (o.houzzId || o.houzzProductId || o.catalogId));
const dlUrl = (p, t) => 'https://firebasestorage.googleapis.com/v0/b/' + BUCKET + '/o/' + encodeURIComponent(p) + '?alt=media&token=' + t;

// A clip is a junk "twin" (room/finish descriptor) we should NOT enrich — target the real product clip.
function isJunkTwin(title) {
  const t = str(title).toLowerCase();
  if (/\broom\b/.test(t)) return true;                                   // "Game room"
  if (/^(black forest|lack forest|ebony|vanilla bean)/.test(t)) return true; // finish-only titles
  if (/\bvanilla bean\b/.test(t) && t.split(/\s+/).length <= 5) return true;
  return false;
}
function curImgCount(o) {
  const s = new Set();
  const add = (u) => { u = str(typeof u === 'string' ? u : (u && (u.url || u.imageUrl || u.src))); if (u && u.indexOf('data:') !== 0) s.add(u); };
  add(o.imageUrl); add(o.image); ['images', 'imageUrls', 'gallery', 'photos'].forEach((k) => { if (Array.isArray(o[k])) o[k].forEach(add); });
  return s.size;
}
async function storageUrlsFor(hid) {
  if (!hid) return [];
  const [files] = await prodBucket.getFiles({ prefix: 'houzz-products/' + hid + '/', maxResults: 32 });
  const imgs = files.filter((f) => IMG_RE.test(f.name)).sort((a, b) => (parseInt(path.basename(a.name), 10) || 0) - (parseInt(path.basename(b.name), 10) || 0) || a.name.localeCompare(b.name));
  const urls = [];
  for (const f of imgs) { try { const [m] = await f.getMetadata(); let t = m.metadata && m.metadata.firebaseStorageDownloadTokens; t = t ? String(t).split(',')[0] : ''; if (t) urls.push(dlUrl(f.name, t)); } catch (e) {} }
  return urls;
}

(async () => {
  console.log(DRY ? '=== DRY RUN (no writes) ===' : '=== APPLY to STAGING ===');
  const snap = await stgDb.collection('boards').doc(PROJECT).collection('clips').get();
  const sb = [];
  snap.forEach((d) => { const c = d.data() || {}; if (VENDOR_RE.test(str(c.vendor))) sb.push(Object.assign({ _clipId: d.id }, c)); });

  const manifest = [];
  const backups = [];
  for (const clip of sb) {
    const hid = houzzIdOf(clip);
    const title = str(clip.title || clip.name);
    const urls = await storageUrlsFor(hid);
    let action = '', reason = '';
    if (urls.length < 2) { action = 'skip'; reason = 'storage_<2_images'; }
    else if (isJunkTwin(title)) { action = 'skip'; reason = 'duplicate_twin (room/finish)'; }
    else if (clip._imageLocked === true) { action = 'skip'; reason = 'image_locked'; }
    else if (curImgCount(clip) >= urls.length) { action = 'skip'; reason = 'already_has_gallery'; }
    else { action = DRY ? 'would_apply' : 'applied'; }

    manifest.push({ clipId: clip._clipId, title: title.slice(0, 50), houzzId: hid, room: str(clip.room), now: curImgCount(clip), storage: urls.length, action, reason });

    if (action === 'would_apply' || action === 'applied') {
      backups.push({ clipId: clip._clipId, prev: { imageUrl: clip.imageUrl || null, image: clip.image || null, images: clip.images || null, heroImageIndex: clip.heroImageIndex == null ? null : clip.heroImageIndex } });
      if (!DRY) {
        await stgDb.collection('boards').doc(PROJECT).collection('clips').doc(clip._clipId).update({
          images: urls, imageUrl: urls[0], heroImageIndex: 0,
          _galleryLinkedFromHouzzAt: '2026-06-08', updatedAt: '2026-06-08T00:00:00.000Z',
        });
      }
    }
  }

  const outDir = path.join(__dirname, '..', '_backup', 'somersetbay-rh-gallery-apply-staging-2026-06-08');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, (DRY ? 'DRYRUN' : 'APPLIED') + '_manifest.json'), JSON.stringify({ dryRun: DRY, project: PROJECT, env: 'STAGING', manifest }, null, 2));
  if (!DRY) fs.writeFileSync(path.join(outDir, 'CLIP_BACKUP_before_apply.json'), JSON.stringify(backups, null, 2));

  console.log('\nclip                                               | hzId     | now | strg | action');
  manifest.forEach((m) => console.log(m.title.padEnd(50) + ' | ' + String(m.houzzId).padEnd(8) + ' | ' + String(m.now).padStart(3) + ' | ' + String(m.storage).padStart(4) + ' | ' + m.action + (m.reason ? ' (' + m.reason + ')' : '')));
  const applied = manifest.filter((m) => m.action === 'applied' || m.action === 'would_apply').length;
  console.log('\n' + (DRY ? 'WOULD apply to' : 'APPLIED to') + ' ' + applied + ' clip(s).', DRY ? 'Re-run with --apply to write.' : 'Backup: ' + path.join(outDir, 'CLIP_BACKUP_before_apply.json'));
  process.exit(0);
})().catch((e) => { console.error('ERROR', e); process.exit(1); });
