const path = require('path');
const admin = require('firebase-admin');
const SA = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
admin.initializeApp({ credential: admin.credential.cert(require(SA)) });
const db = admin.firestore();
(async () => {
  const ref = db.collection('boards').doc('katke-graceland-dr').collection('invoices').doc('ogvfb07qPmYq1LM4nqeT');
  const snap = await ref.get();
  if (!snap.exists) { console.log('Already gone.'); process.exit(0); }
  const d = snap.data();
  console.log('Deleting:', d.invoiceNum || d.number, '$' + d.total, d.status);
  await ref.delete();
  await db.collection('boards').doc('katke-graceland-dr').update({
    invoiceCount: admin.firestore.FieldValue.increment(-1),
    updatedAt: new Date().toISOString()
  });
  console.log('Done. Real board invoiceCount decremented.');
  process.exit(0);
})();
