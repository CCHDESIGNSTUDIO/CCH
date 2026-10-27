#!/usr/bin/env node
'use strict';
/** PRO-3024 — the exact lines missing a cost, and what collapses. READ-ONLY. */
const admin = require('firebase-admin');
const path = require('path');
const KEY = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(require(KEY)) });
const db = admin.firestore();

const URLF = ['productUrl', 'pageUrl', 'sourceUrl', 'clippedFromUrl', 'vendorUrl', 'url'];
const n = v => { const x = parseFloat(v); return isNaN(x) ? null : x; };
const urlOf = it => { for (const f of URLF) { const v = String(it[f] || '').trim(); if (v) return v; } return ''; };
const normUrl = u => { try { const x = new URL(u); x.hash=''; x.search=''; return x.hostname.replace(/^www\./,'') + x.pathname.replace(/\/+$/,''); } catch(e){ return String(u||'').toLowerCase().split('?')[0]; } };
const key = it => {
  const lid = String(it.libraryProductId || it.linkedLibraryProductId || '').trim();
  if (lid) return 'lib:' + lid;
  const u = normUrl(urlOf(it)).toLowerCase();
  if (u && u.length > 10) return 'url:' + u;
  const t = String(it.title || it.name || '').trim().toLowerCase();
  const v = String(it.vendor || '').trim().toLowerCase();
  return t && v ? t + '|' + v : '';
};

(async () => {
  const p = await db.collection('boards').doc('cloud-rolling-hills')
    .collection('proposals').get();
  for (const doc of p.docs) {
    const d = doc.data() || {};
    if (String(d.number || d.proposalNum || d.name || '').indexOf('3024') === -1) continue;
    const items = Array.isArray(d.items) ? d.items : [];

    console.log('\n=== LINES WITH NO COST (these are the ones to re-enter) ===');
    items.forEach((it, i) => {
      if ((n(it.cost) || 0) > 0) return;
      console.log(' line ' + i + ': ' + String(it.title || it.name || '(untitled)').slice(0, 68));
      console.log('    vendor: ' + (it.vendor || '—') + '   sku: ' + (it.sku || '—') +
                  '   finish: ' + (it.finish || it.color || '—'));
      console.log('    amount(sell): ' + (n(it.amount) != null ? n(it.amount).toFixed(2) : '—') +
                  '   qty: ' + (it.qty ?? '—') +
                  '   cost field present: ' + Object.prototype.hasOwnProperty.call(it, 'cost'));
    });

    const byKey = {};
    items.forEach((it, i) => { const k = key(it); (byKey[k] = byKey[k] || []).push(i); });
    console.log('\n=== ROWS THAT COLLAPSE TOGETHER (may hide lines in Selections) ===');
    Object.keys(byKey).filter(k => k && byKey[k].length > 1).forEach(k => {
      console.log(' key: ' + k.slice(0, 74));
      byKey[k].forEach(i => {
        const it = items[i];
        console.log('    line ' + i + ': ' + String(it.title || '').slice(0, 54) +
                    '  | sku: ' + (it.sku || '—') +
                    '  | finish: ' + (it.finish || it.color || '—') +
                    '  | cost: ' + (n(it.cost) != null ? n(it.cost).toFixed(2) : '—'));
      });
    });
    console.log('\ndone — nothing was written.');
  }
})().catch(e => { console.error(e.message); process.exit(1); });
