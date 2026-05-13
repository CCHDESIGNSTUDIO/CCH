const path = require('path');
const admin = require('firebase-admin');
const SA = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
admin.initializeApp({ credential: admin.credential.cert(require(SA)) });
const db = admin.firestore();
db.collection('boards').doc('katke-graceland').collection('invoices').get().then(s => {
  s.forEach(d => {
    const x = d.data();
    console.log('docId:', d.id);
    console.log('  invoiceNum:', x.invoiceNum || x.number || '(none)');
    console.log('  status:    ', x.status);
    console.log('  total:     ', x.total);
    console.log('  paid:      ', x.paidAmount);
    console.log('  created:   ', x.createdAt);
    console.log('  source:    ', x._source || x.source);
    console.log('  name:      ', x.name);
    console.log('  items:     ', (x.items || []).length, 'line items');
  });
  process.exit(0);
});
