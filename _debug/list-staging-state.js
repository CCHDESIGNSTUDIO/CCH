/** Inspect staging state — boards + their clip counts. */
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

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

  const boards = await getDocs(collection(db, 'boards'));
  console.log(`Staging /boards/: ${boards.size} docs total\n`);
  for (const b of boards.docs) {
    const x = b.data();
    let clipCount = 0, propCount = 0, invCount = 0, poCount = 0;
    try { clipCount = (await b.ref.collection('clips').get()).size; } catch {}
    try { propCount = (await b.ref.collection('proposals').get()).size; } catch {}
    try { invCount = (await b.ref.collection('invoices').get()).size; } catch {}
    try { poCount = (await b.ref.collection('purchaseOrders').get()).size; } catch {}
    console.log(`  ${b.id}  name="${x.name || x.title || ''}"`);
    console.log(`    clips=${clipCount} proposals=${propCount} invoices=${invCount} POs=${poCount}`);
  }

  const products = await getDocs(collection(db, 'products'));
  console.log(`\nStaging /products/: ${products.size} docs`);
  let withHouzzId = 0, withHouzzPrefix = 0;
  products.forEach(d => {
    if (d.id.startsWith('houzz-')) withHouzzPrefix++;
    if (d.data().houzzId) withHouzzId++;
  });
  console.log(`  with houzz- doc ID prefix: ${withHouzzPrefix}`);
  console.log(`  with houzzId field: ${withHouzzId}`);
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
