/**
 * READ-ONLY audit of PRODUCTION Firestore for any traces of my writes today.
 * I tagged every staging write with one of:
 *   source: 'houzz-catalog-apr27'        (catalog upload)
 *   source: 'staging-copy-from-prod-rh'  (RH mirror)
 *   _imageSource: 'houzz-catalog-apr27'  (clip linking — never ran)
 * If ANY production doc has these tags, I wrote to prod by mistake.
 */
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, collectionGroup } = require('firebase/firestore');

const PROD_CONFIG = {
  apiKey: 'AIzaSyAd24U5ArVGrA24IxNcYD2NYiTVycyF4og',
  authDomain: 'cch-design-boards.firebaseapp.com',
  projectId: 'cch-design-boards',
  storageBucket: 'cch-design-boards.appspot.com',
  messagingSenderId: '210388013080',
  appId: '1:210388013080:web:cch-design-boards',
};

(async () => {
  const app = initializeApp(PROD_CONFIG);
  const db = getFirestore(app);

  console.log('Connected to PRODUCTION (cch-design-boards). Read-only.');

  // 1. Products with my catalog tag
  console.log('\n[1/3] Scanning /products/ for source==houzz-catalog-apr27 ...');
  const psnap = await getDocs(collection(db, 'products'));
  let myCatalog = 0;
  let myCatalogIds = [];
  let docIdsHouzzPrefix = 0;
  let docIdsHouzzPrefixSamples = [];
  psnap.forEach(d => {
    const x = d.data();
    if (x.source === 'houzz-catalog-apr27') {
      myCatalog++;
      if (myCatalogIds.length < 5) myCatalogIds.push(d.id);
    }
    // Also check if any prod doc IDs start with "houzz-" (my naming convention)
    if (d.id.startsWith('houzz-')) {
      docIdsHouzzPrefix++;
      if (docIdsHouzzPrefixSamples.length < 5) docIdsHouzzPrefixSamples.push(d.id);
    }
  });
  console.log(`  total products in PROD: ${psnap.size}`);
  console.log(`  with source='houzz-catalog-apr27' (my tag): ${myCatalog}`);
  if (myCatalog > 0) console.log(`    sample ids: ${myCatalogIds.join(', ')}`);
  console.log(`  with doc id starting 'houzz-' (my naming): ${docIdsHouzzPrefix}`);
  if (docIdsHouzzPrefix > 0) console.log(`    sample ids: ${docIdsHouzzPrefixSamples.join(', ')}`);

  // 2. Rolling Hills board doc + subcols for staging-copy tag
  console.log('\n[2/3] Scanning prod boards/cloud-rolling-hills for staging-copy-from-prod-rh tag ...');
  const subs = ['clips', 'proposals', 'invoices', 'purchaseOrders'];
  for (const sub of subs) {
    const ssnap = await getDocs(collection(db, 'boards', 'cloud-rolling-hills', sub));
    let tagged = 0;
    ssnap.forEach(d => { if (d.data().source === 'staging-copy-from-prod-rh') tagged++; });
    console.log(`  ${sub}: ${ssnap.size} total, ${tagged} with my staging-copy tag`);
  }

  // 3. Any clip across any board with my _imageSource tag
  console.log('\n[3/3] Scanning ALL boards/*/clips for _imageSource=houzz-catalog-apr27 ...');
  try {
    const cg = await getDocs(collectionGroup(db, 'clips'));
    let tagged = 0;
    cg.forEach(d => { if (d.data()._imageSource === 'houzz-catalog-apr27') tagged++; });
    console.log(`  total clips across all boards: ${cg.size}, with my tag: ${tagged}`);
  } catch (e) {
    console.log(`  (collectionGroup query needs index, skipping: ${e.message})`);
  }

  console.log('\nVERDICT:');
  if (myCatalog === 0 && docIdsHouzzPrefix === 0) {
    console.log('  No traces of my writes in production /products/.');
  } else {
    console.log(`  FOUND TRACES: catalog tag=${myCatalog}, houzz- doc ids=${docIdsHouzzPrefix}`);
  }
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
