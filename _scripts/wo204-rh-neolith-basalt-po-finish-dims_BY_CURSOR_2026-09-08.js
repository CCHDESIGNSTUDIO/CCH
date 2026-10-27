#!/usr/bin/env node
'use strict';
/**
 * WO-204 PRODUCTION: copy Product Library finish + dimensions onto Cloud Rolling Hills
 * Neolith Basalt PO lines (sent/locked POs cannot be edited in Studio).
 *
 *   node _scripts\wo204-rh-neolith-basalt-po-finish-dims_BY_CURSOR_2026-09-08.js
 *   node _scripts\wo204-rh-neolith-basalt-po-finish-dims_BY_CURSOR_2026-09-08.js --apply
 *
 * Default is dry-run. --apply writes a JSON backup then patches finish + dimensions only.
 * Does not touch cost, qty, images, title, vendor, or tax.
 */
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const APPLY = process.argv.includes('--apply');
const _finishFlag = process.argv.indexOf('--finish');
const FORCE_FINISH = _finishFlag >= 0 ? String(process.argv[_finishFlag + 1] || '').trim() : '';
const BOARD = 'cloud-rolling-hills';
const LIB_ID = 'basalt_black__neolith__stone___tile';

const KEY = path.join(
  __dirname,
  '..',
  '_debug',
  'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json'
);
const db = admin.initializeApp({ credential: admin.credential.cert(require(KEY)) }, 'wo204Neolith').firestore();

function str(v) { return String(v == null ? '' : v).trim(); }
function low(v) { return str(v).toLowerCase(); }
function isBasaltBlackLine(it) {
  const title = low(it.title || it.name);
  const lid = str(it.libraryProductId || it.linkedLibraryProductId);
  if (title.includes('cobblestone') || title.includes('reclaimed german')) return false;
  if (lid === LIB_ID) return true;
  if (title === 'basalt black' || title.includes('basalt black')) return true;
  return false;
}
function lineFinish(it) {
  return str(it.finish || it.color || it.finishColor || '');
}
function lineDims(it) {
  return str(it.dimensions || it.size || it.dimension || it.dims || it.measurements || '');
}
function libFinish(lib) {
  return str(lib.finish || lib.color || lib.finishColor || '');
}
function libDims(lib) {
  return str(lib.dimensions || lib.size || lib.dimension || '');
}

async function loadLib(id) {
  if (!id) return { id: '', src: '', data: null };
  const pl = await db.collection('productLibrary').doc(id).get();
  if (pl.exists) return { id: id, src: 'productLibrary', data: pl.data() || {} };
  const pr = await db.collection('products').doc(id).get();
  if (pr.exists) return { id: id, src: 'products', data: pr.data() || {} };
  return { id: id, src: '', data: null };
}

