#!/usr/bin/env node
'use strict';
const path = require('path');
const admin = require('firebase-admin');
const KEY = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
admin.initializeApp({ credential: admin.credential.cert(require(KEY)) });
const db = admin.firestore();
(async () => {
  for (const c of ['productLibrary_archive', 'products_archive', 'productLibrary', 'products']) {
    const s = await db.collection(c).count().get();
    console.log(c + ':', s.data().count);
  }
})();
