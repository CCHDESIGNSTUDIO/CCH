#!/usr/bin/env node
'use strict';
const admin = require('firebase-admin');
const path = require('path');
const KEY = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
admin.initializeApp({ credential: admin.credential.cert(require(KEY)) });
const db = admin.firestore();
const PID = 'cloud-rolling-hills';

(async () => {
  const snap = await db.collection('boards').doc(PID).collection('invoices').get();
  const rows = [];
  snap.forEach((d) => {
    const x = d.data() || {};
    const num = String(x.invoiceNum || x.number || x.name || d.id).trim();
    rows.push({
      num,
      id: d.id,
      status: x.status || '(blank)',
      published: x.published,
      sentAt: x.sentAt || x.emailSentAt || x.clientSentAt || '',
      emailed: x.emailed || x.emailSent || x.sentToClient,
      qbPushPending: x.qbPushPending,
      updatedAt: x.updatedAt || '',
    });
  });
  rows.sort((a, b) => a.num.localeCompare(b.num));
  console.log('=== cloud-rolling-hills invoices — status fields ===\n');
  rows.forEach((r) => {
    console.log(r.num.padEnd(14), 'status:', String(r.status).padEnd(12),
      'published:', r.published, 'sentAt:', (r.sentAt || '').slice(0, 19),
      'emailed:', r.emailed);
  });
  console.log('\nTotal invoice docs:', rows.length);
})().catch((e) => { console.error(e); process.exit(1); });
