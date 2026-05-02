/**
 * PHASE 7B — Backfill empty categories on Rolling Hills Houzz-source clips
 * directly from the Houzz catalog file (NOT from /products/, to avoid Phase 1.5 over-normalization).
 *
 * Default DRY RUN. --execute to write.
 *
 * Match priority: houzzId → SKU → normalized title.
 * Skip: clips with non-Houzz source (manual/clipper/empty/etc.) — never touched.
 * Skip: clips that already have a category set.
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
const OUT_CSV = path.join(__dirname, 'phase7b-category-backfill-manifest.csv');
const EXECUTE = process.argv.includes('--execute');

const SKIP_SOURCES_LOWER = new Set(['manual', 'clipper', 'cch-studio-clipper', 'ideabook-asset', 'studio-added', 'studio', '']);
function isHouzzSource(s) { const v = String(s||'').toLowerCase().trim(); return v.indexOf('houzz') >= 0 || v === 'clip-sync'; }
function shouldSkip(s) { return !isHouzzSource(s) && SKIP_SOURCES_LOWER.has(String(s||'').toLowerCase().trim()); }

function parseCSV(t) {
  const rows=[]; let row=[]; let cur=''; let q=false;
  for (let i=0;i<t.length;i++){const c=t[i];
    if(q){if(c==='"'){if(t[i+1]==='"'){cur+='"';i++}else q=false}else cur+=c}
    else{if(c==='"')q=true;else if(c===',') {row.push(cur);cur=''}else if(c==='\r'){}else if(c==='\n'){row.push(cur);rows.push(row);row=[];cur=''}else cur+=c}
  }
  if(cur||row.length){row.push(cur);rows.push(row)}
  return rows;
}
function normTitle(s) { return String(s||'').toLowerCase().trim().replace(/\s+/g,' ').replace(/[^\w\s-]/g,''); }
function normSku(s) { return String(s||'').toLowerCase().trim().replace(/\s+/g,''); }
function csvEsc(v) { if (v == null) return ''; const s = String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }

(async () => {
  console.log(`PHASE 7B — RH category backfill from Houzz catalog  (${EXECUTE ? 'EXECUTE' : 'DRY RUN'})\n`);

  // Build catalog lookups
  const text = fs.readFileSync(CATALOG, 'utf-8');
  const rows = parseCSV(text);
  const h = rows[0];
  const idx = (n) => h.indexOf(n);
  const catalog = rows.slice(1).filter(r => r.length > 1 && r[idx('id')]).map(r => ({
    id: String(r[idx('id')]).trim(), name: r[idx('name')], sku: r[idx('sku')], category: r[idx('category')],
  }));
  const byId = new Map(), bySku = new Map(), byTitle = new Map();
  for (const c of catalog) {
    if (c.id) byId.set(c.id, c);
    if (c.sku) { const k = normSku(c.sku); if (k && !bySku.has(k)) bySku.set(k, c); }
    if (c.name) { const k = normTitle(c.name); if (k && !byTitle.has(k)) byTitle.set(k, c); }
  }
  console.log(`  Catalog: ${catalog.length} records (${byId.size} by id, ${bySku.size} by sku, ${byTitle.size} by title)`);

  const app = initializeApp(PROD);
  const db = getFirestore(app);
  const snap = await getDocs(collection(db, 'boards', BOARD_ID, 'clips'));
  console.log(`  ${snap.size} clips in boards/${BOARD_ID}/clips\n`);

  const updates = [];
  let skippedNonHouzz = 0, alreadyHasCat = 0, matchedById = 0, matchedBySku = 0, matchedByTitle = 0, noMatch = 0, catalogHadEmpty = 0;

  snap.forEach(d => {
    const x = d.data();
    if (shouldSkip(x.source)) { skippedNonHouzz++; return; }
    if (!isHouzzSource(x.source)) { skippedNonHouzz++; return; }
    const curCat = String(x.category || '').trim();
    if (curCat) { alreadyHasCat++; return; }

    const hid = String(x.houzzId || x.houzzProductId || '').trim();
    const sku = normSku(x.sku);
    const t = normTitle(x.title || x.name);

    let m = null, by = '';
    if (hid && byId.has(hid)) { m = byId.get(hid); by = 'id'; matchedById++; }
    else if (sku && bySku.has(sku)) { m = bySku.get(sku); by = 'sku'; matchedBySku++; }
    else if (t && byTitle.has(t)) { m = byTitle.get(t); by = 'title'; matchedByTitle++; }
    else { noMatch++; return; }

    const newCat = String(m.category || '').trim();
    if (!newCat) { catalogHadEmpty++; return; }

    updates.push({
      docId: d.id, title: x.title || '', vendor: x.vendor || '', sku: x.sku || '',
      houzzId: hid, matchedBy: by, oldCategory: curCat, newCategory: newCat,
    });
  });

  console.log('--- Plan ---');
  console.log(`  Skipped non-Houzz source:           ${skippedNonHouzz}`);
  console.log(`  Already has category (skip):        ${alreadyHasCat}`);
  console.log(`  Matched by houzzId:                 ${matchedById}`);
  console.log(`  Matched by SKU:                     ${matchedBySku}`);
  console.log(`  Matched by title:                   ${matchedByTitle}`);
  console.log(`  No catalog match (skip):            ${noMatch}`);
  console.log(`  Catalog has empty category (skip):  ${catalogHadEmpty}`);
  console.log(`  TOTAL category writes:              ${updates.length}`);

  // Manifest
  const csv = ['clipDocId,title,vendor,sku,houzzId,matchedBy,oldCategory,newCategory'];
  for (const u of updates) csv.push([u.docId, u.title, u.vendor, u.sku, u.houzzId, u.matchedBy, u.oldCategory, u.newCategory].map(csvEsc).join(','));
  fs.writeFileSync(OUT_CSV, csv.join('\n'));
  console.log(`\n  Manifest: ${OUT_CSV}`);

  if (!EXECUTE) { console.log('\nDRY RUN. --execute to write.'); process.exit(0); }

  console.log('\nWRITING TO PRODUCTION...');
  const BATCH = 400;
  const nowIso = new Date().toISOString();
  let written = 0;
  for (let i = 0; i < updates.length; i += BATCH) {
    const batch = writeBatch(db);
    for (const u of updates.slice(i, i + BATCH)) {
      batch.update(doc(db, 'boards', BOARD_ID, 'clips', u.docId), {
        category: u.newCategory, _categoryBackfilledFromCatalogAt: nowIso,
      });
    }
    await batch.commit();
    written += Math.min(BATCH, updates.length - i);
    console.log(`  wrote ${written}/${updates.length}`);
  }
  console.log('\nDONE.');
  process.exit(0);
})().catch(e => { console.error('FAILED:', e); process.exit(1); });
