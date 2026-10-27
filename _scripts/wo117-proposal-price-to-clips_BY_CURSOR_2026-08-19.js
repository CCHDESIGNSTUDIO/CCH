#!/usr/bin/env node
'use strict';
/**
 * WO-117 / BF-012 — one-off DATA REPAIR, cloud-rolling-hills only.
 * Push proposal/invoice line `cost` onto linked room-board clips.
 * Colliding clipIds: keep first line on the original clip; duplicate the rest
 * using duplicateLibraryProduct STRIP rules (index.html:66066), not CopyToRoom.
 *
 * Dry-run by default. Production writes only with --apply after Cindy typed GO.
 * Does not touch platform/index.html. Does not write markupPct or clientPrice.
 * Does not create clips for unmatched lines. Does not change lineApprovalStatus.
 *
 * Usage:
 *   node _scripts/wo117-proposal-price-to-clips_BY_CURSOR_2026-08-19.js
 *   node _scripts/wo117-proposal-price-to-clips_BY_CURSOR_2026-08-19.js --apply
 */
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const PID = 'cloud-rolling-hills';
const APPLY = process.argv.includes('--apply');
const KEY = path.join(
  __dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json'
);
const REVERSAL = path.join(
  __dirname, '..', '_debug', 'REVERSAL-prices-cloud-rolling-hills-2026-08-19.json'
);

if (!fs.existsSync(KEY)) {
  console.error('Missing prod service account key.');
  process.exit(1);
}

const db = admin.initializeApp(
  { credential: admin.credential.cert(require(KEY)) },
  'wo117Prices'
).firestore();

/** Mirrors duplicateLibraryProduct STRIP at platform/index.html:66067–66084 */
const STRIP = {
  id: 1,
  houzzId: 1,
  houzzProductId: 1,
  productCode: 1,
  libraryUsageRefs: 1,
  usageRefs: 1,
  projectRefs: 1,
  usedInProjects: 1,
  linkedClips: 1,
  clipIds: 1,
  qbItemId: 1,
  qbDocId: 1,
  createdAt: 1,
  updatedAt: 1,
  duplicatedFrom: 1,
  _tradeCostPushedFromLibraryAt: 1,
  _docLinkedAt: 1
};

/** parseMoney at platform/index.html:4544 */
function money(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return isFinite(v) ? v : null;
  const n = parseFloat(String(v).replace(/[$,\s]/g, ''));
  return isNaN(n) ? null : n;
}
function cents(v) {
  return v == null ? null : Math.round(v * 100);
}
function clipTitle(it) {
  return String((it && (it.title || it.name)) || '').trim();
}

function cloneClipLikeLibraryDuplicate(src) {
  const data = {};
  Object.keys(src || {}).forEach(function (k) {
    if (STRIP[k]) return;
    if (k.charAt(0) === '_' && k !== '_taxonomyV' && k !== '_categoryFixedAt' && k !== '_taxableFixedAt') return;
    const v = src[k];
    if (v === undefined) return;
    if (v && typeof v === 'object' && typeof v.isEqual === 'function') return;
    if (Array.isArray(v)) data[k] = v.slice();
    else if (v && typeof v === 'object' && Object.prototype.toString.call(v) === '[object Object]') {
      try { data[k] = JSON.parse(JSON.stringify(v)); } catch (_eJ) { /* skip nested */ }
    } else data[k] = v;
  });
  delete data.markupPct;
  delete data.clientPrice;
  delete data.clientSelectionStatus;
  delete data.lineApprovalStatus;
  delete data.approved;
  delete data.declined;
  return data;
}

