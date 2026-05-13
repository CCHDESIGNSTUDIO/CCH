/**
 * Phase B: Mirror production /products/ -> staging /products/ AND enrich
 * approved matches (HIGH + MED, not locked) in a single pass.
 *
 * - Reads production read-only via PROD config.
 * - Writes staging only via STAGING config (cch-studio-staging).
 * - Uses the dry-run CSV (phase-A-v2-detail.csv) as the source of truth for
 *   which products get the houzzId + imageUrl enrichment.
 * - Production is never written.
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
const STAGING = {
  apiKey: 'AIzaSyBIwwo7uRij6Q0FZg-qmIS1LC8t2AjXrYo',
  authDomain: 'cch-studio-staging.firebaseapp.com',
  projectId: 'cch-studio-staging',
  storageBucket: 'cch-studio-staging.firebasestorage.app',
  messagingSenderId: '210388013080',
  appId: '1:210388013080:web:fcd520b30c0d50b149736d',
};

const DRYRUN_CSV = path.join(__dirname, 'phase-A-v2-detail.csv');

function parseCSV(t) {
  const rows=[]; let row=[]; let cur=''; let q=false;
  for (let i=0;i<t.length;i++){const c=t[i];
    if(q){if(c==='"'){if(t[i+1]==='"'){cur+='"';i++}else q=false}else cur+=c}
    else{if(c==='"')q=true;else if(c===',') {row.push(cur);cur=''}else if(c==='\r'){}else if(c==='\n'){row.push(cur);rows.push(row);row=[];cur=''}else cur+=c}
  }
  if(cur||row.length){row.push(cur);rows.push(row)}
  return rows;
}

(async () => {
  const start = Date.now();

  console.log('[1/4] Loading approved-updates list from dry-run CSV...');
  const csvText = fs.readFileSync(DRYRUN_CSV, 'utf-8');
  const rows = parseCSV(csvText);
  const h = rows[0];
  const idx = (n) => h.indexOf(n);
  // Approved = wouldWrite=YES AND matchConfidence in (HIGH, MED)
  // (LOW explicitly skipped per Grok's final approval)
  const enrichmentMap = new Map(); // studioId -> { houzzId, imageUrl }
  let approvedHigh = 0, approvedMed = 0, skippedLow = 0;
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (r.length < 2) continue;
    const ww = r[idx('wouldWrite')];
    const conf = r[idx('matchConfidence')];
    const sid = r[idx('studioId')];
    const hid = r[idx('catalogHouzzId')];
    const img = r[idx('newImageUrl')];
    if (ww !== 'YES') continue;
    if (conf === 'HIGH') { approvedHigh++; enrichmentMap.set(sid, { houzzId: hid, imageUrl: img }); }
    else if (conf === 'MED') { approvedMed++; enrichmentMap.set(sid, { houzzId: hid, imageUrl: img }); }
    else if (conf === 'LOW') { skippedLow++; }
  }
  console.log(`  approved HIGH: ${approvedHigh}, MED: ${approvedMed}, total enrichment: ${enrichmentMap.size}`);
  console.log(`  skipped LOW: ${skippedLow}`);

  console.log('[2/4] Reading production /products/ (read-only)...');
  const prodApp = initializeApp(PROD, 'p');
  const prodDb = getFirestore(prodApp);
  const psnap = await getDocs(collection(prodDb, 'products'));
  const prodProducts = [];
  psnap.forEach(d => prodProducts.push({ _id: d.id, _data: d.data() }));
  console.log(`  production products read: ${prodProducts.length}`);

  console.log('[3/4] Connecting to STAGING...');
  const stagingApp = initializeApp(STAGING, 's');
  const stagingDb = getFirestore(stagingApp);

  console.log('[4/4] Mirror + enrich, batched to staging /products/...');
  const BATCH_SIZE = 400;
  let written = 0, enriched = 0, mirroredOnly = 0;
  const writeStart = Date.now();
  for (let i = 0; i < prodProducts.length; i += BATCH_SIZE) {
    const batch = writeBatch(stagingDb);
    const slice = prodProducts.slice(i, i + BATCH_SIZE);
    for (const p of slice) {
      const enrichment = enrichmentMap.get(p._id);
      const docData = { ...p._data, _stagedFromProdAt: new Date().toISOString() };
      if (enrichment && enrichment.houzzId) {
        docData.houzzId = enrichment.houzzId;
        if (enrichment.imageUrl && enrichment.imageUrl.startsWith('http')) {
          docData.imageUrl = enrichment.imageUrl;
        }
        docData._enrichedFromHouzz = 'apr27-catalog';
        enriched++;
      } else {
        mirroredOnly++;
      }
      batch.set(doc(stagingDb, 'products', p._id), docData);
    }
    await batch.commit();
    written += slice.length;
    const elapsed = ((Date.now() - writeStart) / 1000).toFixed(1);
    console.log(`  ${written}/${prodProducts.length} (${elapsed}s)`);
  }

  const total = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\nDONE in ${total}s.`);
  console.log(`  Mirrored: ${written} production products copied to staging /products/`);
  console.log(`  Enriched: ${enriched} got new houzzId + imageUrl`);
  console.log(`  Mirrored without enrichment: ${mirroredOnly} (LOW or no-match or locked)`);

  // Pick 5 spot-check URLs covering different match scenarios
  console.log('\nSPOT-CHECK URLS (open in staging Studio after sign-in):');
  const samples = [];
  for (const p of prodProducts) {
    const e = enrichmentMap.get(p._id);
    if (e && e.houzzId && samples.length < 5) {
      samples.push({ id: p._id, title: p._data.title || p._data.name || '(no title)', enrich: !!e });
    }
    if (samples.length >= 5) break;
  }
  for (const s of samples) {
    console.log(`  ${s.title}`);
    console.log(`    https://cch-platform-staging.web.app/#/products  (search "${(s.title||'').slice(0,30)}")`);
    console.log(`    Doc ID: ${s.id}`);
  }

  process.exit(0);
})().catch(e => { console.error('FAILED:', e); process.exit(1); });
