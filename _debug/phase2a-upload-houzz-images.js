/**
 * PHASE 2A — Upload Houzz catalog slot-1 images to Firebase Storage at /houzz-products/<houzzId>/<filename>
 * Filtered to ONLY houzzIds present in production /products/. Slot-1 (primary image) only for now.
 * Outputs phase2a-upload-manifest.csv: houzzId, slot, localFile, storagePath, downloadUrl, status, errorMsg.
 *
 * NO Firestore writes. Writes only to Firebase Storage at the new /houzz-products/** path.
 * Storage rules MUST already be temp-relaxed for /houzz-products/** to allow create/update without auth.
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
const OUT_CSV = path.join(__dirname, 'phase2a-upload-manifest.csv');
const OUT_JSON = path.join(__dirname, 'phase2a-upload-manifest.json');
const PROGRESS_LOG = path.join(__dirname, 'phase2a-progress.log');
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
  console.log('PHASE 2A — UPLOAD slot-1 catalog images to Firebase Storage');
  console.log('  Bucket:', PROD.storageBucket);
  console.log('  Path:   houzz-products/<houzzId>/<filename>');
  console.log();

  console.log('[1/4] Reading production /products/ for houzzIds...');
  const app = initializeApp(PROD);
  const db = getFirestore(app);
  const storage = getStorage(app);
  const psnap = await getDocs(collection(db, 'products'));
  const prodHouzzIds = new Set();
  psnap.forEach(d => {
    const x = d.data();
    const hid = String(x.houzzId || x.houzzProductId || '').trim();
    if (hid) prodHouzzIds.add(hid);
  });
  console.log(`  ${psnap.size} products, ${prodHouzzIds.size} unique houzzIds in production`);

  console.log('[2/4] Loading local image manifest...');
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
  const slot1ByHouzzId = new Map();
  for (const r of manifest.results) {
    if (r.status !== 'ok') continue;
    if (r.kind !== 'catalog') continue;
    if (r.slot !== 1) continue;
    if (!prodHouzzIds.has(String(r.sourceId))) continue;
    if (!fs.existsSync(r.dest)) continue;
    slot1ByHouzzId.set(String(r.sourceId), r);
  }
  console.log(`  ${slot1ByHouzzId.size} slot-1 images matched to production houzzIds and present on disk`);

  // Also pick slot 2/3/4 fallback when slot 1 missing
  let fallbackCount = 0;
  for (const r of manifest.results) {
    if (r.status !== 'ok') continue;
    if (r.kind !== 'catalog') continue;
    if (r.slot === 1) continue;
    const id = String(r.sourceId);
    if (!prodHouzzIds.has(id)) continue;
    if (slot1ByHouzzId.has(id)) continue;
    if (!fs.existsSync(r.dest)) continue;
    slot1ByHouzzId.set(id, r);
    fallbackCount++;
  }
  console.log(`  +${fallbackCount} fallback (slot >1) for products without slot 1`);
  console.log(`  TOTAL TO UPLOAD: ${slot1ByHouzzId.size}`);

  console.log('[3/4] Uploading...');
  const uploadList = Array.from(slot1ByHouzzId.values());
  const results = [];
  let done = 0, ok = 0, failed = 0;

  const progressTimer = setInterval(() => {
    const pct = ((done / uploadList.length) * 100).toFixed(1);
    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(0);
    const rate = done > 0 ? (done / (Date.now() - startedAt) * 1000).toFixed(1) : '0';
    const line = `  progress: ${done}/${uploadList.length} (${pct}%) ok=${ok} failed=${failed} rate=${rate}/s elapsed=${elapsed}s`;
    console.log(line);
    try { fs.appendFileSync(PROGRESS_LOG, line + '\n'); } catch (_e) {}
  }, 5000);

  async function uploadOne(item) {
    const houzzId = String(item.sourceId);
    const slot = item.slot;
    const localPath = item.dest;
    const ext = path.extname(localPath) || '.jpeg';
    const storagePath = `houzz-products/${houzzId}/${slot}${ext}`;
    try {
      const buffer = fs.readFileSync(localPath);
      const sref = ref(storage, storagePath);
      await uploadBytes(sref, buffer, { contentType: contentTypeFor(localPath) });
      const downloadUrl = await getDownloadURL(sref);
      ok++;
      results.push({ houzzId, slot, localFile: localPath, storagePath, downloadUrl, status: 'ok', errorMsg: '' });
    } catch (e) {
      failed++;
      results.push({ houzzId, slot, localFile: localPath, storagePath, downloadUrl: '', status: 'failed', errorMsg: String(e.message || e).slice(0, 200) });
    } finally {
      done++;
    }
  }

  // Concurrency pool
  let i = 0;
  async function worker() {
    while (i < uploadList.length) {
      const myIdx = i++;
      await uploadOne(uploadList[myIdx]);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  clearInterval(progressTimer);

  console.log(`  done. ok=${ok} failed=${failed} of ${uploadList.length}`);

  console.log('[4/4] Writing manifests...');
  const csv = ['houzzId,slot,localFile,storagePath,downloadUrl,status,errorMsg'];
  for (const r of results) {
    csv.push([r.houzzId, r.slot, r.localFile, r.storagePath, r.downloadUrl, r.status, r.errorMsg].map(csvEsc).join(','));
  }
  fs.writeFileSync(OUT_CSV, csv.join('\n'));
  fs.writeFileSync(OUT_JSON, JSON.stringify({
    generatedAt: new Date().toISOString(),
    bucket: PROD.storageBucket,
    total: uploadList.length, ok, failed,
    results,
  }, null, 2));

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(0);
  console.log(`\nDONE in ${elapsed}s. Uploaded ${ok} images, ${failed} failed.`);
  console.log(`Manifest CSV:  ${OUT_CSV}`);
  console.log(`Manifest JSON: ${OUT_JSON}`);
  process.exit(0);
})().catch(e => { console.error('FAILED:', e); process.exit(1); });
