const path = require('path');
const admin = require('firebase-admin');
const SA = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
admin.initializeApp({ credential: admin.credential.cert(require(SA)) });
const db = admin.firestore();
db.collection('activity').where('projectId', '==', 'katke-graceland').get().then(async snap => {
  for (const d of snap.docs) {
    console.log('Deleting activity', d.id, '—', (d.data().description || '').slice(0, 60));
    await d.ref.delete();
  }
  console.log('Done.', snap.size, 'stale activity entries cleaned.');
  process.exit(0);
});
