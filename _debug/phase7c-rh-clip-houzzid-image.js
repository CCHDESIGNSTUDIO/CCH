/**
 * PHASE 7C — Backfill houzzId + imageUrl on Rolling Hills Houzz-source clips.
 * Default DRY RUN. --execute to write.
 *
 * Matching priority for houzzId/category lookup: existing houzzId → SKU → normalized title.
 * Image source priority: Phase 2A+4A upload manifest (catalog id → Firebase Storage URL) → existing imageUrl.
 *
 * NEVER touch:
 *   - clips with non-Houzz source (manual/clipper/cch-studio-clipper/etc.)
 *   - the category field (handled by Phase 7B)
 *
 * Only fills if currently missing/empty. No overwrite of existing values.
 */
const fs = require('fs');
const path = require('path');
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, writeBatch } = require('firebase/firestore');

const PROD = {
  apiKey: 'AIzaSyAd24U5ArVGrA24IxNcYD2NYiTVycyF4og',
  authDomain: 'cch-design-boards.firebaseapp.com',
  projectId: 'cch-design-boards',
  storageBucket: 'cch-design-boards.firebasestorage.app',
  messagingSenderId: '210388013080',
  appId: '1:210388013080:web:cch-design-boards',
};

const BOARD_ID = 'cloud-rolling-hills';
const CATALOG = String.raw`C:\Users\cindy\Dropbox\Claude - CCH studio\Houzz FILES\cchdesign_0427_original\catalog-items-with-images_cchdesign_0427.csv`;
const PHASE2A = path.join(__dirname, 'phase2a-upload-manifest.json');
const PHASE4A = path.join(__dirname, 'phase4a-upload-manifest.json');
const OUT_CSV = path.join(__dirname, 'phase7c-clip-houzzid-image-manifest.csv');
const EXECUTE = process.argv.includes('--execute');

const SKIP_SOURCES_LOWER = new Set(['manual', 'clipper', 'cch-studio-clipper', 'ideabook-asset', 'studio-added', 'studio', '']);
function isHouzzSource(s) { const v = String(s||'').toLowerCase().trim(); return v.indexOf('houzz') >= 0 || v === 'clip-sync'; }
function shouldSkip(s) { return !isHouzzSource(s) && SKIP_SOURCES_LOWER.has(String(s||'').toLowerCase().trim()); }

function parseCSV(t) { const rows=[]; let row=[]; let cur=''; let q=false; for (let i=0;i<t.length;i++){const c=t[i]; if(q){if(c==='"'){if(t[i+1]==='"'){cur+='"';i++}else q=false}else cur+=c} else{if(c==='"')q=true; else if(c===',') {row.push(cur);cur=''} else if(c==='\r'){} else if(c==='\n'){row.push(cur);rows.push(row);row=[];cur=''} else cur+=c}} if(cur||row.length){row.push(cur);rows.push(row)} return rows; }
function normTitle(s) { return String(s||'').toLowerCase().trim().replace(/\s+/g,' ').replace(/[^\w\s-]/g,''); }
function normSku(s) { return String(s||'').toLowerCase().trim().replace(/\s+/g,''); }
function csvEsc(v) { if (v == null) return ''; const s = String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }

