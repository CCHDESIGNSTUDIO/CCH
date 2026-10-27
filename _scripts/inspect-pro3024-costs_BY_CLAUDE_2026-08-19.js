#!/usr/bin/env node
'use strict';
/**
 * READ-ONLY diagnostic for PRO-3024 — Aug 19, 2026, by Claude.
 *
 * Answers two questions:
 *   1. Were costs ever written to the proposal lines, or are they genuinely absent?
 *   2. Do any lines collapse onto the same dedupe key (the different-finish problem)?
 *
 * THIS SCRIPT NEVER WRITES. No .set(), .update(), .delete(), .add() anywhere.
 * Run:  node _scripts/inspect-pro3024-costs_BY_CLAUDE_2026-08-19.js
 */
const admin = require('firebase-admin');
const path = require('path');
const KEY = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(require(KEY)) });
const db = admin.firestore();

const TARGET = '3024';

function num(v) { const n = parseFloat(v); return isNaN(n) ? null : n; }
function money(v) { const n = num(v); return n == null ? '—' : n.toFixed(2); }

/** Mirrors cchNormalizeProductUrlForDedup closely enough to reproduce collisions. */
function normUrl(u) {
  u = String(u || '').trim().toLowerCase();
  if (!u) return '';
  u = u.replace(/^https?:\/\//, '').replace(/^www\./, '');
  u = u.split('#')[0].split('?')[0];
  return u.replace(/\/+$/, '');
}

/** Mirrors selDupKeyForItem() at platform/index.html:18118 */
function dupKey(it) {
  it = it || {};
  const lid = String(it.libraryProductId || it.linkedLibraryProductId || '').trim();
  if (lid) return 'lib:' + lid;
  const urlKey = normUrl(it.productUrl || it.url || it.websiteUrl || it.sourceUrl || '');
  if (urlKey && urlKey.length > 10) return 'url:' + urlKey;
  const t = String(it.title || it.name || '').trim().toLowerCase();
  const v = String(it.vendor || '').trim().toLowerCase();
  return t && v ? (t + '|' + v) : '';
}

function finishOf(it) {
  return String(it.finish || it.color || it.colorFinish || '').trim() || '(none)';
}

(async () => {
  const boards = await db.collection('boards').get();
  console.log('scanning', boards.size, 'boards for a proposal matching', TARGET, '\n');

  let hits = 0;

  for (const b of boards.docs) {
    let snap;
    try {
      snap = await b.ref.collection('proposals').get();
    } catch (e) { continue; }

    for (const p of snap.docs) {
      const d = p.data() || {};
      const label = String(d.number || d.proposalNum || d.name || '');
      if (label.indexOf(TARGET) === -1) continue;

      hits++;
      console.log('='.repeat(72));
      console.log('PROPOSAL', label, '  project:', b.id, '  docId:', p.id);
      console.log('updatedAt:', String(d.updatedAt || '—'), '  lastEditedBy:', String(d.lastEditedBy || '—'));
      console.log('total:', money(d.total), '  taxRate:', d.taxRate);

      const items = Array.isArray(d.items) ? d.items : [];
      console.log('lines:', items.length, '\n');

      const byKey = {};
      let withCost = 0, zeroCost = 0, noCostField = 0;

      items.forEach((it, i) => {
        const c = it.cost;
        const hasField = Object.prototype.hasOwnProperty.call(it, 'cost');
        const cn = num(c);
        if (!hasField) noCostField++;
        else if (cn && cn > 0) withCost++;
        else zeroCost++;

        const k = dupKey(it);
        (byKey[k] = byKey[k] || []).push(i);

        console.log(`--- line ${i} ---`);
        console.log('  title   :', String(it.title || it.name || '').slice(0, 90));
        console.log('  vendor  :', it.vendor || '—', '  sku:', it.sku || '—');
        console.log('  finish  :', finishOf(it));
        console.log('  cost    :', hasField ? money(c) : '(field absent)',
                    '  qty:', it.qty ?? '—',
                    '  markup%:', it.markupPct ?? '—',
                    '  amount:', money(it.amount));
        console.log('  libId   :', it.libraryProductId || it.linkedLibraryProductId || '—');
        console.log('  clipId  :', it.clipId || it.sourceClipId || it._matchedClipId || '—');
        // all six URL field names the platform checks (_cchProductPageUrlFromItem, index.html:27606)
        const urlFields = ['productUrl', 'pageUrl', 'sourceUrl', 'clippedFromUrl', 'vendorUrl', 'url'];
        const present = urlFields.filter(f => String(it[f] || '').trim());
        if (!present.length) {
          console.log('  URL     : (none of the 6 url fields are set)');
        } else {
          present.forEach(f => console.log('  URL.' + f + ':', String(it[f]).slice(0, 120)));
        }
        console.log('  dupKey  :', k || '(EMPTY — never dedupes)');
      });

      console.log('\n' + '-'.repeat(72));
      console.log('COST SUMMARY  with-cost:', withCost, '  zero/blank:', zeroCost, '  field absent:', noCostField);

      const collisions = Object.keys(byKey).filter(k => k && byKey[k].length > 1);
      if (!collisions.length) {
        console.log('DEDUPE: no two lines share a key. The finish-collapse theory does NOT apply here.');
      } else {
        console.log('DEDUPE COLLISIONS —', collisions.length, 'key(s) shared by multiple lines:');
        collisions.forEach(k => {
          const idxs = byKey[k];
          const finishes = idxs.map(i => finishOf(items[i]));
          const uniq = [...new Set(finishes)];
          console.log('  key:', k.slice(0, 90));
          console.log('    lines:', idxs.join(', '), '  finishes:', finishes.join(' | '));
          if (uniq.length > 1) console.log('    *** DIFFERENT FINISHES SHARING ONE KEY — this is the bug ***');
        });
      }
      console.log('');
    }
  }

  if (!hits) console.log('No proposal found whose number/name contains', TARGET);
  console.log('done — nothing was written.');
})().catch(e => { console.error(e); process.exit(1); });
