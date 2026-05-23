'use strict';
const path = require('path');
const admin = require('firebase-admin');
const PR = path.join(__dirname, 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
const db = admin.initializeApp({ credential: admin.credential.cert(require(PR)) }, 'pr').firestore();

function kind(u) {
  u = String(u || '').trim();
  if (!u) return 'none';
  if (/firebasestorage|\.firebasestorage\.app/i.test(u)) return 'firebase';
  if (/ivy-uploads/i.test(u)) return 'ivy';
  return 'other';
}

function urlsFrom(p) {
  const out = [];
  const push = (u) => { u = String(u || '').trim(); if (u) out.push(u); };
  push(p.imageUrl);
  push(p.image);
  push(p.thumbnail);
  (p.images || []).forEach((x) => push(typeof x === 'string' ? x : (x && (x.url || x.imageUrl))));
  return out;
}

(async () => {
  const titles = ['Manhattan', 'New York', 'San Francisco', 'Custom Soapstone Kitchen Sink'];
  const snap = await db.collection('products').limit(3000).get();
  console.log('products scanned', snap.size);
  titles.forEach((t) => {
    const hits = [];
    snap.forEach((d) => {
      const p = d.data();
      if (String(p.title || '').trim() !== t) return;
      const us = urlsFrom(p);
      hits.push({ id: d.id, vendor: p.vendor, kinds: us.map(kind), urls: us.map((u) => u.slice(0, 72)) });
    });
    console.log('\nTitle', t, 'matches', hits.length);
    hits.slice(0, 3).forEach((h) => console.log(' ', h.id, h.vendor, h.kinds.join(','), h.urls[0] || ''));
  });
  const clips = await db.collection('boards').doc('cloud-rolling-hills').collection('clips').get();
  let fb = 0, ivy = 0;
  clips.forEach((d) => {
    const c = d.data();
    const u = c.imageUrl || c.image || '';
    if (kind(u) === 'firebase') fb++;
    if (kind(u) === 'ivy') ivy++;
  });
  console.log('\nRH clips total', clips.size, 'firebase img', fb, 'ivy img', ivy);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
