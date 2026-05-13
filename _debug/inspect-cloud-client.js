/**
 * Read-only: find every Cloud project in Firestore + their client refs.
 * Plus look at /clients/ collection for any Ron/Tracey/Cloud doc.
 */
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, query, where } = require('firebase/firestore');

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

  // 1. All boards — filter for Cloud
  console.log('=== BOARDS (projects) MATCHING "cloud" ===');
  const boardsSnap = await getDocs(collection(db, 'boards'));
  const cloudBoards = [];
  boardsSnap.forEach(d => {
    const x = d.data();
    const name = String(x.name || x.projectName || '').toLowerCase();
    const id = d.id.toLowerCase();
    if (id.includes('cloud') || name.includes('cloud')) {
      cloudBoards.push({ id: d.id, data: x });
    }
  });
  console.log(`  Found ${cloudBoards.length} Cloud boards`);
  for (const b of cloudBoards) {
    console.log(`\n  --- ${b.id} ---`);
    console.log(`    name:           ${b.data.name || b.data.projectName || '(none)'}`);
    console.log(`    clientName:     ${b.data.clientName || '(none)'}`);
    console.log(`    clientId:       ${b.data.clientId || '(none)'}`);
    console.log(`    clientEmail:    ${b.data.clientEmail || '(none)'}`);
    console.log(`    client (obj):   ${b.data.client ? JSON.stringify(b.data.client).slice(0,80) : '(none)'}`);
    console.log(`    address:        ${b.data.address || '(none)'}`);
    console.log(`    archived:       ${b.data.archived || false}`);
    console.log(`    createdAt:      ${b.data.createdAt || '(none)'}`);
  }

  // 2. /clients/ collection
  console.log('\n=== /clients/ COLLECTION (filtering name~Cloud or Ron or Tracey) ===');
  try {
    const clientsSnap = await getDocs(collection(db, 'clients'));
    const matched = [];
    clientsSnap.forEach(d => {
      const x = d.data();
      const name = String(x.name || x.clientName || x.fullName || '').toLowerCase();
      const email = String(x.email || x.clientEmail || '').toLowerCase();
      if (name.includes('cloud') || name.includes('ron') || name.includes('tracey') || email.includes('cloud') || email.includes('thecloudfam')) {
        matched.push({ id: d.id, data: x });
      }
    });
    console.log(`  Total clients: ${clientsSnap.size}, matched: ${matched.length}`);
    for (const c of matched) {
      console.log(`\n  --- ${c.id} ---`);
      const fields = ['name','clientName','fullName','email','clientEmail','phone','primaryEmail','projects','projectIds','boards'];
      for (const f of fields) {
        if (c.data[f] !== undefined) console.log(`    ${f.padEnd(15)}: ${typeof c.data[f] === 'object' ? JSON.stringify(c.data[f]).slice(0,100) : c.data[f]}`);
      }
    }
  } catch (e) {
    console.log(`  Error reading /clients/: ${e.code || e.message}`);
  }

  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
