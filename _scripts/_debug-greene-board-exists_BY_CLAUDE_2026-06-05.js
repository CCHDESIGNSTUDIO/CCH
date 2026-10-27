#!/usr/bin/env node
'use strict';
const admin = require('firebase-admin');
const path = require('path');
const KEY = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
admin.initializeApp({ credential: admin.credential.cert(require(KEY)) });
const db = admin.firestore();

(async () => {
  const ref = db.collection('boards').doc('greene');
  const snap = await ref.get();
  console.log('boards/greene exists:', snap.exists);
  console.log('field keys:', snap.exists ? Object.keys(snap.data() || {}) : []);
  console.log('raw data:', JSON.stringify(snap.data() || null));

  const inv = await ref.collection('invoices').limit(3).get();
  console.log('invoices subcollection count (sample):', inv.size);

  // list all fields on doc
  if (snap.exists) {
    const d = snap.data();
    console.log('qbCustomerId:', d.qbCustomerId);
  }
})().catch((e) => { console.error(e); process.exit(1); });
