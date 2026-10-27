#!/usr/bin/env node
'use strict';
/**
 * Rolling Hills price repair — push doc-line costs onto room-board clips.
 * Where two doc lines share one clip, duplicate the clip so each product has its own.
 * Mirrors duplicateLibraryProduct() at platform/index.html:66066.
 *
 * DRY RUN BY DEFAULT.  --apply to write.  Reversal file written before any write.
 */
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');
const KEY = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(require(KEY)) });
const db = admin.firestore();

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const PROJECT = 'cloud-rolling-hills';
const STAMP = '2026-08-19';

function money(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return isFinite(v) ? v : null;
  const n = parseFloat(String(v).replace(/[$,\s]/g, ''));
  return isNaN(n) ? null : n;
}
const cents = v => (v == null ? null : Math.round(v * 100));

const STRIP = {
  id: 1, houzzId: 1, houzzProductId: 1, productCode: 1, libraryUsageRefs: 1,
  usageRefs: 1, projectRefs: 1, usedInProjects: 1, linkedClips: 1, clipIds: 1,
  qbItemId: 1, qbDocId: 1, createdAt: 1, updatedAt: 1, duplicatedFrom: 1,
  _tradeCostPushedFromLibraryAt: 1, _docLinkedAt: 1
};
const KEEP_U = { _taxonomyV: 1, _categoryFixedAt: 1, _taxableFixedAt: 1 };

function cloneClip(src) {
  const out = {};
  Object.keys(src).forEach(k => {
    if (STRIP[k]) return;
    if (k.charAt(0) === '_' && !KEEP_U[k]) return;
    const v = src[k];
    if (v === undefined) return;
    if (v && typeof v === 'object' && typeof v.isEqual === 'function') return;
    if (Array.isArray(v)) out[k] = v.slice();
    else if (v && typeof v === 'object' && Object.prototype.toString.call(v) === '[object Object]') {
      try { out[k] = JSON.parse(JSON.stringify(v)); } catch (e) {}
    } else out[k] = v;
  });
  return out;
}

