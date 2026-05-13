/**
 * PHASE 4B — Enrich /productLibrary/ docs with Houzz catalog data + permanent imageUrl.
 * Default DRY RUN. Pass --execute to write.
 *
 * For each /productLibrary/ doc:
 *  - Match to catalog by SKU then title
 *  - If matched:
 *     - Fill empty fields: houzzId, vendorUrl, dimensions, materials, finish, manufacturer,
 *       description, vendorDescription, msrp, cost
 *     - imageUrl -> permanent Firebase Storage URL (from Phase 2A or 4A manifest)
 *     - Category normalized via Phase 1.5/1.6 logic (rooms moved to room field, typos normalized)
 *     - Markers: _enrichedFromHouzzApr27, _imagesRehostedAt, _imageUrlPrevApr27, _categoryFixedAt
 *  - SKIP if already has _enrichedFromHouzzApr27 (idempotent)
 *  - SKIP if no catalog match
 *
 * Output: phase4b-manifest.csv
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

const CATALOG = String.raw`C:\Users\cindy\Dropbox\Claude - CCH studio\Houzz FILES\cchdesign_0427_original\catalog-items-with-images_cchdesign_0427.csv`;
const PHASE2A = path.join(__dirname, 'phase2a-upload-manifest.json');
const PHASE4A = path.join(__dirname, 'phase4a-upload-manifest.json');
const OUT_CSV = path.join(__dirname, 'phase4b-manifest.csv');
const EXECUTE = process.argv.includes('--execute');

const REAL_CATS_LOWER = new Set([
  'art','mirror','accessories','fabric & trim','furniture','stone & tile','appliances & plumbing','hardware',
  'floor covering','florals','wall','bedding & pillows','wall covering','custom furniture','custom upholstery',
  'cabinets','custom bedding and pillows','custom window coverings','windows','lighting','architectural',
  'outdoor','tile & stone','plumbing & appliances','window treatments','flooring','electrical',
  'mirrors & accessories'
]);
const NORM_CAT = {
  'fabric  + trim': 'Fabric & Trim','fabric + trim': 'Fabric & Trim','fabrics': 'Fabric & Trim','fabric': 'Fabric & Trim',
  'appliances  & plumbing': 'Appliances & Plumbing','mirror': 'Mirror','pillows': 'Bedding & Pillows','pillows & bedding': 'Bedding & Pillows',
  'window': 'Windows','cushions': 'Bedding & Pillows','wallpaper': 'Wall Covering','rug': 'Floor Covering','rugs': 'Floor Covering',
  'flooring': 'Floor Covering','floor': 'Floor Covering','cabinetry': 'Cabinets','cabinet hardware': 'Hardware','architecural': 'Architectural',
  'outdoors': 'Outdoor','furniture & upholstery': 'Furniture','paint': 'Wall Covering','wood stain': 'Cabinets',
  'cabinet door style': 'Cabinets','kitchen and bath': 'Appliances & Plumbing','furnishings': 'Furniture',
};

function parseCSV(t) { const rows=[]; let row=[]; let cur=''; let q=false; for (let i=0;i<t.length;i++){const c=t[i]; if(q){if(c==='"'){if(t[i+1]==='"'){cur+='"';i++}else q=false}else cur+=c} else{if(c==='"')q=true; else if(c===','){row.push(cur);cur=''} else if(c==='\r'){} else if(c==='\n'){row.push(cur);rows.push(row);row=[];cur=''} else cur+=c}} if(cur||row.length){row.push(cur);rows.push(row)} return rows; }
function norm(s) { return String(s||'').toLowerCase().trim().replace(/\s+/g,' ').replace(/[^\w\s-]/g,''); }
function csvEsc(v) { if (v == null) return ''; const s = String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
function isEmptyVal(v) { return v == null || v === '' || (typeof v === 'number' && !isFinite(v)); }
function isProductCategory(s) { return REAL_CATS_LOWER.has(String(s||'').trim().toLowerCase()); }
function normalizeHouzzCat(catRaw) { if (!catRaw) return ''; const k = String(catRaw).trim().toLowerCase().replace(/\s+/g,' '); return NORM_CAT[k] || ''; }
function isAlreadyPermanent(u) { if (!u) return false; const s = String(u).trim(); if (s.startsWith('data:')) return true; if (/firebasestorage\.googleapis\.com|firebasestorage\.app/i.test(s)) return true; if (/cdn\.brandfolder\.io|fourhands\.com|visualcomfort\.com|arteriorshome\.com|brunschwig|kravet\.com/i.test(s)) return true; return false; }

(async () => {
  console.log(`PHASE 4B — Enrich /productLibrary/  (mode: ${EXECUTE ? 'EXECUTE — WRITES' : 'DRY RUN'})\n`);

  // Catalog
  const txt = fs.readFileSync(CATALOG, 'utf-8');
  const rows = parseCSV(txt);
  const h = rows[0];
  const idx = (n) => h.indexOf(n);
  const catalog = rows.slice(1).filter(r => r.length > 1 && r[idx('id')]).map(r => ({
    id: r[idx('id')], name: r[idx('name')], sku: r[idx('sku')], category: r[idx('category')],
    description: r[idx('description')], vendor_description: r[idx('vendor_description')],
    vendor_title: r[idx('vendor_title')], manufacturer: r[idx('manufacturer')],
    materials: r[idx('materials')], finish: r[idx('finish')], dimensions: r[idx('dimensions')],
    url: r[idx('url')], msrp: r[idx('msrp')], cost: r[idx('cost')],
  }));
  const bySku = new Map(), byTitle = new Map();
  for (const c of catalog) {
    if (c.sku) { const k = norm(c.sku); if (k && !bySku.has(k)) bySku.set(k, c); }
    if (c.name) { const k = norm(c.name); if (k && !byTitle.has(k)) byTitle.set(k, c); }
  }

  // Upload manifests (combined)
  const urlByHouzz = new Map();
  for (const fpath of [PHASE2A, PHASE4A]) {
    if (!fs.existsSync(fpath)) continue;
    const m = JSON.parse(fs.readFileSync(fpath, 'utf-8'));
    for (const r of m.results || []) if (r.status === 'ok' && r.downloadUrl && !urlByHouzz.has(r.houzzId)) urlByHouzz.set(String(r.houzzId), r.downloadUrl);
  }
  console.log(`  Permanent URLs available for ${urlByHouzz.size} houzzIds (Phase 2A + 4A combined)`);

  const app = initializeApp(PROD);
  const db = getFirestore(app);
  const psnap = await getDocs(collection(db, 'productLibrary'));
  console.log(`  /productLibrary/: ${psnap.size} docs`);

  const updates = [];
  let skipNoMatch = 0, skipAlreadyDone = 0, willEnrich = 0, willRehost = 0, willCategoryFix = 0;
  const nowIso = new Date().toISOString();

  psnap.forEach(d => {
    const x = d.data();
    if (x._enrichedFromHouzzApr27) { skipAlreadyDone++; return; }

    const sku = norm(x.sku || '');
    const title = norm(x.title || '');
    let m = null;
    if (sku && bySku.has(sku)) m = bySku.get(sku);
    else if (title && byTitle.has(title)) m = byTitle.get(title);
    if (!m) { skipNoMatch++; return; }

    const fields = { _enrichedFromHouzzApr27: nowIso };
    let touched = false;

    // Fill-empty enrichment
    if (isEmptyVal(x.houzzId) && m.id) { fields.houzzId = String(m.id); touched = true; }
    if (isEmptyVal(x.vendorUrl) && m.url) { fields.vendorUrl = m.url; touched = true; }
    if (isEmptyVal(x.dimensions) && m.dimensions) { fields.dimensions = m.dimensions; touched = true; }
    if (isEmptyVal(x.materials) && m.materials) { fields.materials = m.materials; touched = true; }
    if (isEmptyVal(x.finish) && m.finish) { fields.finish = m.finish; touched = true; }
    if (isEmptyVal(x.manufacturer) && m.manufacturer) { fields.manufacturer = m.manufacturer; touched = true; }
    if (isEmptyVal(x.description) && m.description) { fields.description = m.description; touched = true; }
    if (isEmptyVal(x.vendorDescription) && m.vendor_description) { fields.vendorDescription = m.vendor_description; touched = true; }
    if (isEmptyVal(x.msrp) && m.msrp) { const n = parseFloat(m.msrp); if (isFinite(n) && n > 0) { fields.msrp = n; touched = true; } }
    if (isEmptyVal(x.cost) && m.cost) { const n = parseFloat(m.cost); if (isFinite(n) && n > 0) { fields.cost = n; touched = true; } }

    // imageUrl rehost
    const newUrl = urlByHouzz.get(String(m.id));
    const curUrl = String(x.imageUrl || '').trim();
    if (newUrl && !isAlreadyPermanent(curUrl)) {
      fields.imageUrl = newUrl;
      fields._imageUrlPrevApr27 = curUrl;
      fields._imagesRehostedAt = nowIso;
      touched = true; willRehost++;
    }

    // Category cleanup
    const curCat = String(x.category || '').trim();
    if (curCat) {
      const lowerCat = curCat.toLowerCase();
      // ALL-CAPS room board
      if (curCat === curCat.toUpperCase() && curCat.length >= 3 && /[A-Z]/.test(curCat) && REAL_CATS_LOWER.has(lowerCat)) {
        if (isEmptyVal(x.room)) fields.room = curCat;
        const houzzNew = (m.category && isProductCategory(m.category)) ? m.category : (normalizeHouzzCat(m.category) || '');
        fields.category = houzzNew;
        fields._categoryFixedAt = nowIso;
        touched = true; willCategoryFix++;
      } else if (!isProductCategory(lowerCat)) {
        const normd = normalizeHouzzCat(lowerCat);
        if (normd && isProductCategory(normd)) {
          fields.category = normd;
          fields._categoryFixedAt = nowIso;
          touched = true; willCategoryFix++;
        }
      }
    } else if (m.category) {
      // No category; pull from catalog
      const houzzNew = isProductCategory(m.category) ? m.category : (normalizeHouzzCat(m.category) || '');
      if (houzzNew) { fields.category = houzzNew; fields._categoryFixedAt = nowIso; touched = true; willCategoryFix++; }
    }

    if (touched) { willEnrich++; updates.push({ id: d.id, title: x.title || '', houzzId: fields.houzzId || x.houzzId || '', oldImageUrl: curUrl, newImageUrl: fields.imageUrl || curUrl, fields }); }
    else skipAlreadyDone++; // matched but nothing to fill
  });

  console.log('\n--- Action plan ---');
  console.log(`  Will enrich:           ${willEnrich}`);
  console.log(`  Of those, rehost:      ${willRehost}`);
  console.log(`  Of those, fix cat:     ${willCategoryFix}`);
  console.log(`  Skip (no catalog):     ${skipNoMatch}`);
  console.log(`  Skip (already done):   ${skipAlreadyDone}`);

  // Manifest
  const csv = ['libraryDocId,title,houzzId,oldImageUrl,newImageUrl,action'];
  for (const u of updates) csv.push([u.id, u.title, u.houzzId, u.oldImageUrl, u.newImageUrl, EXECUTE ? 'updated' : 'will-update'].map(csvEsc).join(','));
  fs.writeFileSync(OUT_CSV, csv.join('\n'));
  console.log(`\n  Manifest: ${OUT_CSV}`);

  if (!EXECUTE) { console.log('\nDRY RUN complete. Re-run with --execute to write.'); process.exit(0); }

  // Execute
  console.log('\nWRITING TO PRODUCTION /productLibrary/...');
  const BATCH = 400;
  let written = 0;
  for (let i = 0; i < updates.length; i += BATCH) {
    const batch = writeBatch(db);
    const slice = updates.slice(i, i + BATCH);
    for (const u of slice) batch.update(doc(db, 'productLibrary', u.id), u.fields);
    await batch.commit();
    written += slice.length;
    console.log(`  wrote ${written}/${updates.length}`);
  }
  console.log(`\nEXECUTE complete. Wrote ${written}.`);
  process.exit(0);
})().catch(e => { console.error('FAILED:', e); process.exit(1); });
