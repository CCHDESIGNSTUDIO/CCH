'use strict';
const path = require('path');
const admin = require('firebase-admin');
const key = path.join(__dirname, 'service-account.json', 'cch-studio-staging-firebase-adminsdk-fbsvc-b93c6f1cf4.json');
admin.initializeApp({ credential: admin.credential.cert(require(key)) });
const db = admin.firestore();

(async () => {
  const id = 'soapstone_kitchen_sinks__m_teixeira_soapstone__appliances___plumbing';
  const doc = await db.collection('products').doc(id).get();
  if (doc.exists) {
    const p = doc.data();
    console.log('STAGING products doc:', id);
    console.log('title:', p.title);
    console.log('houzzId:', p.houzzId || '(empty)');
    console.log('houzzProductId:', p.houzzProductId || '(empty)');
  } else {
    console.log('products doc missing for', id);
    const q = await db.collection('products').where('title', '==', 'Soapstone Kitchen Sinks').limit(5).get();
    console.log('title hits:', q.size);
    q.forEach((d) => {
      const p = d.data();
      console.log(' ', d.id, 'houzzId', p.houzzId || '-');
    });
  }
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
