/**
 * Read-only: figure out how Studio stores inspiration sections + images.
 * Look at an existing project (cloud-rolling-hills) for a real example.
 */
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, doc, getDoc, getDocs } = require('firebase/firestore');

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

  // 1. Try common inspiration-related subcollection names
  const candidates = ['inspirationSections', 'sections', 'ideabooks', 'inspiration', 'inspirationBoards', 'inspirationImages', 'images', 'boards'];
  for (const name of candidates) {
    try {
      const snap = await getDocs(collection(db, 'boards', BOARD_ID, name));
      console.log(`  ${('boards/' + BOARD_ID + '/' + name).padEnd(70)} → ${snap.size} docs`);
      if (snap.size > 0 && snap.size < 50) {
        console.log(`    First doc:`, JSON.stringify(Array.from(snap.docs)[0].data()).slice(0, 300));
      }
    } catch (e) {
      console.log(`  ${name}: error ${e.code || e.message}`);
    }
  }

  // 2. Look at the parent doc for top-level inspiration field
  console.log('\n--- Top-level board doc inspirationsekt-related fields ---');
  const ds = await getDoc(doc(db, 'boards', BOARD_ID));
  if (ds.exists()) {
    const x = ds.data();
    for (const k of Object.keys(x).sort()) {
      if (k.toLowerCase().includes('inspir') || k.toLowerCase().includes('section') || k.toLowerCase().includes('image') || k.toLowerCase().includes('idea')) {
        const v = x[k];
        console.log(`  ${k.padEnd(30)} : ${typeof v === 'object' ? (Array.isArray(v) ? '[Array len=' + v.length + ']' : JSON.stringify(v).slice(0,80)) : String(v).slice(0,80)}`);
      }
    }
  }

  // 3. Top-level collections (look for project-scoped or global)
  console.log('\n--- Trying global /inspirationSections ---');
  try {
    const snap = await getDocs(collection(db, 'inspirationSections'));
    console.log(`  /inspirationSections → ${snap.size} docs`);
    if (snap.size > 0) {
      const first = Array.from(snap.docs)[0];
      console.log(`  First docId: ${first.id}`);
      console.log(`  First data:`, JSON.stringify(first.data()).slice(0, 400));
    }
  } catch (e) {
    console.log(`  /inspirationSections error: ${e.code || e.message}`);
  }

  console.log('\n--- Trying global /inspirations ---');
  try {
    const snap = await getDocs(collection(db, 'inspirations'));
    console.log(`  /inspirations → ${snap.size} docs`);
    if (snap.size > 0) {
      const first = Array.from(snap.docs)[0];
      console.log(`  First docId: ${first.id}`);
      console.log(`  First data:`, JSON.stringify(first.data()).slice(0, 400));
    }
  } catch (e) {
    console.log(`  /inspirations error: ${e.code || e.message}`);
  }

  console.log('\n--- Trying global /sections ---');
  try {
    const snap = await getDocs(collection(db, 'sections'));
    console.log(`  /sections → ${snap.size} docs`);
    if (snap.size > 0) {
      const first = Array.from(snap.docs)[0];
      console.log(`  First docId: ${first.id}`);
      console.log(`  First data keys:`, Object.keys(first.data()).join(', '));
    }
  } catch (e) {
    console.log(`  /sections error: ${e.code || e.message}`);
  }

  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
