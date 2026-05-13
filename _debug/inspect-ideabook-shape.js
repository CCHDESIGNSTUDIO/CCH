/**
 * Read one full ideabook + its first image entry to understand the data shape.
 */
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
const BOARD_ID = 'cloud-rolling-hills';

(async () => {
  const app = initializeApp(PROD);
  const db = getFirestore(app);

  const snap = await getDocs(collection(db, 'boards', BOARD_ID, 'ideabooks'));
  console.log(`Total ideabooks in ${BOARD_ID}: ${snap.size}\n`);

  // Show top-level fields of first 3 ideabooks
  let i = 0;
  snap.forEach(d => {
    if (i >= 3) return;
    const x = d.data();
    console.log(`=== Ideabook ${++i}: ${d.id} ===`);
    for (const k of Object.keys(x).sort()) {
      const v = x[k];
      if (k === 'images') {
        console.log(`  ${k.padEnd(25)}: [Array len=${(v||[]).length}]`);
        if (Array.isArray(v) && v.length > 0) {
          console.log(`  --- first image entry: ---`);
          for (const ik of Object.keys(v[0]).sort()) {
            const iv = v[0][ik];
            console.log(`    ${ik.padEnd(20)}: ${typeof iv === 'string' ? iv.slice(0, 100) : JSON.stringify(iv).slice(0, 100)}`);
          }
        }
      } else {
        console.log(`  ${k.padEnd(25)}: ${typeof v === 'string' ? v.slice(0, 100) : JSON.stringify(v).slice(0, 100)}`);
      }
    }
    console.log('');
  });

  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