(async () => {
  const board = db.collection('boards').doc(PROJECT);
  const clipSnap = await board.collection('clips').get();
  const clipById = new Map();
  clipSnap.forEach(d => clipById.set(d.id, d.data() || {}));

  const targets = [];
  for (const col of ['proposals', 'invoices']) {
    const docs = await board.collection(col).get();
    for (const doc of docs.docs) {
      const d = doc.data() || {};
      const label = d.number || d.proposalNum || d.invoiceNum || d.name || doc.id;
      (Array.isArray(d.items) ? d.items : []).forEach((it, i) => {
        const cost = money(it.cost);
        if (cost == null || cost <= 0) return;
        const cid = String(it.clipId || it.sourceClipId || it._matchedClipId || '').trim();
        if (!cid || !clipById.has(cid)) return;
        targets.push({ col, docId: doc.id, label, lineIdx: i, item: it, clipId: cid, cost });
      });
    }
  }

  const perClip = {};
  targets.forEach(t => { (perClip[t.clipId] = perClip[t.clipId] || []).push(t); });

  // A clip only needs duplicating when two GENUINELY DIFFERENT products share it.
  // The same product appearing on both a proposal and an invoice is one product.
  const ident = t => (String(t.item.sku || '').trim().toLowerCase() || '~') + '::' +
                     String(t.item.title || t.item.name || '').trim().toLowerCase().replace(/\s+/g, ' ');

  const updates = [], dupes = [], conflicts = [];
  Object.keys(perClip).forEach(cid => {
    const list = perClip[cid].slice().sort((a, b) =>
      String(a.label).localeCompare(String(b.label)) || a.lineIdx - b.lineIdx);
    const clip = clipById.get(cid);
    const clipCost = money(clip.cost);

    // group this clip's lines by product identity
    const groups = {};
    list.forEach(t => { (groups[ident(t)] = groups[ident(t)] || []).push(t); });
    const keys = Object.keys(groups);

    keys.forEach((k, gi) => {
      const g = groups[k];
      // same product on several docs: do the costs agree?
      const distinct = [...new Set(g.map(t => cents(t.cost)))];
      if (distinct.length > 1) {
        conflicts.push({ clipId: cid, room: clip.room || '—',
          title: String(g[0].item.title || '').slice(0, 46),
          options: g.map(t => ({ doc: t.label, line: t.lineIdx, cost: t.cost })) });
        return;   // needs Cindy — never auto-pick a price
      }
      const t = g[0];
      if (gi === 0) {
        if (cents(clipCost) !== cents(t.cost)) {
          updates.push({ clipId: cid, from: clipCost, to: t.cost,
                         doc: t.label, line: t.lineIdx,
                         title: String(t.item.title || '').slice(0, 46) });
        }
      } else {
        dupes.push({ fromClipId: cid, doc: t.label, line: t.lineIdx, col: t.col, docId: t.docId,
                     title: String(t.item.title || '').slice(0, 46), cost: t.cost,
                     sku: t.item.sku || '', finish: t.item.finish || t.item.color || '',
                     room: clip.room || '' });
      }
    });
  });

  if (conflicts.length) {
    console.log('\n=== NEEDS YOUR DECISION — same product, two different prices ===');
    conflicts.forEach(c => {
      console.log('  [' + c.room + '] ' + c.title + '   (clip ' + c.clipId + ')');
      c.options.forEach(o => console.log('      ' + o.doc + ' line ' + o.line + '  ->  ' + o.cost.toFixed(2)));
    });
    console.log('  (these are SKIPPED — no price is guessed)');
  }

  console.log('Rolling Hills price repair' + (APPLY ? '   *** APPLY ***' : '   (dry run)'));
  console.log('  clip cost updates ....... ' + updates.length);
  console.log('  new clips to create ..... ' + dupes.length);
  dupes.forEach(d => console.log('    dup from ' + d.fromClipId + ' [' + d.room + '] -> ' +
    d.title + '  ' + d.cost.toFixed(2)));

  if (!APPLY) { console.log('\nDRY RUN — nothing written. Add --apply to execute.'); return; }

  const reversal = { project: PROJECT, stamp: STAMP, updates: [], created: [], relinked: [] };
  updates.forEach(u => reversal.updates.push({
    clipId: u.clipId, previousCost: clipById.get(u.clipId).cost ?? null }));
  const revPath = path.join(__dirname, '..', '_debug', 'REVERSAL-rh-prices-' + STAMP + '.json');
  fs.writeFileSync(revPath, JSON.stringify(reversal, null, 2), 'utf8');

  let nUpd = 0, nNew = 0, nRelink = 0;
  for (const u of updates) {
    await board.collection('clips').doc(u.clipId).update({
      cost: u.to, _priceFromDocAt: STAMP, _priceFromDoc: u.doc + ':' + u.line });
    nUpd++;
  }

  const byDoc = {};
  dupes.forEach(d => { (byDoc[d.col + '/' + d.docId] = byDoc[d.col + '/' + d.docId] || []).push(d); });
  for (const k of Object.keys(byDoc)) {
    const [col, docId] = k.split('/');
    const ref = board.collection(col).doc(docId);
    const snap = await ref.get();
    if (!snap.exists) continue;
    const items = Array.isArray((snap.data() || {}).items) ? (snap.data().items).slice() : [];
    for (const d of byDoc[k]) {
      const nd = cloneClip(clipById.get(d.fromClipId));
      if (d.title) nd.title = d.title;
      if (d.sku) nd.sku = d.sku;
      if (d.finish) nd.finish = d.finish;
      nd.cost = d.cost;
      nd.duplicatedFrom = d.fromClipId;
      nd.createdAt = new Date().toISOString();
      nd.updatedAt = nd.createdAt;
      nd._priceFromDocAt = STAMP;
      nd._priceFromDoc = d.doc + ':' + d.line;
      const newRef = await board.collection('clips').add(nd);
      reversal.created.push({ clipId: newRef.id, duplicatedFrom: d.fromClipId });
      nNew++;
      if (items[d.line]) {
        reversal.relinked.push({ col, docId, line: d.line, previousClipId: items[d.line].clipId ?? null });
        items[d.line] = Object.assign({}, items[d.line], { clipId: newRef.id });
        nRelink++;
      }
    }
    await ref.update({ items: items });
  }

  fs.writeFileSync(revPath, JSON.stringify(reversal, null, 2), 'utf8');
  console.log('\nAPPLIED   updated:' + nUpd + '  created:' + nNew + '  relinked:' + nRelink);
  console.log('reversal: ' + revPath);
})().catch(e => { console.error(e.message); process.exit(1); });
