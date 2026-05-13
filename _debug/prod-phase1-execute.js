/**
 * PHASE 1 EXECUTE — production /products/ enrichment.
 * THIS SCRIPT WRITES TO PRODUCTION.
 *
 * Same logic as prod-phase1-dryrun.js. Fill-empty-only. Skip protected & locked.
 * Outputs phase1-prod-execute-manifest.csv with every doc + every field changed.
 */
const fs = require('fs');
const path = require('path');
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, writeBatch } = require('firebase/firestore');

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
function needsImageRefresh(u) {
  if (!u || typeof u !== 'string') return true;
  const s = u.trim();
  if (s === '' || !/^https?:\/\//i.test(s)) return true;
  if (/ivy-(prod|uploads)/i.test(s)) return true;
  if (/houzz/i.test(s)) return true;
  if (/X-Amz-/i.test(s)) return true;
  if (/[?&]AWSAccessKeyId=/i.test(s)) return true;
  if (/amazonaws/i.test(s) && /[?&]Expires=\d/i.test(s)) return true;
  return false;
}
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
  console.log('PHASE 1 EXECUTE — Production /products/ enrichment');
  console.log('THIS WILL WRITE TO PRODUCTION (cch-design-boards).\n');

  console.log('[1/5] Parsing Houzz catalog...');
  const txt = fs.readFileSync(CATALOG, 'utf-8');
  const rows = parseCSV(txt);
  const h = rows[0];
  const get = (r, n) => { const i = h.indexOf(n); return i >= 0 ? (r[i] || '').trim() : ''; };
  const catalog = rows.slice(1).filter(r => r.length > 1 && get(r, 'id')).map(r => ({
    houzzId: get(r, 'id'),
    title: get(r, 'name'),
    sku: get(r, 'sku'),
    category: get(r, 'category'),
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

  console.log('[2/5] Reading PRODUCTION /products/...');
  const app = initializeApp(PROD);
  const db = getFirestore(app);
  const psnap = await getDocs(collection(db, 'products'));
  const products = [];
  psnap.forEach(d => products.push({ _id: d.id, ...d.data() }));
  console.log(`  ${products.length} products`);

  console.log('[3/5] Building locked set...');
  const bsnap = await getDocs(collection(db, 'boards'));
  const allLineItems = [];
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
                  allLineItems.push({ title: norm(it.title || it.name || it.description || ''), sku: norm(it.sku || '') });
                }
              }
            }
          }
        });
      } catch (_e) {}
    }
  }
  console.log(`  ${allLineItems.length} line items collected`);

  console.log('[4/5] Computing updates...');
  const updates = [];
  const stats = { protected: 0, locked: 0, noMatch: 0, noFills: 0, willUpdate: 0 };
  for (const p of products) {
    if (PROTECTED_SOURCES.has(String(p.source || '').trim())) { stats.protected++; continue; }
    const studioSku = norm(p.sku || '');
    const studioTitle = norm(p.title || p.name || '');
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
    if (locked) { stats.locked++; continue; }

    let m = null;
    if (studioSku && bySku.has(studioSku)) m = bySku.get(studioSku);
    else if (studioTitle && byTitle.has(studioTitle)) m = byTitle.get(studioTitle);
    if (!m) { stats.noMatch++; continue; }

    const fills = {};
    const currentImg = String(p.imageUrl || '').trim();
    if (needsImageRefresh(currentImg) && !isPermanentImage(currentImg)) {
      if (m.image1 && m.image1.startsWith('http')) fills.imageUrl = m.image1;
    }
    if (!p.houzzId && m.houzzId) fills.houzzId = m.houzzId;
    const hasAnyUrl = !!(p.vendorUrl || p.productUrl || p.sourceUrl || p.clippedFromUrl || p.pageUrl || p.websiteLink);
    if (!hasAnyUrl && m.url && m.url.startsWith('http')) fills.vendorUrl = m.url;
    for (const [studioField, catField] of [
      ['category','category'],
      ['dimensions','dimensions'], ['materials','materials'], ['finish','finish'],
      ['manufacturer','manufacturer'], ['description','description'], ['vendorDescription','vendorDescription']
    ]) {
      const cur = String(p[studioField] || '').trim();
      const cat = String(m[catField] || '').trim();
      if (!cur && cat) fills[studioField] = cat;
    }

    if (Object.keys(fills).length === 0) { stats.noFills++; continue; }
    fills._enrichedFromHouzzApr27 = new Date().toISOString();
    updates.push({ id: p._id, title: p.title, fills });
    stats.willUpdate++;
  }

  console.log(`  protected: ${stats.protected}  locked: ${stats.locked}  noMatch: ${stats.noMatch}  noFills: ${stats.noFills}`);
  console.log(`  WILL UPDATE: ${stats.willUpdate}`);

  console.log('\n[5/5] WRITING TO PRODUCTION in batches of 400...');
  const BATCH = 400;
  let written = 0;
  const writeStart = Date.now();
  for (let i = 0; i < updates.length; i += BATCH) {
    const batch = writeBatch(db);
    const slice = updates.slice(i, i + BATCH);
    for (const u of slice) batch.update(doc(db, 'products', u.id), u.fills);
    await batch.commit();
    written += slice.length;
    if (written % 800 === 0 || written === updates.length) {
      const t = ((Date.now() - writeStart) / 1000).toFixed(1);
      console.log(`  ${written}/${updates.length} (${t}s)`);
    }
  }

  // Manifest
  const cols = ['studioId','title','fieldsChanged','newImageUrl','newHouzzId','newVendorUrl','newCategory','newDimensions','newManufacturer','newMaterials','newFinish','newDescription','newVendorDescription'];
  const csv = [cols.join(',')];
  for (const u of updates) {
    csv.push([
      csvEsc(u.id),
      csvEsc(u.title || ''),
      csvEsc(Object.keys(u.fills).filter(k => !k.startsWith('_')).join('|')),
      csvEsc(u.fills.imageUrl || ''),
      csvEsc(u.fills.houzzId || ''),
      csvEsc(u.fills.vendorUrl || ''),
      csvEsc(u.fills.category || ''),
      csvEsc((u.fills.dimensions || '').slice(0, 100)),
      csvEsc(u.fills.manufacturer || ''),
      csvEsc((u.fills.materials || '').slice(0, 100)),
      csvEsc(u.fills.finish || ''),
      csvEsc((u.fills.description || '').slice(0, 100)),
      csvEsc((u.fills.vendorDescription || '').slice(0, 100)),
    ].join(','));
  }
  fs.writeFileSync('phase1-prod-execute-manifest.csv', csv.join('\n'));

  const total = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\nDONE in ${total}s.`);
  console.log(`Wrote ${written} production product updates.`);
  console.log(`Manifest: phase1-prod-execute-manifest.csv (${updates.length} rows)`);
  process.exit(0);
})().catch(e => { console.error('FAILED:', e); process.exit(1); });
