#!/usr/bin/env node
'use strict';
/**
 * Restore INV-6018 excluded custom Elu lines to PRO-3025 and ensure Product Library rows
 * (products/ + productLibrary/) with CCH- productCode for each clip.
 * Dry-run default. --apply to execute.
 */
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const KEY = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
admin.initializeApp({ credential: admin.credential.cert(require(KEY)) });
const db = admin.firestore();

const PID = 'cloud-rolling-hills';
const PRO_ID = 'QdIB3AClnotrP9YgBLTs';
const PRO_NUM = 'PRO-3025';
const APPLY = process.argv.includes('--apply');
const BACKUP = path.join(__dirname, '..', '_backup', 'inv6018-to-proposal-2026-06-06', 'invoice-backup.json');

/** 0-based indexes excluded from PRO-3025 (from convert script). */
const EXCLUDED_IDX = [0, 1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12, 13, 14];

function str(v) { return String(v == null ? '' : v).trim(); }
function clone(o) { return JSON.parse(JSON.stringify(o)); }

async function allocateProductCode() {
  const ref = db.collection('settings').doc('docCounters');
  const code = await db.runTransaction(async (tx) => {
    const doc = await tx.get(ref);
    const data = doc.exists ? doc.data() : {};
    let cur = parseInt(data.productCodeCounter, 10);
    if (isNaN(cur) || cur < 0) cur = 0;
    const next = cur + 1;
    tx.set(ref, { productCodeCounter: next }, { merge: true });
    return 'CCH-' + String(next).padStart(6, '0');
  });
  return code;
}

function clipToLibraryPayload(clip, line, libId, productCode, boardName) {
  const ts = new Date().toISOString();
  const title = str(line.title || line.name || clip.title) || 'Untitled';
  const vendor = str(line.vendor || clip.vendor) || 'Elu';
  const images = Array.isArray(clip.images) && clip.images.length
    ? clip.images
    : (Array.isArray(line.images) && line.images.length ? line.images : []);
  const imageUrl = str(clip.imageUrl || line.imageUrl || images[0] || '');
  const base = {
    title,
    vendor,
    manufacturer: str(clip.manufacturer || line.manufacturer) || null,
    category: str(line.category || clip.category) || 'Lighting',
    sku: str(line.sku || clip.sku) || null,
    room: str(line.room || clip.room) || null,
    projectId: PID,
    project: boardName,
    libraryItemKind: 'product',
    productLifecycle: 'active',
    imageUrl: imageUrl || null,
    images: images.length ? images : (imageUrl ? [imageUrl] : []),
    productUrl: str(clip.productUrl || clip.pageUrl || line.productUrl) || null,
    vendorUrl: str(clip.vendorUrl || clip.pageUrl || line.vendorUrl) || null,
    pageUrl: str(clip.pageUrl || clip.productUrl) || null,
    clientDescription: str(line.clientDescription || clip.clientDescription) || null,
    description: str(line.description || clip.description) || null,
    vendorDescription: str(line.vendorDescription || clip.vendorDescription) || null,
    finish: str(line.finish || clip.finish) || null,
    dimensions: str(line.dimensions || clip.dimensions) || null,
    productCode,
    source: 'room-board-restore',
    _restoredFrom: 'INV-6018-excluded',
    _restoredAt: ts,
    updatedAt: ts,
  };
  Object.keys(base).forEach((k) => { if (base[k] == null || base[k] === '') delete base[k]; });
  return base;
}

function prepareProposalLine(line, clipId) {
  const row = clone(line);
  delete row.invoiceId;
  delete row.invoiceNum;
  row.lineApprovalStatus = 'pending';
  if (clipId) row.clipId = clipId;
  row.libraryProductId = row.libraryProductId || undefined;
  return row;
}

