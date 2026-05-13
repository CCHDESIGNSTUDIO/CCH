/**
 * PHASE 2A-EXTENDED — Upload ALL remaining catalog images to Firebase Storage.
 * Skips anything already uploaded in Phase 2A (per phase2a-upload-manifest.json).
 * Output: phase2a-extended-manifest.json + .csv
 *
 * NO Firestore writes. Storage only.
 * Storage rules MUST allow /houzz-products/** writes.
 */
const fs = require('fs');
const path = require('path');
const { initializeApp } = require('firebase/app');
const { getStorage, ref, uploadBytes, getDownloadURL } = require('firebase/storage');

const PROD = {
  apiKey: 'AIzaSyAd24U5ArVGrA24IxNcYD2NYiTVycyF4og',
  authDomain: 'cch-design-boards.firebaseapp.com',
  projectId: 'cch-design-boards',
  storageBucket: 'cch-design-boards.firebasestorage.app',
  messagingSenderId: '210388013080',
  appId: '1:210388013080:web:cch-design-boards',
};

const MANIFEST_PATH = String.raw`C:\Users\cindy\Dropbox\Claude - CCH studio\Houzz FILES\cchdesign_0427\_images\manifest.json`;
const PHASE2A = path.join(__dirname, 'phase2a-upload-manifest.json');
const PHASE4A = path.join(__dirname, 'phase4a-upload-manifest.json');
const OUT_CSV = path.join(__dirname, 'phase2a-extended-manifest.csv');
const OUT_JSON = path.join(__dirname, 'phase2a-extended-manifest.json');
const PROGRESS_LOG = path.join(__dirname, 'phase2a-extended-progress.log');
const CONCURRENCY = 8;

function csvEsc(v) { if (v == null) return ''; const s = String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
function contentTypeFor(p) {
  const ext = (path.extname(p) || '').toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.png') return 'image/png';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.webp') return 'image/webp';
  return 'image/jpeg';
}

(async () => {
  const startedAt = Date.now();
  console.log('PHASE 2A-EXTENDED — UPLOAD all remaining catalog images');
  console.log();

  // Build set of already-uploaded storagePaths from Phase 2A AND Phase 4A
  const alreadyUploaded = new Set();
  for (const fpath of [PHASE2A, PHASE4A]) {
    if (!fs.existsSync(fpath)) continue;
    const m = JSON.parse(fs.readFileSync(fpath, 'utf-8'));
    for (const r of m.results || []) {
      if (r.status === 'ok' && r.storagePath) alreadyUploaded.add(r.storagePath);
    }
  }
  console.log(`  ${alreadyUploaded.size} already uploaded in Phase 2A + 4A — will skip`);

  // Build list of remaining catalog images (all slots, all houzzIds)
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
  const queue = [];
  for (const r of manifest.results) {
    if (r.status !== 'ok') continue;
    if (r.kind !== 'catalog') continue;
    if (!fs.existsSync(r.dest)) continue;
    const ext = path.extname(r.dest) || '.jpeg';
    const storagePath = `houzz-products/${r.sourceId}/${r.slot}${ext}`;
    if (alreadyUploaded.has(storagePath)) continue;
    queue.push({ ...r, storagePath, ext });
  }
  console.log(`  ${queue.length} catalog images remaining to upload`);
  if (!queue.length) { console.log('Nothing to upload.'); process.exit(0); }

  console.log('  Uploading...');
  const app = initializeApp(PROD);
  const storage = getStorage(app);

  const results = [];
  let done = 0, ok = 0, failed = 0;

  const progressTimer = setInterval(() => {
    const pct = ((done / queue.length) * 100).toFixed(1);
    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(0);
    const rate = done > 0 ? (done / (Date.now() - startedAt) * 1000).toFixed(1) : '0';
    const line = `  progress: ${done}/${queue.length} (${pct}%) ok=${ok} failed=${failed} rate=${rate}/s elapsed=${elapsed}s`;
    console.log(line);
    try { fs.appendFileSync(PROGRESS_LOG, line + '\n'); } catch (_e) {}
  }, 10000);

  async function uploadOne(item) {
    try {
      const buffer = fs.readFileSync(item.dest);
      const sref = ref(storage, item.storagePath);
      await uploadBytes(sref, buffer, { contentType: contentTypeFor(item.dest) });
      const downloadUrl = await getDownloadURL(sref);
      ok++;
      results.push({ houzzId: String(item.sourceId), slot: item.slot, localFile: item.dest, storagePath: item.storagePath, downloadUrl, status: 'ok', errorMsg: '' });
    } catch (e) {
      failed++;
      results.push({ houzzId: String(item.sourceId), slot: item.slot, localFile: item.dest, storagePath: item.storagePath, downloadUrl: '', status: 'failed', errorMsg: String(e.message || e).slice(0, 200) });
    } finally { done++; }
  }

  let i = 0;
  async function worker() { while (i < queue.length) { const idx = i++; await uploadOne(queue[idx]); } }
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  clearInterval(progressTimer);

  // Write manifests
  const csv = ['houzzId,slot,localFile,storagePath,downloadUrl,status,errorMsg'];
  for (const r of results) csv.push([r.houzzId, r.slot, r.localFile, r.storagePath, r.downloadUrl, r.status, r.errorMsg].map(csvEsc).join(','));
  fs.writeFileSync(OUT_CSV, csv.join('\n'));
  fs.writeFileSync(OUT_JSON, JSON.stringify({ generatedAt: new Date().toISOString(), bucket: PROD.storageBucket, total: queue.length, ok, failed, results }, null, 2));

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(0);
  console.log(`\nDONE in ${elapsed}s. Uploaded ${ok}, failed ${failed} of ${queue.length}.`);
  console.log(`Manifest CSV:  ${OUT_CSV}`);
  console.log(`Manifest JSON: ${OUT_JSON}`);
  process.exit(0);
})().catch(e => { console.error('FAILED:', e); process.exit(1); });
