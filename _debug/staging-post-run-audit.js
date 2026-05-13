/**
 * READ-ONLY post-run audit of STAGING /products/.
 * Confirms category cleanup state + verifies protected/locked exclusions.
 */
const fs = require('fs');
const path = require('path');
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');
const SCRIPT_DIR = __dirname;
const MANIFEST_15 = path.join(SCRIPT_DIR, 'phase1_5-staging-execute-manifest.csv');
const MANIFEST_16 = path.join(SCRIPT_DIR, 'phase1_6-staging-execute-manifest.csv');

const STAGING = {
  apiKey: 'AIzaSyBIwwo7uRij6Q0FZg-qmIS1LC8t2AjXrYo',
  authDomain: 'cch-studio-staging.firebaseapp.com',
  projectId: 'cch-studio-staging',
  storageBucket: 'cch-studio-staging.firebasestorage.app',
  messagingSenderId: '210388013080',
  appId: '1:210388013080:web:fcd520b30c0d50b149736d',
};

const REAL_CATS_LOWER = new Set([
  'art','mirror','accessories','fabric & trim','furniture','stone & tile','appliances & plumbing','hardware',
  'floor covering','florals','wall','bedding & pillows','wall covering','custom furniture','custom upholstery',
  'cabinets','custom bedding and pillows','custom window coverings','windows','lighting','architectural',
  'outdoor','tile & stone','plumbing & appliances','window treatments','flooring','electrical',
  'mirrors & accessories'
]);
const PROTECTED_SOURCES = new Set(['cch-studio-clipper', 'clipper', 'manual', 'ideabook-asset']);