(async () => {
  const inv = JSON.parse(fs.readFileSync(BACKUP, 'utf8'));
  const items = inv.items || [];
  const boardSnap = await db.collection('boards').doc(PID).get();
  const boardName = boardSnap.exists ? str(boardSnap.data().name) || 'Cloud - Rolling Hills' : 'Cloud - Rolling Hills';

  const proSnap = await db.collection('boards').doc(PID).collection('proposals').doc(PRO_ID).get();
  if (!proSnap.exists) {
    console.error('Proposal not found:', PRO_ID);
    process.exit(1);
  }
  const pro = proSnap.data() || {};
  const existingLines = pro.items || [];

  const plan = [];
  for (const idx of EXCLUDED_IDX) {
    const line = items[idx];
    if (!line) continue;
    const clipId = str(line.clipId || line.sourceClipId || line._matchedClipId);
    let clip = {};
    if (clipId) {
      const cs = await db.collection('boards').doc(PID).collection('clips').doc(clipId).get();
      if (!cs.exists) {
        plan.push({ idx: idx + 1, title: str(line.title), status: 'skip_missing_clip', clipId });
        continue;
      }
      clip = cs.data() || {};
    } else {
      plan.push({ idx: idx + 1, title: str(line.title), status: 'skip_no_clipId' });
      continue;
    }

    let libId = str(clip.libraryProductId || line.libraryProductId);
    const prodSnap = libId ? await db.collection('products').doc(libId).get() : null;
    const plSnap = libId ? await db.collection('productLibrary').doc(libId).get() : null;
    let productCode = '';
    if (prodSnap && prodSnap.exists) productCode = str(prodSnap.data().productCode);
    if (!productCode && plSnap && plSnap.exists) productCode = str(plSnap.data().productCode);
    if (!productCode) productCode = '(assign on apply)';

    if (!libId) libId = '(new id on apply)';

    plan.push({
      idx: idx + 1,
      title: str(line.title || clip.title),
      room: str(line.room || clip.room),
      clipId,
      libraryProductId: libId,
      productCode,
      hadProducts: !!(prodSnap && prodSnap.exists),
      hadProductLibrary: !!(plSnap && plSnap.exists),
      status: 'restore',
    });
  }

  console.log('=== Restore INV-6018 excluded → PRO-3025 + Library ===');
  console.log('Mode:', APPLY ? 'APPLY' : 'DRY-RUN');
  plan.forEach((p) => console.log(JSON.stringify(p)));

  const toRestore = plan.filter((p) => p.status === 'restore');
  console.log('\nWill restore:', toRestore.length, 'lines to', PRO_NUM);

  if (!APPLY) {
    console.log('\nRun with --apply to write.');
    process.exit(0);
  }

  const ts = new Date().toISOString();
  const manifest = { restored: [], proposalLinesAdded: [] };

  for (const p of toRestore) {
    const line = items[p.idx - 1];
    const clipSnap = await db.collection('boards').doc(PID).collection('clips').doc(p.clipId).get();
    const clip = clipSnap.data() || {};
    let libId = str(clip.libraryProductId || line.libraryProductId);
    if (!libId) {
      libId = db.collection('products').doc().id;
    }

    let productCode = p.productCode;
    if (productCode.startsWith('(new')) {
      productCode = await allocateProductCode();
    } else if (!productCode) {
      productCode = await allocateProductCode();
    }

    const payload = clipToLibraryPayload(clip, line, libId, productCode, boardName);
    const prodRef = db.collection('products').doc(libId);
    const prodExists = (await prodRef.get()).exists;
    if (!prodExists) payload.createdAt = ts;
    await prodRef.set(payload, { merge: true });

    const libPayload = Object.assign({}, payload, {
      unitCost: parseFloat(line.cost || line.unitCost) || null,
      sellPrice: parseFloat(line.amount) || null,
      image: payload.imageUrl || null,
    });
    Object.keys(libPayload).forEach((k) => { if (libPayload[k] == null) delete libPayload[k]; });
    await db.collection('productLibrary').doc(libId).set(libPayload, { merge: true });

    await db.collection('boards').doc(PID).collection('clips').doc(p.clipId).set({
      libraryProductId: libId,
      title: payload.title,
      vendor: payload.vendor,
      updatedAt: ts,
      proposalId: PRO_ID,
      proposalNum: PRO_NUM,
    }, { merge: true });

    const propLine = prepareProposalLine(line, p.clipId);
    propLine.libraryProductId = libId;
    propLine.libraryProductIdLocked = true;
    manifest.proposalLinesAdded.push({
      L: p.idx,
      title: payload.title,
      clipId: p.clipId,
      libraryProductId: libId,
      productCode,
    });
    manifest.restored.push(p);
  }

  const newLines = toRestore.map((p) => {
    const line = prepareProposalLine(items[p.idx - 1], p.clipId);
    const entry = manifest.proposalLinesAdded.find((x) => x.L === p.idx);
    if (entry) {
      line.libraryProductId = entry.libraryProductId;
      line.libraryProductIdLocked = true;
    }
    return line;
  });

  const mergedItems = existingLines.concat(newLines);
  const newTotal = mergedItems.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);

  await db.collection('boards').doc(PID).collection('proposals').doc(PRO_ID).update({
    items: mergedItems,
    total: newTotal,
    updatedAt: ts,
    notes: (pro.notes || '') + (pro.notes ? '\n' : '') + 'Restored ' + newLines.length + ' custom Elu lines from INV-6018 archive (' + ts.slice(0, 10) + ').',
  });

  const outDir = path.join(__dirname, '..', '_backup', 'restore-inv6018-excluded-2026-06-06');
  fs.mkdirSync(outDir, { recursive: true });
  manifest.appliedAt = ts;
  manifest.proposalId = PRO_ID;
  manifest.newLineCount = newLines.length;
  manifest.newMerchandiseTotal = newTotal;
  fs.writeFileSync(
    path.join(outDir, 'manifest_RESTORE_INV6018_EXCLUDED_BY_CLAUDE_2026-06-06.json'),
    JSON.stringify(manifest, null, 2)
  );

  console.log('\nDone. Added', newLines.length, 'lines to', PRO_NUM, '| merchandise total now', newTotal);
})().catch((e) => { console.error(e); process.exit(1); });
