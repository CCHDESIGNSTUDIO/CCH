const path = require('path');
const admin = require('firebase-admin');
const SA = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
admin.initializeApp({ credential: admin.credential.cert(require(SA)) });
const db = admin.firestore();
db.collection('boards').doc('31-whitesail').collection('invoices').get().then(s => {
  console.log('Whitesail invoices: ' + s.size);
  s.forEach(d => {
    const x = d.data();
    console.log('  id=' + d.id + '  num=' + (x.invoiceNum || '?') + '  total=$' + x.total + '  status=' + x.status + '  _houzzId=' + x._houzzId + '  source=' + (x._source || x.source));
  });
  process.exit(0);
});
