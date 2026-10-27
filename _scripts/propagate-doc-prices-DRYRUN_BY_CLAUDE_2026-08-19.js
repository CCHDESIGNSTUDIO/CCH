#!/usr/bin/env node
'use strict';
/**
 * DRY RUN — proposal/invoice line prices that never reached their room-board clips.
 * Reports only. WRITES NOTHING. Apply script is separate and needs Cindy's GO.
 *
 * Usage: node _scripts/propagate-doc-prices-DRYRUN_BY_CLAUDE_2026-08-19.js [projectId]
 */
const admin = require('firebase-admin');
const path = require('path');
const KEY = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(require(KEY)) });
const db = admin.firestore();

const PROJECT = process.argv[2] || 'cloud-rolling-hills';

/** matches parseMoney at platform/index.html:4544 — handles "$1,985.00" */
function money(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return isFinite(v) ? v : null;
  const n = parseFloat(String(v).replace(/[$,\s]/g, ''));
  return isNaN(n) ? null : n;
}
const norm = s => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
const cents = v => (v == null ? null : Math.round(v * 100));

(async () => {
  const board = db.collection('boards').doc(PROJECT);

  const clips = [];
  (await board.collection('clips').get()).forEach(d => clips.push({ id: d.id, d: d.data() || {} }));

  const byId = new Map(clips.map(c => [c.id, c]));
  const byLib = new Map(), bySkuVendor = new Map(), byTitleVendor = new Map();
  clips.forEach(c => {
    const lib = String(c.d.libraryProductId || c.d.linkedLibraryProductId || '').trim();
    if (lib) { if (!byLib.has(lib)) byLib.set(lib, []); byLib.get(lib).push(c); }
    const sku = norm(c.d.sku), ven = norm(c.d.vendor), ttl = norm(c.d.title || c.d.name);
    if (sku && ven) { const k = sku + '|' + ven; if (!bySkuVendor.has(k)) bySkuVendor.set(k, []); bySkuVendor.get(k).push(c); }
    if (ttl && ven) { const k = ttl + '|' + ven; if (!byTitleVendor.has(k)) byTitleVendor.set(k, []); byTitleVendor.get(k).push(c); }
  });

  function match(it) {
    const direct = String(it.clipId || it.sourceClipId || it._matchedClipId || '').trim();
    if (direct && byId.has(direct)) return { how: 'clipId', hits: [byId.get(direct)] };
    const lib = String(it.libraryProductId || it.linkedLibraryProductId || '').trim();
    if (lib && byLib.has(lib)) return { how: 'libraryProductId', hits: byLib.get(lib) };
    const sku = norm(it.sku), ven = norm(it.vendor), ttl = norm(it.title || it.name);
    if (sku && ven && bySkuVendor.has(sku + '|' + ven)) return { how: 'sku+vendor', hits: bySkuVendor.get(sku + '|' + ven) };
    if (ttl && ven && byTitleVendor.has(ttl + '|' + ven)) return { how: 'title+vendor', hits: byTitleVendor.get(ttl + '|' + ven) };
    return { how: null, hits: [] };
  }

  const changes = [], unmatched = [];
  let linesWithPrice = 0;

  for (const col of ['proposals', 'invoices']) {
    const docs = await board.collection(col).get();
    for (const doc of docs.docs) {
      const d = doc.data() || {};
      const label = d.number || d.proposalNum || d.invoiceNum || d.name || doc.id;
      (Array.isArray(d.items) ? d.items : []).forEach((it, i) => {
        const lineCost = money(it.cost);
        if (lineCost == null || lineCost <= 0) return;   // nothing authoritative to push
        linesWithPrice++;
        const m = match(it);
        if (!m.how) {
          unmatched.push({ doc: label, i, title: String(it.title || '').slice(0, 46), cost: lineCost });
          return;
        }
        m.hits.forEach(c => {
          const clipCost = money(c.d.cost);
          if (cents(clipCost) === cents(lineCost)) return;   // already agrees
          changes.push({
            doc: label, line: i, how: m.how, clipId: c.id,
            title: String(it.title || '').slice(0, 46),
            room: c.d.room || '—',
            from: clipCost == null ? '(none)' : clipCost.toFixed(2),
            fromRaw: c.d.cost === undefined ? '' : String(c.d.cost),
            to: lineCost.toFixed(2)
          });
        });
      });
    }
  }

  console.log('project: ' + PROJECT);
  console.log('clips on board .......................... ' + clips.length);
  console.log('doc lines carrying an authoritative cost  ' + linesWithPrice);
  console.log('clip updates that WOULD be made ......... ' + changes.length);
  console.log('doc lines with no matching clip ......... ' + unmatched.length);

  const byHow = {};
  changes.forEach(c => byHow[c.how] = (byHow[c.how] || 0) + 1);
  console.log('\n=== how they matched ===');
  Object.keys(byHow).forEach(k => console.log('  ' + String(byHow[k]).padStart(4) + '  ' + k));

  // --- risk split: safe fills vs real overwrites vs clip collisions ---
  const fills = changes.filter(c => c.from === '(none)' || c.from === '0.00');
  const overwrites = changes.filter(c => c.from !== '(none)' && c.from !== '0.00');
  const perClip = {};
  changes.forEach(c => { (perClip[c.clipId] = perClip[c.clipId] || []).push(c); });
  const collisions = Object.keys(perClip).filter(k => perClip[k].length > 1);

  console.log('\n=== RISK SPLIT ===');
  console.log('  SAFE fills (clip had null or 0) ........ ' + fills.length);
  console.log('  OVERWRITES (clip had a real value) ..... ' + overwrites.length +
              (overwrites.length ? '   <-- review these' : ''));
  console.log('  CLIPS targeted by >1 doc line .......... ' + collisions.length +
              (collisions.length ? '   <-- last write would win' : ''));

  if (overwrites.length) {
    console.log('\n  --- overwrites in detail ---');
    overwrites.forEach(c => console.log('   [' + c.doc + ' line ' + c.line + '] ' + c.title +
      '\n      clip ' + c.clipId + ' room:' + c.room + '   ' + c.from + '  ->  ' + c.to));
  }
  if (collisions.length) {
    console.log('\n  --- clips targeted by more than one line ---');
    collisions.forEach(k => {
      console.log('   clip ' + k + ' (room ' + perClip[k][0].room + ')');
      perClip[k].forEach(c => console.log('      [' + c.doc + ' line ' + c.line + '] ' +
        c.title + '  ->  ' + c.to));
    });
  }

  console.log('\n=== proposed changes (first 40) ===');
  changes.slice(0, 40).forEach(c => {
    console.log('  [' + c.doc + ' line ' + c.line + '] ' + c.title);
    console.log('      clip ' + c.clipId + '  room:' + c.room + '  via ' + c.how);
    console.log('      cost ' + c.from + (c.fromRaw && c.fromRaw !== c.from ? ' (raw "' + c.fromRaw + '")' : '') +
                '   ->   ' + c.to);
  });
  if (changes.length > 40) console.log('  … and ' + (changes.length - 40) + ' more');

  if (unmatched.length) {
    console.log('\n=== doc lines with NO clip to update (first 15) ===');
    unmatched.slice(0, 15).forEach(u =>
      console.log('  [' + u.doc + ' line ' + u.i + '] ' + u.title + '   cost ' + u.cost.toFixed(2)));
  }

  console.log('\nDRY RUN — nothing was written.');
})().catch(e => { console.error(e.message); process.exit(1); });
