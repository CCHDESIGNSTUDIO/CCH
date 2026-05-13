/** Read-only check: did the enrichment actually write fields to staging? */
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, getDoc } = require('firebase/firestore');

const STAGING = {
  apiKey: 'AIzaSyBIwwo7uRij6Q0FZg-qmIS1LC8t2AjXrYo',
  authDomain: 'cch-studio-staging.firebaseapp.com',
  projectId: 'cch-studio-staging',
  storageBucket: 'cch-studio-staging.firebasestorage.app',
  messagingSenderId: '210388013080',
  appId: '1:210388013080:web:fcd520b30c0d50b149736d',
};

(async () => {
  const app = initializeApp(STAGING);
  const db = getFirestore(app);

  console.log('Reading all staging /products/...');
  const snap = await getDocs(collection(db, 'products'));
  console.log(`Total docs: ${snap.size}`);

  let withHouzzPrefix = 0, withProdId = 0;
  let prodMirroredEnriched = 0, prodMirroredNotEnriched = 0;
  let prodHasImageUrl = 0, prodEmptyImageUrl = 0;
  let catalogHasImageUrl = 0, catalogEmptyImageUrl = 0;
  let prodHasHouzzId = 0, prodNoHouzzId = 0;
  const prodSamples = [], catalogSamples = [];

  snap.forEach(d => {
    const x = d.data();
    if (d.id.startsWith('houzz-')) {
      withHouzzPrefix++;
      if (x.imageUrl) catalogHasImageUrl++; else catalogEmptyImageUrl++;
      if (catalogSamples.length < 2) catalogSamples.push({ id: d.id, ...x });
    } else {
      withProdId++;
      if (x._enrichedFromHouzz === 'apr27-catalog') prodMirroredEnriched++;
      else prodMirroredNotEnriched++;
      if (x.imageUrl) prodHasImageUrl++; else prodEmptyImageUrl++;
      if (x.houzzId) prodHasHouzzId++; else prodNoHouzzId++;
      if (prodSamples.length < 5 && x._enrichedFromHouzz === 'apr27-catalog') prodSamples.push({ id: d.id, ...x });
    }
  });

  console.log(`\nDoc counts:`);
  console.log(`  with 'houzz-' prefix (catalog-only): ${withHouzzPrefix}`);
  console.log(`  with prod opaque ID (mirrored from prod): ${withProdId}`);

  console.log(`\nProd-mirrored docs:`);
  console.log(`  enriched (_enrichedFromHouzz tag): ${prodMirroredEnriched}`);
  console.log(`  not enriched: ${prodMirroredNotEnriched}`);
  console.log(`  with non-empty imageUrl: ${prodHasImageUrl}`);
  console.log(`  with empty imageUrl: ${prodEmptyImageUrl}`);
  console.log(`  with houzzId: ${prodHasHouzzId}`);
  console.log(`  without houzzId: ${prodNoHouzzId}`);

  console.log(`\nCatalog-only docs:`);
  console.log(`  with non-empty imageUrl: ${catalogHasImageUrl}`);
  console.log(`  with empty imageUrl: ${catalogEmptyImageUrl}`);

  console.log('\n--- 5 Sample prod-mirrored ENRICHED docs ---');
  for (const s of prodSamples) {
    console.log(`\n  ${s.id}`);
    console.log(`    title: ${s.title}`);
    console.log(`    houzzId: ${s.houzzId || '(empty)'}`);
    console.log(`    imageUrl: ${(s.imageUrl||'(empty)').slice(0, 100)}`);
    console.log(`    _enrichedFromHouzz: ${s._enrichedFromHouzz || '(none)'}`);
    console.log(`    keys: ${Object.keys(s).filter(k => k !== '_data').join(', ')}`);
  }

  console.log('\n--- 2 Sample catalog-only docs (older upload) ---');
  for (const s of catalogSamples) {
    console.log(`\n  ${s.id}`);
    console.log(`    title: ${s.title}`);
    console.log(`    houzzId: ${s.houzzId || '(empty)'}`);
    console.log(`    imageUrl: ${(s.imageUrl||'(empty)').slice(0, 100)}`);
  }

  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
