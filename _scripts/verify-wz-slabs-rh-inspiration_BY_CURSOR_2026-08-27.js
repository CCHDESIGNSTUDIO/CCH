/**
 * Confirm last 12 pins on RH Slabs after WZ import.
 *   node _scripts/verify-wz-slabs-rh-inspiration_BY_CURSOR_2026-08-27.js
 */
'use strict';
const path = require('path');
const admin = require('firebase-admin');
const KEY = path.join(__dirname, '..', '_debug', 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
const app = admin.initializeApp({ credential: admin.credential.cert(require(KEY)) }, 'wzSlabsVerify');
const db = app.firestore();

(async function () {
  const ib = (await db.collection('boards').doc('cloud-rolling-hills').collection('ideabooks').doc('5zLV53Y6IBMkPGDgKHaM').get()).data() || {};
  const images = ib.images || [];
  console.log('Slabs count', images.length);
  images.slice(-12).forEach(function (im, i) {
    console.log(images.length - 12 + i, {
      caption: im.caption,
      vendor: im.vendor || '(empty)',
      showSource: im.showSource,
      importedFrom: im.importedFrom,
      hasHosted: String(im.imageUrl || '').indexOf('firebasestorage') >= 0,
      sourceFile: String(im.sourceUrl || '').split('/').pop()
    });
  });
  process.exit(0);
})().catch(function (e) { console.error(e); process.exit(1); });
