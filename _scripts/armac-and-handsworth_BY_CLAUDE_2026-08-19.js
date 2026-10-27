#!/usr/bin/env node
'use strict';
/** Armac vendor duplicates + where Handsworth lives. READ-ONLY. */
const admin = require('firebase-admin');
const path = require('path');
const KEY = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(require(KEY)) });
const db = admin.firestore();

(async () => {
  console.log('=== VENDORS collection — anything matching "armac" ===');
  try {
    const vs = await db.collection('vendors').get();
    let hit = 0;
    vs.forEach(d => {
      const v = d.data() || {};
      const nm = String(v.name || v.vendorName || '');
      if (nm.toLowerCase().includes('armac')) {
        hit++;
        console.log('  id:' + d.id + '  name:"' + nm + '"  active:' + v.active +
                    '  archived:' + (v.archived || v._archived || false));
      }
    });
    console.log('  total vendors in collection: ' + vs.size + ', armac matches: ' + hit);
  } catch (e) { console.log('  vendors collection error: ' + e.message); }

  console.log('\n=== DISTINCT vendor strings used on products (armac only) ===');
  const counts = {};
  for (const col of ['products', 'productLibrary']) {
    try {
      const snap = await db.collection(col).get();
      snap.forEach(d => {
        const v = String((d.data() || {}).vendor || '').trim();
        if (v.toLowerCase().includes('armac')) {
          const k = col + ' :: "' + v + '"';
          counts[k] = (counts[k] || 0) + 1;
        }
      });
    } catch (e) { console.log('  ' + col + ' error: ' + e.message); }
  }
  Object.keys(counts).sort().forEach(k => console.log('  ' + counts[k] + '  ' + k));
  if (!Object.keys(counts).length) console.log('  (none)');

  console.log('\n=== HANDSWORTH — where does it exist? ===');
  const found = [];
  for (const col of ['products', 'productLibrary', 'products_archive', 'productLibrary_archive']) {
    try {
      const snap = await db.collection(col).get();
      snap.forEach(d => {
        const p = d.data() || {};
        const t = String(p.title || p.name || '');
        if (t.toLowerCase().includes('handsworth')) {
          found.push({ col, id: d.id, title: t.slice(0, 60), vendor: p.vendor || '—',
                       sku: p.sku || '—', cost: p.cost ?? '—',
                       quarantined: p._quarantinedAt || '', src: p.source || p._source || '—' });
        }
      });
    } catch (e) { console.log('  ' + col + ' error: ' + e.message); }
  }
  if (!found.length) console.log('  NOT FOUND in products, productLibrary, or either archive.');
  found.forEach(f => console.log('  [' + f.col + '] ' + f.title + '\n     vendor:' + f.vendor +
    '  sku:' + f.sku + '  cost:' + f.cost + '  source:' + f.src +
    (f.quarantined ? '  QUARANTINED:' + f.quarantined : '')));

  console.log('\n=== HANDSWORTH in Rolling Hills clips? ===');
  try {
    const cs = await db.collection('boards').doc('cloud-rolling-hills').collection('clips').get();
    let c = 0;
    cs.forEach(d => {
      const p = d.data() || {};
      if (String(p.title || '').toLowerCase().includes('handsworth')) {
        c++;
        console.log('  clip ' + d.id + '  vendor:' + (p.vendor || '—') +
                    '  cost:' + (p.cost ?? '—') + '  libId:' + (p.libraryProductId || '—'));
      }
    });
    if (!c) console.log('  no Handsworth clip on Rolling Hills.');
  } catch (e) { console.log('  clips error: ' + e.message); }

  console.log('\ndone — nothing was written.');
})().catch(e => { console.error(e.message); process.exit(1); });
