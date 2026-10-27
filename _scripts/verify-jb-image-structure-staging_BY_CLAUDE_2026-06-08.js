'use strict';
/** READ-ONLY verification: for each Jonathan Browning product (staging), show the CURRENT main
 *  image (imageUrl) and the numbered Houzz images (houzz-products/{houzzId}/1..N) so Cynthia can
 *  verify which is the product and how the rest are numbered. ZERO writes. */
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const KEY_DIR = path.join(__dirname, '..', '_debug', 'service-account.json');
const prodBucket = admin.initializeApp({ credential: admin.credential.cert(require(path.join(KEY_DIR, 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json'))), storageBucket: 'cch-design-boards.firebasestorage.app' }, 'prod').storage().bucket();
const db = admin.initializeApp({ credential: admin.credential.cert(require(path.join(KEY_DIR, 'cch-studio-staging-firebase-adminsdk-fbsvc-b93c6f1cf4.json'))) }, 'stg').firestore();
const BUCKET = 'cch-design-boards.firebasestorage.app';
const str = (v) => String(v == null ? '' : v).trim();
const hz = (o) => str(o && (o.houzzId || o.houzzProductId || o.catalogId));
const JB = /jonathan\s*browning/i;
const dlUrl = (p, t) => 'https://firebasestorage.googleapis.com/v0/b/' + BUCKET + '/o/' + encodeURIComponent(p) + '?alt=media&token=' + t;
function heroSource(u) { u = str(u); if (/ivy-uploads|amazonaws/i.test(u)) return 'Ivy/S3 (likely expired)'; const m = u.match(/houzz-products%2F\d+%2F(\d+)\./i); if (m) return 'Houzz image #' + m[1]; if (/firebasestorage/i.test(u)) return 'Firebase (other)'; if (!u) return '(none)'; return 'other'; }
async function numbered(hid) { if (!hid) return []; const [files] = await prodBucket.getFiles({ prefix: 'houzz-products/' + hid + '/', maxResults: 32 }); const imgs = files.filter((f) => /\.(jpe?g|png|webp|gif)$/i.test(f.name)).sort((a, b) => (parseInt(path.basename(a.name), 10) || 0) - (parseInt(path.basename(b.name), 10) || 0)); const out = []; for (const f of imgs) { const num = path.basename(f.name).replace(/\.[a-z]+$/i, ''); try { const [m] = await f.getMetadata(); let t = m.metadata && m.metadata.firebaseStorageDownloadTokens; t = t ? String(t).split(',')[0] : ''; out.push({ n: num, url: t ? dlUrl(f.name, t) : '(no token)' }); } catch (e) { out.push({ n: num, url: '(meta err)' }); } } return out; }

(async () => {
  const snap = await db.collection('products').get();
  const seen = new Set(); const jb = [];
  snap.forEach((d) => { const p = d.data() || {}; if (JB.test(str(p.vendor))) { const h = hz(p); if (h && seen.has(h)) return; if (h) seen.add(h); jb.push(Object.assign({ _id: d.id }, p)); } });
  const report = [];
  console.log('=== Jonathan Browning — image structure verification (read-only) ===\n');
  for (const p of jb) {
    const hid = hz(p); const nums = await numbered(hid);
    report.push({ title: str(p.title || p.name), houzzId: hid, currentMain: str(p.imageUrl), currentMainSource: heroSource(p.imageUrl), numberedHouzzImages: nums });
    console.log('"' + str(p.title || p.name) + '"  (Houzz ' + hid + ')');
    console.log('   MAIN now: ' + heroSource(p.imageUrl) + '   ' + (str(p.imageUrl) ? str(p.imageUrl).slice(0, 90) : '(none)'));
    console.log('   Numbered Houzz images: ' + (nums.length ? nums.map((x) => '#' + x.n).join(', ') : '(none in storage)'));
    nums.forEach((x) => console.log('       #' + x.n + '  ' + x.url));
    console.log('');
  }
  const outDir = path.join(__dirname, '..', '_backup', 'jb-image-verify-2026-06-08'); fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'JB_IMAGE_STRUCTURE_VERIFY.json'), JSON.stringify(report, null, 2));
  console.log('Full report (clickable URLs):', path.join(outDir, 'JB_IMAGE_STRUCTURE_VERIFY.json'));
  process.exit(0);
})().catch((e) => { console.error('ERROR', e); process.exit(1); });