(async () => {
  const board = db.collection('boards').doc(PID);
  if (board.path !== 'boards/' + PID) {
    console.error('Refusing to run outside boards/' + PID);
    process.exit(1);
  }

  const clips = [];
  (await board.collection('clips').get()).forEach(d => clips.push({ id: d.id, d: d.data() || {} }));
  const byId = new Map(clips.map(c => [c.id, c]));

  const pricedLinks = [];
  const unmatched = [];
  let linesWithPrice = 0;

  for (const col of ['proposals', 'invoices']) {
    const docs = await board.collection(col).get();
    for (const doc of docs.docs) {
      const d = doc.data() || {};
      const label = String(d.number || d.proposalNum || d.invoiceNum || d.name || doc.id);
      const items = Array.isArray(d.items) ? d.items : [];
      items.forEach((it, i) => {
        const lineCost = money(it.cost);
        if (lineCost == null || lineCost <= 0) return;
        linesWithPrice++;
        const clipId = String(it.clipId || it.sourceClipId || it._matchedClipId || '').trim();
        if (!clipId || !byId.has(clipId)) {
          unmatched.push({ col: col, docId: doc.id, doc: label, i: i, title: clipTitle(it).slice(0, 46), cost: lineCost });
          return;
        }
        pricedLinks.push({
          col: col,
          docId: doc.id,
          doc: label,
          line: i,
          item: it,
          clipId: clipId,
          lineCost: lineCost,
          title: clipTitle(it)
        });
      });
    }
  }

  const changes = pricedLinks.filter(row => {
    const clipCost = money(byId.get(row.clipId).d.cost);
    return cents(clipCost) !== cents(row.lineCost);
  });

  const perClipChanges = {};
  changes.forEach(c => {
    (perClipChanges[c.clipId] = perClipChanges[c.clipId] || []).push(c);
  });
  Object.keys(perClipChanges).forEach(k => {
    perClipChanges[k].sort((a, b) => {
      const dl = String(a.doc).localeCompare(String(b.doc));
      if (dl) return dl;
      if (a.line !== b.line) return a.line - b.line;
      return String(a.col).localeCompare(String(b.col));
    });
  });

  const inPlace = [];
  const collisions = [];
  Object.keys(perClipChanges).forEach(clipId => {
    const rows = perClipChanges[clipId];
    if (rows.length === 1) inPlace.push(rows[0]);
    else collisions.push({ clipId: clipId, rows: rows });
  });

  const plannedCreates = [];
  const plannedRelinks = [];
  collisions.forEach(coln => {
    coln.rows.forEach((row, idx) => {
      if (idx === 0) {
        inPlace.push(row);
        return;
      }
      plannedCreates.push(row);
      plannedRelinks.push(row);
    });
  });

  const fills = inPlace.filter(c => {
    const from = money(byId.get(c.clipId).d.cost);
    return from == null || from === 0;
  });
  const overwrites = inPlace.filter(c => {
    const from = money(byId.get(c.clipId).d.cost);
    return from != null && from !== 0;
  });

  function fmtFrom(clipId) {
    const raw = byId.get(clipId).d.cost;
    const n = money(raw);
    if (n == null) return '(none)';
    return n.toFixed(2);
  }

  console.log('WO-117 / BF-012  project=' + PID + '  mode=' + (APPLY ? 'APPLY' : 'DRY-RUN'));
  console.log('clips on board .......................... ' + clips.length);
  console.log('doc lines carrying an authoritative cost  ' + linesWithPrice);
  console.log('clipId-linked cost mismatches ........... ' + changes.length);
  console.log('doc lines with no matching clip ......... ' + unmatched.length + ' (leave alone)');
  console.log('in-place cost writes .................... ' + inPlace.length +
    '  (fills ' + fills.length + ' / overwrites ' + overwrites.length + ')');
  console.log('collision clips ......................... ' + collisions.length);
  console.log('new clips to create ..................... ' + plannedCreates.length);
  console.log('doc lines to relink ..................... ' + plannedRelinks.length);

  if (collisions.length) {
    console.log('\n=== collisions (first line keeps clip; rest duplicate) ===');
    collisions.forEach(coln => {
      const room = byId.get(coln.clipId).d.room || '—';
      console.log('  clip ' + coln.clipId + '  room:' + room);
      coln.rows.forEach((r, idx) => {
        console.log('    ' + (idx === 0 ? 'KEEP' : 'DUP ') +
          ' [' + r.doc + ' line ' + r.line + '] ' + r.title.slice(0, 46) +
          '  ->  ' + r.lineCost.toFixed(2));
      });
    });
  }

  console.log('\n=== in-place cost updates ===');
  inPlace.forEach(c => {
    console.log('  [' + c.doc + ' line ' + c.line + '] ' + c.title.slice(0, 46));
    console.log('      clip ' + c.clipId + '  ' + fmtFrom(c.clipId) + '  ->  ' + c.lineCost.toFixed(2));
  });

  if (!APPLY) {
    console.log('\nDRY RUN — nothing was written. Reversal not created.');
    console.log('Typed GO + --apply required before any Firestore write.');
    process.exit(0);
  }

  const now = new Date().toISOString();
  const clipRef = (id) => board.collection('clips').doc(id);

  const createJobs = plannedCreates.map(row => {
    const ref = board.collection('clips').doc();
    return { row: row, ref: ref, newId: ref.id };
  });

  const reversal = {
    writtenAt: now,
    project: PID,
    wo: 'WO-117',
    changeId: 'BF-012',
    clipCostRestores: inPlace.map(c => ({
      clipId: c.clipId,
      previousCost: byId.get(c.clipId).d.cost === undefined ? null : byId.get(c.clipId).d.cost
    })),
    createdClips: createJobs.map(j => ({
      clipId: j.newId,
      duplicatedFrom: j.row.clipId
    })),
    docLineRelinks: createJobs.map(j => ({
      collection: j.row.col,
      docId: j.row.docId,
      lineIndex: j.row.line,
      previousClipId: j.row.clipId,
      newClipId: j.newId
    }))
  };

  fs.mkdirSync(path.dirname(REVERSAL), { recursive: true });
  fs.writeFileSync(REVERSAL, JSON.stringify(reversal, null, 2));
  console.log('\nReversal written BEFORE first write: ' + REVERSAL);

  let clipWrites = 0;
  let docWrites = 0;

  for (const job of createJobs) {
    const src = byId.get(job.row.clipId).d;
    const data = cloneClipLikeLibraryDuplicate(src);
    const line = job.row.item;
    const t = clipTitle(line);
    if (t) data.title = t;
    const sku = String(line.sku || '').trim();
    if (sku) data.sku = sku;
    const finish = String(line.finish || '').trim();
    if (finish) data.finish = finish;
    data.cost = job.row.lineCost;
    data.duplicatedFrom = job.row.clipId;
    data.createdAt = now;
    data.updatedAt = now;
    data._priceFromDocAt = now;
    data._priceFromDoc = job.row.doc + ':' + job.row.line;
    if (Object.prototype.hasOwnProperty.call(data, 'markupPct') ||
        Object.prototype.hasOwnProperty.call(data, 'clientPrice')) {
      throw new Error('Refusing create that would write markupPct/clientPrice');
    }
    await job.ref.set(data);
    clipWrites++;
  }

  for (const c of inPlace) {
    const stamp = c.doc + ':' + c.line;
    await clipRef(c.clipId).update({
      cost: c.lineCost,
      updatedAt: now,
      _priceFromDocAt: now,
      _priceFromDoc: stamp
    });
    clipWrites++;
  }

  const relinkByDoc = {};
  createJobs.forEach(j => {
    const key = j.row.col + '/' + j.row.docId;
    (relinkByDoc[key] = relinkByDoc[key] || []).push(j);
  });
  for (const key of Object.keys(relinkByDoc)) {
    const jobs = relinkByDoc[key];
    const col = jobs[0].row.col;
    const docId = jobs[0].row.docId;
    const ref = board.collection(col).doc(docId);
    const snap = await ref.get();
    if (!snap.exists) throw new Error('Missing doc ' + key);
    const items = Array.isArray((snap.data() || {}).items) ? (snap.data().items).slice() : [];
    jobs.forEach(j => {
      if (!items[j.row.line]) throw new Error('Missing line ' + key + ' #' + j.row.line);
      items[j.row.line] = Object.assign({}, items[j.row.line], { clipId: j.newId });
    });
    await ref.update({ items: items, updatedAt: now });
    docWrites++;
  }

  console.log('\nAPPLY complete. clipWrites=' + clipWrites + ' docWrites=' + docWrites);
  console.log('Re-run without --apply (or this script a second time with --apply) must be a no-op.');
})().catch(e => {
  console.error(e && e.stack ? e.stack : e);
  process.exit(1);
});
