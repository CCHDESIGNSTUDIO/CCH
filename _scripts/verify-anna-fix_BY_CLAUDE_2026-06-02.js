#!/usr/bin/env node
'use strict';
const path = require('path');
const admin = require('firebase-admin');
const KEY = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
admin.initializeApp({ credential: admin.credential.cert(require(KEY)) });
const db = admin.firestore();
const PID = 'cloud-rolling-hills';
const CLIP = 'RHcPR9xep5IdBZEKUAK5';
const LIB = '93WNGh4hetTjLelYY9Xy';

(async () => {
  const lib = await db.collection('products').doc(LIB).get();
  const clip = await db.collection('boards').doc(PID).collection('clips').doc(CLIP).get();
  console.log('products/' + LIB, lib.data().title, lib.data().sku, lib.data().source, lib.data().productUrl);
  console.log('clip', clip.data().title, clip.data().sku, clip.data().libraryProductId,
    'inv', clip.data().invoiceNum, clip.data().invoiceId);
  inv.forEach((d) => {
    const n = String(d.data().number || d.data().invoiceNum || '');
    if (n.indexOf('6017') >= 0) console.log('any 6017', d.id, n);
  });
  const inv6017 = await db.collection('boards').doc(PID).collection('invoices').doc('woO4Doh3IHzRuUEXqIhW').get();
  if (inv6017.exists) {
    (inv6017.data().items || []).forEach((it, i) => {
      if (String(it.clipId || '') === CLIP || String(it.sku || '') === '44764') {
        console.log('INV-6017 doc', inv6017.id, inv6017.data().number, 'line', i, it.title, it.sku, it.libraryProductId, it.houzzId);
      }
    });
  }
  const inv = await db.collection('boards').doc(PID).collection('invoices').get();
  inv.forEach((d) => {
    (d.data().items || []).forEach((it, i) => {
      if (String(it.clipId || '') === CLIP || String(it.libraryProductId || '') === LIB ||
          (String(it.title || '').indexOf('Anna') >= 0 && String(it.sku || '') === '44764')) {
        console.log('invoice', d.id, d.data().number || d.data().invoiceNum, 'line', i, it.title, it.sku, it.libraryProductId);
      }
    });
  });
})();
