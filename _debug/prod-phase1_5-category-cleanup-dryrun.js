/**
 * PHASE 1.5 DRY-RUN — Category cleanup.
 * Detect prod products where category is actually a room name. Plan to:
 *   - Move category → room (if room empty)
 *   - Set category from Houzz catalog match (if matched)
 *   - Else clear category
 * READ-ONLY. NO WRITES.
 */
const fs = require('fs');
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

// Pulled DIRECTLY from CCH Clipper sidebar.js — single source of truth for category taxonomy
const MASTER_PRODUCT_CATEGORIES = [
  'Art','Mirror','Accessories','Fabric & Trim','Furniture','Stone & Tile',
  'Appliances & Plumbing','Hardware','Floor Covering','Florals','Wall',
  'Bedding & Pillows','Wall Covering','Custom Furniture','Custom Upholstery',
  'Cabinets','Custom Bedding and Pillows','Custom Window Coverings','Windows',
  'Lighting','Architectural'
];
const VALID_FFE_LOWER = new Set([
  'accessories','architectural','art','bedding & pillows','fabric & trim','flooring',
  'furniture','hardware','lighting','outdoor','plumbing & appliances','appliances & plumbing',
  'tile & stone','wall covering','window treatments','mirror','custom furniture','custom upholstery',
  'cabinets','windows','stone & tile','floor covering','florals','tv','electrical',
  'custom bedding and pillows','custom window coverings'
]);
const SERVICE_CATEGORIES_LOWER = new Set([
  'cch design service','cch project management','custom labor','expenses','expense',
  'design services','blended design services','consultation'
]);
// Map of common typos/variants observed in production + Houzz catalog -> Clipper master category
const CATEGORY_NORMALIZATION = {
  // Spacing/punctuation typos
  'fabric  + trim': 'Fabric & Trim',
  'fabric + trim': 'Fabric & Trim',
  'fabrics': 'Fabric & Trim',
  'fabric': 'Fabric & Trim',
  'fabri': 'Fabric & Trim',
  'fab': 'Fabric & Trim',
  'appliances  & plumbing': 'Appliances & Plumbing',
  // Plurals / case
  'mirror': 'Mirror',
  'pillows': 'Bedding & Pillows',
  'pillows & bedding': 'Bedding & Pillows',
  'window': 'Windows',
  'cushions': 'Bedding & Pillows',
  'wallpaper': 'Wall Covering',
  'rug': 'Floor Covering',
  'rugs': 'Floor Covering',
  'flooring': 'Floor Covering',
  'floor': 'Floor Covering',
  'cabinetry': 'Cabinets',
  'cabinet hardware': 'Hardware',
  'architecural': 'Architectural',
  'outdoors': 'Outdoor',
  // KEEP-AS-IS combined categories per Cynthia (don't normalize):
  //   'Mirrors & Accessories' — stays
  // Other concatenated/ambiguous defaults:
  'furniture & upholstery': 'Furniture',
  'lightingbedding & pillows': 'Bedding & Pillows',
  // Specifics that should fold under broader categories
  'paint': 'Wall Covering',
  'wood stain': 'Cabinets',
  'cabinet door style': 'Cabinets',
  'kitchen and bath': 'Appliances & Plumbing',
  'furnishings': 'Furniture',
  'inventory': '', // unclear — clear it
  'uncategorized': '', // clear it
};
function normalizeToWhitelist(catRaw) {
  if (!catRaw) return '';
  const key = String(catRaw).trim().toLowerCase().replace(/\s+/g, ' ');
  if (CATEGORY_NORMALIZATION.hasOwnProperty(key)) return CATEGORY_NORMALIZATION[key];
  return '';
}
function isRealCategory(s) {
  const t = String(s || '').trim().toLowerCase();
  if (!t) return false;
  if (MASTER_PRODUCT_CATEGORIES.some(c => c.toLowerCase() === t)) return true;
  if (VALID_FFE_LOWER.has(t)) return true;
  if (SERVICE_CATEGORIES_LOWER.has(t)) return true;
  return false;
}
// Strict: only PRODUCT-type categories (no services, no expenses, no labor)
// CCH-specific approved categories beyond Clipper's master list
const CCH_EXTENDED_CATEGORIES = new Set([
  'mirrors & accessories',
]);
function isProductCategory(s) {
  const t = String(s || '').trim().toLowerCase();
  if (!t) return false;
  if (MASTER_PRODUCT_CATEGORIES.some(c => c.toLowerCase() === t)) return true;
  if (VALID_FFE_LOWER.has(t)) return true;
  if (CCH_EXTENDED_CATEGORIES.has(t)) return true;
  return false;
}
// Tag for items that shouldn't be in the product library (per Cynthia's rule)
function isNotAProduct(s) {
  const t = String(s || '').trim().toLowerCase();
  if (!t) return false;
  if (SERVICE_CATEGORIES_LOWER.has(t)) return true;
  // Common variants
  if (/freight|shipping|transaction\s*fee|pre.?paid\s*tax|tax\s*charge|labor|design.?fee|design.?service|project.?management|consultation/i.test(t)) return true;
  return false;
}
// CCH-specific room names that aren't caught by the generic regex (per Cynthia's confirmation)
const CCH_KNOWN_ROOMS = new Set([
  'inventory',
  'bar',
  'damon', 'kelly', 'calvin', 'emi', 'tracey', 'ron',
  'garza blanca',
]);
// Same logic as Clipper's clipperStringLooksLikePhysicalRoom
function looksLikePhysicalRoom(s) {
  const t = String(s || '').trim();
  if (!t) return false;
  if (isRealCategory(t)) return false;
  if (CCH_KNOWN_ROOMS.has(t.toLowerCase())) return true;
  const roomRe = /(\b(bedroom|bathroom|bath|kitchen|closet|pantry|laundry|mudroom|garage|office|den|nursery|suite|foyer|entry|lobby|walk-?in|powder|living|dining|game\s*room|family\s*room|great\s*room|family\b|great\b|lounge|library|study|music|theater|theatre|media|piano|cellar|wine\s*cellar|terrace|butler|master\b|guest|upstairs|downstairs|hallway|hall\b|\bL\d\b|second\s+floor|first\s+floor|basement|attic|porch|patio|deck|sunroom|playroom|nook|exterior|gym))/i;
  if (roomRe.test(t)) return true;
  if (/'s\s|’s\s/.test(t) && /(closet|room|bedroom|bathroom|office|suite|nook)/i.test(t)) return true;
  if (/\s-\s/.test(t) && /(guest|bedroom|bath|master|office)/i.test(t)) return true;
  return false;
}
function csvEsc(v) {
  if (v == null) return '';
  const s = String(v);
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

(async () => {
  console.log('PHASE 1.5 DRY-RUN — Category cleanup');
  console.log('READ-ONLY. NO WRITES.\n');

  console.log('[1/4] Loading official category whitelist from Clipper taxonomy...');
  console.log(`  ${MASTER_PRODUCT_CATEGORIES.length} master + ${VALID_FFE_LOWER.size} FFE variants + ${SERVICE_CATEGORIES_LOWER.size} service categories`);
  const txt = fs.readFileSync(CATALOG, 'utf-8');
  const rows = parseCSV(txt);
  const h = rows[0];
  const get = (r, n) => { const i = h.indexOf(n); return i >= 0 ? (r[i] || '').trim() : ''; };
  const catalog = rows.slice(1).filter(r => r.length > 1 && get(r, 'id')).map(r => ({
    houzzId: get(r, 'id'),
    title: get(r, 'name'),
    sku: get(r, 'sku'),
    category: get(r, 'category'),
  }));

  // Index catalog
  const bySku = new Map(), byTitle = new Map();
  for (const c of catalog) {
    if (c.sku) { const k = norm(c.sku); if (k && !bySku.has(k)) bySku.set(k, c); }
    if (c.title) { const k = norm(c.title); if (k && !byTitle.has(k)) byTitle.set(k, c); }
  }

  console.log('[2/4] Reading PRODUCTION /products/...');
  const app = initializeApp(PROD);
  const db = getFirestore(app);
  const psnap = await getDocs(collection(db, 'products'));
  const products = [];
  psnap.forEach(d => products.push({ _id: d.id, ...d.data() }));
  console.log(`  ${products.length} products`);

  console.log('[3/4] Classifying production category values...');
  const roomFixRows = [];   // category is a room → move to room field
  const typoFixRows = [];   // category is a typo/variant → normalize to whitelist
  const removeFromLibraryRows = []; // category is service/expense/freight → flag for removal (separate phase)
  const leaveAloneRows = [];  // can't normalize, not a room
  const goodCategoryCount = { byRealMatch: 0, byEmpty: 0 };
  for (const p of products) {
    const cur = String(p.category || '').trim();
    if (!cur) { goodCategoryCount.byEmpty++; continue; }
    // Service/expense/freight item — shouldn't be in product library
    if (isNotAProduct(cur)) {
      removeFromLibraryRows.push({
        studioId: p._id, title: p.title || '', sku: p.sku || '',
        currentCategory: cur, currentRoom: String(p.room || '').trim(),
        planAction: 'remove-from-library', houzzMatchTitle: '',
      });
      continue;
    }
    // Already in product whitelist
    if (isProductCategory(cur)) { goodCategoryCount.byRealMatch++; continue; }
    // Not in product whitelist. Determine if room or typo
    const isRoom = looksLikePhysicalRoom(cur);
    const studioSku = norm(p.sku || '');
    const studioTitle = norm(p.title || p.name || '');
    let m = null;
    if (studioSku && bySku.has(studioSku)) m = bySku.get(studioSku);
    else if (studioTitle && byTitle.has(studioTitle)) m = byTitle.get(studioTitle);
    const houzzCat = m && m.category ? m.category.trim() : '';
    // New category: ONLY use product categories (no services). Try Studio normalize first, then Houzz.
    let newCategory = '';
    const studioNorm = normalizeToWhitelist(cur);
    if (studioNorm && isProductCategory(studioNorm)) {
      newCategory = studioNorm;
    } else if (houzzCat) {
      if (isProductCategory(houzzCat)) newCategory = houzzCat;
      else {
        const houzzNorm = normalizeToWhitelist(houzzCat);
        if (houzzNorm && isProductCategory(houzzNorm)) newCategory = houzzNorm;
      }
    }
    const currentRoom = String(p.room || '').trim();
    const row = {
      studioId: p._id, title: p.title || '', sku: p.sku || '',
      currentCategory: cur, currentRoom: currentRoom,
      newRoom: isRoom ? (currentRoom || cur) : currentRoom,
      newCategory: newCategory, houzzMatchTitle: m ? m.title : '',
    };
    if (isRoom) {
      row.planAction = currentRoom
        ? (newCategory ? 'set-cat-keep-room' : 'clear-cat-keep-room')
        : (newCategory ? 'move-cat-to-room+set-cat' : 'move-cat-to-room+clear-cat');
      roomFixRows.push(row);
    } else if (newCategory) {
      row.planAction = 'normalize-typo-to-whitelist';
      typoFixRows.push(row);
    } else {
      row.planAction = 'leave-alone-cant-map';
      leaveAloneRows.push(row);
    }
  }
  console.log(`  Already in product whitelist: ${goodCategoryCount.byRealMatch}`);
  console.log(`  Empty category: ${goodCategoryCount.byEmpty}`);
  console.log(`  Service/expense/freight items (REMOVE from library): ${removeFromLibraryRows.length}`);
  console.log(`  Confirmed ROOMS (move to room field): ${roomFixRows.length}`);
  console.log(`  Typos/variants (normalize): ${typoFixRows.length}`);
  console.log(`  Cant map - leave alone: ${leaveAloneRows.length}`);

  // Top values per bucket
  function topValues(rows, key, n) {
    const counts = {};
    for (const r of rows) counts[r[key]] = (counts[r[key]] || 0) + 1;
    return Object.entries(counts).sort((a,b) => b[1]-a[1]).slice(0, n);
  }
  console.log('\n  Top ROOM values (will move to room field):');
  for (const [v, c] of topValues(roomFixRows, 'currentCategory', 15)) console.log(`    ${v}: ${c}`);
  console.log('\n  Top TYPO values (will normalize to whitelist):');
  for (const [v, c] of topValues(typoFixRows, 'currentCategory', 15)) console.log(`    ${v}: ${c}  →  ${typoFixRows.find(r => r.currentCategory === v).newCategory}`);
  console.log('\n  Top REMOVE-FROM-LIBRARY values (services/expenses/freight):');
  for (const [v, c] of topValues(removeFromLibraryRows, 'currentCategory', 10)) console.log(`    ${v}: ${c}`);
  console.log('\n  Top CANT-MAP values (left alone):');
  for (const [v, c] of topValues(leaveAloneRows, 'currentCategory', 10)) console.log(`    ${v}: ${c}`);

  console.log('\n[4/4] Writing manifest CSVs...');
  const cols = ['studioId','title','sku','currentCategory','currentRoom','newRoom','newCategory','planAction','houzzMatchTitle'];
  function writeCsv(file, rows) {
    const lines = [cols.join(',')];
    for (const r of rows) lines.push(cols.map(c => csvEsc(r[c])).join(','));
    fs.writeFileSync(file, lines.join('\n'));
  }
  writeCsv('phase1_5-rooms-to-fix.csv', roomFixRows);
  writeCsv('phase1_5-typos-to-normalize.csv', typoFixRows);
  writeCsv('phase1_5-remove-from-library.csv', removeFromLibraryRows);
  writeCsv('phase1_5-cant-map-leave-alone.csv', leaveAloneRows);
  console.log(`  rooms-to-fix.csv: ${roomFixRows.length}`);
  console.log(`  typos-to-normalize.csv: ${typoFixRows.length}`);
  console.log(`  remove-from-library.csv: ${removeFromLibraryRows.length}`);
  console.log(`  cant-map-leave-alone.csv: ${leaveAloneRows.length}`);
  process.exit(0);
})().catch(e => { console.error('FAILED:', e); process.exit(1); });
