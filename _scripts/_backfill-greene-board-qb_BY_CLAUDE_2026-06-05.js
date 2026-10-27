#!/usr/bin/env node
'use strict';
/** One-time: create missing boards/greene parent doc with qbCustomerId 2264 (user entered in Edit Project). */
const admin = require('firebase-admin');
const path = require('path');
const KEY = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
admin.initializeApp({ credential: admin.credential.cert(require(KEY)) });
const db = admin.firestore();

(async () => {
  const ref = db.collection('boards').doc('greene');
  const snap = await ref.get();
  const now = new Date().toISOString();
  await ref.set({
    name: 'Greene',
    qbCustomerId: '2264',
    defaultProductMarkupPct: 30,
    defaultLaborMarkupPct: 15,
    taxRate: 0,
    status: 'Active',
    createdAt: snap.exists ? (snap.data().createdAt || now) : now,
    updatedAt: now,
    _boardDocBackfilledAt: now,
    _boardDocBackfillNote: 'Parent board doc created — had invoices subcollection only; qbCustomerId from Cynthia Edit Project 2026-06-05',
  }, { merge: true });
  const check = await ref.get();
  console.log('boards/greene exists:', check.exists, 'qbCustomerId:', check.data().qbCustomerId);
})().catch((e) => { console.error(e); process.exit(1); });
