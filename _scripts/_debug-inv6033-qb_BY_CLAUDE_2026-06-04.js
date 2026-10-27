#!/usr/bin/env node
'use strict';
const admin = require('firebase-admin');
const path = require('path');
const KEY = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
admin.initializeApp({ credential: admin.credential.cert(require(KEY)) });
const db = admin.firestore();

(async () => {
  const projectId = 'greene';
  const invoiceId = 'xm5sfxwzmEO8bUWlsovY';

  const board = await db.collection('boards').doc(projectId).get();
  const inv = await db.collection('boards').doc(projectId).collection('invoices').doc(invoiceId).get();
  if (!inv.exists) {
    console.log('Invoice not found');
    process.exit(1);
  }
  const d = inv.data();
  const proj = board.exists ? board.data() : {};

  console.log('=== Board (greene) ===');
  console.log('name:', proj.name);
  console.log('clientName:', proj.clientName);
  console.log('clientEmail:', proj.clientEmail);
  console.log('qbCustomerId:', proj.qbCustomerId);

  console.log('\n=== INV-6033 doc', invoiceId, '===');
  console.log('invoiceNum:', d.invoiceNum || d.number);
  console.log('status:', d.status);
  console.log('total:', d.total, 'taxRate:', d.taxRate, 'tax:', d.tax);
  console.log('items:', (d.items || []).length);
  (d.items || []).forEach((it, i) => {
    console.log(' ', i + 1, it.title || it.name, 'qty', it.qty, 'amount', it.amount || it.clientPrice || it.total, 'billing', it.billingCategory || it.service);
  });

  console.log('\n=== QB fields ===');
  console.log('qbDocId:', d.qbDocId);
  console.log('qbInvoiceId:', d.qbInvoiceId);
  console.log('qbPushPending:', d.qbPushPending);
  console.log('qbPushLastError:', d.qbPushLastError);
  console.log('qbPushErrorAt:', d.qbPushErrorAt);
  console.log('qbPushQueuedAt:', d.qbPushQueuedAt);
  console.log('qbSynced:', d.qbSynced);

  // siblings with same invoice number
  const num = String(d.invoiceNum || d.number || '').trim();
  if (num) {
    const snap = await db.collection('boards').doc(projectId).collection('invoices')
      .where('invoiceNum', '==', num).get();
    console.log('\n=== Docs with invoiceNum', num, ':', snap.size, '===');
    snap.forEach((doc) => {
      const x = doc.data();
      console.log(' ', doc.id, 'items', (x.items || []).length, 'total', x.total, 'qbDocId', x.qbDocId || '(none)', 'qbPushLastError', x.qbPushLastError || '');
    });
  }

  console.log('\n=== Related Greene boards ===');
  for (const id of ['greene-hixson', 'greene-de-anza']) {
    const b = await db.collection('boards').doc(id).get();
    if (!b.exists) { console.log(id, 'not found'); continue; }
    const x = b.data();
    console.log(id, { name: x.name, clientName: x.clientName, qbCustomerId: x.qbCustomerId });
  }
})().catch((e) => { console.error(e); process.exit(1); });
