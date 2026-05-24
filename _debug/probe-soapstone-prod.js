'use strict';
const path = require('path');
const admin = require('firebase-admin');
const key = path.join(__dirname, 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
admin.initializeApp({ credential: admin.credential.cert(require(key)) });
const db = admin.firestore();

(async () => {
  const id = 'soapstone_kitchen_sinks__m_teixeira_soapstone__appliances___plumbing';
  const doc = await db.collection('products').doc(id).get();
  if (doc.exists) {
    const p = doc.data();
    console.log('PROD products doc:', id);
    console.log('title:', p.title);
    console.log('houzzId:', p.houzzId || '(empty)');
  } else {
    const q = await db.collection('products').where('title', '==', 'Soapstone Kitchen Sinks').limit(3).get();
    q.forEach(d => console.log(d.id, d.data().houzzId));
  }
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
