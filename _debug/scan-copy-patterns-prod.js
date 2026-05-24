#!/usr/bin/env node
/** Broader scan: copy/copied patterns + broken libraryProductId refs on Rolling Hills invoices */
'use strict';
const path = require('path');
const admin = require('firebase-admin');
const key = path.join(__dirname, 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
admin.initializeApp({ credential: admin.credential.cert(require(key)) });
const db = admin.firestore();

const PREFIXES = [/^copied/i, /^copy/i, /^copy_/i, /^copy-/i, /^copyof/i, /^duplicate/i];

(async () => {
  const prodIds = new Set();
  const plIds = new Set();
  (await db.collection('products').get()).forEach((d) => prodIds.add(d.id));
  (await db.collection('productLibrary').get()).forEach((d) => plIds.add(d.id));

  for (const coll of ['products', 'productLibrary']) {
    const snap = await db.collection(coll).get();
    const hits = [];
    snap.forEach((d) => {
      const p = d.data() || {};
      const checks = [
        ['id', d.id],
        ['title', p.title],
        ['sku', p.sku],
        ['lineCode', p.lineCode],
        ['libraryProductId', p.libraryProductId],
        ['studioProductId', p.studioProductId],
        ['imageUrl', (p.imageUrl || '').slice(-80)],
      ];
      for (const [field, val] of checks) {
        const s = String(val || '');
        if (PREFIXES.some((re) => re.test(s)) || /\/copied/i.test(s) || /copied[_-]/i.test(s)) {
          hits.push({ coll, id: d.id, field, sample: s.slice(0, 120), title: p.title });
        }
      }
    });
    console.log('\n===', coll, 'pattern hits:', hits.length, '===');
    hits.slice(0, 25).forEach((h) => console.log(JSON.stringify(h)));
  }

  // Invoice lines with libraryProductId containing copy/copied
  const board = 'cloud-rolling-hills';
  let lineCopy = 0;
  let lineMissingLib = 0;
  const missingSamples = [];
  const copySamples = [];
  for (const sub of ['invoices', 'proposals']) {
    const snap = await db.collection('boards').doc(board).collection(sub).get();
    snap.forEach((d) => {
      const items = (d.data() || {}).items || [];
      items.forEach((it, idx) => {
        const lid = String(it.libraryProductId || it.linkedLibraryProductId || '').trim();
        if (!lid) return;
        if (/copied|^copy/i.test(lid)) {
          lineCopy++;
          if (copySamples.length < 15) copySamples.push({ sub, doc: d.id, idx, lid, title: it.title });
        }
        if (!prodIds.has(lid) && !plIds.has(lid)) {
          lineMissingLib++;
          if (missingSamples.length < 15) missingSamples.push({ sub, doc: d.id, idx, lid, title: it.title });
        }
      });
    });
  }
  console.log('\n=== cloud-rolling-hills line libraryProductId ===');
  console.log('  contains copy/copied:', lineCopy);
  copySamples.forEach((x) => console.log('   ', JSON.stringify(x)));
  console.log('  libraryProductId not in products or productLibrary:', lineMissingLib);
  missingSamples.forEach((x) => console.log('   ', JSON.stringify(x)));

  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
