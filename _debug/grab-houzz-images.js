/**
 * Download every Houzz AWS S3 image from the Apr 27 export to local disk.
 * Sources:
 *   1. catalog-items-with-images_cchdesign_0427.csv (image1..image5 cols)
 *   2. cchdesign_0427.csv FILES section
 *
 * URLs are AWS pre-signed and EXPIRE — May 25 deadline.
 *
 * Output: C:\Users\cindy\Dropbox\Claude - CCH studio\Houzz FILES\cchdesign_0427\_images\
 *   - catalog\<productId>\<index>__<basename>
 *   - files\<basename> (with collision-safe suffix)
 *   - manifest.json (mapping for later upload)
 *   - download.log (per-URL status)
 *
 * Resumable: skips already-downloaded files. Run again anytime to retry failures.
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const { URL } = require('url');

const ROOT = String.raw`C:\Users\cindy\Dropbox\Claude - CCH studio\Houzz FILES\cchdesign_0427`;
const CATALOG = path.join(ROOT, 'catalog-items-with-images_cchdesign_0427.csv');
const MAIN = path.join(ROOT, 'cchdesign_0427.csv');
const OUT = path.join(ROOT, '_images');
const MANIFEST = path.join(OUT, 'manifest.json');
const LOG = path.join(OUT, 'download.log');

const CONCURRENCY = 10;
const MAX_RETRIES = 2;

function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }
ensureDir(OUT);
ensureDir(path.join(OUT, 'catalog'));
ensureDir(path.join(OUT, 'files'));

const logStream = fs.createWriteStream(LOG, { flags: 'a' });
function logln(s) { logStream.write(s + '\n'); }

function decodeHtml(s) {
  return String(s || '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function unwrapHyperlink(cell) {
  // Excel: =HYPERLINK("url", "text")
  if (typeof cell !== 'string') return cell;
  const m = cell.match(/^=HYPERLINK\("([^"]+)"/i);
  if (m) return decodeHtml(m[1]);
  return decodeHtml(cell);
}

function parseCSV(text) {
  const rows = []; let row = []; let cur = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i+1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += c;
    } else {
      if (c === '"') q = true;
      else if (c === ',') { row.push(cur); cur = ''; }
      else if (c === '\r') {}
      else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
      else cur += c;
    }
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

// --- Build the URL list ---
console.log('[1/3] Parsing catalog file for image URLs...');
const catText = fs.readFileSync(CATALOG, 'utf-8');
const catRows = parseCSV(catText);
const catH = catRows[0];
const idxId = catH.indexOf('id');
const idxImg = [1,2,3,4,5].map(n => catH.indexOf('image' + n));
const tasks = [];
for (let i = 1; i < catRows.length; i++) {
  const r = catRows[i];
  if (r.length < 2) continue;
  const id = r[idxId] || `row${i}`;
  for (let k = 0; k < idxImg.length; k++) {
    const col = idxImg[k];
    if (col < 0) continue;
    const url = unwrapHyperlink(r[col] || '');
    if (url && url.startsWith('http')) {
      const safeId = id.replace(/[^A-Za-z0-9_-]/g, '');
      const dir = path.join(OUT, 'catalog', safeId);
      const base = path.basename(new URL(url).pathname).slice(-100) || `img${k+1}`;
      const dest = path.join(dir, `${k+1}__${base}`);
      tasks.push({ url, dest, kind: 'catalog', sourceId: id, slot: k+1 });
    }
  }
}
console.log(`  catalog images queued: ${tasks.length}`);

console.log('[2/3] Parsing FILES section from main export...');
const mainText = fs.readFileSync(MAIN, 'utf-8');
const mainRows = parseCSV(mainText);
let inFiles = false;
let filesCount = 0;
for (const r of mainRows) {
  if (r.length === 1 && r[0].trim() === 'FILES') { inFiles = true; continue; }
  if (inFiles && r.length === 1 && /^[A-Z_]+$/.test(r[0].trim()) && r[0].trim() !== 'FILES') break;
  if (!inFiles) continue;
  const url = unwrapHyperlink(r[0] || '');
  if (url && url.startsWith('http')) {
    let base;
    try { base = path.basename(new URL(url).pathname); } catch { continue; }
    if (!base) base = `file_${filesCount}`;
    base = base.slice(-120).replace(/[^A-Za-z0-9._-]/g, '_');
    const dest = path.join(OUT, 'files', `${filesCount}__${base}`);
    tasks.push({ url, dest, kind: 'files', sourceId: String(filesCount) });
    filesCount++;
  }
}
console.log(`  files queued: ${filesCount}`);
console.log(`  TOTAL queued: ${tasks.length}`);

// --- Download with concurrency + resume ---
console.log(`[3/3] Downloading (concurrency=${CONCURRENCY})...`);
const startedAt = Date.now();
let done = 0, ok = 0, skipped = 0, failed = 0, bytes = 0;

function fetchOne(task, retries = MAX_RETRIES) {
  return new Promise(resolve => {
    if (fs.existsSync(task.dest)) {
      const st = fs.statSync(task.dest);
      if (st.size > 0) { skipped++; return resolve({ ...task, status: 'skipped', size: st.size }); }
    }
    ensureDir(path.dirname(task.dest));
    const u = (() => { try { return new URL(task.url); } catch { return null; } })();
    if (!u) { failed++; logln(`BADURL\t${task.url}`); return resolve({ ...task, status: 'badurl' }); }
    const tmp = task.dest + '.part';
    const fileStream = fs.createWriteStream(tmp);
    const req = https.get({
      hostname: u.hostname, path: u.pathname + u.search,
      headers: { 'User-Agent': 'cch-archiver/1.0' },
    }, res => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        fileStream.close(); fs.unlinkSync(tmp);
        const next = res.headers.location;
        if (next && retries > 0) {
          return resolve(fetchOne({ ...task, url: next }, retries - 1));
        }
        failed++; logln(`REDIR_FAIL\t${task.url}`);
        return resolve({ ...task, status: 'redirfail' });
      }
      if (res.statusCode !== 200) {
        fileStream.close(); try { fs.unlinkSync(tmp); } catch {}
        failed++; logln(`HTTP${res.statusCode}\t${task.url}`);
        return resolve({ ...task, status: 'http' + res.statusCode });
      }
      let n = 0;
      res.on('data', d => { n += d.length; });
      res.pipe(fileStream);
      fileStream.on('finish', () => {
        fileStream.close();
        try { fs.renameSync(tmp, task.dest); } catch (e) { failed++; logln(`RENAME\t${e.message}\t${task.url}`); return resolve({ ...task, status: 'rename' }); }
        ok++; bytes += n; logln(`OK\t${n}\t${task.url}`);
        resolve({ ...task, status: 'ok', size: n });
      });
    });
    req.on('error', e => {
      fileStream.close(); try { fs.unlinkSync(tmp); } catch {}
      if (retries > 0) return resolve(fetchOne(task, retries - 1));
      failed++; logln(`ERR\t${e.message}\t${task.url}`);
      resolve({ ...task, status: 'err', error: e.message });
    });
    req.setTimeout(30000, () => {
      req.destroy(); fileStream.close(); try { fs.unlinkSync(tmp); } catch {}
      if (retries > 0) return resolve(fetchOne(task, retries - 1));
      failed++; logln(`TIMEOUT\t${task.url}`);
      resolve({ ...task, status: 'timeout' });
    });
  });
}

(async () => {
  const queue = tasks.slice();
  const inflight = new Set();
  const results = [];
  async function tick() {
    while (inflight.size < CONCURRENCY && queue.length) {
      const t = queue.shift();
      const p = fetchOne(t).then(r => {
        inflight.delete(p);
        results.push(r);
        done++;
        if (done % 100 === 0) {
          const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
          const mb = (bytes / 1024 / 1024).toFixed(1);
          console.log(`  ${done}/${tasks.length} | ok=${ok} skipped=${skipped} failed=${failed} | ${mb} MB | ${elapsed}s`);
        }
      });
      inflight.add(p);
    }
  }
  while (queue.length || inflight.size) {
    await tick();
    if (inflight.size) await Promise.race(inflight);
  }
  fs.writeFileSync(MANIFEST, JSON.stringify({ generatedAt: new Date().toISOString(), total: tasks.length, ok, skipped, failed, bytes, results: results.map(r => ({ kind: r.kind, sourceId: r.sourceId, slot: r.slot, dest: r.dest, status: r.status, size: r.size || 0 })) }, null, 2));
  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`\nDONE. ok=${ok} skipped=${skipped} failed=${failed} | ${(bytes/1024/1024).toFixed(1)} MB | ${elapsed}s`);
  console.log(`Manifest: ${MANIFEST}`);
  console.log(`Log:      ${LOG}`);
  logStream.end();
  process.exit(failed > 0 ? 2 : 0);
})();
