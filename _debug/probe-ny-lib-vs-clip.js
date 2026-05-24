'use strict';
const path = require('path');
const admin = require('firebase-admin');
const key = path.join(__dirname, 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
const db = admin.initializeApp({ credential: admin.credential.cert(require(key)) }).firestore();

function n(s) { return String(s || '').toLowerCase().trim(); }
function fb(u) { return /firebasestorage/i.test(String(u || '')); }
function hid(u) {
  const m = String(u || '').match(/houzz-products%2F(\d+)/);
  return m ? m[1] : '?';
}

(async () => {
  const title = process.argv[2] || 'Manhattan';
  const vendor = process.argv[3] || 'Concretti';
  const lib = [];
  (await db.collection('productLibrary').limit(8000).get()).forEach((d) => {
    const p = d.data();
    if (n(p.title) !== n(title)) return;
    if (n(p.vendor) !== n(vendor) && p.vendor) return;
    lib.push({ id: d.id, imageUrl: p.imageUrl || '', fb: fb(p.imageUrl), houzz: hid(p.imageUrl), vendor: p.vendor });
  });
  console.log('Library', title, vendor, 'hits', lib.length);
  lib.slice(0, 6).forEach((x) => console.log(' ', x.id, '|', x.vendor, '| houzz', x.houzz));

  const clips = await db.collection('boards').doc('cloud-rolling-hills').collection('clips').get();
  clips.forEach((d) => {
    const c = d.data();
    if (n(c.title) !== n(title)) return;
    console.log('CLIP', d.id, 'vendor', c.vendor, 'houzz', hid(c.imageUrl));
    console.log('  libraryProductId', c.libraryProductId, 'linked', c.linkedLibraryProductId);
    if (lib[0] && c.imageUrl === lib[0].imageUrl) console.log('  SAME URL as first lib entry');
  });
})();
