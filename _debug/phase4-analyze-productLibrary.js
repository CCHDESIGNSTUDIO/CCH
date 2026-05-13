/**
 * READ-ONLY analysis of /productLibrary/ scope:
 * - Match each doc to Houzz catalog by SKU then by title
 * - For each match, check if Phase 2A upload manifest has its image
 * - Report counts
 */
const fs = require('fs');
const path = require('path');
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

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
const LOCAL_MANIFEST = String.raw`C:\Users\cindy\Dropbox\Claude - CCH studio\Houzz FILES\cchdesign_0427\_images\manifest.json`;

function parseCSV(t) {
  const rows=[]; let row=[]; let cur=''; let q=false;
  for (let i=0;i<t.length;i++){const c=t[i];
    if(q){if(c==='"'){if(t[i+1]==='"'){cur+='"';i++}else q=false}else cur+=c}
    else{if(c==='"')q=true; else if(c===','){row.push(cur);cur=''} else if(c==='\r'){} else if(c==='\n'){row.push(cur);rows.push(row);row=[];cur=''} else cur+=c}
  }
  if(cur||row.length){row.push(cur);rows.push(row)}
  return rows;
}
function norm(s) { return String(s||'').toLowerCase().trim().replace(/\s+/g,' ').replace(/[^\w\s-]/g,''); }

(async () => {
  console.log('READ-ONLY analysis of /productLibrary/ → Houzz catalog mapping\n');

  // Load Houzz catalog
  const txt = fs.readFileSync(CATALOG, 'utf-8');
  const rows = parseCSV(txt);
  const h = rows[0];
  const idx = (n) => h.indexOf(n);
  const catalog = rows.slice(1).filter(r => r.length > 1 && r[idx('id')]).map(r => ({
    id: r[idx('id')], name: r[idx('name')], sku: r[idx('sku')], category: r[idx('category')],
    vendor_title: r[idx('vendor_title')], manufacturer: r[idx('manufacturer')],
    url: r[idx('url')], description: r[idx('description')],
    image1: r[idx('image1')], image2: r[idx('image2')], image3: r[idx('image3')],
  }));
  const bySku = new Map(), byTitle = new Map();
  for (const c of catalog) {
    if (c.sku) { const k = norm(c.sku); if (k && !bySku.has(k)) bySku.set(k, c); }
    if (c.name) { const k = norm(c.name); if (k && !byTitle.has(k)) byTitle.set(k, c); }
  }
  console.log(`  Houzz catalog: ${catalog.length} records, ${bySku.size} indexed by SKU, ${byTitle.size} by title`);

  // Phase 2A upload manifest
  const phase2a = JSON.parse(fs.readFileSync(PHASE2A, 'utf-8'));
  const uploadedHouzzIds = new Set();
  for (const r of phase2a.results || []) {
    if (r.status === 'ok' && r.houzzId) uploadedHouzzIds.add(String(r.houzzId));
  }
  console.log(`  Phase 2A uploaded URLs available for: ${uploadedHouzzIds.size} houzzIds`);

  // Local images manifest (slot 1 by houzzId)
  const localManifest = JSON.parse(fs.readFileSync(LOCAL_MANIFEST, 'utf-8'));
  const localSlot1 = new Map();
  for (const r of localManifest.results) {
    if (r.status !== 'ok' || r.kind !== 'catalog') continue;
    if (!fs.existsSync(r.dest)) continue;
    const id = String(r.sourceId);
    const cur = localSlot1.get(id);
    if (!cur || r.slot < cur.slot) localSlot1.set(id, r);
  }
  console.log(`  Local image files available for: ${localSlot1.size} houzzIds (slot 1 or fallback)`);

  // Read /productLibrary/
  const app = initializeApp(PROD);
  const db = getFirestore(app);
  const psnap = await getDocs(collection(db, 'productLibrary'));
  console.log(`\n  /productLibrary/: ${psnap.size} docs total\n`);

  let matchedBySku = 0, matchedByTitle = 0, noMatch = 0;
  let withUploadedImage = 0, needsUpload = 0, noLocalImage = 0;
  let bySource = new Map();
  const examplesNoMatch = [];

  psnap.forEach(d => {
    const x = d.data();
    const src = String(x.source || x.dataSource || x.origin || '').trim();
    bySource.set(src, (bySource.get(src) || 0) + 1);

    const sku = norm(x.sku || '');
    const title = norm(x.title || '');
    let m = null, by = '';
    if (sku && bySku.has(sku)) { m = bySku.get(sku); by = 'sku'; matchedBySku++; }
    else if (title && byTitle.has(title)) { m = byTitle.get(title); by = 'title'; matchedByTitle++; }
    else { noMatch++; if (examplesNoMatch.length < 5) examplesNoMatch.push({ id: d.id, title: x.title || '', sku: x.sku || '', vendor: x.vendor || '' }); return; }

    const hid = String(m.id);
    if (uploadedHouzzIds.has(hid)) withUploadedImage++;
    else if (localSlot1.has(hid)) needsUpload++;
    else noLocalImage++;
  });

  console.log('--- Match results ---');
  console.log(`  Matched by SKU:        ${matchedBySku}`);
  console.log(`  Matched by title:      ${matchedByTitle}`);
  console.log(`  No catalog match:      ${noMatch}`);
  console.log();
  console.log('--- For matched docs, image status ---');
  console.log(`  Already uploaded (Phase 2A):  ${withUploadedImage}`);
  console.log(`  Needs upload (local file ok): ${needsUpload}`);
  console.log(`  No local image either:        ${noLocalImage}`);
  console.log();
  console.log('--- /productLibrary/ docs by source ---');
  for (const [k, v] of [...bySource.entries()].sort((a,b)=>b[1]-a[1])) console.log(`  ${k.padEnd(30)} ${String(v).padStart(5)}`);

  console.log('\n--- Examples of no-catalog-match docs ---');
  for (const ex of examplesNoMatch) console.log(`  ${ex.id} sku="${ex.sku}" vendor="${ex.vendor}" title="${(ex.title||'').slice(0,60)}"`);

  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
