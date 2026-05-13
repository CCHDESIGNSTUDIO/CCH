/** Find INV-6014, 6012, 6007 across all boards and dump their QB-related fields. */
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
const TARGETS = ['INV-6014', 'INV-6012', 'INV-6007', 'IN-6014', 'IN-6012', 'IN-6007'];
function norm(s) { const m = String(s||'').trim().toUpperCase().match(/(?:INV|IN)[\s-]?(\d+)/); return m ? 'INV-'+m[1] : ''; }
(async () => {
  const app = initializeApp(PROD);
  const db = getFirestore(app);
  const targets = new Set(TARGETS.map(norm).filter(Boolean));
  const bsnap = await getDocs(collection(db, 'boards'));
  const found = [];
  for (const bd of bsnap.docs) {
    try {
      const psnap = await getDocs(collection(db, 'boards', bd.id, 'invoices'));
      psnap.forEach(d => {
        const x = d.data();
        const num = norm(x.number || x.invoiceNum || '');
        if (targets.has(num)) {
          found.push({ projectId: bd.id, projectName: bd.data().name || bd.id, docId: d.id, num, ...x });
        }
      });
    } catch (_e) {}
  }
  console.log('Found ' + found.length + ' matching invoices:\n');
  for (const f of found) {
    console.log('  ' + f.num + '  in  ' + f.projectName + '  (project ' + f.projectId + ', doc ' + f.docId + ')');
    console.log('    total:                  ' + (f.total || 0));
    console.log('    paidAmount:             ' + (f.paidAmount || 0));
    console.log('    invoiceBalance:         ' + (f.invoiceBalance || 0));
    console.log('    status:                 ' + (f.status || ''));
    console.log('    qbInvoiceId / qbId:     ' + (f.qbInvoiceId || f.qbId || '(none)'));
    console.log('    qbPaymentStatus:        ' + (f.qbPaymentStatus || '(none)'));
    console.log('    qbBalance:              ' + (f.qbBalance != null ? f.qbBalance : '(none)'));
    console.log('    lastQbSyncAt:           ' + (f.lastQbSyncAt || '(none)'));
    console.log('    lastQbWebhookAt:        ' + (f.lastQbWebhookAt || '(none)'));
    console.log();
  }
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
