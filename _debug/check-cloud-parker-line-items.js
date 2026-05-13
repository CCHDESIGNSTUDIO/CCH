/**
 * READ-ONLY: find Cloud-Parker board, sample its proposals/invoices/POs line items,
 * to see whether items carry any Houzz product reference (houzzId, houzzProductId, etc.)
 * or if they're just text-only line items.
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

  // Find Cloud-Parker board
  const all = await getDocs(collection(db, 'boards'));
  const candidates = [];
  all.forEach(d => {
    const x = d.data();
    const n = String(x.name || x.title || '').toLowerCase();
    if (/parker/i.test(n) || /parker/i.test(d.id)) candidates.push({ id: d.id, name: x.name || x.title });
  });
  console.log('Parker-related boards:');
  for (const c of candidates) console.log(`  id=${c.id}  name="${c.name}"`);

  if (candidates.length === 0) { process.exit(0); }
  const board = candidates[0];

  // For each subcol, dump 1 doc + first 2 items
  for (const sub of ['proposals', 'invoices', 'purchaseOrders']) {
    console.log(`\n--- boards/${board.id}/${sub} ---`);
    const ssnap = await getDocs(collection(db, 'boards', board.id, sub));
    console.log(`  total: ${ssnap.size} docs`);
    let i = 0;
    ssnap.forEach(d => {
      if (i++ >= 1) return;
      const x = d.data();
      const docKeys = Object.keys(x);
      console.log(`  sample doc id=${d.id}`);
      console.log(`    top-level keys: ${docKeys.slice(0, 25).join(', ')}${docKeys.length > 25 ? ', …' : ''}`);
      // Look at items array
      const items = x.items || x.lineItems || [];
      console.log(`    items[]: ${Array.isArray(items) ? items.length + ' items' : '(not an array)'}`);
      if (Array.isArray(items) && items.length > 0) {
        const first = items[0];
        const itemKeys = Object.keys(first);
        console.log(`    first item keys: ${itemKeys.join(', ')}`);
        // Highlight any Houzz/product reference fields
        const refs = {};
        for (const k of itemKeys) {
          if (/houzz|productId|product_id|libraryId|library_id|catalogId|sku|externalId/i.test(k)) {
            refs[k] = first[k];
          }
        }
        console.log(`    Houzz/product reference fields in first item: ${JSON.stringify(refs)}`);
        // Show first item compact
        const compact = {};
        for (const k of itemKeys) {
          let v = first[k];
          if (typeof v === 'string' && v.length > 60) v = v.slice(0, 60) + '…';
          compact[k] = v;
        }
        console.log(`    first item (full):`, JSON.stringify(compact, null, 2).slice(0, 1200));
      }
    });
  }

  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
