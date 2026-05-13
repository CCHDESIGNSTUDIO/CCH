/**
 * PHASE 1 DRY-RUN — production /products/ enrichment.
 * READ-ONLY. NO WRITES.
 *
 * Rules (per Cynthia's safety contract):
 *   - Only FILL empty fields, never overwrite anything populated.
 *   - Skip products with source = cch-studio-clipper / clipper / manual.
 *   - Skip locked products (referenced in any proposal/invoice/PO line item).
 *   - Update only: imageUrl (if aws-expiring or empty), houzzId, vendorUrl,
 *     dimensions, materials, finish, manufacturer, description, vendorDescription.
 *   - imageUrl preserve: Firebase Storage URLs and retail/CDN URLs (manual fixes).
 *
 * Output:
 *   - phase1-prod-dryrun-summary.txt   (counts)
 *   - phase1-prod-dryrun-manifest.csv  (per-product detail)
 */
const fs = require('fs');
const path = require('path');
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

const PROD = {
  apiKey: 'AIzaSyAd24U5ArVGrA24IxNcYD2NYiTVycyF4og',
  authDomain: 'cch-design-boards.firebaseapp.com',
  projectId: 'cch-design-boards',
  storageBucket: 'cch-design-boards.appspot.com',
  messagingSenderId: '210388013080',
  appId: '1:210388013080:web:cch-design-boards',
};
const CATALOG = String.raw`C:\Users\cindy\Dropbox\Claude - CCH studio\Houzz FILES\cchdesign_0427_original\catalog-items-with-images_cchdesign_0427.csv`;

const PROTECTED_SOURCES = new Set(['cch-studio-clipper', 'clipper', 'manual', 'ideabook-asset']);
const FILL_FIELDS = ['houzzId', 'vendorUrl', 'dimensions', 'materials', 'finish', 'manufacturer', 'description', 'vendorDescription'];

