const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc } = require('firebase/firestore');
const PROD = {apiKey:'AIzaSyAd24U5ArVGrA24IxNcYD2NYiTVycyF4og',authDomain:'cch-design-boards.firebaseapp.com',projectId:'cch-design-boards',storageBucket:'cch-design-boards.firebasestorage.app',messagingSenderId:'210388013080',appId:'1:210388013080:web:cch-design-boards'};
(async () => {
  const app = initializeApp(PROD);
  const db = getFirestore(app);
  const ds = await getDoc(doc(db, 'boards', 'cloud-rolling-hills', 'invoices', 'IN-12980'));
  if (!ds.exists()) { console.log('NOT FOUND'); process.exit(0); }
  const x = ds.data();
  console.log('IN-12980 doc:');
  console.log('  number:', x.number);
  console.log('  total:', x.total);
  console.log('  totalCost:', x.totalCost);
  console.log('  totalSelling:', x.totalSelling);
  console.log('  status:', x.status);
  console.log('  vendor:', x.vendor);
  console.log('  items count:', (x.items || []).length);
  console.log('\nFirst 3 line items:');
  for (const it of (x.items || []).slice(0, 3)) {
    console.log('  title:', it.title);
    console.log('    sku:', it.sku, ' vendor:', it.vendor, ' qty:', it.qty);
    console.log('    unitCost:', it.unitCost, ' cost:', it.cost);
    console.log('    unitPrice:', it.unitPrice, ' clientPrice:', it.clientPrice, ' totalSelling:', it.totalSelling);
    console.log('    imageUrl:', it.imageUrl ? it.imageUrl.slice(0, 80) : '(empty)');
    console.log('    imageFilename:', it.imageFilename);
    console.log('    houzzId:', it.houzzId);
    console.log('    libraryProductId:', it.libraryProductId);
    console.log('    _matchedClipId:', it._matchedClipId);
    console.log('  ---');
  }
  // Aggregate stats
  const items = x.items || [];
  let withImage = 0, withHouzzId = 0, withClipMatch = 0, withCost = 0, withPrice = 0;
  for (const it of items) {
    if (it.imageUrl) withImage++;
    if (it.houzzId) withHouzzId++;
    if (it._matchedClipId) withClipMatch++;
    if (it.cost > 0 || it.unitCost > 0) withCost++;
    if (it.unitPrice > 0 || it.clientPrice > 0 || it.totalSelling > 0) withPrice++;
  }
  console.log('\nAggregate (' + items.length + ' items):');
  console.log('  with imageUrl:', withImage);
  console.log('  with houzzId:', withHouzzId);
  console.log('  with clip match:', withClipMatch);
  console.log('  with any cost:', withCost);
  console.log('  with any price:', withPrice);
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
