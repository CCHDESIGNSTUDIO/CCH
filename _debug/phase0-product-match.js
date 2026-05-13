/**
 * Phase 0 dry-run: match Studio production products against Houzz catalog.
 * READ-ONLY. Writes nothing. Outputs a report file.
 *
 * Targets PRODUCTION Firestore (cch-design-boards) for read-only product list.
 * Production rules allow open read on products/, no auth required.
 */
const fs = require('fs');
const path = require('path');
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

// Production config (READ-ONLY — products/ is publicly readable per Firestore rules)
const PROD_CONFIG = {
  apiKey: 'AIzaSyAd24U5ArVGrA24IxNcYD2NYiTVycyF4og',
  authDomain: 'cch-design-boards.firebaseapp.com',
  projectId: 'cch-design-boards',
  storageBucket: 'cch-design-boards.appspot.com',
  messagingSenderId: '210388013080',
  appId: '1:210388013080:web:cch-design-boards',
};

const CATALOG_CSV = String.raw`C:\Users\cindy\Dropbox\Claude - CCH studio\Houzz FILES\cchdesign_0427\catalog-items-with-images_cchdesign_0427.csv`;
const REPORT = 'phase0-product-match-report.md';

function parseCSV(text) {
  // Minimal RFC4180-ish CSV parser
  const rows = []; let row = []; let cur = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') {
        if (text[i+1] === '"') { cur += '"'; i++; }
        else { q = false; }
      } else cur += c;
    } else {
      if (c === '"') q = true;
      else if (c === ',') { row.push(cur); cur = ''; }
      else if (c === '\r') {} // skip
      else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
      else cur += c;
    }
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

function norm(s) {
  return String(s || '').toLowerCase().trim().replace(/\s+/g, ' ').replace(/[^\w\s-]/g, '');
}

