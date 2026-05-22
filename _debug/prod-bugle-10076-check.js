'use strict';
const path = require('path');
const admin = require('firebase-admin');
const PR = path.join(__dirname, 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
const db = admin.initializeApp({ credential: admin.credential.cert(require(PR)) }, 'pr').firestore();

(async () => {
  const d = await db.collection('boards').doc('7225-bugletrail').collection('invoices').doc('IN-10076').get();
  if (!d.exists) {
    console.log('prod IN-10076 doc missing');
    process.exit(0);
  }
  const x = d.data();
  let full = 0, frag = 0, miss = 0;
  (x.items || []).forEach((it) => {
    const u = String(it.imageUrl || '').trim();
    if (!u) miss++;
    else if (u.startsWith('http')) full++;
    else frag++;
  });
  console.log('PROD IN-10076 lines:', (x.items || []).length, '| full https:', full, '| fragment:', frag, '| missing:', miss);
  (x.items || []).slice(0, 3).forEach((it, i) => console.log(' ', i, (it.imageUrl || '(none)').slice(0, 100)));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
