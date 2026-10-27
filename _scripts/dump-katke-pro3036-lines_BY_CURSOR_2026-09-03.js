#!/usr/bin/env node
'use strict';
const path = require('path');
const admin = require('firebase-admin');
const KEY = path.join(__dirname, '..', '_debug', 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
const db = admin.initializeApp({ credential: admin.credential.cert(require(KEY)) }, 'katke3036').firestore();

(async () => {
  const d = await db.collection('boards').doc('katke-graceland-dr').collection('proposals').doc('askqWrZqzQDveIAznKml').get();
  const x = d.data() || {};
  console.log('num', x.proposalNum, 'total', x.total, 'tax', x.taxAmount || x.tax, 'published', x.published);
  (x.items || []).forEach((it, i) => {
    console.log([
      i + 1,
      it.title || it.name,
      'qty=' + (it.qty || it.quantity || 1),
      'amt=' + (it.amount || it.total || it.clientPrice || ''),
      it.room || '',
      it.lineApprovalStatus || ''
    ].join(' | '));
  });
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
