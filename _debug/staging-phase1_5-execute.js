/**
 * PHASE 1.5 EXECUTE — STAGING /products/ category cleanup.
 * THIS WRITES TO STAGING (cch-studio-staging).
 * Same logic as the production version.
 */
const fs = require('fs');
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, writeBatch } = require('firebase/firestore');

const PROD = {
  apiKey: 'AIzaSyBIwwo7uRij6Q0FZg-qmIS1LC8t2AjXrYo',
  authDomain: 'cch-studio-staging.firebaseapp.com',
  projectId: 'cch-studio-staging',
  storageBucket: 'cch-studio-staging.firebasestorage.app',
  messagingSenderId: '210388013080',
  appId: '1:210388013080:web:fcd520b30c0d50b149736d',
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
function csvEsc(v) {
  if (v == null) return '';
  const s = String(v);
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

const MASTER_PRODUCT_CATEGORIES = ['Art','Mirror','Accessories','Fabric & Trim','Furniture','Stone & Tile','Appliances & Plumbing','Hardware','Floor Covering','Florals','Wall','Bedding & Pillows','Wall Covering','Custom Furniture','Custom Upholstery','Cabinets','Custom Bedding and Pillows','Custom Window Coverings','Windows','Lighting','Architectural'];
const VALID_FFE_LOWER = new Set(['accessories','architectural','art','bedding & pillows','fabric & trim','flooring','furniture','hardware','lighting','outdoor','plumbing & appliances','appliances & plumbing','tile & stone','wall covering','window treatments','mirror','custom furniture','custom upholstery','cabinets','windows','stone & tile','floor covering','florals','tv','electrical','custom bedding and pillows','custom window coverings']);
const SERVICE_CATEGORIES_LOWER = new Set(['cch design service','cch project management','custom labor','expenses','expense','design services','blended design services','consultation']);
const CCH_EXTENDED_CATEGORIES = new Set(['mirrors & accessories']);
const CCH_KNOWN_ROOMS = new Set(['inventory','bar','damon','kelly','calvin','emi','tracey','ron','garza blanca']);
const CATEGORY_NORMALIZATION = {
  'fabric  + trim': 'Fabric & Trim','fabric + trim': 'Fabric & Trim','fabrics': 'Fabric & Trim','fabric': 'Fabric & Trim','fabri': 'Fabric & Trim','fab': 'Fabric & Trim',
  'appliances  & plumbing': 'Appliances & Plumbing','mirror': 'Mirror','pillows': 'Bedding & Pillows','pillows & bedding': 'Bedding & Pillows','window': 'Windows','cushions': 'Bedding & Pillows','wallpaper': 'Wall Covering','rug': 'Floor Covering','rugs': 'Floor Covering','flooring': 'Floor Covering','floor': 'Floor Covering','cabinetry': 'Cabinets','cabinet hardware': 'Hardware','architecural': 'Architectural','outdoors': 'Outdoor',
  'furniture & upholstery': 'Furniture','lightingbedding & pillows': 'Bedding & Pillows','paint': 'Wall Covering','wood stain': 'Cabinets','cabinet door style': 'Cabinets','kitchen and bath': 'Appliances & Plumbing','furnishings': 'Furniture','inventory': '','uncategorized': '',
};
function normalizeToWhitelist(catRaw) {
  if (!catRaw) return '';
  const key = String(catRaw).trim().toLowerCase().replace(/\s+/g, ' ');
  return CATEGORY_NORMALIZATION.hasOwnProperty(key) ? CATEGORY_NORMALIZATION[key] : '';
}
function isProductCategory(s) {
  const t = String(s||'').trim().toLowerCase();
  if (!t) return false;
  if (MASTER_PRODUCT_CATEGORIES.some(c => c.toLowerCase() === t)) return true;
  if (VALID_FFE_LOWER.has(t)) return true;
  if (CCH_EXTENDED_CATEGORIES.has(t)) return true;
  return false;
}
function isNotAProduct(s) {
  const t = String(s||'').trim().toLowerCase();
  if (!t) return false;
  if (SERVICE_CATEGORIES_LOWER.has(t)) return true;
  if (/freight|shipping|transaction\s*fee|pre.?paid\s*tax|tax\s*charge|labor|design.?fee|design.?service|project.?management|consultation/i.test(t)) return true;
  return false;
}
function looksLikePhysicalRoom(s) {
  const t = String(s||'').trim();
  if (!t) return false;
  if (isProductCategory(t)) return false;
  if (CCH_KNOWN_ROOMS.has(t.toLowerCase())) return true;
  const roomRe = /(\b(bedroom|bathroom|bath|kitchen|closet|pantry|laundry|mudroom|garage|office|den|nursery|suite|foyer|entry|lobby|walk-?in|powder|living|dining|game\s*room|family\s*room|great\s*room|family\b|great\b|lounge|library|study|music|theater|theatre|media|piano|cellar|wine\s*cellar|terrace|butler|master\b|guest|upstairs|downstairs|hallway|hall\b|\bL\d\b|second\s+floor|first\s+floor|basement|attic|porch|patio|deck|sunroom|playroom|nook|exterior|gym))/i;
  if (roomRe.test(t)) return true;
  if (/'s\s|’s\s/.test(t) && /(closet|room|bedroom|bathroom|office|suite|nook)/i.test(t)) return true;
  if (/\s-\s/.test(t) && /(guest|bedroom|bath|master|office)/i.test(t)) return true;
  return false;
}

(async () => {
  const start = Date.now();
  console.log('PHASE 1.5 EXECUTE — Production /products/ category cleanup\nWRITES TO PRODUCTION.\n');

  console.log('[1/4] Parsing Houzz catalog (for category fallback)...');
  const txt = fs.readFileSync(CATALOG, 'utf-8');
  const rows = parseCSV(txt);
  const h = rows[0];
  const get = (r, n) => { const i = h.indexOf(n); return i >= 0 ? (r[i] || '').trim() : ''; };
  const catalog = rows.slice(1).filter(r => r.length > 1 && get(r, 'id')).map(r => ({
    houzzId: get(r, 'id'), title: get(r, 'name'), sku: get(r, 'sku'), category: get(r, 'category'),
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
  let skipReal = 0, skipEmpty = 0, skipService = 0, skipCantMap = 0;
  let countRoomFix = 0, countTypoFix = 0;
  for (const p of products) {
    const cur = String(p.category || '').trim();
    if (!cur) { skipEmpty++; continue; }
    if (isNotAProduct(cur)) { skipService++; continue; }
    if (isProductCategory(cur)) { skipReal++; continue; }
    const isRoom = looksLikePhysicalRoom(cur);
    const studioSku = norm(p.sku || '');
    const studioTitle = norm(p.title || p.name || '');
    let m = null;
    if (studioSku && bySku.has(studioSku)) m = bySku.get(studioSku);
    else if (studioTitle && byTitle.has(studioTitle)) m = byTitle.get(studioTitle);
    const houzzCat = m && m.category ? m.category.trim() : '';
    let newCategory = '';
    const studioNorm = normalizeToWhitelist(cur);
    if (studioNorm && isProductCategory(studioNorm)) newCategory = studioNorm;
    else if (houzzCat) {
      if (isProductCategory(houzzCat)) newCategory = houzzCat;
      else {
        const houzzNorm = normalizeToWhitelist(houzzCat);
        if (houzzNorm && isProductCategory(houzzNorm)) newCategory = houzzNorm;
      }
    }
    const currentRoom = String(p.room || '').trim();
    const fields = {};
    let action = '';
    if (isRoom) {
      // Move to room field if empty, set newCategory from Houzz match (or clear if no match)
      if (!currentRoom) fields.room = cur;
      fields.category = newCategory; // may be empty string if no Houzz match — same as dry-run report
      action = currentRoom ? (newCategory ? 'set-cat-keep-room' : 'clear-cat-keep-room')
                           : (newCategory ? 'move-cat-to-room+set-cat' : 'move-cat-to-room+clear-cat');
      countRoomFix++;
    } else if (newCategory) {
      // Typo case: normalize to Clipper whitelist value
      fields.category = newCategory;
      action = 'normalize-typo';
      countTypoFix++;
    } else {
      skipCantMap++;
      continue;
    }
    fields._categoryFixedAt = new Date().toISOString();
    updates.push({ id: p._id, title: p.title || '', oldCategory: cur, oldRoom: currentRoom, action, fields });
  }
  console.log(`  Already real (skip): ${skipReal}`);
  console.log(`  Empty (skip): ${skipEmpty}`);
  console.log(`  Service/expense (skip — separate removal): ${skipService}`);
  console.log(`  Cant map (skip): ${skipCantMap}`);
  console.log(`  Room fixes: ${countRoomFix}`);
  console.log(`  Typo fixes: ${countTypoFix}`);
  console.log(`  TOTAL UPDATES: ${updates.length}`);

  console.log('\n[4/4] WRITING TO PRODUCTION in batches of 400...');
  const BATCH = 400;
  let written = 0;
  const writeStart = Date.now();
  for (let i = 0; i < updates.length; i += BATCH) {
    const batch = writeBatch(db);
    const slice = updates.slice(i, i + BATCH);
    for (const u of slice) batch.update(doc(db, 'products', u.id), u.fields);
    await batch.commit();
    written += slice.length;
    if (written % 800 === 0 || written === updates.length) {
      const t = ((Date.now() - writeStart) / 1000).toFixed(1);
      console.log(`  ${written}/${updates.length} (${t}s)`);
    }
  }

  // Manifest
  const cols = ['studioId','title','oldCategory','oldRoom','action','newCategory','newRoom'];
  const csv = [cols.join(',')];
  for (const u of updates) csv.push([
    csvEsc(u.id), csvEsc(u.title), csvEsc(u.oldCategory), csvEsc(u.oldRoom),
    csvEsc(u.action), csvEsc(u.fields.category != null ? u.fields.category : ''), csvEsc(u.fields.room || u.oldRoom)
  ].join(','));
  fs.writeFileSync('phase1_5-prod-execute-manifest.csv', csv.join('\n'));

  const total = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\nDONE in ${total}s. Wrote ${written} production updates.`);
  console.log('Manifest: phase1_5-prod-execute-manifest.csv');
  process.exit(0);
})().catch(e => { console.error('FAILED:', e); process.exit(1); });
