const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc } = require('firebase/firestore');
const PROD = {
  apiKey: 'AIzaSyAd24U5ArVGrA24IxNcYD2NYiTVycyF4og',
  authDomain: 'cch-design-boards.firebaseapp.com',
  projectId: 'cch-design-boards',
  storageBucket: 'cch-design-boards.firebasestorage.app',
  messagingSenderId: '210388013080',
  appId: '1:210388013080:web:cch-design-boards',
};
(async () => {
  const app = initializeApp(PROD);
  const db = getFirestore(app);
  const ds = await getDoc(doc(db, 'products', '0Jn4h0UQZWTsASqbijid'));
  if (!ds.exists()) { console.log('NOT FOUND'); process.exit(1); }
  const x = ds.data();
  console.log('Title:', x.title);
  console.log('Vendor:', x.vendor);
  console.log('houzzId:', x.houzzId);
  console.log('imageUrl FULL:');
  console.log(x.imageUrl);
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
