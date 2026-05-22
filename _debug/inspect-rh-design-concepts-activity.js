/**
 * Read-only: find any activity mentioning Design Concepts section.
 */
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, query, where, doc, getDoc } = require('firebase/firestore');

const PROD = {
  apiKey: 'AIzaSyAd24U5ArVGrA24IxNcYD2NYiTVycyF4og',
  authDomain: 'cch-design-boards.firebaseapp.com',
  projectId: 'cch-design-boards',
  storageBucket: 'cch-design-boards.firebasestorage.app',
};
const BOARD_ID = 'cloud-rolling-hills';
const DESIGN_ID = 'dDnSNrYubEZVQpFzUmL2';

(async () => {
  const db = getFirestore(initializeApp(PROD));

  const actSnap = await getDocs(query(collection(db, 'activity'), where('projectId', '==', BOARD_ID)));
  console.log('Total activity for cloud-rolling-hills:', actSnap.size);

  const bySection = [];
  const byName = [];
  actSnap.forEach((d) => {
    const x = d.data();
    const sid = String((x.meta && x.meta.sectionId) || '');
    const desc = String(x.description || '');
    if (sid === DESIGN_ID) bySection.push({ id: d.id, ...x });
    if (/design concepts/i.test(desc)) byName.push({ id: d.id, ...x });
  });

  console.log('\nActivity with meta.sectionId === Design Concepts doc:', bySection.length);
  bySection.forEach((x) => {
    console.log(' ', x.timestamp, '|', x.type, '|', x.action, '|', x.description);
  });

  console.log('\nActivity description mentions "Design Concepts":', byName.length);
  byName.forEach((x) => {
    console.log(' ', x.timestamp, '|', x.type, '|', x.action, '|', x.description);
    if (x.meta) console.log('   meta:', JSON.stringify(x.meta));
  });

  const ib = await getDoc(doc(db, 'boards', BOARD_ID, 'ideabooks', DESIGN_ID));
  console.log('\nDesign Concepts Firestore fields:');
  if (ib.exists()) {
    const x = ib.data();
    console.log('  coverUrl:', x.coverUrl || '(none)');
    console.log('  keys:', Object.keys(x).sort().join(', '));
  }

  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