(async () => {
  console.log('[1/4] Reading Houzz catalog...');
  const txt = fs.readFileSync(CATALOG_CSV, 'utf-8');
  const rows = parseCSV(txt);
  const header = rows[0];
  const get = (r, n) => { const i = header.indexOf(n); return i >= 0 ? (r[i] || '').trim() : ''; };
  const catalog = rows.slice(1).filter(r => r.length > 1).map(r => ({
    id: get(r, 'id'),
    name: get(r, 'name'),
    sku: get(r, 'sku'),
    manufacturer: get(r, 'manufacturer'),
    supplier: get(r, 'supplier'),
    item_type: get(r, 'item_type'),
    image1: get(r, 'image1'),
    image2: get(r, 'image2'),
    image3: get(r, 'image3'),
    image4: get(r, 'image4'),
    image5: get(r, 'image5'),
  }));
  const catalogWithImg = catalog.filter(c => c.image1);
  console.log(`    catalog: ${catalog.length} items, ${catalogWithImg.length} with images`);

  console.log('[2/4] Connecting to PRODUCTION Studio Firestore (read-only)...');
  const app = initializeApp(PROD_CONFIG);
  const db = getFirestore(app);
  const snap = await getDocs(collection(db, 'products'));
  const studioProducts = [];
  snap.forEach(d => studioProducts.push({ id: d.id, ...d.data() }));
  console.log(`    Studio production products: ${studioProducts.length}`);

  console.log('[3/4] Matching...');
  // Index Houzz catalog by SKU and by normalized title
  const bySku = new Map();
  const byTitle = new Map();
  for (const c of catalogWithImg) {
    if (c.sku) {
      const key = norm(c.sku);
      if (key && !bySku.has(key)) bySku.set(key, c);
    }
    if (c.name) {
      const key = norm(c.name);
      if (key && !byTitle.has(key)) byTitle.set(key, c);
    }
  }

  const matched = []; const unmatched = [];
  for (const p of studioProducts) {
    const studioSku = norm(p.sku || '');
    const studioTitle = norm(p.title || p.name || '');
    let m = null; let how = '';
    if (studioSku && bySku.has(studioSku)) { m = bySku.get(studioSku); how = 'sku'; }
    else if (studioTitle && byTitle.has(studioTitle)) { m = byTitle.get(studioTitle); how = 'title'; }
    const studioHasImage = !!(p.imageUrl || p.image || p.imageURL || (p.images && p.images.length));
    if (m) matched.push({ studio: p, houzz: m, how, studioHasImage });
    else unmatched.push({ studio: p, studioHasImage });
  }

  // Houzz items not in Studio
  const studioSkus = new Set(studioProducts.map(p => norm(p.sku || '')).filter(Boolean));
  const studioTitles = new Set(studioProducts.map(p => norm(p.title || p.name || '')).filter(Boolean));
  const houzzNotInStudio = catalogWithImg.filter(c => {
    const sku = norm(c.sku); const title = norm(c.name);
    return !(sku && studioSkus.has(sku)) && !(title && studioTitles.has(title));
  });

  console.log('[4/4] Writing report...');
  const lines = [];
  lines.push('# Phase 0 Product Library Match Report');
  lines.push('');
  lines.push('**Generated:** ' + new Date().toISOString());
  lines.push('**Mode:** READ-ONLY. No writes performed.');
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`- Studio production products: **${studioProducts.length}**`);
  lines.push(`- Houzz catalog products with images: **${catalogWithImg.length}**`);
  lines.push(`- Studio products matched to Houzz catalog: **${matched.length}**`);
  lines.push(`  - matched by SKU: ${matched.filter(m => m.how === 'sku').length}`);
  lines.push(`  - matched by title: ${matched.filter(m => m.how === 'title').length}`);
  lines.push(`  - already have image in Studio: ${matched.filter(m => m.studioHasImage).length}`);
  lines.push(`  - **eligible for image enrichment: ${matched.filter(m => !m.studioHasImage).length}**`);
  lines.push(`- Studio products with no Houzz match: ${unmatched.length}`);
  lines.push(`- Houzz catalog items NOT in Studio (potential new imports): ${houzzNotInStudio.length}`);
  lines.push('');
  lines.push('## Eligible for image enrichment (sample, first 30)');
  lines.push('');
  const eligible = matched.filter(m => !m.studioHasImage);
  lines.push('| # | Studio title | Studio SKU | Houzz match by | Houzz image |');
  lines.push('|---|---|---|---|---|');
  eligible.slice(0, 30).forEach((m, i) => {
    const t = (m.studio.title || m.studio.name || '').slice(0, 50);
    const sku = (m.studio.sku || '').slice(0, 30);
    const img = (m.houzz.image1 || '').slice(0, 80);
    lines.push(`| ${i + 1} | ${t} | ${sku} | ${m.how} | ${img}... |`);
  });
  if (eligible.length > 30) lines.push(`\n_... and ${eligible.length - 30} more_`);
  lines.push('');
  lines.push('## No Houzz match — sample (first 20)');
  lines.push('');
  unmatched.slice(0, 20).forEach((u, i) => {
    const t = u.studio.title || u.studio.name || '(no title)';
    const sku = u.studio.sku ? ` [${u.studio.sku}]` : '';
    lines.push(`- ${t}${sku}`);
  });
  lines.push('');
  lines.push('## Houzz catalog items not in Studio (top suppliers)');
  lines.push('');
  const supCount = {};
  for (const h of houzzNotInStudio) {
    const s = h.supplier || h.manufacturer || '(unknown)';
    supCount[s] = (supCount[s] || 0) + 1;
  }
  const topSup = Object.entries(supCount).sort((a, b) => b[1] - a[1]).slice(0, 15);
  topSup.forEach(([s, n]) => lines.push(`- ${s}: ${n}`));
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## Next step decision (no code runs until you say so)');
  lines.push('');
  lines.push('1. If "eligible for image enrichment" looks like a useful number → proceed to Phase 1: download images, host on Firebase Storage, update Studio products');
  lines.push('2. If matching looks too low → tweak match logic (e.g. fuzzy title, manufacturer-aware SKU)');
  lines.push('3. The "Houzz items not in Studio" list is a separate decision — import as new products, or leave for later');

  fs.writeFileSync(REPORT, lines.join('\n'));
  console.log(`\nWrote ${REPORT}`);
  process.exit(0);
})().catch(err => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
