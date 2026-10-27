#!/usr/bin/env node
'use strict';
/** How many clips/products hold cost as an unparseable string? READ-ONLY. */
const admin = require('firebase-admin');
const path = require('path');
const KEY = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(require(KEY)) });
const db = admin.firestore();

const FIELDS = ['cost', 'unitCost', 'clientPrice', 'retailPrice', 'unitSellingPrice', 'totalSelling'];

function classify(v) {
  if (v === null || v === undefined || v === '') return 'empty';
  if (typeof v === 'number') return 'number';
  const s = String(v);
  if (/^\s*-?\d+(\.\d+)?\s*$/.test(s)) return 'numeric-string';
  if (/[$,]/.test(s)) return 'DOLLAR-STRING';
  return 'other-string';
}

(async () => {
  const scopes = [];
  const boards = await db.collection('boards').get();
  for (const b of boards.docs) {
    scopes.push({ label: 'clips/' + b.id, ref: b.ref.collection('clips') });
  }
  scopes.push({ label: 'products', ref: db.collection('products') });
  scopes.push({ label: 'productLibrary', ref: db.collection('productLibrary') });

  const grand = {};
  let brokenDocs = 0, totalDocs = 0;
  const perBoard = {};

  for (const s of scopes) {
    let snap; try { snap = await s.ref.get(); } catch (e) { continue; }
    let boardBroken = 0;
    snap.forEach(d => {
      totalDocs++;
      const data = d.data() || {};
      let docBroken = false;
      FIELDS.forEach(f => {
        if (!(f in data)) return;
        const c = classify(data[f]);
        grand[f] = grand[f] || {};
        grand[f][c] = (grand[f][c] || 0) + 1;
        if (c === 'DOLLAR-STRING') docBroken = true;
      });
      if (docBroken) { brokenDocs++; boardBroken++; }
    });
    if (boardBroken) perBoard[s.label] = boardBroken;
  }

  console.log('documents scanned: ' + totalDocs);
  console.log('documents with at least one $-string money field: ' + brokenDocs + '\n');

  console.log('=== per field ===');
  FIELDS.forEach(f => {
    const g = grand[f]; if (!g) return;
    const parts = Object.keys(g).sort().map(k => k + ':' + g[k]).join('   ');
    console.log('  ' + f.padEnd(18) + parts);
  });

  console.log('\n=== where the broken docs live ===');
  Object.keys(perBoard).sort((a, b) => perBoard[b] - perBoard[a]).slice(0, 15)
    .forEach(k => console.log('  ' + String(perBoard[k]).padStart(5) + '  ' + k));

  console.log('\ndone — nothing was written.');
})().catch(e => { console.error(e.message); process.exit(1); });
