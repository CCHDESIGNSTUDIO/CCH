#!/usr/bin/env node
'use strict';
/**
 * Rolling Hills: clips on room boards with NO Houzz ID and NOT clipper-sourced.
 * Cross-links invoice lines (e.g. Pool Bath / IN-12802 plumbing).
 *
 *   node _scripts/audit-rh-no-houzz-no-clipper_BY_CLAUDE_2026-06-02.js
 *   node _scripts/audit-rh-no-houzz-no-clipper_BY_CLAUDE_2026-06-02.js --room="Pool Bath"
 */
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const KEY = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
admin.initializeApp({ credential: admin.credential.cert(require(KEY)) });
const db = admin.firestore();

const PID = 'cloud-rolling-hills';
const PROJ = 'Cloud - Rolling Hills';
const ROOM_FILTER = (process.argv.find((a) => a.startsWith('--room=')) || '').replace('--room=', '').trim();
const OUT = path.join(__dirname, '..', '_backup', 'rh-no-houzz-no-clipper-2026-06-02', 'audit-report.json');

function houzzIdOf(x) {
  return String(x.houzzId || x.houzzProductId || x.catalogId || '').trim();
}
function isClipperClip(x) {
  const s = String(x.source || '').toLowerCase();
  return s === 'clipper' || s === 'cch-studio-clipper';
}
function hasImg(x) {
  return !!(String(x.imageUrl || x.image || '').trim() || (Array.isArray(x.images) && x.images.length));
}

function orphanClipRow(d) {
  const x = d.data() || {};
  const hz = houzzIdOf(x);
  const clipper = isClipperClip(x);
  if (hz || clipper) return null;
  const room = String(x.room || '').trim();
  if (ROOM_FILTER && room !== ROOM_FILTER) return null;
  return {
    kind: 'room-board-clip',
    id: d.id,
    title: String(x.title || '').slice(0, 100),
    vendor: x.vendor || '',
    room,
    category: x.category || '',
    source: x.source || '',
    sku: x.sku || '',
    libraryProductId: x.libraryProductId || '',
    clipId: d.id,
    houzzId: '',
    hasImage: hasImg(x),
    invoiceNum: x.invoiceNum || '',
    proposalNum: x.proposalNum || '',
    addedAt: x.addedAt || '',
    updatedAt: x.updatedAt || '',
  };
}

