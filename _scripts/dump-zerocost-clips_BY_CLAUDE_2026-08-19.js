#!/usr/bin/env node
'use strict';
/** Full field dump of zero-cost clips — find where the entered cost actually landed. READ-ONLY. */
const admin = require('firebase-admin');
const path = require('path');
const KEY = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(require(KEY)) });
const db = admin.firestore();

const MONEYISH = /(cost|price|amount|total|rate|sell|retail|trade|msrp|unit)/i;

(async () => {
  const cs = await db.collection('boards').doc('cloud-rolling-hills').collection('clips').get();
  const zero = [];
  cs.forEach(d => {
    const c = d.data() || {};
    const cost = parseFloat(c.cost);
    if (!cost || cost === 0) zero.push({ id: d.id, c });
  });
  console.log('clips with cost 0 / blank: ' + zero.length + ' of ' + cs.size + '\n');

  // Which money-ish fields exist anywhere, and how often they carry a non-zero value?
  const tally = {};
  zero.forEach(({ c }) => {
    Object.keys(c).forEach(k => {
      if (!MONEYISH.test(k)) return;
      const n = parseFloat(c[k]);
      tally[k] = tally[k] || { present: 0, nonzero: 0 };
      tally[k].present++;
      if (!isNaN(n) && n > 0) tally[k].nonzero++;
    });
  });
  console.log('=== money-ish fields on ZERO-COST clips ===');
  Object.keys(tally).sort().forEach(k => {
    console.log('  ' + k.padEnd(22) + ' present:' + String(tally[k].present).padStart(4) +
                '   NON-ZERO:' + String(tally[k].nonzero).padStart(4) +
                (tally[k].nonzero ? '   <-- value lives here' : ''));
  });

  console.log('\n=== 3 full dumps (every field) ===');
  zero.slice(0, 3).forEach(({ id, c }) => {
    console.log('\n--- clip ' + id + ' : ' + String(c.title || '').slice(0, 50) + ' ---');
    Object.keys(c).sort().forEach(k => {
      let v = c[k];
      if (v && typeof v === 'object') {
        if (typeof v.toDate === 'function') v = v.toDate().toISOString().slice(0, 16);
        else v = JSON.stringify(v).slice(0, 90);
      }
      v = String(v);
      if (v.length > 90) v = v.slice(0, 90) + '…';
      console.log('   ' + k.padEnd(24) + ' = ' + v);
    });
  });
  console.log('\ndone — nothing was written.');
})().catch(e => { console.error(e.message); process.exit(1); });
