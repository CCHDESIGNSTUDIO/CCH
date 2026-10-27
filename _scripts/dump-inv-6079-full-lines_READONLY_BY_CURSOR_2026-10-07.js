#!/usr/bin/env node
'use strict';
const path = require('path');
const admin = require('firebase-admin');
const KEY = path.join(__dirname, '..', '_debug', 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
const app = admin.initializeApp({ credential: admin.credential.cert(require(KEY)) }, 'inv6079b');
const db = app.firestore();
function str(v) { return String(v == null ? '' : v).trim(); }
function n(v) { return parseFloat(v) || 0; }
(async () => {
  const snap = await db.collection('boards').doc('cloud-rolling-hills').collection('invoices').doc('bCqEJW17QgBgGCDpUqqu').get();
  const x = snap.data() || {};
  console.log('clientSummary:', JSON.stringify(String(x.clientSummary || '').slice(0, 400)));
  console.log('servicePeriod', x.servicePeriodLabel || x.periodStart, x.periodEnd);
  (x.items || []).forEach((it, i) => {
    console.log('\n=== LINE', i + 1, '===');
    console.log('title:', str(it.title || it.name));
    console.log('service:', str(it.service || it.billingCategory));
    console.log('qty/hrs:', n(it.qty || it.hours), 'rate', n(it.rate), 'amt', n(it.amount || it.total));
    console.log('desc:', str(it.description).slice(0, 400));
    console.log('lineNotes:', str(it.lineNotes || it.notes).slice(0, 500));
  });
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