(async () => {
  const board = await db.collection('boards').doc(PID).get();
  const projName = board.exists ? String((board.data() || {}).name || PROJ).trim() : PROJ;

  const orphans = [];
  const clipSnap = await db.collection('boards').doc(PID).collection('clips').get();
  clipSnap.forEach((d) => {
    const row = orphanClipRow(d);
    if (row) orphans.push(row);
  });

  // Invoice lines: same project, no houzz on line, with room (esp. invoiced plumbing)
  const invSnap = await db.collection('boards').doc(PID).collection('invoices').get();
  const invoiceLines = [];
  invSnap.forEach((invDoc) => {
    const inv = invDoc.data() || {};
    const invNum = String(inv.invoiceNum || inv.name || inv.number || invDoc.id).trim();
    (inv.items || []).forEach((line, idx) => {
      if (!line) return;
      const hz = houzzIdOf(line);
      if (hz) return;
      const room = String(line.room || '').trim();
      if (ROOM_FILTER && room !== ROOM_FILTER) return;
      const title = String(line.title || line.name || line.description || '').trim();
      if (!title) return;
      invoiceLines.push({
        kind: 'invoice-line',
        invoiceId: invDoc.id,
        invoiceNum: invNum,
        lineIdx: idx,
        title: title.slice(0, 100),
        vendor: line.vendor || '',
        room,
        category: line.category || '',
        sku: line.sku || '',
        clipId: String(line.clipId || line.sourceClipId || '').trim(),
        libraryProductId: String(line.libraryProductId || '').trim(),
        houzzId: '',
        amount: line.amount,
        imageUrl: !!(line.imageUrl || line.image),
      });
    });
  });

  // Catalog rows with room but no houzz (spawn source for library clips)
  const catalogOrphans = [];
  const seenCat = new Set();
  async function scanCatalog(coll) {
    let s1 = await db.collection(coll).where('projectId', '==', PID).limit(500).get();
    s1.forEach((d) => {
      if (seenCat.has(d.id)) return;
      const p = d.data() || {};
      const hz = houzzIdOf(p);
      if (hz) return;
      const room = String(p.room || '').trim();
      if (!room) return;
      if (ROOM_FILTER && room !== ROOM_FILTER) return;
      seenCat.add(d.id);
      catalogOrphans.push({
        kind: 'catalog',
        collection: coll,
        id: d.id,
        title: String(p.title || '').slice(0, 100),
        vendor: p.vendor || '',
        room,
        source: p.source || '',
        sku: p.sku || '',
        houzzId: '',
        hasImage: hasImg(p),
        invoice: p.invoice || p.houzzInvoice || '',
        proposal: p.proposal || '',
      });
    });
    if (projName) {
      const s2 = await db.collection(coll).where('project', '==', projName).limit(500).get();
      s2.forEach((d) => {
        if (seenCat.has(d.id)) return;
        const p = d.data() || {};
        if (houzzIdOf(p)) return;
        const room = String(p.room || '').trim();
        if (!room || (ROOM_FILTER && room !== ROOM_FILTER)) return;
        seenCat.add(d.id);
        catalogOrphans.push({
          kind: 'catalog',
          collection: coll,
          id: d.id,
          title: String(p.title || '').slice(0, 100),
          vendor: p.vendor || '',
          room,
          source: p.source || '',
          sku: p.sku || '',
          houzzId: '',
          hasImage: hasImg(p),
          invoice: p.invoice || p.houzzInvoice || '',
          proposal: p.proposal || '',
        });
      });
    }
  }
  await scanCatalog('products');
  await scanCatalog('productLibrary');

  // Match orphans to IN-12802 etc.
  const inv12802Lines = invoiceLines.filter((l) => /12802/i.test(l.invoiceNum));
  const poolBathClips = orphans.filter((o) => o.room === 'Pool Bath');

  const bySource = {};
  orphans.forEach((o) => {
    const s = o.source || '(none)';
    bySource[s] = (bySource[s] || 0) + 1;
  });

  const report = {
    generatedAt: new Date().toISOString(),
    projectId: PID,
    projectName: projName,
    roomFilter: ROOM_FILTER || null,
    summary: {
      totalClips: clipSnap.size,
      orphanClipsOnRoomBoard: orphans.length,
      orphanCatalogWithRoom: catalogOrphans.length,
      invoiceLinesNoHouzzId: invoiceLines.length,
      poolBathOrphanClips: poolBathClips.length,
      inv12802LinesNoHouzz: inv12802Lines.length,
    },
    orphanClipsBySource: bySource,
    orphanRoomBoardClips: orphans.sort((a, b) => String(a.room).localeCompare(b.room) || String(a.title).localeCompare(b.title)),
    orphanCatalogRows: catalogOrphans.slice(0, 200),
    invoiceLinesNoHouzz: invoiceLines,
    poolBathDetail: {
      orphanClips: poolBathClips,
      inv12802Lines,
    },
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2));

  console.log('=== RH: no Houzz ID + not clipper ===\n');
  console.log('Room filter:', ROOM_FILTER || '(all)');
  console.log('Total clips:', clipSnap.size);
  console.log('Orphan room-board clips (no Houzz, not clipper):', orphans.length);
  console.log('  by source:', JSON.stringify(bySource));
  console.log('Catalog rows with room, no Houzz:', catalogOrphans.length);
  console.log('Invoice lines, no Houzz:', invoiceLines.length);
  console.log('Pool Bath orphan clips:', poolBathClips.length);
  console.log('IN-12802 lines w/o Houzz:', inv12802Lines.length);
  console.log('\nReport:', OUT);

  console.log('\n--- Pool Bath orphan clips (room board) ---');
  poolBathClips.forEach((o, i) => {
    console.log(`${i + 1}. ${o.id} | ${o.source} | img:${o.hasImage} | ${o.title}`);
    if (o.invoiceNum) console.log('   clip tags invoice:', o.invoiceNum);
  });

  console.log('\n--- IN-12802 invoice lines (no Houzz id) ---');
  inv12802Lines.forEach((l) => {
    console.log(`  [${l.lineIdx}] ${l.title} | room:${l.room} | clipId:${l.clipId || '—'} | $${l.amount}`);
  });

  console.log('\n--- Sample orphan clips (first 25) ---');
  orphans.slice(0, 25).forEach((o, i) => {
    console.log(`${i + 1}. ${o.room || '(no room)'} | ${o.source} | ${o.id} | ${o.title.slice(0, 55)}`);
  });
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
