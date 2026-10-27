#!/usr/bin/env node
'use strict';
const path = require('path');
const admin = require('firebase-admin');
const KEY = path.join(__dirname, '..', '_debug', 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
const db = admin.initializeApp({ credential: admin.credential.cert(require(KEY)) }, 'katkeLinks').firestore();
const BOARD = 'katke-graceland-dr';
const PID = 'tORSx2y6Z6UyOHuTdvl0';

function scan(label, snap) {
  let n = 0;
  snap.forEach((d) => {
    const x = d.data() || {};
    const hits = [];
    ['linkedProposalId', 'proposalId', 'sourceProposalId', 'convertedFromProposalId'].forEach((f) => {
      if (String(x[f] || '') === PID) hits.push(f);
    });
    if ([x.linkedProposalNum, x.proposalNum, x.sourceProposalNum].some((v) => String(v || '') === 'PRO-3016')) hits.push('num');
    const items = Array.isArray(x.items) ? x.items : [];
    const itemHits = items.filter((it) =>
      String(it.proposalId || it.sourceProposalId || '') === PID || String(it.proposalNum || '') === 'PRO-3016'
    ).length;
    if (itemHits) hits.push('items:' + itemHits);
    if (hits.length) {
      n++;
      console.log(label, d.id, x.invoiceNum || x.poNumber || x.number || '', 'total=' + (x.total || 0), hits.join(','));
    }
  });
  if (!n) console.log(label, 'none');
}

(async () => {
  scan('INV', await db.collection('boards').doc(BOARD).collection('invoices').get());
  scan('PO', await db.collection('boards').doc(BOARD).collection('purchaseOrders').get());
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
