const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');
const PROD = {apiKey:'AIzaSyAd24U5ArVGrA24IxNcYD2NYiTVycyF4og',authDomain:'cch-design-boards.firebaseapp.com',projectId:'cch-design-boards',storageBucket:'cch-design-boards.firebasestorage.app',messagingSenderId:'210388013080',appId:'1:210388013080:web:cch-design-boards'};
(async () => {
  const app = initializeApp(PROD);
  const db = getFirestore(app);
  const snap = await getDocs(collection(db, 'boards', 'cloud-rolling-hills', 'invoices'));
  snap.forEach(d => {
    const x = d.data();
    const num = String(x.number || x.invoiceNum || '').trim();
    if (num.toUpperCase().includes('12962')) {
      console.log('docId:', d.id);
      console.log('  number:', num, ' total:', x.total, ' status:', x.status);
      console.log('  paidAmount:', x.paidAmount, ' invoiceBalance:', x.invoiceBalance);
      console.log('  items:', (x.items||[]).length);
      console.log('  source:', x.source || '(none)', ' qbId:', x.qbId || '(none)');
      console.log('  createdAt:', x.createdAt, ' updatedAt:', x.updatedAt);
      console.log('  date:', x.date);
    }
  });
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
