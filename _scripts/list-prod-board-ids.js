'use strict';
const path = require('path');
const admin = require('firebase-admin');
const key = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
const db = admin.initializeApp({ credential: admin.credential.cert(require(key)) }).firestore();
(async () => {
  const snap = await db.collection('boards').get();
  const rows = [];
  snap.forEach((d) => rows.push({ id: d.id, name: (d.data().name || '').slice(0, 50) }));
  rows.sort((a, b) => a.id.localeCompare(b.id));
  rows.forEach((r) => console.log(r.id, '|', r.name));
  console.log('total', rows.length);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
