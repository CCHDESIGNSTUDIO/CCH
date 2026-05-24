#!/usr/bin/env node
'use strict';
const path = require('path');
const admin = require('firebase-admin');
const key = path.join(__dirname, 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
admin.initializeApp({ credential: admin.credential.cert(require(key)) });
const db = admin.firestore();

function hostKind(u) {
  u = String(u || '').replace(/&amp;/g, '&');
  if (!u) return 'empty';
  if (/firebasestorage\.googleapis|\.firebasestorage\.app/i.test(u)) {
    if (/houzz-products/i.test(u)) return 'firebase-houzz-products';
    return 'firebase-other';
  }
  if (/ivy-uploads/i.test(u)) return 'ivy';
  if (/houzz|hzcdn/i.test(u)) return 'houzz-cdn';
  return 'other';
}

function scanCol(name) {
  const counts = {};
  let n = 0;
  let hasHz = 0;
  return db.collection(name).get().then((snap) => {
    snap.forEach((d) => {
      n++;
      const p = d.data() || {};
      if (String(p.houzzId || '').trim()) hasHz++;
      const u = p.imageUrl || (Array.isArray(p.images) && p.images[0]) || '';
      const k = hostKind(u);
      counts[k] = (counts[k] || 0) + 1;
    });
    console.log('\n===', name, 'docs:', n, 'houzzId field:', hasHz, '===');
    Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([k, v]) => console.log(' ', v, k));
    return n;
  });
}

(async () => {
  await scanCol('products');
  await scanCol('productLibrary');
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
