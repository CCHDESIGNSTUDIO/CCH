#!/usr/bin/env node
'use strict';
const path = require('path');
const admin = require('firebase-admin');
const KEY = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
const db = admin.initializeApp({ credential: admin.credential.cert(require(KEY)) }, 'wo236img').firestore();
const BOARD = 'cloud-rolling-hills';
const CLIP = 'y1225j48vzeYDheN0BXm';
const LIB = 'gWPgnpfAdJXlcjVlwRUq';

(async () => {
  const clip = (await db.collection('boards').doc(BOARD).collection('clips').doc(CLIP).get()).data() || {};
  const prod = (await db.collection('products').doc(LIB).get()).data() || {};
  const libAlt = (await db.collection('productLibrary').doc(LIB).get()).data() || {};
  function img(x) {
    return {
      imageUrl: String(x.imageUrl || '').slice(0, 160),
      image: String(x.image || '').slice(0, 80),
      images0: Array.isArray(x.images) && x.images[0] ? String(x.images[0]).slice(0, 120) : '',
      nImages: Array.isArray(x.images) ? x.images.length : 0,
      override: x.imageUrlOverride || '',
      updatedAt: x.updatedAt || ''
    };
  }
  console.log(JSON.stringify({
    clip: Object.assign({ libraryProductId: clip.libraryProductId || '' }, img(clip)),
    products: img(prod),
    productLibrary: img(libAlt)
  }, null, 2));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
