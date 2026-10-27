#!/usr/bin/env node
'use strict';
/** Did the price repair touch anything DONE or PAID? READ-ONLY. */
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');
const KEY = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(require(KEY)) });
const db = admin.firestore();

const REV = path.join(__dirname, '..', '_debug', 'REVERSAL-rh-prices-2026-08-19.json');
const PAID = /(paid|closed|complete|received|installed|delivered|invoiced)/i;

(async () => {
  const rev = JSON.parse(fs.readFileSync(REV, 'utf8'));
  const board = db.collection('boards').doc('cloud-rolling-hills');

  const flagged = [], clean = [];
  for (const u of rev.updates) {
    const snap = await board.collection('clips').doc(u.clipId).get();
    if (!snap.exists) continue;
    const c = snap.data() || {};
    const marks = [];
    if (PAID.test(String(c.status || ''))) marks.push('status=' + c.status);
    if (PAID.test(String(c.houzzInvoice || ''))) marks.push('houzzInvoice=' + c.houzzInvoice);
    if (PAID.test(String(c.houzzPO || ''))) marks.push('houzzPO=' + c.houzzPO);
    if (PAID.test(String(c.houzzProposal || ''))) marks.push('houzzProposal=' + c.houzzProposal);
    if (c.paid === true || c.isPaid === true) marks.push('paid=true');
    const row = { clipId: u.clipId, title: String(c.title || '').slice(0, 46),
                  room: c.room || '—', prev: u.previousCost, now: c.cost, marks };
    if (marks.length) flagged.push(row); else clean.push(row);
  }

  console.log('clips updated by the repair: ' + rev.updates.length);
  console.log('  touched something PAID/DONE .... ' + flagged.length);
  console.log('  clean .......................... ' + clean.length);

  if (flagged.length) {
    console.log('\n=== TOUCHED PAID / DONE — candidates to revert ===');
    flagged.forEach(f => {
      console.log('  [' + f.room + '] ' + f.title);
      console.log('     clip ' + f.clipId + '   was: ' + (f.prev === null ? '(none)' : f.prev) +
                  '   now: ' + f.now);
      console.log('     markers: ' + f.marks.join(' | '));
    });
  } else {
    console.log('\nNothing paid or closed was touched.');
  }

  if (rev.created && rev.created.length) {
    console.log('\n=== clips created ===');
    for (const c of rev.created) {
      const s = await board.collection('clips').doc(c.clipId).get();
      const d = s.exists ? s.data() : {};
      console.log('  ' + c.clipId + '  ' + String(d.title || '').slice(0, 46) +
                  '   status:' + (d.status || '—') + '   cost:' + d.cost);
    }
  }
  console.log('\ndone — nothing was written.');
})().catch(e => { console.error(e.message); process.exit(1); });
