'use strict';
const path = require('path');
const admin = require('firebase-admin');
const key = path.join(__dirname, 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
const db = admin.initializeApp({ credential: admin.credential.cert(require(key)) }).firestore();
const board = 'cloud-rolling-hills';

function kind(u) {
  u = String(u || '');
  if (/firebasestorage/i.test(u)) return 'firebase';
  if (/ivy-uploads/i.test(u)) return 'ivy';
  return 'other';
}

(async () => {
  const clips = [];
  (await db.collection('boards').doc(board).collection('clips').get()).forEach((d) => {
    clips.push({ id: d.id, ...d.data() });
  });

  const terms = ['manhattan', 'hardware', 'window', 'sink', 'concretti', 'tile'];
  console.log('=== Clips (title/vendor/room contains manhattan, hardware, window, sink) ===\n');
  for (const c of clips) {
    const blob = [c.title, c.name, c.vendor, c.room, c.category, c.notes]
      .map((x) => String(x || '').toLowerCase())
      .join(' ');
    if (!terms.some((t) => blob.includes(t))) continue;
    console.log('CLIP ID:', c.id);
    console.log('  title:', c.title || c.name);
    console.log('  vendor:', c.vendor || '(none)');
    console.log('  room:', c.room || c.category || '(none)');
    console.log('  houzzId:', c.houzzId || c.houzzProductId || '(none)');
    console.log('  image:', kind(c.imageUrl), '\n   ', String(c.imageUrl || '').slice(0, 95));
    console.log('');
  }

  const inv = (
    await db.collection('boards').doc(board).collection('invoices').doc('17zvCe3CeU7fZIkkseGW').get()
  ).data();
  const line = (inv.items || [])[3];
  console.log('=== IN-12902 line 3 ===');
  console.log('  title:', line.title, '| vendor:', line.vendor || '(none)');
  console.log('  houzzId:', line.houzzId || '(none)');
  console.log('  image:', kind(line.imageUrl));
  console.log('  ', String(line.imageUrl || '').slice(0, 95));

  const hid = String(line.houzzId || '');
  if (hid) {
    const match = clips.filter((c) => String(c.houzzId || c.houzzProductId) === hid);
    console.log('\n=== All clips with same houzzId as invoice line (' + hid + ') ===');
    match.forEach((c) => {
      console.log(' -', c.id, '|', c.title || c.name, '|', kind(c.imageUrl));
    });
  }
})();
