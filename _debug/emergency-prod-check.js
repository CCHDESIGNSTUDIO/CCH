/** EMERGENCY READ-ONLY check of production /products/ field state. NO WRITES. */
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

(async () => {
  console.log('EMERGENCY READ-ONLY check — production /products/');
  console.log('Connecting to:', PROD.projectId);
  console.log();
  const app = initializeApp(PROD);
  const db = getFirestore(app);
  const snap = await getDocs(collection(db, 'products'));
  let total = 0;
  let withHouzzId = 0, withoutHouzzId = 0;
  let withEnrichmentMarker = 0;
  let withCategoryFixedAt = 0;
  let withImageUrl = 0;
  let withVendorUrl = 0;
  let categoryDistinct = new Set();
  let allCapsLeftover = 0;
  let sampleDocsWithHouzzId = [];
  let sampleDocsWithoutHouzzId = [];
  snap.forEach(d => {
    total++;
    const x = d.data();
    if (x.houzzId) {
      withHouzzId++;
      if (sampleDocsWithHouzzId.length < 3) sampleDocsWithHouzzId.push({ id: d.id, title: x.title, houzzId: x.houzzId });
    } else {
      withoutHouzzId++;
      if (sampleDocsWithoutHouzzId.length < 3) sampleDocsWithoutHouzzId.push({ id: d.id, title: x.title });
    }
    if (x._enrichedFromHouzzApr27) withEnrichmentMarker++;
    if (x._categoryFixedAt) withCategoryFixedAt++;
    if (x.imageUrl) withImageUrl++;
    if (x.vendorUrl) withVendorUrl++;
    if (x.category) categoryDistinct.add(x.category);
    const c = String(x.category || '').trim();
    if (c.length >= 3 && c === c.toUpperCase() && /[A-Z]/.test(c) &&
        ['LIGHTING','FLORALS','ART','MIRROR','HARDWARE','FURNITURE'].includes(c)) {
      allCapsLeftover++;
    }
  });

  console.log(`Total production /products/: ${total}`);
  console.log(`With houzzId populated: ${withHouzzId}`);
  console.log(`Without houzzId: ${withoutHouzzId}`);
  console.log(`With _enrichedFromHouzzApr27 marker: ${withEnrichmentMarker}`);
  console.log(`With _categoryFixedAt marker: ${withCategoryFixedAt}`);
  console.log(`With imageUrl populated: ${withImageUrl}`);
  console.log(`With vendorUrl populated: ${withVendorUrl}`);
  console.log(`Distinct categories: ${categoryDistinct.size}`);
  console.log(`ALL-CAPS room boards back in category field: ${allCapsLeftover}`);
  console.log();
  console.log('Sample WITH houzzId:');
  for (const s of sampleDocsWithHouzzId) console.log(`  ${s.id}: "${s.title}" houzzId=${s.houzzId}`);
  console.log('Sample WITHOUT houzzId:');
  for (const s of sampleDocsWithoutHouzzId) console.log(`  ${s.id}: "${s.title}"`);

  console.log('\nExpected from earlier Phase 1 manifest: 5,283 should have _enrichedFromHouzzApr27');
  console.log('Expected from Phase 1.5+1.6 manifests: ~3,838+226=4,064 should have _categoryFixedAt');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
