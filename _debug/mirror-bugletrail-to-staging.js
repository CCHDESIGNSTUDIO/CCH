/**
 * Mirror production boards/7225-bugletrail (board doc + clips + proposals +
 * invoices + purchaseOrders) to staging with the SAME board ID. Preserves
 * all linkage fields. Read-only on production, writes to staging only.
 */
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, setDoc } = require('firebase/firestore');

const PROD = {
  apiKey: 'AIzaSyAd24U5ArVGrA24IxNcYD2NYiTVycyF4og',
  authDomain: 'cch-design-boards.firebaseapp.com',
  projectId: 'cch-design-boards',
  storageBucket: 'cch-design-boards.appspot.com',
  messagingSenderId: '210388013080',
  appId: '1:210388013080:web:cch-design-boards',
};
const STAGING = {
  apiKey: 'AIzaSyBIwwo7uRij6Q0FZg-qmIS1LC8t2AjXrYo',
  authDomain: 'cch-studio-staging.firebaseapp.com',
  projectId: 'cch-studio-staging',
  storageBucket: 'cch-studio-staging.firebasestorage.app',
  messagingSenderId: '210388013080',
  appId: '1:210388013080:web:fcd520b30c0d50b149736d',
};

const BOARD_ID = '7225-bugletrail';
const SUBCOLLECTIONS = ['clips', 'proposals', 'invoices', 'purchaseOrders'];
const TAG = { _stagedFromProdAt: new Date().toISOString(), _stagingMirrorOf: BOARD_ID };

(async () => {
  const start = Date.now();
  const prodApp = initializeApp(PROD, 'p');
  const stagingApp = initializeApp(STAGING, 's');
  const prodDb = getFirestore(prodApp);
  const stagingDb = getFirestore(stagingApp);

  console.log('Phase A: Read production /boards/7225-bugletrail (read-only)');
  const allBoards = await getDocs(collection(prodDb, 'boards'));
  let boardData = null;
  allBoards.forEach(d => { if (d.id === BOARD_ID) boardData = d.data(); });
  if (!boardData) { console.error('Board not found in prod'); process.exit(1); }
  console.log(`  board found: "${boardData.name || boardData.title}"`);

  const subData = {};
  for (const sub of SUBCOLLECTIONS) {
    const snap = await getDocs(collection(prodDb, 'boards', BOARD_ID, sub));
    const docs = [];
    snap.forEach(d => docs.push({ id: d.id, data: d.data() }));
    subData[sub] = docs;
    console.log(`  ${sub}: ${docs.length}`);
  }

  console.log('\nPhase B: Write to staging (preserving doc IDs and linkage fields)');
  await setDoc(doc(stagingDb, 'boards', BOARD_ID), { ...boardData, ...TAG });
  console.log(`  wrote board doc: ${BOARD_ID}`);

  for (const sub of SUBCOLLECTIONS) {
    let count = 0;
    for (const d of subData[sub]) {
      await setDoc(doc(stagingDb, 'boards', BOARD_ID, sub, d.id), { ...d.data, ...TAG });
      count++;
      if (count % 50 === 0) console.log(`  ${sub}: ${count}/${subData[sub].length}`);
    }
    console.log(`  wrote ${sub}: ${count} docs`);
  }

  console.log(`\nDONE in ${((Date.now()-start)/1000).toFixed(1)}s.`);
  console.log('Production untouched.');
  process.exit(0);
})().catch(e => { console.error('FAILED:', e); process.exit(1); });
