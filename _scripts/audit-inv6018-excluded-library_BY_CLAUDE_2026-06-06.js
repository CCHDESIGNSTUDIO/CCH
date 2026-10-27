#!/usr/bin/env node
'use strict';
const admin = require('firebase-admin');
const path = require('path');
const KEY = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
admin.initializeApp({ credential: admin.credential.cert(require(KEY)) });
const db = admin.firestore();
const PID = 'cloud-rolling-hills';
const EXCLUDED = [
  'NgfeOU7R5vCLVhl1JbQP', 'zz6iCqGrUWb4FU873JTH', '2UwSssFkCPwqApM3Buj7',
  'oGa172UD0c0oihCKwtdT', 'HOAQnHg8t78NjPtXjVvV', '6eHN31X6lSUuNFQuC5qL',
  'o9e0MoQUNFa6JtuURIIh', 'vRwNKFBeUemcv8NFJJtZ', '6s0HRvsS6ruC0U0kZgGa',
  'c8869sMAI1DJ5s5kQ6S3', 'GQbr3XSY73fLZSkFVHR5', 'iVIFO04UhbLueQOLz2Vn',
  'P8DaFyTh17tje63V09FS', 'VDB85yacPeuiFYv4GX3f',
];

(async () => {
  for (const clipId of EXCLUDED) {
    const c = (await db.collection('boards').doc(PID).collection('clips').doc(clipId).get()).data() || {};
    const lib = String(c.libraryProductId || '').trim();
    const p = lib ? await db.collection('products').doc(lib).get() : null;
    const pl = lib ? await db.collection('productLibrary').doc(lib).get() : null;
    console.log('---', c.title);
    console.log(' clip', clipId, 'room', c.room);
    console.log(' libId', lib || '(none)');
    console.log(' products/', p && p.exists ? 'YES productCode=' + (p.data().productCode || '') : 'MISSING');
    console.log(' productLibrary/', pl && pl.exists ? 'YES' : 'MISSING');
  }
})();
