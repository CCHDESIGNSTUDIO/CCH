const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');
const PROD = {apiKey:'AIzaSyAd24U5ArVGrA24IxNcYD2NYiTVycyF4og',authDomain:'cch-design-boards.firebaseapp.com',projectId:'cch-design-boards',storageBucket:'cch-design-boards.firebasestorage.app',messagingSenderId:'210388013080',appId:'1:210388013080:web:cch-design-boards'};
(async () => {
  const app = initializeApp(PROD);
  const db = getFirestore(app);
  const snap = await getDocs(collection(db, 'boards', 'cloud-rolling-hills', 'invoices'));
  let found = 0;
  snap.forEach(d => {
    const x = d.data();
    const num = String(x.number || x.invoiceNum || '').trim();
    if (num.toUpperCase().includes('12902')) {
      found++;
      console.log('docId:', d.id);
      console.log('  number:', num);
      console.log('  status:', x.status || '(none)');
      console.log('  _poPaymentStatus:', x._poPaymentStatus || '(none)');
      console.log('  total:', x.total || 0);
      console.log('  paidAmount:', x.paidAmount || 0);
      console.log('  invoiceBalance:', x.invoiceBalance || 0);
      console.log('  qbId:', x.qbId || '(none)');
      console.log('  qbInvoiceId:', x.qbInvoiceId || '(none)');
      console.log('  qbStatus:', x.qbStatus || '(none)');
      console.log('  qbPaymentStatus:', x.qbPaymentStatus || '(none)');
      console.log('  payments[]:', Array.isArray(x.payments) ? x.payments.length + ' entries' : '(none)');
      if (Array.isArray(x.payments)) for (const p of x.payments) console.log('    -', p.amount, p.method || '', p.date || '', p.reference || '');
      console.log('  updatedAt:', x.updatedAt || '');
      console.log('  ---');
    }
  });
  if (!found) console.log('NOT FOUND');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
