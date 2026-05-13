/** READ-ONLY: query specific products by title from production to check houzzId + imageUrl. */
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');
const PROD = {
  apiKey: 'AIzaSyAd24U5ArVGrA24IxNcYD2NYiTVycyF4og',
  authDomain: 'cch-design-boards.firebaseapp.com',
  projectId: 'cch-design-boards',
  storageBucket: 'cch-design-boards.firebasestorage.app',
  messagingSenderId: '210388013080',
  appId: '1:210388013080:web:cch-design-boards',
};
const TITLES_TO_FIND = ['Ember Pendants', 'Daffodil', 'fluted brass body', 'MELIA', 'Anatolia Collection', 'Linear Iron and Brass Chandelier'];
(async () => {
  const app = initializeApp(PROD);
  const db = getFirestore(app);
  const psnap = await getDocs(collection(db, 'products'));
  const found = new Map();
  psnap.forEach(d => {
    const x = d.data();
    const t = String(x.title || '').toLowerCase();
    for (const target of TITLES_TO_FIND) {
      if (t.includes(target.toLowerCase().slice(0, 15))) {
        if (!found.has(target)) found.set(target, []);
        found.get(target).push({ id: d.id, ...x });
      }
    }
  });
  for (const target of TITLES_TO_FIND) {
    const list = found.get(target) || [];
    console.log(`\n=== "${target}" — ${list.length} matches`);
    for (const x of list.slice(0, 3)) {
      console.log(`  ${x.id}  "${(x.title||'').slice(0,50)}"`);
      console.log(`    vendor:    ${x.vendor || x.manufacturer || '(none)'}`);
      console.log(`    houzzId:   ${x.houzzId || '(none — Studio-native)'}`);
      console.log(`    imageUrl:  ${(x.imageUrl||'(empty)').slice(0,90)}`);
      console.log(`    source:    ${x.source || x.dataSource || x.origin || '(none)'}`);
      console.log(`    rehosted:  ${x._imagesRehostedAt || '(no — not touched by Phase 2C)'}`);
    }
  }
  process.exit(0);
})().catch(e => { console.error('FAILED:', e); process.exit(1); });
