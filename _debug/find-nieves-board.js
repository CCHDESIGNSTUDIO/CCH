/**
 * Find the Nieves / 3920 Laguna Blanca project in Firestore. Read-only.
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

(async () => {
  const app = initializeApp(PROD);
  const db = getFirestore(app);

  const snap = await getDocs(collection(db, 'boards'));
  const matches = [];
  snap.forEach(d => {
    const x = d.data();
    const id = d.id.toLowerCase();
    const name = String(x.name || x.projectName || '').toLowerCase();
    const addr = String(x.address || x.projectAddress || '').toLowerCase();
    const client = String(x.clientName || '').toLowerCase();
    if (id.includes('nieves') || id.includes('laguna') || id.includes('blanca') ||
        name.includes('nieves') || name.includes('laguna') || name.includes('blanca') ||
        addr.includes('laguna') || addr.includes('3920') ||
        client.includes('nieves')) {
      matches.push({ id: d.id, data: x });
    }
  });

  console.log(`Found ${matches.length} candidate board(s):\n`);
  for (const m of matches) {
    console.log(`  --- ${m.id} ---`);
    for (const k of ['name', 'projectName', 'clientName', 'clientEmail', 'address', 'projectAddress', 'archived', 'status', 'createdAt']) {
      if (m.data[k] !== undefined) console.log(`    ${k.padEnd(15)}: ${typeof m.data[k] === 'object' ? JSON.stringify(m.data[k]).slice(0,80) : m.data[k]}`);
    }
    console.log('');
  }

  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
