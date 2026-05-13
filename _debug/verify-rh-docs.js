/**
 * Read-only listing of all RH invoices + proposals.
 * Confirms whether IN-12980 / PR-12951 / IN-12977/78/76 / PR-12957 still exist in Firestore.
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

  const TARGETS = ['IN-12980', 'IN-12977', 'IN-12978', 'IN-12976', 'PR-12951', 'PR-12957'];

  for (const sub of ['invoices', 'proposals']) {
    const snap = await getDocs(collection(db, 'boards', BOARD_ID, sub));
    console.log(`\n=== /${sub}/ — ${snap.size} docs ===`);
    const list = [];
    snap.forEach(d => {
      const x = d.data();
      list.push({
        docId: d.id,
        number: String(x.number || x.invoiceNum || x.proposalNum || '').trim(),
        status: x.status || '',
        total: x.total,
        items: (x.items || x.lineItems || []).length,
        lastEditedAt: x.lastEditedAt || x.updatedAt || '',
        lastEditedBy: x.lastEditedBy || '',
      });
    });
    list.sort((a, b) => String(a.number).localeCompare(String(b.number)));
    for (const r of list) {
      console.log(`  ${(r.number || r.docId).padEnd(10)}  status=${r.status.padEnd(16)} total=$${String(r.total || 0).padStart(10)}  items=${String(r.items).padStart(3)}  edited=${String(r.lastEditedAt).slice(0,19)}  by=${r.lastEditedBy}`);
    }

    console.log(`\n  TARGET CHECK for /${sub}/:`);
    for (const t of TARGETS) {
      const found = list.find(r => r.number.toUpperCase().includes(t) || r.docId.toUpperCase().includes(t));
      console.log(`    ${t}: ${found ? `EXISTS (docId=${found.docId}, items=${found.items})` : 'MISSING'}`);
    }
  }

  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
