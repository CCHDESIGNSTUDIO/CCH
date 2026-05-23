'use strict';
const path = require('path');
const admin = require('firebase-admin');
const ST = path.join(__dirname, 'service-account.json', 'cch-studio-staging-firebase-adminsdk-fbsvc-b93c6f1cf4.json');
const db = admin.initializeApp({ credential: admin.credential.cert(require(ST)) }, 'st').firestore();

(async () => {
  const s = await db.collection('boards').doc('cloud-rolling-hills').collection('clips').get();
  s.forEach((d) => {
    const u = d.data().imageUrl || '';
    if (!/firebasestorage/i.test(u)) return;
    console.log((d.data().title || '').slice(0, 50), '|', d.id);
  });
  const sf = [];
  s.forEach((d) => {
    if (String(d.data().title || '').toLowerCase().indexOf('san franc') >= 0) sf.push(d.data().title);
  });
  console.log('san francisco clips:', sf.length, sf.slice(0, 5));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
