#!/usr/bin/env node
'use strict';
const admin = require('firebase-admin');
const path = require('path');
const KEY = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
admin.initializeApp({ credential: admin.credential.cert(require(KEY)) });
const db = admin.firestore();

(async () => {
  const pid = '7225-bugletrail';
  const snap = await db.collection('products').where('projectId', '==', pid).get();
  let withH = 0;
  snap.forEach((d) => { if (d.data().houzzId) withH++; });
  console.log('products with projectId', snap.size, 'with houzzId', withH);
})().catch((e) => { console.error(e); process.exit(1); });
