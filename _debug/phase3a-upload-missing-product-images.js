/**
 * PHASE 3A — Upload slot-1 images for Houzz catalog products NOT YET in Studio.
 * For each houzzId in the Houzz catalog that has no matching Studio product,
 * upload its slot-1 (or earliest available) image to Firebase Storage.
 *
 * NO Firestore writes. Storage only.
 * Output: phase3a-upload-manifest.json + .csv
 */
const fs = require('fs');
const path = require('path');
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');
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
const OUT_CSV = path.join(__dirname, 'phase3a-upload-manifest.csv');
const OUT_JSON = path.join(__dirname, 'phase3a-upload-manifest.json');
const PROGRESS_LOG = path.join(__dirname, 'phase3a-progress.log');
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
  console.log('PHASE 3A — UPLOAD slot-1 of catalog products NOT yet in Studio\n');

  console.log('[1/4] Reading Studio /products/ to get existing houzzIds...');
  const app = initializeApp(PROD);
  const db = getFirestore(app);
  const storage = getStorage(app);
  const psnap = await getDocs(collection(db, 'products'));
  const studioHouzzIds = new Set();
  psnap.forEach(d => {
    const x = d.data();
    const hid = String(x.houzzId || x.houzzProductId || '').trim();
    if (hid) studioHouzzIds.add(hid);
  });
  console.log(`  ${studioHouzzIds.size} unique houzzIds already in Studio /products/`);

  console.log('[2/4] Loading local image manifest + Phase 2A manifest...');
  const phase2a = JSON.parse(fs.readFileSync(PHASE2A, 'utf-8'));
  const alreadyUploaded = new Set();
  for (const r of phase2a.results || []) {
    if (r.status === 'ok' && r.storagePath) alreadyUploaded.add(r.storagePath);
  }
  const localManifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));

  // Pick best slot per houzzId from local manifest (slot 1 preferred, else lowest available)
  const bestByHouzzId = new Map();
  for (const r of localManifest.results) {
    if (r.status !== 'ok') continue;
    if (r.kind !== 'catalog') continue;
    if (!fs.existsSync(r.dest)) continue;
    const hid = String(r.sourceId);
    if (studioHouzzIds.has(hid)) continue; // already in Studio — Phase 2A covered it
    const cur = bestByHouzzId.get(hid);
    if (!cur || r.slot < cur.slot) bestByHouzzId.set(hid, r);
  }
  const queue = [];
  for (const r of bestByHouzzId.values()) {
    const ext = path.extname(r.dest) || '.jpeg';
    const storagePath = `houzz-products/${r.sourceId}/${r.slot}${ext}`;
    if (alreadyUploaded.has(storagePath)) continue;
    queue.push({ ...r, storagePath, ext });
  }
  console.log(`  ${queue.length} catalog houzzIds NOT in Studio with downloadable images → upload queue`);
  if (!queue.length) { console.log('Nothing to upload.'); process.exit(0); }

  console.log('[3/4] Uploading...');
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

  console.log('[4/4] Writing manifests...');
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
