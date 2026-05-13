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
  const snap = await getDocs(collection(db, 'boards', 'cloud-rolling-hills', 'invoices'));
  console.log('cloud-rolling-hills/invoices: ' + snap.size + ' docs\n');
  let totalAll = 0, totalNonDraft = 0, totalPaid = 0;
  const byStatus = {};
  const byPrefix = {};
  const allInvoices = [];
  snap.forEach(d => {
    const x = d.data();
    const total = parseFloat(x.total) || 0;
    const status = x.status || '(none)';
    const num = String(x.number || x.invoiceNum || '').trim();
    const prefix = num ? num.split('-')[0] : '(no-num)';
    totalAll += total;
    if (status !== 'Draft') totalNonDraft += total;
    if (status === 'Paid') totalPaid += total;
    byStatus[status] = (byStatus[status] || 0) + 1;
    byPrefix[prefix] = (byPrefix[prefix] || 0) + 1;
    allInvoices.push({ docId: d.id, num, total, status });
  });
  console.log('TOTALS:');
  console.log('  All invoices sum:           $' + totalAll.toLocaleString('en-US', {minimumFractionDigits:2}));
  console.log('  Non-Draft sum:              $' + totalNonDraft.toLocaleString('en-US', {minimumFractionDigits:2}));
  console.log('  Paid sum:                   $' + totalPaid.toLocaleString('en-US', {minimumFractionDigits:2}));
  console.log('\nBY STATUS:');
  for (const [k, v] of Object.entries(byStatus).sort((a,b) => b[1]-a[1])) console.log('  ' + k.padEnd(20) + ' ' + v);
  console.log('\nBY PREFIX:');
  for (const [k, v] of Object.entries(byPrefix).sort((a,b) => b[1]-a[1])) console.log('  ' + k.padEnd(15) + ' ' + v);
  console.log('\nLARGEST 10 INVOICES (any status):');
  allInvoices.sort((a,b) => b.total - a.total).slice(0, 10).forEach(inv => {
    console.log('  $' + inv.total.toFixed(2).padStart(12) + '  ' + inv.num.padEnd(12) + '  status=' + inv.status + '  doc=' + inv.docId.slice(0,12));
  });
  console.log('\nSEARCH FOR IN-12978 / 12977 / 12980 / $199K invoice:');
  const targets = ['IN-12978', 'IN-12977', 'IN-12980', 'INV-12978', 'INV-12977', 'INV-12980'];
  let foundTarget = false;
  allInvoices.forEach(inv => {
    if (targets.some(t => inv.num.includes(t.split('-')[1]))) {
      console.log('  FOUND: ' + inv.num + '  $' + inv.total + '  ' + inv.status);
      foundTarget = true;
    }
    if (inv.total >= 190000 && inv.total <= 210000) {
      console.log('  ~$199K candidate: ' + inv.num + '  $' + inv.total + '  ' + inv.status);
      foundTarget = true;
    }
  });
  if (!foundTarget) console.log('  None of the target invoices found in this project.');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
