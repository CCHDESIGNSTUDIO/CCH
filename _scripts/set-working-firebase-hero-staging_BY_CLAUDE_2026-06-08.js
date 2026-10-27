'use strict';
/**
 * Make vendor products SHOW: set hero (imageUrl) + gallery to the WORKING Firebase Houzz images
 * (houzz-products/{houzzId}/1..N), dropping the dead pre-Firebase (Ivy) URL. hero = #1.
 * Backs up prior. STAGING ONLY. Dry-run unless --apply.
 *   node _scripts/set-working-firebase-hero-staging_BY_CLAUDE_2026-06-08.js --vendor="Jonathan Browning" --apply
 */
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const DRY = !process.argv.includes('--apply');
const vArg = (process.argv.find((a) => a.startsWith('--vendor=')) || '').split('=').slice(1).join('=').replace(/^"|"$/g, '').trim();
if (!vArg) { console.error('Pass --vendor="Name"'); process.exit(1); }
const KEY_DIR = path.join(__dirname, '..', '_debug', 'service-account.json');
const prodBucket = admin.initializeApp({ credential: admin.credential.cert(require(path.join(KEY_DIR, 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json'))), storageBucket: 'cch-design-boards.firebasestorage.app' }, 'prod').storage().bucket();
const db = admin.initializeApp({ credential: admin.credential.cert(require(path.join(KEY_DIR, 'cch-studio-staging-firebase-adminsdk-fbsvc-b93c6f1cf4.json'))) }, 'stg').firestore();
const BUCKET = 'cch-design-boards.firebasestorage.app';
const str = (v) => String(v == null ? '' : v).trim();
const hz = (o) => str(o && (o.houzzId || o.houzzProductId || o.catalogId));
const dlUrl = (p, t) => 'https://firebasestorage.googleapis.com/v0/b/' + BUCKET + '/o/' + encodeURIComponent(p) + '?alt=media&token=' + t;
async function houzzUrls(hid) { if (!hid) return []; const [files] = await prodBucket.getFiles({ prefix: 'houzz-products/' + hid + '/', maxResults: 32 }); const imgs = files.filter((f) => /\.(jpe?g|png|webp|gif)$/i.test(f.name)).sort((a, b) => (parseInt(path.basename(a.name), 10) || 0) - (parseInt(path.basename(b.name), 10) || 0)); const out = []; for (const f of imgs) { try { const [m] = await f.getMetadata(); let t = m.metadata && m.metadata.firebaseStorageDownloadTokens; t = t ? String(t).split(',')[0] : ''; if (t) out.push(dlUrl(f.name, t)); } catch (e) {} } return out; }

(async () => {
  console.log((DRY ? 'DRY RUN' : 'APPLY') + ' — set WORKING Firebase hero+gallery — vendor="' + vArg + '" (STAGING)\n');
  const re = new RegExp(vArg.replace(/[^a-z0-9]+/gi, '\\s*'), 'i');
  const snap = await db.collection('products').get();
  const docs = []; snap.forEach((d) => { const p = d.data() || {}; if (re.test(str(p.vendor))) docs.push(Object.assign({ _id: d.id }, p)); });
  const backups = []; let fixed = 0;
  for (const p of docs) {
    const hid = hz(p); const urls = await houzzUrls(hid);
    if (!urls.length) { console.log('  skip (no firebase imgs)  "' + str(p.title || p.name) + '"'); continue; }
    backups.push({ productId: p._id, prev: { imageUrl: p.imageUrl || null, image: p.image || null, images: p.images || null, heroImageIndex: p.heroImageIndex == null ? null : p.heroImageIndex } });
    if (!DRY) await db.collection('products').doc(p._id).set({ imageUrl: urls[0], image: urls[0], images: urls, heroImageIndex: 0, updatedAt: '2026-06-08T00:00:00.000Z' }, { merge: true });
    fixed++;
    console.log('  ' + (DRY ? 'would set' : 'set') + '  "' + str(p.title || p.name).slice(0, 42).padEnd(42) + '"  hero→#1 of ' + urls.length + ' firebase imgs');
  }
  const outDir = path.join(__dirname, '..', '_backup', 'vendor-working-hero-staging-2026-06-08'); fs.mkdirSync(outDir, { recursive: true });
  if (!DRY) fs.writeFileSync(path.join(outDir, 'BACKUP_' + vArg.replace(/[^a-z0-9]+/gi, '_') + '.json'), JSON.stringify(backups, null, 2));
  console.log('\n' + (DRY ? 'WOULD fix ' + fixed : 'FIXED ' + fixed) + ' products (hero=#1 Firebase, gallery=all Firebase imgs). ' + (DRY ? 'Add --apply.' : 'Backup saved. Hard-refresh staging to see images.'));
  process.exit(0);
})().catch((e) => { console.error('ERROR', e); process.exit(1); });