function decodeHtml(s) { return String(s||'').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>'); }
function unwrapHyperlink(c) { if(typeof c!=='string')return c; const m=c.match(/^=HYPERLINK\("([^"]+)"/i); return decodeHtml(m?m[1]:c); }
function parseCSV(text) {
  const rows=[]; let row=[]; let cur=''; let q=false;
  for (let i=0;i<text.length;i++){const c=text[i];
    if(q){if(c==='"'){if(text[i+1]==='"'){cur+='"';i++}else q=false}else cur+=c}
    else{if(c==='"')q=true;else if(c===',') {row.push(cur);cur=''}else if(c==='\r'){}else if(c==='\n'){row.push(cur);rows.push(row);row=[];cur=''}else cur+=c}
  }
  if(cur||row.length){row.push(cur);rows.push(row)}
  return rows;
}
function norm(s) { return String(s||'').toLowerCase().trim().replace(/\s+/g,' ').replace(/[^\w\s-]/g,''); }
// True if this imageUrl needs to be refreshed (empty, expiring, or Houzz/AWS source)
function needsImageRefresh(u) {
  if (!u || typeof u !== 'string') return true;
  const s = u.trim();
  if (s === '' || !/^https?:\/\//i.test(s)) return true;
  // Houzz/AWS signed URLs — all expire eventually
  if (/ivy-(prod|uploads)/i.test(s)) return true;
  if (/houzz/i.test(s)) return true;
  if (/X-Amz-/i.test(s)) return true;
  if (/[?&]AWSAccessKeyId=/i.test(s)) return true;
  if (/amazonaws/i.test(s) && /[?&]Expires=\d/i.test(s)) return true;
  return false;
}
// True if this imageUrl is durable and should be preserved (Firebase Storage or vendor CDN)
function isPermanentImage(u) {
  if (!u || typeof u !== 'string') return false;
  if (/firebasestorage\.googleapis\.com/i.test(u)) return true;
  if (/^https?:\/\//i.test(u) && !needsImageRefresh(u)) return true;
  return false;
}
function csvEsc(v) {
  if (v == null) return '';
  const s = String(v);
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

(async () => {
  const start = Date.now();
  console.log('PHASE 1 DRY-RUN — Production /products/ enrichment');
  console.log('READ-ONLY. NO WRITES.\n');

  console.log('[1/5] Parsing Houzz catalog...');
  const txt = fs.readFileSync(CATALOG, 'utf-8');
  const rows = parseCSV(txt);
  const h = rows[0];
  const get = (r, n) => { const i = h.indexOf(n); return i >= 0 ? (r[i] || '').trim() : ''; };
  const catalog = rows.slice(1).filter(r => r.length > 1 && get(r, 'id')).map(r => ({
    houzzId: get(r, 'id'),
    title: get(r, 'name'),
    sku: get(r, 'sku'),
    description: get(r, 'description'),
    vendorDescription: get(r, 'vendor_description'),
    manufacturer: get(r, 'manufacturer'),
    materials: get(r, 'materials'),
    finish: get(r, 'finish'),
    dimensions: get(r, 'dimensions'),
    image1: unwrapHyperlink(get(r, 'image1')),
    url: unwrapHyperlink(get(r, 'url')),
  }));
  const bySku = new Map(), byTitle = new Map();
  for (const c of catalog) {
    if (c.sku) { const k = norm(c.sku); if (k && !bySku.has(k)) bySku.set(k, c); }
    if (c.title) { const k = norm(c.title); if (k && !byTitle.has(k)) byTitle.set(k, c); }
  }
  console.log(`  ${catalog.length} catalog items indexed`);
  // Diagnostic: how many catalog items have a valid image1 URL after unwrap
  let catWithImage = 0;
  for (const c of catalog) if (c.image1 && c.image1.startsWith('http')) catWithImage++;
  console.log(`  catalog items with valid image1 (post-unwrap): ${catWithImage}`);
  // Print 3 sample catalog image1 values for sanity
  console.log('  sample catalog image1 values:');
  for (let si = 0; si < 3; si++) {
    if (catalog[si]) console.log(`    [${si}] "${catalog[si].title}": image1=${(catalog[si].image1||'').slice(0, 100)}`);
  }

  console.log('[2/5] Reading PRODUCTION /products/ (read-only)...');
  const app = initializeApp(PROD);
  const db = getFirestore(app);
  const psnap = await getDocs(collection(db, 'products'));
  const products = [];
  psnap.forEach(d => products.push({ _id: d.id, ...d.data() }));
  console.log(`  ${products.length} production products`);

  console.log('[3/5] Building locked-products set (scanning all boards...)');
  const bsnap = await getDocs(collection(db, 'boards'));
  const allLineItems = [];
  let scanned = 0;
  for (const b of bsnap.docs) {
    for (const sub of ['proposals','invoices','purchaseOrders']) {
      try {
        const ssnap = await getDocs(collection(db, 'boards', b.id, sub));
        ssnap.forEach(d => {
          const x = d.data();
          for (const f of ['items','lineItems']) {
            if (Array.isArray(x[f])) {
              for (const it of x[f]) {
                if (it && (it.title || it.name || it.description || it.sku)) {
                  allLineItems.push({
                    title: norm(it.title || it.name || it.description || ''),
                    sku: norm(it.sku || ''),
                  });
                }
              }
            }
          }
        });
      } catch (_e) {}
    }
    scanned++;
    if (scanned % 25 === 0) console.log(`  scanned ${scanned}/${bsnap.size} boards (${allLineItems.length} line items)`);
  }
  console.log(`  ${allLineItems.length} line items collected from ${bsnap.size} boards`);
  console.log(`  NOTE: top-level /invoices not scanned (auth required) — possibly undercounts locked`);

  console.log('[4/5] Computing what would be filled...');
  const stats = {
    total: products.length,
    skippedProtected: 0,
    skippedLocked: 0,
    noHouzzMatch: 0,
    noFieldsToFill: 0,
    wouldUpdate: 0,
  };
  // Diagnostic: classify all 6,165 imageUrls so we can see the distribution
  const imgClass = { empty: 0, houzzAws: 0, permanentFirebase: 0, permanentOther: 0, other: 0 };
  for (const p of products) {
    const u = String(p.imageUrl || '').trim();
    if (!u) imgClass.empty++;
    else if (needsImageRefresh(u)) imgClass.houzzAws++;
    else if (/firebasestorage\.googleapis\.com/i.test(u)) imgClass.permanentFirebase++;
    else if (/^https?:\/\//i.test(u)) imgClass.permanentOther++;
    else imgClass.other++;
  }
  const fillCount = { imageUrl: 0, houzzId: 0, vendorUrl: 0, category: 0, dimensions: 0, materials: 0, finish: 0, manufacturer: 0, description: 0, vendorDescription: 0 };
  const manifestRows = [];

  for (const p of products) {
    if (PROTECTED_SOURCES.has(String(p.source || '').trim())) { stats.skippedProtected++; continue; }

    const studioSku = norm(p.sku || '');
    const studioTitle = norm(p.title || p.name || '');

    // Locked check (same fuzzy logic Studio uses)
    let locked = false;
    if (studioSku) {
      for (const li of allLineItems) {
        if (li.sku && li.sku === studioSku) { locked = true; break; }
        if (studioSku.length >= 4 && li.title.includes(studioSku)) { locked = true; break; }
      }
    }
    if (!locked && studioTitle.length >= 6) {
      for (const li of allLineItems) {
        if (li.title.includes(studioTitle)) { locked = true; break; }
      }
    }
    if (locked) { stats.skippedLocked++; continue; }

    // Find Houzz catalog match
    let m = null;
    if (studioSku && bySku.has(studioSku)) m = bySku.get(studioSku);
    else if (studioTitle && byTitle.has(studioTitle)) m = byTitle.get(studioTitle);
    if (!m) { stats.noHouzzMatch++; continue; }

    // Compute fills
    const fills = {};
    // imageUrl: refresh if empty/expiring; preserve only Firebase Storage + true vendor CDN URLs
    const currentImg = String(p.imageUrl || '').trim();
    const wantRefresh = needsImageRefresh(currentImg) && !isPermanentImage(currentImg);
    const catImg = m.image1;
    const catImgValid = !!(catImg && catImg.startsWith('http'));
    // First-3 debug log
    if (stats.wouldUpdate < 3) {
      console.log(`  DEBUG[${p._id}]: currentImg="${currentImg.slice(0,60)}" wantRefresh=${wantRefresh} catImg="${(catImg||'').slice(0,60)}" catImgValid=${catImgValid}`);
    }
    if (wantRefresh && catImgValid) {
      fills.imageUrl = catImg;
    }
    // houzzId
    if (!p.houzzId && m.houzzId) fills.houzzId = m.houzzId;
    // vendorUrl
    const hasAnyUrl = !!(p.vendorUrl || p.productUrl || p.sourceUrl || p.clippedFromUrl || p.pageUrl || p.websiteLink);
    if (!hasAnyUrl && m.url && m.url.startsWith('http')) fills.vendorUrl = m.url;
    // Other fields: only fill empty
    for (const [studioField, catField] of [
      ['category','category'],
      ['dimensions','dimensions'], ['materials','materials'], ['finish','finish'],
      ['manufacturer','manufacturer'], ['description','description'], ['vendorDescription','vendorDescription']
    ]) {
      const cur = String(p[studioField] || '').trim();
      const cat = String(m[catField] || '').trim();
      if (!cur && cat) fills[studioField] = cat;
    }

    if (Object.keys(fills).length === 0) { stats.noFieldsToFill++; continue; }

    stats.wouldUpdate++;
    for (const f of Object.keys(fills)) fillCount[f] = (fillCount[f] || 0) + 1;

    manifestRows.push({
      studioId: p._id,
      studioTitle: p.title || '',
      studioSku: p.sku || '',
      studioVendor: p.vendor || '',
      source: p.source || '',
      catalogHouzzId: m.houzzId,
      fillsList: Object.keys(fills).join('|'),
      newImageUrl: fills.imageUrl || '',
      newHouzzId: fills.houzzId || '',
      newVendorUrl: fills.vendorUrl || '',
      newDimensions: (fills.dimensions || '').slice(0, 80),
      newMaterials: (fills.materials || '').slice(0, 80),
      newManufacturer: fills.manufacturer || '',
    });
  }

  console.log('[5/5] Writing reports...');
  const sumLines = [];
  const w = (s) => sumLines.push(s == null ? '' : s);
  w('PHASE 1 DRY-RUN SUMMARY — production /products/ enrichment');
  w('READ-ONLY. NO WRITES PERFORMED.');
  w(`Run time: ${((Date.now()-start)/1000).toFixed(1)}s`);
  w('');
  w('SUMMARY');
  w(`  Total production products:               ${stats.total}`);
  w(`  Skipped — protected source:              ${stats.skippedProtected}  (Clipper/manual)`);
  w(`  Skipped — locked (on a doc):             ${stats.skippedLocked}`);
  w(`  Skipped — no Houzz catalog match:        ${stats.noHouzzMatch}`);
  w(`  Skipped — match found but nothing empty: ${stats.noFieldsToFill}`);
  w(`  WOULD UPDATE:                            ${stats.wouldUpdate}`);
  w('');
  w('IMAGE URL CLASSIFICATION (across ALL 6,165 prod products):');
  w(`  empty:                                  ${imgClass.empty}`);
  w(`  houzz/AWS expiring (refresh candidate): ${imgClass.houzzAws}`);
  w(`  Firebase Storage (preserve):            ${imgClass.permanentFirebase}`);
  w(`  Other vendor CDN (preserve):            ${imgClass.permanentOther}`);
  w(`  invalid/non-http:                       ${imgClass.other}`);
  w('');
  w('FIELD-FILL COUNTS (across all updated products)');
  w(`  imageUrl refresh (was empty/aws-expiring): ${fillCount.imageUrl}`);
  w(`  houzzId fill:                              ${fillCount.houzzId}`);
  w(`  vendorUrl fill:                            ${fillCount.vendorUrl}`);
  w(`  category fill (only if empty):             ${fillCount.category}`);
  w(`  dimensions fill:                           ${fillCount.dimensions}`);
  w(`  materials fill:                            ${fillCount.materials}`);
  w(`  finish fill:                               ${fillCount.finish}`);
  w(`  manufacturer fill:                         ${fillCount.manufacturer}`);
  w(`  description fill:                          ${fillCount.description}`);
  w(`  vendorDescription fill:                    ${fillCount.vendorDescription}`);
  w('');
  w('CAVEAT: locked-products check did NOT scan top-level /invoices');
  w('(auth required). Locked count may be undercounted.');
  w('');
  w(`Detailed manifest: phase1-prod-dryrun-manifest.csv (${manifestRows.length} rows)`);

  fs.writeFileSync('phase1-prod-dryrun-summary.txt', sumLines.join('\n'));

  // CSV manifest
  const cols = ['studioId','studioTitle','studioSku','studioVendor','source','catalogHouzzId','fillsList','newImageUrl','newHouzzId','newVendorUrl','newDimensions','newMaterials','newManufacturer'];
  const csv = [cols.join(',')];
  for (const r of manifestRows) csv.push(cols.map(c => csvEsc(r[c])).join(','));
  fs.writeFileSync('phase1-prod-dryrun-manifest.csv', csv.join('\n'));

  console.log('\n' + sumLines.join('\n'));
  console.log('\nFiles written: phase1-prod-dryrun-summary.txt, phase1-prod-dryrun-manifest.csv');
  process.exit(0);
})().catch(e => { console.error('FAILED:', e); process.exit(1); });
