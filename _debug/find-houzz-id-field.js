/**
 * Read-only: find what field on production products holds the Houzz product ID
 * (the linking key Grok refers to). Sample several products, look for any
 * houzz-related field, also check for numeric-looking IDs that might match
 * the Houzz catalog 'id' column (which has values like 459226, 459227, etc.).
 */
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');
const fs = require('fs');

const PROD = {
  apiKey: 'AIzaSyAd24U5ArVGrA24IxNcYD2NYiTVycyF4og',
  authDomain: 'cch-design-boards.firebaseapp.com',
  projectId: 'cch-design-boards',
  storageBucket: 'cch-design-boards.appspot.com',
  messagingSenderId: '210388013080',
  appId: '1:210388013080:web:cch-design-boards',
};

const HOUZZ_CATALOG = String.raw`C:\Users\cindy\Dropbox\Claude - CCH studio\Houzz FILES\cchdesign_0427\catalog-items-with-images_cchdesign_0427.csv`;

(async () => {
  const app = initializeApp(PROD);
  const db = getFirestore(app);

  console.log('[1] All field names on production products:');
  const snap = await getDocs(collection(db, 'products'));
  const fc = {};
  const allFields = new Set();
  snap.forEach(d => {
    for (const k of Object.keys(d.data())) {
      allFields.add(k);
      fc[k] = (fc[k] || 0) + 1;
    }
  });
  // Find any field with "houzz", "id", "external", "legacy", "ref" in name
  const interesting = [...allFields].filter(k =>
    /houzz/i.test(k) || /external/i.test(k) || /legacy/i.test(k) ||
    /^id$/i.test(k) || /productId/i.test(k) || /ref$/i.test(k) ||
    /houzzPro/i.test(k)
  );
  console.log('  Fields matching "houzz|external|legacy|id|productId|ref":');
  for (const k of interesting) console.log(`    ${k.padEnd(35)} count: ${fc[k]}`);
  if (interesting.length === 0) {
    console.log('  (none — Studio products do NOT have an explicit Houzz ID field)');
  }

  // Now load Houzz catalog IDs and check if any production doc IDs or sku values match them
  console.log('\n[2] Checking if Houzz catalog ids match anything on production products...');
  const csvText = fs.readFileSync(HOUZZ_CATALOG, 'utf-8');
  const firstLines = csvText.split('\n').slice(0, 6);
  console.log('  Houzz CSV header + first 3 rows for reference:');
  firstLines.forEach((l, i) => console.log(`    [${i}] ${l.slice(0, 200)}`));

  // Parse just the IDs
  const lines = csvText.split('\n');
  const houzzIds = new Set();
  for (let i = 1; i < lines.length; i++) {
    const m = lines[i].match(/^(\d+),/);
    if (m) houzzIds.add(m[1]);
  }
  console.log(`  total Houzz catalog ids parsed: ${houzzIds.size}`);

  // Check how many prod product DOC IDs are numeric and match a Houzz id
  let docIdMatches = 0;
  let skuMatches = 0;
  const skuField = 'sku';
  snap.forEach(d => {
    if (houzzIds.has(d.id)) docIdMatches++;
    const sku = d.data()[skuField];
    if (sku && houzzIds.has(String(sku).trim())) skuMatches++;
  });
  console.log(`  prod doc IDs that match a Houzz id: ${docIdMatches}`);
  console.log(`  prod sku values that match a Houzz id: ${skuMatches}`);

  // Sample 3 products and dump everything
  console.log('\n[3] Three sample production products (all fields):');
  let i = 0;
  snap.forEach(d => {
    if (i++ >= 3) return;
    console.log(`\n  --- ${d.id} ---`);
    const data = d.data();
    for (const [k, v] of Object.entries(data)) {
      let display = v;
      if (typeof v === 'string' && v.length > 120) display = v.slice(0, 120) + '...';
      if (Array.isArray(v)) display = `[Array:${v.length}]`;
      if (typeof v === 'object' && v !== null && !Array.isArray(v)) display = `{${Object.keys(v).join(',')}}`;
      console.log(`    ${k.padEnd(28)} ${display}`);
    }
  });

  // Also check a sample proposal: do its line items reference products by Studio doc ID, Houzz ID, or something else?
  console.log('\n[4] Sample proposal line items — what field links to a product?');
  const props = await getDocs(collection(db, 'boards', '7225-bugletrail', 'proposals'));
  let pi = 0;
  props.forEach(d => {
    if (pi++ >= 1) return;
    const x = d.data();
    console.log(`  proposal ${d.id}:`);
    if (x.items && Array.isArray(x.items) && x.items.length > 0) {
      const item = x.items[0];
      console.log(`  first item keys: ${Object.keys(item).join(', ')}`);
      console.log(`  first item:`, JSON.stringify(item, null, 2).slice(0, 1200));
    } else {
      console.log(`  no items[] array; top-level keys: ${Object.keys(x).join(', ')}`);
    }
  });

  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
