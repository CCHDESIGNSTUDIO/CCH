'use strict';
const path = require('path');
const admin = require('firebase-admin');
const key = path.join(__dirname, 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
admin.initializeApp({ credential: admin.credential.cert(require(key)) });
const db = admin.firestore();

(async () => {
  const q2 = await db.collection('products').where('vendor', '==', 'M Teixeira Soapstone').limit(8).get();
  console.log('vendor hits', q2.size);
  q2.forEach(d => {
    const p = d.data();
    console.log('-', p.title, '| houzzId:', p.houzzId || '-', '| studioId:', d.id.slice(0, 55));
  });

  const snap = await db.collection('products').limit(5000).get();
  let withHz = 0;
  let example = null;
  snap.forEach(d => {
    const p = d.data();
    if (String(p.houzzId || '').trim()) {
      withHz++;
      if (!example && /soapstone/i.test(p.title || '')) example = { id: d.id, title: p.title, houzzId: p.houzzId };
    }
  });
  console.log('sample scan houzzId count in first 5000:', withHz);
  if (example) console.log('soapstone example:', JSON.stringify(example));
  else {
    snap.forEach(d => {
      const p = d.data();
      if (!example && String(p.houzzId || '').trim() && p.title) {
        example = { id: d.id, title: p.title, houzzId: p.houzzId, vendor: p.vendor };
      }
    });
    console.log('any houzz example:', JSON.stringify(example));
  }
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
