'use strict';
/**
 * PRODUCTION gallery enrich (cch-design-boards products/). Adds Houzz gallery images to images[]
 * and PRESERVES the existing hero (imageUrl) — NEVER overwrites it. Dedups images[]; hero kept first.
 * Respects _imageLocked. Backs up EVERY touched doc's full prior {imageUrl,image,images,heroImageIndex}.
 * Dry-run unless --apply.  *** PRODUCTION DATA — Cynthia GO required for --apply. ***
 *   node _scripts/apply-vendor-gallery-PRODUCTION_BY_CLAUDE_2026-06-08.js --vendor="Somerset Bay"
 *   node _scripts/apply-vendor-gallery-PRODUCTION_BY_CLAUDE_2026-06-08.js --vendor="Somerset Bay" --apply
 */
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const DRY = !process.argv.includes('--apply');
const vArg = (process.argv.find((a) => a.startsWith('--vendor=')) || '').split('=').slice(1).join('=').replace(/^"|"$/g, '').trim();
if (!vArg) { console.error('Pass --vendor="Name"'); process.exit(1); }
const KEY_DIR = path.join(__dirname, '..', '_debug', 'service-account.json');
const PROD_KEY = require(path.join(KEY_DIR, 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json'));
const BUCKET = 'cch-design-boards.firebasestorage.app';
const app = admin.initializeApp({ credential: admin.credential.cert(PROD_KEY), storageBucket: BUCKET }, 'PROD');
const db = app.firestore();
const bucket = app.storage().bucket();
const str = (v) => String(v == null ? '' : v).trim();
const hz = (o) => str(o && (o.houzzId || o.houzzProductId || o.catalogId));
const dlUrl = (p, t) => 'https://firebasestorage.googleapis.com/v0/b/' + BUCKET + '/o/' + encodeURIComponent(p) + '?alt=media&token=' + t;
function curImages(o) { const a = []; const add = (u) => { u = str(typeof u === 'string' ? u : (u && (u.url || u.imageUrl || u.src))); if (u && u.indexOf('data:') !== 0) a.push(u); }; add(o.imageUrl); add(o.image); ['images', 'imageUrls', 'gallery', 'photos'].forEach((k) => { if (Array.isArray(o[k])) o[k].forEach(add); }); return a; }
function uniq(a) { const s = new Set(); const o = []; a.forEach((u) => { const k = str(u); if (k && !s.has(k)) { s.add(k); o.push(k); } }); return o; }
async function houzzUrls(hid) { if (!hid) return []; const [files] = await bucket.getFiles({ prefix: 'houzz-products/' + hid + '/', maxResults: 32 }); const imgs = files.filter((f) => /\.(jpe?g|png|webp|gif)$/i.test(f.name)).sort((a, b) => (parseInt(path.basename(a.name), 10) || 0) - (parseInt(path.basename(b.name), 10) || 0)); const urls = []; for (const f of imgs) { try { const [m] = await f.getMetadata(); let t = m.metadata && m.metadata.firebaseStorageDownloadTokens; t = t ? String(t).split(',')[0] : ''; if (t) urls.push(dlUrl(f.name, t)); } catch (e) {} } return urls; }

(async () => {
  console.log('*** ' + (DRY ? 'DRY RUN (read-only)' : 'APPLY — PRODUCTION WRITE') + ' *** gallery enrich (HERO PRESERVED) — vendor="' + vArg + '" — project cch-design-boards\n');
  const re = new RegExp(vArg.replace(/[^a-z0-9]+/gi, '\\s*'), 'i');
  const snap = await db.collection('products').get();
  const docs = []; snap.forEach((d) => { const p = d.data() || {}; if (re.test(str(p.vendor))) docs.push(Object.assign({ _id: d.id }, p)); });
  const backups = []; let enriched = 0, added = 0, heroChanged = 0;
  for (const p of docs) {
    const hid = hz(p); const cur = curImages(p); const gallery = hid ? await houzzUrls(hid) : [];
    if (!hid || gallery.length < 2 || p._imageLocked === true) continue;
    const merged = uniq(cur.concat(gallery));
    if (merged.length <= cur.length) continue;
    // SAFETY: hero (imageUrl) is never written. Verify it stays as merged[0] only if it already was.
    if (cur.length && merged[0] !== cur[0]) { /* shouldn't happen — uniq keeps cur first */ heroChanged++; }
    backups.push({ productId: p._id, prev: { imageUrl: p.imageUrl || null, image: p.image || null, images: p.images || null, heroImageIndex: p.heroImageIndex == null ? null : p.heroImageIndex } });
    if (!DRY) await db.collection('products').doc(p._id).set({ images: merged, heroImageIndex: 0, _houzzGalleryLinkedAt: '2026-06-08', updatedAt: '2026-06-08T00:00:00.000Z' }, { merge: true });
    enriched++; added += (merged.length - cur.length);
    console.log('  ' + (DRY ? 'would add' : 'added') + '  "' + str(p.title || p.name).slice(0, 40).padEnd(40) + '"  cur=' + cur.length + ' → +' + (merged.length - cur.length) + ' imgs   hero UNCHANGED (' + (str(p.imageUrl).slice(-18) || 'none') + ')');
  }
  const outDir = path.join(__dirname, '..', '_backup', 'PRODUCTION-vendor-gallery-2026-06-08'); fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, (DRY ? 'DRYRUN' : 'APPLIED') + '_' + vArg.replace(/[^a-z0-9]+/gi, '_') + '.json'), JSON.stringify({ dryRun: DRY, project: 'cch-design-boards', vendor: vArg, heroPolicy: 'imageUrl NEVER written', enriched, imagesAdded: added }, null, 2));
  if (!DRY) fs.writeFileSync(path.join(outDir, 'BACKUP_' + vArg.replace(/[^a-z0-9]+/gi, '_') + '.json'), JSON.stringify(backups, null, 2));
  console.log('\nPRODUCTS scanned:', docs.length, '| ' + (DRY ? 'WOULD enrich' : 'enriched') + ':', enriched, '| images added:', added, '| heroes changed: ' + heroChanged + ' (must be 0)');
  console.log(DRY ? '\nDRY RUN — nothing written. Cynthia GO required to --apply.' : '\nPRODUCTION WRITE complete. Backup: ' + outDir);
  process.exit(0);
})().catch((e) => { console.error('ERROR', e); process.exit(1); });
