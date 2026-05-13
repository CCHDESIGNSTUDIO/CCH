const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');
const PROD = { apiKey: 'AIzaSyAd24U5ArVGrA24IxNcYD2NYiTVycyF4og', authDomain: 'cch-design-boards.firebaseapp.com', projectId: 'cch-design-boards', storageBucket: 'cch-design-boards.appspot.com', messagingSenderId: '210388013080', appId: '1:210388013080:web:cch-design-boards' };

(async () => {
  const app = initializeApp(PROD);
  const db = getFirestore(app);

  // Check across all 3 subcols on Cloud-Parker, count items population, sample connectedDocs
  for (const sub of ['proposals', 'invoices', 'purchaseOrders']) {
    console.log(`\n=== ${sub} ===`);
    const snap = await getDocs(collection(db, 'boards', 'cloud-parker', sub));
    let withItems = 0, withConnected = 0, totalItems = 0;
    let firstSampleItem = null, firstSampleConn = null, firstSampleConnDocId = null;
    snap.forEach(d => {
      const x = d.data();
      if (Array.isArray(x.items) && x.items.length > 0) {
        withItems++;
        totalItems += x.items.length;
        if (!firstSampleItem) firstSampleItem = { docId: d.id, item: x.items[0] };
      }
      if (x.connectedDocs) {
        withConnected++;
        if (!firstSampleConn) {
          firstSampleConn = x.connectedDocs;
          firstSampleConnDocId = d.id;
        }
      }
    });
    console.log(`  total: ${snap.size}  with items[]>0: ${withItems}  total line items: ${totalItems}  with connectedDocs: ${withConnected}`);
    if (firstSampleItem) {
      console.log(`  Sample item from ${firstSampleItem.docId}:`);
      const compact = {};
      for (const [k,v] of Object.entries(firstSampleItem.item)) {
        compact[k] = typeof v === 'string' && v.length > 60 ? v.slice(0,60)+'…' : v;
      }
      console.log(JSON.stringify(compact, null, 2).slice(0, 800));
    }
    if (firstSampleConn) {
      console.log(`  Sample connectedDocs from ${firstSampleConnDocId}:`);
      console.log(JSON.stringify(firstSampleConn, null, 2).slice(0, 800));
    }
  }
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
