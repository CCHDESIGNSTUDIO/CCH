#!/usr/bin/env node
'use strict';
/** Print linked doc line qty vs clip qty for heal candidates. READ-ONLY. */
const admin = require('firebase-admin');
const path = require('path');
const KEY = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(require(KEY)) });
const db = admin.firestore();

const IDS = process.argv.slice(2);
function money(v) {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return v;
  return parseFloat(String(v).replace(/[$,\s]/g, '')) || 0;
}

(async () => {
  const board = db.collection('boards').doc('cloud-rolling-hills');
  const want = new Set(IDS);
  for (const col of ['proposals', 'invoices']) {
    const docs = await board.collection(col).get();
    docs.forEach(doc => {
      const d = doc.data() || {};
      const num = d.invoiceNum || d.proposalNum || d.number || doc.id;
      (d.items || []).forEach((it, i) => {
        const cid = String(it.clipId || it.sourceClipId || '').trim();
        if (want.size && !want.has(cid)) return;
        if (!want.size && !cid) return;
        if (want.size || IDS.length === 0) {
          if (want.size && !want.has(cid)) return;
        }
        if (!cid) return;
        if (IDS.length && !want.has(cid)) return;
        console.log(col, num, 'line', i, 'clip', cid);
        console.log('  line qty', it.qty, 'clientPrice', it.clientPrice, 'amount', it.amount, 'sell', it.sellPrice, 'title', String(it.title || it.name || '').slice(0, 50));
      });
    });
  }
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
