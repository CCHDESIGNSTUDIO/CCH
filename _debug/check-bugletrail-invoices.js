/**
 * Read-only audit of 7225 Bugletrail invoices in PRODUCTION.
 * Looking for: duplicates, recent creation dates, any of my tags.
 */
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

const PROD = {
  apiKey: 'AIzaSyAd24U5ArVGrA24IxNcYD2NYiTVycyF4og',
  authDomain: 'cch-design-boards.firebaseapp.com',
  projectId: 'cch-design-boards',
  storageBucket: 'cch-design-boards.appspot.com',
  messagingSenderId: '210388013080',
  appId: '1:210388013080:web:cch-design-boards',
};

(async () => {
  const app = initializeApp(PROD);
  const db = getFirestore(app);

  // Find Bugle Trail boards (could be 7225-bugletrail, 7255-bugle-trail, etc.)
  const allBoards = await getDocs(collection(db, 'boards'));
  const bugles = [];
  allBoards.forEach(d => {
    const x = d.data();
    const name = String(x.name || x.title || '').toLowerCase();
    if (/bugle/i.test(name) || /bugle/i.test(d.id)) {
      bugles.push({ id: d.id, name: x.name || x.title });
    }
  });
  console.log('Bugle-related boards in production:');
  for (const b of bugles) console.log(`  id=${b.id}  name="${b.name}"`);

  for (const b of bugles) {
    console.log(`\n--- ${b.id} invoices ---`);
    const inv = await getDocs(collection(db, 'boards', b.id, 'invoices'));
    const docs = [];
    inv.forEach(d => docs.push({ id: d.id, ...d.data() }));
    console.log(`  total invoices: ${docs.length}`);

    // Group by invoiceNum to find dupes
    const byNum = {};
    for (const d of docs) {
      const n = d.invoiceNum || d.invoiceNumber || '(no num)';
      (byNum[n] = byNum[n] || []).push(d);
    }
    const dupGroups = Object.entries(byNum).filter(([n, arr]) => arr.length > 1);
    console.log(`  unique invoiceNums: ${Object.keys(byNum).length}`);
    console.log(`  invoiceNums with duplicates: ${dupGroups.length}`);
    if (dupGroups.length > 0) {
      console.log('  Dupe details (top 10):');
      for (const [n, arr] of dupGroups.slice(0, 10)) {
        console.log(`    ${n}: ${arr.length} copies`);
        for (const d of arr.slice(0, 3)) {
          const created = d.createdAt || '(none)';
          const updated = d.updatedAt || '(none)';
          const src = d.source || d._stagedAt || '';
          console.log(`      docId=${d.id}  created=${created}  updated=${updated}  src=${src}`);
        }
      }
    }

    // Recent activity: any docs created in last 24h?
    const cutoff = Date.now() - 24*3600*1000;
    const recent = docs.filter(d => {
      const t = Date.parse(d.createdAt || d.updatedAt || '');
      return !isNaN(t) && t > cutoff;
    });
    console.log(`  docs created/updated in last 24h: ${recent.length}`);
    for (const d of recent.slice(0, 5)) {
      console.log(`    ${d.id}  created=${d.createdAt}  updated=${d.updatedAt}  source=${d.source || ''}`);
    }

    // Any with my tags
    const tagged = docs.filter(d => d.source === 'staging-copy-from-prod-rh' || d._stagedAt);
    console.log(`  docs with any of my staging tags: ${tagged.length}`);
  }

  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
