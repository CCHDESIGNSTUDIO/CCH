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
  const dsnap = await getDoc(doc(db, 'products', '2eTEqBfQGKKEW6pqq4nA'));
  if (!dsnap.exists()) { console.log('NOT FOUND'); process.exit(1); }
  const x = dsnap.data();
  console.log('Doc id:', dsnap.id);
  const keys = Object.keys(x).sort();
  for (const k of keys) {
    let v = x[k];
    if (Array.isArray(v)) v = '[Array len=' + v.length + ']';
    else if (typeof v === 'object' && v !== null) v = JSON.stringify(v).slice(0, 200);
    else v = String(v).slice(0, 200);
    console.log('  ' + k + ': ' + v);
  }
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
