#!/usr/bin/env node
'use strict';
const path = require('path');
const admin = require('firebase-admin');
const KEY = path.join(__dirname, '..', '_debug', 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
const db = admin.initializeApp({ credential: admin.credential.cert(require(KEY)) }, 'wo204Dump').firestore();

(async function main() {
  const ref = db.collection('boards').doc('cloud-rolling-hills').collection('purchaseOrders').doc('WGLHOwcZgbgYG7oz2fmL');
  const snap = await ref.get();
  const x = snap.data() || {};
  console.log('poNum', x.poNum || x.number, 'poLocked', x.poLocked, 'vendor', x.vendor || x.billToName);
  const it = (x.items || [])[0] || {};
  const keys = Object.keys(it).sort();
  console.log('LINE0_KEYS', keys.join(', '));
  keys.forEach((k) => {
    const v = it[k];
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      console.log(k, JSON.stringify(v).slice(0, 200));
    } else if (Array.isArray(v)) {
      console.log(k, 'array', v.length, JSON.stringify(v).slice(0, 120));
    } else {
      console.log(k, JSON.stringify(v));
    }
  });
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
