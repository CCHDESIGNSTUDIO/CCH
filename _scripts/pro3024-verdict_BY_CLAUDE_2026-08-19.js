#!/usr/bin/env node
'use strict';
/**
 * PRO-3024 VERDICT — short answer only. READ-ONLY, never writes.
 * Run: node _scripts/pro3024-verdict_BY_CLAUDE_2026-08-19.js
 */
const admin = require('firebase-admin');
const path = require('path');
const KEY = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(require(KEY)) });
const db = admin.firestore();

const TARGET = '3024';
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
const fin = it => String(it.finish || it.color || it.colorFinish || '').trim();

(async () => {
  const boards = await db.collection('boards').get();
  for (const b of boards.docs) {
    let snap; try { snap = await b.ref.collection('proposals').get(); } catch (e) { continue; }
    for (const p of snap.docs) {
      const d = p.data() || {};
      const label = String(d.number || d.proposalNum || d.name || '');
      if (label.indexOf(TARGET) === -1) continue;
      const items = Array.isArray(d.items) ? d.items : [];

      const withCost = items.filter(i => (n(i.cost) || 0) > 0).length;
      const withSku  = items.filter(i => String(i.sku || '').trim()).length;
      const withUrl  = items.filter(i => urlOf(i)).length;
      const qsUrls   = items.filter(i => urlOf(i).includes('?')).length;

      const byKey = {};
      items.forEach((it, i) => { const k = key(it); (byKey[k] = byKey[k] || []).push(i); });
      const collisions = Object.keys(byKey).filter(k => k && byKey[k].length > 1);
      const finishCollisions = collisions.filter(k => new Set(byKey[k].map(i => fin(items[i]))).size > 1);
      const skusDifferInCollision = finishCollisions.filter(k =>
        new Set(byKey[k].map(i => String(items[i].sku || '').trim()).filter(Boolean)).size > 1);

      console.log('');
      console.log('PROPOSAL ' + label + '   project: ' + b.id);
      console.log('  lines .................. ' + items.length);
      console.log('  lines WITH a cost ...... ' + withCost + '   (without: ' + (items.length - withCost) + ')');
      console.log('  lines WITH a SKU ....... ' + withSku);
      console.log('  lines WITH a URL ....... ' + withUrl + '   (of those, ' + qsUrls + ' have a ?query)');
      console.log('  rows collapsed by key .. ' + collisions.length + ' key(s)');
      console.log('  ...of those, DIFFERENT FINISHES sharing one key: ' + finishCollisions.length);
      console.log('');
      console.log('  VERDICT');
      console.log('   costs: ' + (withCost === 0
        ? 'NO line has a cost — costs were never written, or were wiped.'
        : withCost < items.length
          ? withCost + ' of ' + items.length + ' have costs. Partial loss — some saved, some did not.'
          : 'every line has a cost. Nothing lost here.'));
      console.log('   finish collapse: ' + (finishCollisions.length === 0
        ? 'none. Different finishes are NOT colliding on this proposal.'
        : finishCollisions.length + ' collision(s) — different finishes ARE sharing one key.'));
      if (skusDifferInCollision.length) {
        console.log('   SKU would fix ' + skusDifferInCollision.length + ' of them (the SKUs differ but are ignored).');
      }
      console.log('   query strings: ' + (qsUrls === 0
        ? 'no line URL has a ?query, so query-stripping is NOT the cause here.'
        : qsUrls + ' line URL(s) carry a ?query that the normalizer discards.'));
      console.log('');
    }
  }
  console.log('done — nothing was written.');
})().catch(e => { console.error(e.message); process.exit(1); });
