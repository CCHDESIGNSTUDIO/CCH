#!/usr/bin/env node
'use strict';
/**
 * Rolling Hills — all line items with no usable image URL.
 * Covers room-board clips, products/ catalog, proposal lines, invoice lines.
 *
 *   node _scripts/audit-rh-no-image-lines_BY_CLAUDE_2026-06-02.js
 *   node _scripts/audit-rh-no-image-lines_BY_CLAUDE_2026-06-02.js --csv
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
const OUT_DIR = path.join(__dirname, '..', '_backup', 'rh-no-image-lines-2026-06-02');
const WRITE_CSV = process.argv.includes('--csv') || true;

function heroUrl(x) {
  if (!x) return '';
  if (Array.isArray(x.images) && x.images.length) {
    for (const im of x.images) {
      const u = typeof im === 'string' ? im : (im && (im.url || im.imageUrl || im.src)) || '';
      if (String(u).trim()) return String(u).trim();
    }
  }
  return String(x.imageUrl || x.image || x.img || x.thumbnail || x.heroImageUrl || '').trim();
}

function hasImage(x) {
  return !!heroUrl(x);
}

function escCsv(v) {
  const s = String(v == null ? '' : v).replace(/"/g, '""');
  return /[",\n\r]/.test(s) ? `"${s}"` : s;
}

function docNum(doc, type) {
  const d = doc || {};
  if (type === 'proposal') return String(d.proposalNum || d.number || d.name || '').trim();
  if (type === 'invoice') return String(d.invoiceNum || d.number || d.name || '').trim();
  if (type === 'po') return String(d.poNum || d.number || d.name || '').trim();
  return '';
}

function isGroupHeader(it) {
  const t = String(it.title || it.description || '').trim();
  return !t || it.isGroupHeader === true || it.lineType === 'group';
}

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const rows = [];
  const boardSnap = await db.collection('boards').doc(PID).get();
  const projName = boardSnap.exists ? String((boardSnap.data() || {}).name || PROJ).trim() : PROJ;

  // 1. Room-board clips
  const clipSnap = await db.collection('boards').doc(PID).collection('clips').get();
  clipSnap.forEach((d) => {
    const x = d.data() || {};
    if (hasImage(x)) return;
    rows.push({
      collection: 'boards/clips',
      docId: d.id,
      lineIndex: '',
      title: String(x.title || '').trim(),
      vendor: String(x.vendor || '').trim(),
      room: String(x.room || '').trim(),
      category: String(x.category || '').trim(),
      source: String(x.source || '').trim(),
      houzzId: String(x.houzzId || x.houzzProductId || '').trim(),
      libraryProductId: String(x.libraryProductId || x.linkedLibraryProductId || '').trim(),
      docRef: [x.proposalNum, x.invoiceNum, x.poNum].filter(Boolean).join(' · ') || '',
      clipId: d.id,
      cost: x.cost || x.costPrice || '',
      sell: x.clientPrice || x.unitSellingPrice || x.totalSelling || '',
      sku: String(x.sku || '').trim(),
      imageFields: JSON.stringify({ imageUrl: x.imageUrl || null, image: x.image || null, imagesLen: (x.images || []).length }),
    });
  });

  // 2. products/ catalog (project scoped)
  const prodById = new Map();
  async function scanProducts(q) {
    const snap = await q.get();
    snap.forEach((d) => {
      if (prodById.has(d.id)) return;
      prodById.set(d.id, d);
    });
  }
  await scanProducts(db.collection('products').where('projectId', '==', PID).limit(800));
  if (projName) await scanProducts(db.collection('products').where('project', '==', projName).limit(800));

  prodById.forEach((d) => {
    const x = d.data() || {};
    if (hasImage(x)) return;
    if (!String(x.room || '').trim() && !String(x.title || '').trim()) return;
    rows.push({
      collection: 'products',
      docId: d.id,
      lineIndex: '',
      title: String(x.title || x.name || '').trim(),
      vendor: String(x.vendor || '').trim(),
      room: String(x.room || '').trim(),
      category: String(x.category || '').trim(),
      source: String(x.source || '').trim(),
      houzzId: String(x.houzzId || x.houzzProductId || '').trim(),
      libraryProductId: d.id,
      docRef: '',
      clipId: String(x.clipId || x.sourceClipId || '').trim(),
      cost: x.cost || x.costPrice || x.unitCost || '',
      sell: x.clientPrice || x.sellPrice || x.totalSell || '',
      sku: String(x.sku || '').trim(),
      imageFields: JSON.stringify({ imageUrl: x.imageUrl || null, image: x.image || null, imagesLen: (x.images || []).length }),
    });
  });

  // 3. Proposal lines
  const propSnap = await db.collection('boards').doc(PID).collection('proposals').get();
  propSnap.forEach((d) => {
    const p = d.data() || {};
    const prNum = docNum(p, 'proposal') || d.id;
    (p.items || []).forEach((it, idx) => {
      if (isGroupHeader(it)) return;
      if (hasImage(it)) return;
      rows.push({
        collection: 'proposals',
        docId: d.id,
        lineIndex: idx,
        title: String(it.title || it.description || '').trim(),
        vendor: String(it.vendor || '').trim(),
        room: String(it.room || '').trim(),
        category: String(it.category || '').trim(),
        source: 'proposal-line',
        houzzId: String(it.houzzId || it.houzzProductId || '').trim(),
        libraryProductId: String(it.libraryProductId || it.linkedLibraryProductId || '').trim(),
        docRef: prNum,
        clipId: String(it.clipId || it.sourceClipId || '').trim(),
        cost: it.cost || '',
        sell: it.amount || it.total || '',
        sku: String(it.sku || '').trim(),
        imageFields: JSON.stringify({ imageUrl: it.imageUrl || null, image: it.image || null, imagesLen: (it.images || []).length }),
      });
    });
  });

  // 4. Invoice lines
  const invSnap = await db.collection('boards').doc(PID).collection('invoices').get();
  invSnap.forEach((d) => {
    const inv = d.data() || {};
    const invNum = docNum(inv, 'invoice') || d.id;
    (inv.items || []).forEach((it, idx) => {
      if (isGroupHeader(it)) return;
      if (hasImage(it)) return;
      rows.push({
        collection: 'invoices',
        docId: d.id,
        lineIndex: idx,
        title: String(it.title || it.description || '').trim(),
        vendor: String(it.vendor || '').trim(),
        room: String(it.room || '').trim(),
        category: String(it.category || '').trim(),
        source: 'invoice-line',
        houzzId: String(it.houzzId || it.houzzProductId || '').trim(),
        libraryProductId: String(it.libraryProductId || it.linkedLibraryProductId || '').trim(),
        docRef: invNum,
        clipId: String(it.clipId || it.sourceClipId || '').trim(),
        cost: it.cost || '',
        sell: it.amount || it.total || '',
        sku: String(it.sku || '').trim(),
        imageFields: JSON.stringify({ imageUrl: it.imageUrl || null, image: it.image || null, imagesLen: (it.images || []).length }),
      });
    });
  });

  // Sort: room, collection, title
  rows.sort((a, b) => {
    const ra = (a.room || 'zzz').localeCompare(b.room || 'zzz');
    if (ra) return ra;
    const ca = a.collection.localeCompare(b.collection);
    if (ca) return ca;
    return String(a.title).localeCompare(String(b.title));
  });

  const summary = {
    projectId: PID,
    projectName: projName,
    auditedAt: new Date().toISOString(),
    totalNoImage: rows.length,
    byCollection: {},
    byRoom: {},
  };
  rows.forEach((r) => {
    summary.byCollection[r.collection] = (summary.byCollection[r.collection] || 0) + 1;
    const rm = r.room || '(no room)';
    summary.byRoom[rm] = (summary.byRoom[rm] || 0) + 1;
  });

  const jsonPath = path.join(OUT_DIR, 'audit-no-image-lines_BY_CLAUDE_2026-06-02.json');
  fs.writeFileSync(jsonPath, JSON.stringify({ summary, rows }, null, 2));

  const headers = [
    'collection', 'docId', 'lineIndex', 'title', 'vendor', 'room', 'category', 'source',
    'houzzId', 'libraryProductId', 'docRef', 'clipId', 'cost', 'sell', 'sku', 'imageFields',
  ];
  const csvPath = path.join(OUT_DIR, 'audit-no-image-lines_BY_CLAUDE_2026-06-02.csv');
  const csvLines = [headers.join(',')];
  rows.forEach((r) => {
    csvLines.push(headers.map((h) => escCsv(r[h])).join(','));
  });
  fs.writeFileSync(csvPath, csvLines.join('\n'));

  console.log('=== Rolling Hills — line items with NO image ===\n');
  console.log('Total:', rows.length);
  console.log('By collection:', summary.byCollection);
  console.log('\nTop rooms (no-image count):');
  Object.entries(summary.byRoom)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .forEach(([rm, n]) => console.log(' ', n, rm));
  console.log('\nJSON:', jsonPath);
  console.log('CSV:', csvPath);
  console.log('\nSample (first 12):');
  rows.slice(0, 12).forEach((r, i) => {
    console.log(`  ${i + 1}. [${r.collection}] ${r.room || '?'} | ${r.title.slice(0, 50)} | ${r.vendor} | ${r.docRef || r.docId.slice(0, 10)}`);
  });
})();
