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
  const boardId = 'cloud-rolling-hills';
  for (const sub of ['proposals', 'invoices', 'purchaseOrders']) {
    try {
      const s = await getDocs(collection(db, 'boards', boardId, sub));
      console.log('\n=== ' + sub + ' (' + s.size + ' docs) ===');
      let alouetteCount = 0, amerCount = 0;
      s.forEach(d => {
        const x = d.data();
        const items = x.items || x.lineItems || [];
        for (const it of items) {
          const t = String(it.title || it.name || it.description || '').toLowerCase();
          if (t.includes('alouette')) {
            alouetteCount++;
            console.log('  Alouette in ' + sub + '/' + d.id.slice(0,12) + '#' + (x.number || x.proposalNum || x.invoiceNum || x.poNum) +
              '  cat=' + (it.category||'') + '  room=' + (it.room||'') + '  cost=' + (it.cost||0) + '  client=' + (it.clientPrice||it.totalSelling||it.amount||0));
          }
          if (t.includes('amer celadon')) {
            amerCount++;
            console.log('  Amer Celadon in ' + sub + '/' + d.id.slice(0,12) + '#' + (x.number || x.proposalNum || x.invoiceNum || x.poNum) +
              '  cat=' + (it.category||'') + '  room=' + (it.room||'') + '  cost=' + (it.cost||0) + '  client=' + (it.clientPrice||it.totalSelling||it.amount||0));
          }
        }
      });
      console.log('  alouette items: ' + alouetteCount + ', amer celadon items: ' + amerCount);
    } catch (e) { console.log(sub + ': ' + e.message); }
  }
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
