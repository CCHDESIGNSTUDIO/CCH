/**
 * PHASE 4A — Upload missing slot-1 images for catalog houzzIds matched by /productLibrary/ docs
 * but not yet in the Phase 2A upload manifest.
 *
 * NO Firestore writes. Storage only. Output: phase4a-upload-manifest.json + .csv
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

const CATALOG = String.raw`C:\Users\cindy\Dropbox\Claude - CCH studio\Houzz FILES\cchdesign_0427_original\catalog-items-with-images_cchdesign_0427.csv`;
const LOCAL_MANIFEST = String.raw`C:\Users\cindy\Dropbox\Claude - CCH studio\Houzz FILES\cchdesign_0427\_images\manifest.json`;
const PHASE2A = path.join(__dirname, 'phase2a-upload-manifest.json');
const OUT_CSV = path.join(__dirname, 'phase4a-upload-manifest.csv');
const OUT_JSON = path.join(__dirname, 'phase4a-upload-manifest.json');
const PROGRESS_LOG = path.join(__dirname, 'phase4a-progress.log');
const CONCURRENCY = 8;

function parseCSV(t) { const rows=[]; let row=[]; let cur=''; let q=false; for (let i=0;i<t.length;i++){const c=t[i]; if(q){if(c==='"'){if(t[i+1]==='"'){cur+='"';i++}else q=false}else cur+=c} else{if(c==='"')q=true; else if(c===','){row.push(cur);cur=''} else if(c==='\r'){} else if(c==='\n'){row.push(cur);rows.push(row);row=[];cur=''} else cur+=c}} if(cur||row.length){row.push(cur);rows.push(row)} return rows; }
function norm(s) { return String(s||'').toLowerCase().trim().replace(/\s+/g,' ').replace(/[^\w\s-]/g,''); }
function csvEsc(v) { if (v == null) return ''; const s = String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
function contentTypeFor(p) { const e=(path.extname(p)||'').toLowerCase(); if(e==='.jpg'||e==='.jpeg')return 'image/jpeg'; if(e==='.png')return 'image/png'; if(e==='.gif')return 'image/gif'; if(e==='.webp')return 'image/webp'; return 'image/jpeg'; }

(async () => {
  const startedAt = Date.now();
  console.log('PHASE 4A — Upload images for /productLibrary/ matches not yet uploaded\n');

  // Build catalog indexes
  const txt = fs.readFileSync(CATALOG, 'utf-8');
  const rows = parseCSV(txt);
  const h = rows[0];
  const idx = (n) => h.indexOf(n);
  const catalog = rows.slice(1).filter(r => r.length > 1 && r[idx('id')]).map(r => ({ id: r[idx('id')], name: r[idx('name')], sku: r[idx('sku')] }));
  const bySku = new Map(), byTitle = new Map();
  for (const c of catalog) {
    if (c.sku) { const k = norm(c.sku); if (k && !bySku.has(k)) bySku.set(k, c); }
    if (c.name) { const k = norm(c.name); if (k && !byTitle.has(k)) byTitle.set(k, c); }
  }

  // Phase 2A manifest
  const phase2a = JSON.parse(fs.readFileSync(PHASE2A, 'utf-8'));
  const alreadyUploaded = new Set();
  for (const r of phase2a.results || []) if (r.status === 'ok' && r.storagePath) alreadyUploaded.add(r.storagePath);

  // Local images
  const localManifest = JSON.parse(fs.readFileSync(LOCAL_MANIFEST, 'utf-8'));
  const bestLocal = new Map();
  for (const r of localManifest.results) {
    if (r.status !== 'ok' || r.kind !== 'catalog') continue;
    if (!fs.existsSync(r.dest)) continue;
    const id = String(r.sourceId);
    const cur = bestLocal.get(id);
    if (!cur || r.slot < cur.slot) bestLocal.set(id, r);
  }

  // Read /productLibrary/, find houzzIds needing upload
  const app = initializeApp(PROD);
  const db = getFirestore(app);
  const storage = getStorage(app);
  const psnap = await getDocs(collection(db, 'productLibrary'));
  const needed = new Set();
  psnap.forEach(d => {
    const x = d.data();
    const sku = norm(x.sku || '');
    const title = norm(x.title || '');
    let m = null;
    if (sku && bySku.has(sku)) m = bySku.get(sku);
    else if (title && byTitle.has(title)) m = byTitle.get(title);
    if (m) needed.add(String(m.id));
  });
  console.log(`  ${needed.size} unique houzzIds matched by /productLibrary/`);

  // Build upload queue
  const queue = [];
  for (const hid of needed) {
    const local = bestLocal.get(hid);
    if (!local) continue;
    const ext = path.extname(local.dest) || '.jpeg';
    const storagePath = `houzz-products/${hid}/${local.slot}${ext}`;
    if (alreadyUploaded.has(storagePath)) continue;
    queue.push({ ...local, storagePath, ext });
  }
  console.log(`  ${queue.length} need upload (rest already in Phase 2A)`);
  if (!queue.length) { console.log('Nothing to upload.'); fs.writeFileSync(OUT_JSON, JSON.stringify({ results: [], total: 0, ok: 0, failed: 0 })); process.exit(0); }

  // Upload
  const results = [];
  let done = 0, ok = 0, failed = 0;
  const progressTimer = setInterval(() => {
    const pct = ((done / queue.length) * 100).toFixed(1);
    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(0);
    const rate = done > 0 ? (done / (Date.now() - startedAt) * 1000).toFixed(1) : '0';
    const line = `  progress: ${done}/${queue.length} (${pct}%) ok=${ok} failed=${failed} rate=${rate}/s elapsed=${elapsed}s`;
    console.log(line); try { fs.appendFileSync(PROGRESS_LOG, line + '\n'); } catch (_e) {}
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
  async function worker() { while (i < queue.length) { await uploadOne(queue[i++]); } }
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  clearInterval(progressTimer);

  // Manifests
  const csv = ['houzzId,slot,localFile,storagePath,downloadUrl,status,errorMsg'];
  for (const r of results) csv.push([r.houzzId, r.slot, r.localFile, r.storagePath, r.downloadUrl, r.status, r.errorMsg].map(csvEsc).join(','));
  fs.writeFileSync(OUT_CSV, csv.join('\n'));
  fs.writeFileSync(OUT_JSON, JSON.stringify({ generatedAt: new Date().toISOString(), bucket: PROD.storageBucket, total: queue.length, ok, failed, results }, null, 2));

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(0);
  console.log(`\nDONE in ${elapsed}s. Uploaded ${ok}, failed ${failed} of ${queue.length}.`);
  process.exit(0);
})().catch(e => { console.error('FAILED:', e); process.exit(1); });
