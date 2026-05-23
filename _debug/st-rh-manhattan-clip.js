'use strict';
const path = require('path');
const admin = require('firebase-admin');
const ST = path.join(__dirname, 'service-account.json', 'cch-studio-staging-firebase-adminsdk-fbsvc-b93c6f1cf4.json');
const db = admin.initializeApp({ credential: admin.credential.cert(require(ST)) }, 'st').firestore();

function kind(u) {
  u = String(u || '').trim();
  if (/firebasestorage|\.firebasestorage\.app/i.test(u)) return 'firebase';
  if (/ivy-uploads/i.test(u)) return 'ivy';
  return u ? 'other' : 'none';
}

(async () => {
  const clips = await db.collection('boards').doc('cloud-rolling-hills').collection('clips').get();
  let fb = 0, ivy = 0;
  clips.forEach((d) => {
    const u = (d.data().imageUrl || '');
    if (kind(u) === 'firebase') fb++;
    if (kind(u) === 'ivy') ivy++;
  });
  console.log('staging RH clips', clips.size, 'firebase', fb, 'ivy', ivy);
  clips.forEach((d) => {
    const c = d.data();
    if (String(c.title || '').toLowerCase().indexOf('manhattan') < 0) return;
    console.log(' ', d.id, c.title, kind(c.imageUrl));
  });
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
