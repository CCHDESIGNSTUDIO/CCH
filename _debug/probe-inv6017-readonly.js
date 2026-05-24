#!/usr/bin/env node
'use strict';
const path = require('path');
const admin = require('firebase-admin');
const key = path.join(__dirname, 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
admin.initializeApp({ credential: admin.credential.cert(require(key)) });
const db = admin.firestore();

function imgKind(u) {
  u = String(u || '').trim();
  if (!u) return 'empty';
  if (/firebasestorage/i.test(u)) return 'firebase';
  if (/ivy-uploads/i.test(u)) return 'ivy';
  return 'other';
}

(async () => {
  const board = 'cloud-rolling-hills';
  const snap = await db.collection('boards').doc(board).collection('invoices').get();
  let found = null;
  snap.forEach((d) => {
    const x = d.data();
    const n = String(x.number || x.invoiceNum || '').trim();
    if (/6017/.test(n)) found = { id: d.id, ...x };
  });
  if (!found) {
    console.log('INV-6017 not found');
    process.exit(1);
  }
  console.log('Invoice:', found.number || found.invoiceNum, 'docId:', found.id);
  console.log('updatedAt:', found.updatedAt);
  (found.items || []).forEach((it, i) => {
    console.log(i, '|', (it.title || '').slice(0, 32), '|', imgKind(it.imageUrl), '|', String(it.imageUrl || '').slice(0, 85));
  });
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
