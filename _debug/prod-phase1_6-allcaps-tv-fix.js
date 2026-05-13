/**
 * PHASE 1.6 EXECUTE — Clean up the misses from Phase 1.5.
 * Targets:
 *   - LIGHTING (all caps) — Houzz room board, not real Lighting category
 *   - FLORALS (all caps) — same
 *   - TV — Cynthia confirmed it's a room, not category
 *   - S7 Bunk Bed — room my regex missed
 * For each: move current value → room field, set new category from Houzz match.
 * Plus: normalize lowercase "mirror" → "Mirror" (case fix).
 */
const fs = require('fs');
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
function csvEsc(v) { if (v == null) return ''; const s = String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }

const REAL_CATS_LOWER = new Set([
  'art','mirror','accessories','fabric & trim','furniture','stone & tile','appliances & plumbing','hardware',
  'floor covering','florals','wall','bedding & pillows','wall covering','custom furniture','custom upholstery',
  'cabinets','custom bedding and pillows','custom window coverings','windows','lighting','architectural',
  'outdoor','tile & stone','plumbing & appliances','window treatments','flooring','electrical',
  'mirrors & accessories'
]);
function isProductCategory(s) {
  return REAL_CATS_LOWER.has(String(s||'').trim().toLowerCase());
}

// Specific bad values to detect: ALL-CAPS room-board variants + TV + S7 Bunk Bed
function isPhase16Target(cur) {
  if (!cur) return false;
  // ALL CAPS where the lowercased version is a real category → it's actually a room board
  if (cur === cur.toUpperCase() && cur.length >= 3 && /[A-Z]/.test(cur)) {
    const lower = cur.toLowerCase();
    if (REAL_CATS_LOWER.has(lower)) return 'allcaps-room-board';
  }
  if (cur === 'TV') return 'tv-as-room';
  if (cur === 'S7 Bunk Bed') return 's7-bunk-bed';
  if (cur === 'mirror') return 'lowercase-mirror'; // case normalize only, not move
  return false;
}

(async () => {
  const start = Date.now();
  console.log('PHASE 1.6 EXECUTE — All-caps room boards + TV + S7 Bunk Bed\nWRITES TO PRODUCTION.\n');

  console.log('[1/4] Parsing Houzz catalog...');
  const txt = fs.readFileSync(CATALOG, 'utf-8');
  const rows = parseCSV(txt);
  const h = rows[0];
  const get = (r, n) => { const i = h.indexOf(n); return i >= 0 ? (r[i] || '').trim() : ''; };
  const catalog = rows.slice(1).filter(r => r.length > 1 && get(r, 'id')).map(r => ({
    title: get(r, 'name'), sku: get(r, 'sku'), category: get(r, 'category'),
  }));
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

  console.log('[3/4] Computing updates...');
  const updates = [];
  let countAllCaps = 0, countTv = 0, countS7 = 0, countMirrorCase = 0;

  // Houzz category normalization (same map as Phase 1.5)
  const NORM = {
    'fabric  + trim': 'Fabric & Trim','fabric + trim': 'Fabric & Trim','fabrics': 'Fabric & Trim','fabric': 'Fabric & Trim',
    'appliances  & plumbing': 'Appliances & Plumbing','mirror': 'Mirror','pillows': 'Bedding & Pillows','pillows & bedding': 'Bedding & Pillows',
    'window': 'Windows','cushions': 'Bedding & Pillows','wallpaper': 'Wall Covering','rug': 'Floor Covering','rugs': 'Floor Covering',
    'flooring': 'Floor Covering','floor': 'Floor Covering','cabinetry': 'Cabinets','cabinet hardware': 'Hardware','architecural': 'Architectural',
    'outdoors': 'Outdoor','furniture & upholstery': 'Furniture','lightingbedding & pillows': 'Bedding & Pillows','paint': 'Wall Covering',
    'wood stain': 'Cabinets','cabinet door style': 'Cabinets','kitchen and bath': 'Appliances & Plumbing','furnishings': 'Furniture',
  };
  function normalizeHouzzCat(catRaw) {
    if (!catRaw) return '';
    const key = String(catRaw).trim().toLowerCase().replace(/\s+/g, ' ');
    if (NORM.hasOwnProperty(key)) return NORM[key];
    return '';
  }

  for (const p of products) {
    const cur = String(p.category || '').trim();
    const target = isPhase16Target(cur);
    if (!target) continue;

    if (target === 'lowercase-mirror') {
      // Just fix the case — don't move to room
      updates.push({ id: p._id, title: p.title || '', oldCat: cur, oldRoom: p.room || '', action: 'case-fix-mirror', fields: { category: 'Mirror', _categoryFixedAt: new Date().toISOString() } });
      countMirrorCase++;
      continue;
    }

    // Move room cases
    const studioSku = norm(p.sku || '');
    const studioTitle = norm(p.title || p.name || '');
    let m = null;
    if (studioSku && bySku.has(studioSku)) m = bySku.get(studioSku);
    else if (studioTitle && byTitle.has(studioTitle)) m = byTitle.get(studioTitle);
    const houzzCat = m && m.category ? m.category.trim() : '';
    let newCategory = '';
    if (houzzCat) {
      if (isProductCategory(houzzCat)) newCategory = houzzCat;
      else {
        const normd = normalizeHouzzCat(houzzCat);
        if (normd && isProductCategory(normd)) newCategory = normd;
      }
    }
    const currentRoom = String(p.room || '').trim();
    const fields = { category: newCategory, _categoryFixedAt: new Date().toISOString() };
    if (!currentRoom) fields.room = cur;
    updates.push({ id: p._id, title: p.title || '', oldCat: cur, oldRoom: currentRoom, action: target, fields });
    if (target === 'allcaps-room-board') countAllCaps++;
    else if (target === 'tv-as-room') countTv++;
    else if (target === 's7-bunk-bed') countS7++;
  }

  console.log(`  All-caps room boards (LIGHTING/FLORALS): ${countAllCaps}`);
  console.log(`  TV → room: ${countTv}`);
  console.log(`  S7 Bunk Bed → room: ${countS7}`);
  console.log(`  mirror → Mirror (case fix): ${countMirrorCase}`);
  console.log(`  TOTAL UPDATES: ${updates.length}`);

  console.log('\n[4/4] WRITING TO PRODUCTION...');
  const BATCH = 400;
  let written = 0;
  for (let i = 0; i < updates.length; i += BATCH) {
    const batch = writeBatch(db);
    const slice = updates.slice(i, i + BATCH);
    for (const u of slice) batch.update(doc(db, 'products', u.id), u.fields);
    await batch.commit();
    written += slice.length;
  }
  console.log(`  wrote ${written} updates`);

  // Manifest
  const csv = ['studioId,title,oldCategory,oldRoom,action,newCategory,newRoom'];
  for (const u of updates) csv.push([
    csvEsc(u.id), csvEsc(u.title), csvEsc(u.oldCat), csvEsc(u.oldRoom),
    csvEsc(u.action), csvEsc(u.fields.category != null ? u.fields.category : ''), csvEsc(u.fields.room || u.oldRoom)
  ].join(','));
  fs.writeFileSync('phase1_6-prod-execute-manifest.csv', csv.join('\n'));

  console.log(`\nDONE in ${((Date.now()-start)/1000).toFixed(1)}s. Wrote ${written} updates.`);
  console.log('Manifest: phase1_6-prod-execute-manifest.csv');
  process.exit(0);
})().catch(e => { console.error('FAILED:', e); process.exit(1); });