(async function main() {
  const board = db.collection('boards').doc(BOARD);
  const canon = await loadLib(LIB_ID);
  const canonFinish = FORCE_FINISH || (canon.data ? libFinish(canon.data) : '');
  const canonDims = canon.data ? libDims(canon.data) : '';
  if (!canonFinish && !canonDims) {
    throw new Error('Library ' + LIB_ID + ' has empty finish and dimensions');
  }

  const poSnap = await board.collection('purchaseOrders').get();
  const hits = [];
  poSnap.forEach((d) => {
    const x = d.data() || {};
    const items = Array.isArray(x.items) ? x.items : [];
    const num = str(x.poNum || x.number || x.docNumber || d.id);
    items.forEach((it, i) => {
      if (!it || typeof it !== 'object') return;
      if (!isBasaltBlackLine(it)) return;
      hits.push({
        poId: d.id,
        poNum: num,
        poLocked: x.poLocked === true || !!(x.poSentAt || x.sentAt),
        vendor: str(x.vendor || x.billToName || x.vendorName),
        lineIdx: i,
        title: str(it.title || it.name),
        room: str(it.room),
        lineTag: str(it.lineTag),
        libraryProductId: str(it.libraryProductId || it.linkedLibraryProductId),
        finish: lineFinish(it),
        dimensions: lineDims(it)
      });
    });
  });

  const planned = hits.map((h) => {
    const finishChanged = !!(canonFinish && canonFinish !== h.finish);
    const dimsChanged = !!(canonDims && canonDims !== h.dimensions);
    return Object.assign({}, h, {
      libSrc: canon.src + ':' + LIB_ID,
      libTitle: canon.data ? str(canon.data.title || canon.data.name) : '',
      libFinish: canonFinish,
      libDimensions: canonDims,
      finishChanged: finishChanged,
      dimsChanged: dimsChanged,
      willWrite: finishChanged || dimsChanged
    });
  });

  console.log('BOARD', BOARD);
  console.log('APPLY', APPLY);
  console.log('PO_DOCS', poSnap.size);
  console.log('NEOLITH_BASALT_LINES', planned.length);
  console.log('FORCE_FINISH', JSON.stringify(FORCE_FINISH || '(library)'));
  console.log('LIBRARY', canon.src, LIB_ID, '|', canon.data ? str(canon.data.title) : 'MISSING');
  console.log('  finish', JSON.stringify(canonFinish));
  console.log('  dims  ', JSON.stringify(canonDims));
  console.log('--- lines ---');
  planned.forEach((p) => {
    console.log([
      p.poNum,
      p.poId,
      'line ' + p.lineIdx,
      p.poLocked ? 'LOCKED' : 'unlocked',
      p.willWrite ? 'WRITE' : 'skip',
      p.title
    ].join(' | '));
    console.log('  room', p.room || '—', '| tag', p.lineTag || '—', '| lib', p.libraryProductId || '—');
    console.log('  finish PO', JSON.stringify(p.finish), '→', JSON.stringify(p.libFinish), p.finishChanged ? 'CHANGE' : 'same');
    console.log('  dims   PO', JSON.stringify(p.dimensions), '→', JSON.stringify(p.libDimensions), p.dimsChanged ? 'CHANGE' : 'same');
  });

  const writes = planned.filter((p) => p.willWrite);
  console.log('WILL_WRITE', writes.length, 'SKIP', planned.length - writes.length);

  if (!APPLY) {
    console.log('Dry-run only. Re-run with --apply to write.');
    process.exit(0);
  }
  if (!writes.length) {
    console.log('Nothing to write.');
    process.exit(0);
  }

  const byPo = {};
  writes.forEach((w) => {
    if (!byPo[w.poId]) byPo[w.poId] = [];
    byPo[w.poId].push(w);
  });

  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const backupDir = path.join(__dirname, '..', '_backup', 'wo204-neolith-basalt-' + stamp);
  fs.mkdirSync(backupDir, { recursive: true });

  for (const poId of Object.keys(byPo)) {
    const ref = board.collection('purchaseOrders').doc(poId);
    const snap = await ref.get();
    if (!snap.exists) throw new Error('PO vanished: ' + poId);
    const x = snap.data() || {};
    const items = Array.isArray(x.items) ? x.items.slice() : [];
    fs.writeFileSync(path.join(backupDir, poId + '.json'), JSON.stringify({ id: poId, data: x }, null, 2));
    byPo[poId].forEach((w) => {
      const it = Object.assign({}, items[w.lineIdx] || {});
      if (w.finishChanged) {
        it.finish = w.libFinish;
        if (str(it.color)) it.color = w.libFinish;
        if (str(it.finishColor)) it.finishColor = w.libFinish;
      }
      if (w.dimsChanged) {
        it.dimensions = w.libDimensions;
        if (str(it.size)) it.size = w.libDimensions;
        if (str(it.dimension)) it.dimension = w.libDimensions;
      }
      items[w.lineIdx] = it;
    });
    await ref.update({
      items: items,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      _wo204NeolithBasaltFinishDimsAt: new Date().toISOString()
    });
    console.log('UPDATED', poId, byPo[poId].length, 'lines');
  }
  if (FORCE_FINISH) {
    const libRef = db.collection('productLibrary').doc(LIB_ID);
    const libSnap = await libRef.get();
    if (libSnap.exists) {
      fs.writeFileSync(path.join(backupDir, 'productLibrary-' + LIB_ID + '.json'), JSON.stringify({ id: LIB_ID, data: libSnap.data() }, null, 2));
      await libRef.update({
        finish: FORCE_FINISH,
        updatedAt: new Date().toISOString()
      });
      console.log('UPDATED productLibrary', LIB_ID, 'finish', JSON.stringify(FORCE_FINISH));
    }
  }
  console.log('BACKUP', backupDir);
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
