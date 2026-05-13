/**
 * Enrich the 6,165 prod-mirrored staging products with richer fields from
 * the new Houzz Apr 27 catalog. Updates only — no deletes, no overwrites of
 * existing data, preserves all room board fields.
 *
 * STAGING ONLY.
 */
const fs = require('fs');
const path = require('path');
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, writeBatch } = require('firebase/firestore');

const STAGING = {
  apiKey: 'AIzaSyBIwwo7uRij6Q0FZg-qmIS1LC8t2AjXrYo',
  authDomain: 'cch-studio-staging.firebaseapp.com',
  projectId: 'cch-studio-staging',
  storageBucket: 'cch-studio-staging.firebasestorage.app',
  messagingSenderId: '210388013080',
  appId: '1:210388013080:web:fcd520b30c0d50b149736d',
};
const CATALOG = String.raw`C:\Users\cindy\Dropbox\Claude - CCH studio\Houzz FILES\cchdesign_0427\catalog-items-with-images_cchdesign_0427.csv`;

const PROTECTED_SOURCES = new Set(['cch-studio-clipper', 'clipper', 'manual', 'ideabook-asset']);

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
function isAwsExpiring(u) {
  if (!u) return true;
  return /ivy-(prod|uploads)\.s3/i.test(u) || (/amazonaws\.com/i.test(u) && /X-Amz-/i.test(u));
}
function isManualImage(u) {
  if (!u) return false;
  if (/firebasestorage\.googleapis\.com/i.test(u)) return true;
  if (!isAwsExpiring(u) && /^https?:\/\//.test(u)) return true; // retail/CDN
  return false;
}

(async () => {
  const start = Date.now();
  console.log('[1/4] Parsing Houzz Apr 27 catalog...');
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
    notes: get(r, 'notes'),
    image1: unwrapHyperlink(get(r, 'image1')),
    url: unwrapHyperlink(get(r, 'url')),
    supplier: get(r, 'supplier'),
  }));
  // Index by SKU + title
  const bySku = new Map(), byTitle = new Map();
  for (const c of catalog) {
    if (c.sku) { const k = norm(c.sku); if (k && !bySku.has(k)) bySku.set(k, c); }
    if (c.title) { const k = norm(c.title); if (k && !byTitle.has(k)) byTitle.set(k, c); }
  }
  console.log(`  catalog: ${catalog.length} items (${bySku.size} sku-indexed, ${byTitle.size} title-indexed)`);

  console.log('[2/4] Reading staging /products/ ...');
  const app = initializeApp(STAGING);
  const db = getFirestore(app);
  const psnap = await getDocs(collection(db, 'products'));
  // Only consider prod-mirrored docs (opaque IDs, not 'houzz-' prefix)
  const prodMirrored = [];
  let catalogOnly = 0;
  psnap.forEach(d => {
    if (d.id.startsWith('houzz-')) catalogOnly++;
    else prodMirrored.push({ _id: d.id, ...d.data() });
  });
  console.log(`  total: ${psnap.size}  catalog-only (skipped): ${catalogOnly}  prod-mirrored: ${prodMirrored.length}`);

  console.log('[3/4] Computing updates (preserving room board fields)...');
  const updates = [];
  let skipProtected = 0, skipNoMatch = 0, skipNothingToUpdate = 0;
  let touchImage = 0, touchHouzzId = 0, touchVendorUrl = 0, touchOtherFields = 0;

  for (const p of prodMirrored) {
    if (PROTECTED_SOURCES.has(String(p.source || '').trim())) { skipProtected++; continue; }
    const studioSku = norm(p.sku || '');
    const studioTitle = norm(p.title || p.name || '');
    let m = null;
    if (studioSku && bySku.has(studioSku)) m = bySku.get(studioSku);
    else if (studioTitle && byTitle.has(studioTitle)) m = byTitle.get(studioTitle);
    if (!m) { skipNoMatch++; continue; }

    const upd = {};

    // imageUrl: refresh ONLY if currently empty or AWS-expiring; never overwrite manual fixes
    const currentImg = (p.imageUrl || '').trim();
    if (!isManualImage(currentImg) && (currentImg === '' || isAwsExpiring(currentImg))) {
      if (m.image1 && m.image1.startsWith('http')) {
        upd.imageUrl = m.image1;
        touchImage++;
      }
    }
    // houzzId: fill if empty
    if (!p.houzzId && m.houzzId) { upd.houzzId = m.houzzId; touchHouzzId++; }
    // vendorUrl: fill if no existing product URL on any field
    const hasAnyUrl = !!(p.vendorUrl || p.productUrl || p.sourceUrl || p.clippedFromUrl || p.pageUrl || p.websiteLink);
    if (!hasAnyUrl && m.url && m.url.startsWith('http')) { upd.vendorUrl = m.url; touchVendorUrl++; }
    // Other fields: only fill if empty
    [
      ['dimensions', 'dimensions'],
      ['materials', 'materials'],
      ['finish', 'finish'],
      ['manufacturer', 'manufacturer'],
      ['description', 'description'],
      ['vendorDescription', 'vendorDescription']
    ].forEach(([studioField, catField]) => {
      const cur = String(p[studioField] || '').trim();
      const cat = String(m[catField] || '').trim();
      if (!cur && cat) { upd[studioField] = cat; touchOtherFields++; }
    });

    if (Object.keys(upd).length === 0) { skipNothingToUpdate++; continue; }

    upd._enrichedFromHouzzApr27 = new Date().toISOString();
    updates.push({ id: p._id, fields: upd });
  }

  console.log(`  protected source (skipped): ${skipProtected}`);
  console.log(`  no Houzz catalog match: ${skipNoMatch}`);
  console.log(`  matched but already complete: ${skipNothingToUpdate}`);
  console.log(`  PLANNED UPDATES: ${updates.length}`);
  console.log(`    - imageUrl refresh: ${touchImage}`);
  console.log(`    - houzzId fill: ${touchHouzzId}`);
  console.log(`    - vendorUrl fill: ${touchVendorUrl}`);
  console.log(`    - other field fills (across all docs): ${touchOtherFields}`);

  if (updates.length === 0) {
    console.log('\nNothing to update.');
    process.exit(0);
  }

  console.log('\n[4/4] Writing updates in batches of 400...');
  const BATCH = 400;
  let written = 0;
  for (let i = 0; i < updates.length; i += BATCH) {
    const batch = writeBatch(db);
    const slice = updates.slice(i, i + BATCH);
    for (const u of slice) {
      batch.update(doc(db, 'products', u.id), u.fields);
    }
    await batch.commit();
    written += slice.length;
    if (written % 2000 === 0 || written === updates.length) {
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      console.log(`  ${written}/${updates.length} (${elapsed}s)`);
    }
  }

  const total = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\nDONE in ${total}s. Updated ${written} prod-mirrored staging products.`);
  console.log('Production untouched.');
  process.exit(0);
})().catch(e => { console.error('FAILED:', e); process.exit(1); });
