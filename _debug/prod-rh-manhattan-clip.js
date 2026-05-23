'use strict';
const path = require('path');
const admin = require('firebase-admin');
const PR = path.join(__dirname, 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
const db = admin.initializeApp({ credential: admin.credential.cert(require(PR)) }, 'pr').firestore();

function kind(u) {
  u = String(u || '').trim();
  if (/firebasestorage|\.firebasestorage\.app/i.test(u)) return 'firebase';
  if (/ivy-uploads/i.test(u)) return 'ivy';
  return u ? 'other' : 'none';
}

(async () => {
  const clips = await db.collection('boards').doc('cloud-rolling-hills').collection('clips').get();
  let n = 0;
  clips.forEach((d) => {
    const c = d.data();
    if (String(c.title || '').toLowerCase().indexOf('manhattan') < 0) return;
    n++;
    const u = c.imageUrl || c.image || '';
    console.log(d.id, (c.title || '').slice(0, 40), kind(u), String(u).slice(0, 85));
    (c.images || []).slice(0, 3).forEach((im, i) => {
      const u2 = typeof im === 'string' ? im : (im && (im.url || im.imageUrl));
      if (u2) console.log('  images[' + i + ']', kind(u2), String(u2).slice(0, 85));
    });
  });
  console.log('manhattan clips', n);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
