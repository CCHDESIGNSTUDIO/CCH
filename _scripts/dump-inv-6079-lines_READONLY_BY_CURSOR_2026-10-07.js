#!/usr/bin/env node
'use strict';
const path = require('path');
const admin = require('firebase-admin');
const KEY = path.join(__dirname, '..', '_debug', 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
const app = admin.initializeApp({ credential: admin.credential.cert(require(KEY)) }, 'inv6079');
const db = app.firestore();

function n(v) { return parseFloat(v) || 0; }
function str(v) { return String(v == null ? '' : v).trim(); }

(async () => {
  const snap = await db.collection('boards').doc('cloud-rolling-hills').collection('invoices').doc('bCqEJW17QgBgGCDpUqqu').get();
  if (!snap.exists) throw new Error('INV-6079 missing');
  const x = snap.data() || {};
  console.log('num', x.invoiceNum || x.number, 'status', x.status, 'total', x.total);
  console.log('title', x.title || x.name || '');
  (x.items || []).forEach((it, i) => {
    console.log(
      i + 1,
      '|', str(it.title || it.name).slice(0, 50),
      '| hrs', n(it.qty || it.hours),
      '| rate', n(it.rate || it.unitPrice),
      '| amt', n(it.amount || it.total || it.lineTotal),
      '| et', str(it.expenseType || it.itemType),
      '| notes', str(it.lineNotes || it.notes || it.description).slice(0, 120)
    );
  });
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