(async () => {
  console.log('STAGING POST-RUN AUDIT — READ-ONLY\n');

  const app = initializeApp(STAGING);
  const db = getFirestore(app);
  const psnap = await getDocs(collection(db, 'products'));
  const products = [];
  psnap.forEach(d => products.push({ _id: d.id, ...d.data() }));
  console.log(`Total staging /products/: ${products.length}`);

  // Manifest reads
  function readCsvIds(file) {
    if (!fs.existsSync(file)) return new Set();
    const lines = fs.readFileSync(file, 'utf-8').split('\n').slice(1);
    const ids = new Set();
    for (const line of lines) {
      if (!line) continue;
      const id = line.split(',')[0].replace(/^"|"$/g, '');
      if (id) ids.add(id);
    }
    return ids;
  }
  const phase15Ids = readCsvIds(MANIFEST_15);
  const phase16Ids = readCsvIds(MANIFEST_16);

  // Category state
  const catCounts = {};
  let withMarkers15 = 0, withMarkers16 = 0;
  let allCapsLeftover = 0, roomsLeftover = 0, realCatsCount = 0;
  let withCategoryFixedAt = 0, withEnrichmentMarker = 0;
  for (const p of products) {
    const c = String(p.category || '').trim();
    if (c) catCounts[c] = (catCounts[c] || 0) + 1;
    if (p._categoryFixedAt) withCategoryFixedAt++;
    if (p._enrichedFromHouzzApr27) withEnrichmentMarker++;
    if (phase15Ids.has(p._id)) withMarkers15++;
    if (phase16Ids.has(p._id)) withMarkers16++;
    if (c) {
      const lower = c.toLowerCase();
      if (REAL_CATS_LOWER.has(lower)) realCatsCount++;
    }
    // Detect leftover all-caps room boards
    if (c && c.length >= 3 && c === c.toUpperCase() && /[A-Z]/.test(c) && REAL_CATS_LOWER.has(c.toLowerCase())) {
      allCapsLeftover++;
    }
    // Detect leftover rooms in category (regex)
    if (c) {
      const re = /(\b(bedroom|bathroom|bath|kitchen|closet|pantry|laundry|game\s*room|living|dining|master|guest|hall\b))/i;
      if (re.test(c) && !REAL_CATS_LOWER.has(c.toLowerCase())) roomsLeftover++;
    }
  }

  console.log('\n--- POST-RUN VALIDATION ---');
  console.log(`In whitelist (real category):       ${realCatsCount}`);
  console.log(`ALL-CAPS room boards leftover:      ${allCapsLeftover}`);
  console.log(`Rooms-in-category leftover (regex): ${roomsLeftover}`);
  console.log(`With _categoryFixedAt marker:       ${withCategoryFixedAt}`);
  console.log(`With _enrichedFromHouzzApr27:       ${withEnrichmentMarker}`);
  console.log(`Phase 1.5 manifest IDs in current state: ${withMarkers15} of ${phase15Ids.size}`);
  console.log(`Phase 1.6 manifest IDs in current state: ${withMarkers16} of ${phase16Ids.size}`);

  // Distinct category list
  console.log('\n--- DISTINCT CATEGORY VALUES (sorted by count) ---');
  const sorted = Object.entries(catCounts).sort((a,b) => b[1]-a[1]);
  for (const [v, n] of sorted) console.log(`  ${n.toString().padStart(5)} | ${v}`);

  // Protected/locked exclusion verification
  console.log('\n--- PROTECTED/LOCKED EXCLUSION VERIFICATION ---');
  let touchedProtected = 0, totalProtected = 0;
  let protectedFixedAt = 0;
  for (const p of products) {
    if (PROTECTED_SOURCES.has(String(p.source || '').trim())) {
      totalProtected++;
      // Was this product touched by phase 1.5 or 1.6?
      if (phase15Ids.has(p._id) || phase16Ids.has(p._id)) touchedProtected++;
      if (p._categoryFixedAt) protectedFixedAt++;
    }
  }
  console.log(`Total products with protected source (Clipper/manual/etc.): ${totalProtected}`);
  console.log(`Protected products in Phase 1.5/1.6 manifests:              ${touchedProtected} (should be 0)`);
  console.log(`Protected products with _categoryFixedAt marker:            ${protectedFixedAt} (should be 0)`);

  // Locked check (sample, can't read top-level /invoices without auth)
  console.log('\nLocked check: scanning all staging boards for line items...');
  const bsnap = await getDocs(collection(db, 'boards'));
  const linkedTitles = new Set();
  const linkedSkus = new Set();
  for (const b of bsnap.docs) {
    for (const sub of ['proposals','invoices','purchaseOrders']) {
      try {
        const ssnap = await getDocs(collection(db, 'boards', b.id, sub));
        ssnap.forEach(d => {
          const x = d.data();
          for (const f of ['items','lineItems']) {
            if (Array.isArray(x[f])) {
              for (const it of x[f]) {
                if (it.title) linkedTitles.add(String(it.title).toLowerCase().trim());
                if (it.sku) linkedSkus.add(String(it.sku).toLowerCase().trim());
              }
            }
          }
        });
      } catch (_e) {}
    }
  }
  console.log(`Line item corpus: ${linkedTitles.size} unique titles, ${linkedSkus.size} unique SKUs across staging boards`);

  let touchedLocked = 0, totalLocked = 0;
  for (const p of products) {
    const t = String(p.title || '').toLowerCase().trim();
    const s = String(p.sku || '').toLowerCase().trim();
    let isLocked = false;
    if (s && linkedSkus.has(s)) isLocked = true;
    else if (t && t.length >= 6 && linkedTitles.has(t)) isLocked = true;
    if (isLocked) {
      totalLocked++;
      if (phase15Ids.has(p._id) || phase16Ids.has(p._id)) touchedLocked++;
    }
  }
  console.log(`Total products that are locked (on a staging doc): ${totalLocked}`);
  console.log(`Locked products in Phase 1.5/1.6 manifests:        ${touchedLocked} (should be 0)`);

  // Manifest action breakdown
  console.log('\n--- MANIFEST BREAKDOWN ---');
  function tallyActions(file) {
    if (!fs.existsSync(file)) return {};
    const lines = fs.readFileSync(file, 'utf-8').split('\n').slice(1);
    const counts = {};
    for (const line of lines) {
      if (!line) continue;
      const cells = line.split(',');
      const action = cells[4] || ''; // 5th column is 'action'
      const cleanAction = action.replace(/^"|"$/g, '');
      counts[cleanAction] = (counts[cleanAction] || 0) + 1;
    }
    return counts;
  }
  console.log('Phase 1.5 actions:');
  for (const [a, n] of Object.entries(tallyActions(MANIFEST_15))) console.log(`  ${a}: ${n}`);
  console.log('Phase 1.6 actions:');
  for (const [a, n] of Object.entries(tallyActions(MANIFEST_16))) console.log(`  ${a}: ${n}`);

  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
