const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, getDoc } = require('firebase/firestore');
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
  // 1. Find every board whose id or name matches bugletrail
  const bsnap = await getDocs(collection(db, 'boards'));
  console.log('Boards matching bugletrail:');
  for (const bd of bsnap.docs) {
    const name = (bd.data().name || '').toLowerCase();
    const id = bd.id.toLowerCase();
    if (name.includes('bugle') || id.includes('bugle')) {
      console.log(`  id=${bd.id}  name="${bd.data().name}"`);
      // Count POs
      try {
        const psnap = await getDocs(collection(db, 'boards', bd.id, 'purchaseOrders'));
        console.log(`    purchaseOrders count: ${psnap.size}`);
        // Sample first 5
        let i = 0;
        psnap.forEach(d => {
          if (i < 5) {
            const x = d.data();
            console.log(`      [${i+1}] doc=${d.id}  number=${x.number || x.poNum || ''}  vendor="${x.vendor || ''}"  qbId=${x.qbId || '(none)'}  paidAmount=${x.paidAmount || 0}  status=${x._poPaymentStatus || x.status || ''}  importedMay2=${x._paymentImportedFromHouzzMay2 || '(no)'}`);
            i++;
          }
        });
      } catch (e) { console.log(`    error: ${e.message}`); }
    }
  }
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
