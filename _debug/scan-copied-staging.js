#!/usr/bin/env node
'use strict';
const path = require('path');
const admin = require('firebase-admin');
const key = path.join(__dirname, 'service-account.json', 'cch-studio-staging-firebase-adminsdk-fbsvc-b93c6f1cf4.json');
admin.initializeApp({ credential: admin.credential.cert(require(key)) });
const db = admin.firestore();

(async () => {
  let copiedId = 0;
  let clipSync = 0;
  let clipper = 0;
  let houzz = 0;
  const snap = await db.collection('products').get();
  snap.forEach((d) => {
    const p = d.data() || {};
    if (/^copied/i.test(d.id)) copiedId++;
    if (String(p.source || '').includes('clip-sync')) clipSync++;
    if (/clipper/i.test(String(p.source || ''))) clipper++;
    if (String(p.houzzId || '').trim()) houzz++;
  });
  console.log('STAGING products:', snap.size);
  console.log('  id starts copied:', copiedId);
  console.log('  source clip-sync:', clipSync);
  console.log('  source clipper:', clipper);
  console.log('  houzzId:', houzz);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
