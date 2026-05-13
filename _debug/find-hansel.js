const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, getDoc } = require('firebase/firestore');
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
  // 1. Try `library` collection
  try {
    const ldsnap = await getDoc(doc(db, 'library', '2eTEqBfQGKKEW6pqq4nA'));
    if (ldsnap.exists()) {
      console.log('FOUND in /library/2eTEqBfQGKKEW6pqq4nA');
      const x = ldsnap.data();
      const keys = Object.keys(x).sort();
      for (const k of keys) {
        let v = x[k];
        if (Array.isArray(v)) v = '[Array len=' + v.length + ']';
        else if (typeof v === 'object' && v !== null) v = JSON.stringify(v).slice(0, 200);
        else v = String(v).slice(0, 200);
        console.log('  ' + k + ': ' + v);
      }
    } else {
      console.log('NOT in /library/');
    }
  } catch (e) { console.log('Could not query /library/:', e.message); }

  // 2. Search /products/ by title or sku
  console.log('\nSearching /products/ for HANSEL FLANNEL BLANKET / BLQ-45-NC...');
  const psnap = await getDocs(collection(db, 'products'));
  let hits = [];
  psnap.forEach(d => {
    const x = d.data();
    const t = String(x.title || '').toUpperCase();
    const s = String(x.sku || '').toUpperCase();
    if (t.includes('HANSEL FLANNEL BLANKET') || s === 'BLQ-45-NC') hits.push({ id: d.id, ...x });
  });
  console.log(`  ${hits.length} matches`);
  for (const h of hits.slice(0, 5)) {
    console.log(`\n  ${h.id}  "${(h.title||'').slice(0,55)}"`);
    console.log(`    vendor: ${h.vendor || '(none)'}  sku: ${h.sku || '(none)'}  houzzId: ${h.houzzId || '(none)'}`);
    console.log(`    imageUrl: ${(h.imageUrl||'(empty)').slice(0,90)}`);
    console.log(`    vendorUrl: ${h.vendorUrl || '(empty)'}`);
    console.log(`    _enrichedFromHouzzApr27: ${h._enrichedFromHouzzApr27 || 'no'}`);
    console.log(`    _imagesRehostedAt: ${h._imagesRehostedAt || 'no'}`);
  }
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
