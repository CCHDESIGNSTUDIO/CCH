#!/usr/bin/env node
'use strict';
const admin = require('firebase-admin');
const path = require('path');
const KEY = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
admin.initializeApp({ credential: admin.credential.cert(require(KEY)) });
const db = admin.firestore();

(async () => {
  const prodSnap = await db.collection('products').get();
  prodSnap.forEach((d) => {
    const x = d.data() || {};
    const t = String(x.title || '');
    const url = String(x.productUrl || x.vendorUrl || x.pageUrl || '');
    if (!/linear/i.test(t) || !/chandelier/i.test(t)) {
      if (!/rockymountainhardware/i.test(url)) return;
    } else {
      console.log('--- product', d.id);
      console.log('  title:', t);
      console.log('  vendor:', x.vendor);
      console.log('  url:', url);
    }
    if (/rockymountainhardware/i.test(url)) {
      console.log('RMH url product', d.id, t, 'vendor=', x.vendor);
    }
  });

  const clipSnap = await db.collection('boards').doc('cloud-rolling-hills').collection('clips').get();
  clipSnap.forEach((d) => {
    const c = d.data() || {};
    const url = String(c.productUrl || c.pageUrl || '');
    if (/linear/i.test(c.title || '') && /chandelier/i.test(c.title || '')) {
      console.log('clip', d.id, c.title, 'vendor=', c.vendor, 'lib=', c.libraryProductId, url.slice(0, 60));
    }
    if (/rockymountainhardware.*linear-chandelier/i.test(url)) {
      console.log('RMH clip', d.id, c.title, 'vendor=', c.vendor, 'lib=', c.libraryProductId);
    }
  });
})();
