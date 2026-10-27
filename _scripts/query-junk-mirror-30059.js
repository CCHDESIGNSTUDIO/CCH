#!/usr/bin/env node
'use strict';
const path = require('path');
const admin = require('firebase-admin');
const KEY = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
admin.initializeApp({ credential: admin.credential.cert(require(KEY)) });
const db = admin.firestore();

(async function() {
  for (const col of ['productLibrary_archive', 'products_archive']) {
    const snap = await db.collection(col).where('sku', '==', '30059').get();
    console.log('\n' + col + ':', snap.size);
    snap.forEach(function(d) {
      const x = d.data() || {};
      console.log(' ', d.id, '| cost:', x.cost, '| totalCost:', x.totalCost, '| source:', x.source, '| title:', x.title);
    });
  }
  // also search by title fragment
  const snap2 = await db.collection('productLibrary_archive').get();
  const hits = [];
  snap2.forEach(function(d) {
    const t = String((d.data() || {}).title || '');
    if (/backlit framed mirror/i.test(t)) hits.push({ id: d.id, ...d.data() });
  });
  console.log('\nproductLibrary_archive title matches:', hits.length);
  hits.forEach(function(h) {
    console.log(' ', h.id, '| cost:', h.cost, '| source:', h.source, '| created:', h.createdAt);
  });
})().catch(function(e) { console.error(e); process.exit(1); });