(async () => {
  console.log(`PHASE 7C — RH clip houzzId + imageUrl backfill  (${EXECUTE ? 'EXECUTE' : 'DRY RUN'})\n`);

  // Catalog lookups (for houzzId match)
  const text = fs.readFileSync(CATALOG, 'utf-8');
  const rows = parseCSV(text);
  const h = rows[0]; const idx = (n) => h.indexOf(n);
  const catalog = rows.slice(1).filter(r => r.length > 1 && r[idx('id')]).map(r => ({
    id: String(r[idx('id')]).trim(), name: r[idx('name')], sku: r[idx('sku')],
  }));
  const bySku = new Map(), byTitle = new Map();
  for (const c of catalog) {
    if (c.sku) { const k = normSku(c.sku); if (k && !bySku.has(k)) bySku.set(k, c); }
    if (c.name) { const k = normTitle(c.name); if (k && !byTitle.has(k)) byTitle.set(k, c); }
  }

  // Image manifests: houzzId → permanent Firebase Storage URL
  const urlByHouzz = new Map();
  for (const fpath of [PHASE2A, PHASE4A]) {
    if (!fs.existsSync(fpath)) continue;
    const m = JSON.parse(fs.readFileSync(fpath, 'utf-8'));
    for (const r of m.results || []) if (r.status === 'ok' && r.downloadUrl && !urlByHouzz.has(r.houzzId)) urlByHouzz.set(String(r.houzzId), r.downloadUrl);
  }
  console.log(`  Catalog: ${catalog.length} records | Permanent URLs available for ${urlByHouzz.size} houzzIds\n`);

  const app = initializeApp(PROD);
  const db = getFirestore(app);
  const snap = await getDocs(collection(db, 'boards', BOARD_ID, 'clips'));
  console.log(`  ${snap.size} clips in boards/${BOARD_ID}/clips\n`);

  const updates = [];
  let skippedNonHouzz = 0, willHouzzId = 0, willImage = 0, neitherNeeded = 0, noCatalogMatch = 0;

  snap.forEach(d => {
    const x = d.data();
    if (shouldSkip(x.source) || !isHouzzSource(x.source)) { skippedNonHouzz++; return; }

    const curHouzzId = String(x.houzzId || x.houzzProductId || '').trim();
    const curImage = String(x.imageUrl || '').trim();
    const curImageIsFirebase = /firebasestorage\.googleapis\.com|firebasestorage\.app/i.test(curImage);

    const sku = normSku(x.sku);
    const t = normTitle(x.title || x.name);

    // Match clip to catalog
    let m = null, by = '';
    if (curHouzzId) { m = catalog.find(c => c.id === curHouzzId); if (m) by = 'existing-id'; }
    if (!m && sku && bySku.has(sku)) { m = bySku.get(sku); by = 'sku'; }
    if (!m && t && byTitle.has(t)) { m = byTitle.get(t); by = 'title'; }
    if (!m) { noCatalogMatch++; return; }

    const matchedHouzzId = m.id;
    const fields = {};
    let action = [];

    if (!curHouzzId) { fields.houzzId = matchedHouzzId; willHouzzId++; action.push('houzzId'); }
    if (!curImageIsFirebase && urlByHouzz.has(matchedHouzzId)) {
      fields.imageUrl = urlByHouzz.get(matchedHouzzId);
      if (curImage) fields._imageUrlPrevApr27 = curImage;
      willImage++;
      action.push('imageUrl');
    }

    if (!Object.keys(fields).length) { neitherNeeded++; return; }
    fields._clipBackfilledAt = new Date().toISOString();
    updates.push({
      docId: d.id, title: x.title || '', vendor: x.vendor || '', sku: x.sku || '',
      matchedBy: by, oldHouzzId: curHouzzId, newHouzzId: fields.houzzId || curHouzzId,
      oldImageHost: curImage ? new URL(curImage).hostname.split('.').slice(-3).join('.') : '',
      newImageOnFirebase: !!fields.imageUrl, action: action.join('+'), fields,
    });
  });

  console.log('--- Plan ---');
  console.log(`  Skipped non-Houzz source:          ${skippedNonHouzz}`);
  console.log(`  Will write houzzId:                ${willHouzzId}`);
  console.log(`  Will write Firebase imageUrl:      ${willImage}`);
  console.log(`  No catalog match (skip):           ${noCatalogMatch}`);
  console.log(`  Already has both fields (skip):    ${neitherNeeded}`);
  console.log(`  TOTAL clip updates:                ${updates.length}`);

  // Manifest
  const csv = ['clipDocId,title,vendor,sku,matchedBy,oldHouzzId,newHouzzId,oldImageHost,newImageOnFirebase,action'];
  for (const u of updates) csv.push([u.docId, u.title, u.vendor, u.sku, u.matchedBy, u.oldHouzzId, u.newHouzzId, u.oldImageHost, u.newImageOnFirebase, u.action].map(csvEsc).join(','));
  fs.writeFileSync(OUT_CSV, csv.join('\n'));
  console.log(`\n  Manifest: ${OUT_CSV}`);

  if (!EXECUTE) { console.log('\nDRY RUN. --execute to write.'); process.exit(0); }

  console.log('\nWRITING TO PRODUCTION...');
  const BATCH = 400;
  let written = 0;
  for (let i = 0; i < updates.length; i += BATCH) {
    const batch = writeBatch(db);
    for (const u of updates.slice(i, i + BATCH)) batch.update(doc(db, 'boards', BOARD_ID, 'clips', u.docId), u.fields);
    await batch.commit();
    written += Math.min(BATCH, updates.length - i);
    console.log(`  wrote ${written}/${updates.length}`);
  }
  console.log('\nDONE.');
  process.exit(0);
})().catch(e => { console.error('FAILED:', e); process.exit(1); });
