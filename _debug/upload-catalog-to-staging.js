/**
 * Upload Houzz Apr 27 catalog -> staging Firestore products/ collection.
 * Maps Houzz columns to Studio's product schema.
 * Uses AWS URLs as-is for now; bulk image downloader will replace with permanent URLs later.
 */
const fs = require('fs');
const path = require('path');
const { initializeApp } = require('firebase/app');
const { getFirestore, doc, writeBatch } = require('firebase/firestore');

const STAGING = {
  apiKey: 'AIzaSyBIwwo7uRij6Q0FZg-qmIS1LC8t2AjXrYo',
  authDomain: 'cch-studio-staging.firebaseapp.com',
  projectId: 'cch-studio-staging',
  storageBucket: 'cch-studio-staging.firebasestorage.app',
  messagingSenderId: '210388013080',
  appId: '1:210388013080:web:fcd520b30c0d50b149736d',
};

const CATALOG = String.raw`C:\Users\cindy\Dropbox\Claude - CCH studio\Houzz FILES\cchdesign_0427\catalog-items-with-images_cchdesign_0427.csv`;

function decodeHtml(s) {
  return String(s || '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}
function unwrapHyperlink(cell) {
  if (typeof cell !== 'string') return cell;
  const m = cell.match(/^=HYPERLINK\("([^"]+)"/i);
  return decodeHtml(m ? m[1] : cell);
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
function parseNum(s) {
  if (s === undefined || s === null || s === '') return null;
  const n = Number(String(s).replace(/[^\d.-]/g, ''));
  return isNaN(n) ? null : n;
}

(async () => {
  console.log('[1/3] Parsing catalog...');
  const txt = fs.readFileSync(CATALOG, 'utf-8');
  const rows = parseCSV(txt);
  const h = rows[0];
  const get = (r, n) => { const i = h.indexOf(n); return i >= 0 ? (r[i] || '').trim() : ''; };
  const products = rows.slice(1).filter(r => r.length > 1 && get(r, 'id')).map(r => {
    const images = [1,2,3,4,5].map(n => unwrapHyperlink(get(r, 'image' + n))).filter(u => u && u.startsWith('http'));
    return {
      houzzId: get(r, 'id'),
      title: get(r, 'name'),
      category: get(r, 'category'),
      itemType: get(r, 'item_type'),
      description: get(r, 'description'),
      vendorDescription: get(r, 'vendor_description'),
      unitType: get(r, 'unit_type'),
      quantity: parseNum(get(r, 'quantity')),
      vendor: get(r, 'supplier') || get(r, 'manufacturer'),
      manufacturer: get(r, 'manufacturer'),
      websiteLink: unwrapHyperlink(get(r, 'url')),
      materials: get(r, 'materials'),
      finish: get(r, 'finish'),
      sku: get(r, 'sku'),
      dimensions: get(r, 'dimensions'),
      notes: get(r, 'notes'),
      retailPrice: parseNum(get(r, 'msrp')),
      markupPct: parseNum(get(r, 'markup')),
      cost: parseNum(get(r, 'cost')),
      shippingCost: parseNum(get(r, 'shipping_cost')),
      taxable: get(r, 'taxable') === 'yes',
      imageUrl: images[0] || '',
      images,
      source: 'houzz-catalog-apr27',
      _stagedAt: new Date().toISOString(),
    };
  });
  console.log(`  parsed ${products.length} products (${products.filter(p => p.imageUrl).length} with images)`);

  console.log('[2/3] Connecting to STAGING Firestore...');
  const app = initializeApp(STAGING);
  const db = getFirestore(app);

  console.log('[3/3] Writing in batches of 400...');
  const BATCH_SIZE = 400;
  let written = 0;
  const start = Date.now();
  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    const slice = products.slice(i, i + BATCH_SIZE);
    for (const p of slice) {
      const docId = `houzz-${p.houzzId}`;
      batch.set(doc(db, 'products', docId), p);
    }
    await batch.commit();
    written += slice.length;
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`  ${written}/${products.length} (${elapsed}s)`);
  }

  console.log(`\nDone. ${written} products in staging /products/`);
  console.log('View staging Studio product library:');
  console.log('  https://cch-platform-staging.web.app/#/products');
  process.exit(0);
})().catch(e => { console.error('FAILED:', e); process.exit(1); });
