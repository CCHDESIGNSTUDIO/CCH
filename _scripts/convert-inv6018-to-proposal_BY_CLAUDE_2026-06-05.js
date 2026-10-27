#!/usr/bin/env node
'use strict';
/**
 * INV-6018 → new proposal (legitimate priced lines only) + flag bad shells + delete invoice.
 * Dry-run by default. Apply: node ... --apply --yes
 */
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const KEY = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
admin.initializeApp({ credential: admin.credential.cert(require(KEY)) });
const db = admin.firestore();

const PID = 'cloud-rolling-hills';
const INV_ID = 'vQsc5Y7nUjrPgleQoBoc';
const INV_NUM = 'INV-6018';
const APPLY = process.argv.includes('--apply');
const YES = process.argv.includes('--yes');

/** 0-based line indexes to keep: L7 (legit shell w/ clip pricing) + L16–L26 (priced). */
const LEGIT_IDX = new Set([6, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25]);

function str(v) { return String(v == null ? '' : v).trim(); }
function clone(o) { return JSON.parse(JSON.stringify(o)); }

function isProductLine(r) {
  if (!r || r.lineKind === 'group') return false;
  const et = str(r.expenseType).toLowerCase();
  if (['service', 'sales_tax', 'shipping', 'handling', 'expense', 'other_expense', 'discount', 'labor'].includes(et)) return false;
  if (r._isService === true || r.itemType === 'service') return false;
  return !!str(r.title || r.name || r.description);
}

function lineAmount(r) {
  return parseFloat(r.amount) || 0;
}

function prepareProposalLine(line, idx, clipById) {
  const row = clone(line);
  delete row.invoiceId;
  delete row.invoiceNum;
  delete row.lineApprovalStatus;
  row.lineApprovalStatus = 'pending';

  const cid = str(row.clipId || row.sourceClipId);
  if (cid && !clipById[cid]) {
    delete row.clipId;
    delete row.sourceClipId;
  }

  if (idx === 6) {
    const clip = clipById[cid];
    const cp = clip && parseFloat(clip.clientPrice);
    const qty = parseFloat(row.qty) || 1;
    if (lineAmount(row) <= 0 && cp > 0) {
      row.amount = Math.round(cp * qty * 100) / 100;
      if (!parseFloat(row.cost)) row.cost = cp;
    }
  }

  return row;
}

async function peekNextProNumber() {
  const doc = await db.collection('settings').doc('docCounters').get();
  const data = doc.exists ? doc.data() : {};
  let cur = parseInt(data.proCounter, 10);
  if (isNaN(cur) || cur < 3000) cur = 3024;
  return 'PRO-' + (cur + 1);
}

async function getNextProNumber() {
  const counterRef = db.collection('settings').doc('docCounters');
  const result = await db.runTransaction(async (tx) => {
    const doc = await tx.get(counterRef);
    const data = doc.exists ? doc.data() : {};
    let cur = parseInt(data.proCounter, 10);
    if (isNaN(cur) || cur < 3000) cur = 3024;
    const next = cur + 1;
    tx.set(counterRef, { proCounter: next }, { merge: true });
    return next;
  });
  return 'PRO-' + result;
}

async function flagProductDoNotReuse(libId, patch, dry) {
  if (!libId) return [];
  const touched = [];
  for (const coll of ['products', 'productLibrary']) {
    const ref = db.collection(coll).doc(libId);
    const snap = await ref.get();
    if (!snap.exists) continue;
    touched.push(coll + '/' + libId);
    if (!dry) await ref.set(patch, { merge: true });
  }
  return touched;
}

(async () => {
  const invRef = db.collection('boards').doc(PID).collection('invoices').doc(INV_ID);
  const invSnap = await invRef.get();
  if (!invSnap.exists) {
    console.error('Invoice not found:', INV_ID);
    process.exit(1);
  }
  const inv = invSnap.data() || {};
  const items = inv.items || [];
  const clipSnap = await db.collection('boards').doc(PID).collection('clips').get();
  const clipById = {};
  clipSnap.forEach((d) => { clipById[d.id] = { id: d.id, ...(d.data() || {}) }; });

  const legit = [];
  const excluded = [];
  items.forEach((line, idx) => {
    if (!isProductLine(line)) return;
    if (LEGIT_IDX.has(idx)) legit.push({ idx, line: prepareProposalLine(line, idx, clipById) });
    else excluded.push({ idx, line });
  });

  const proposalTotal = legit.reduce((s, x) => s + lineAmount(x.line), 0);
  const plannedProNum = await peekNextProNumber();

  const ts = new Date().toISOString();
  const flagPatch = {
    _doNotReuse: true,
    _doNotReuseAt: ts,
    _doNotReuseSource: INV_NUM,
    _doNotReuseReason: 'INV-6018 zero-dollar shell or bad clip link — excluded from replacement proposal',
  };

  const flagClips = [];
  const flagLibs = new Set();
  excluded.forEach(({ idx, line }) => {
    const cid = str(line.clipId || line.sourceClipId);
    if (cid && clipById[cid]) {
      flagClips.push({ clipId: cid, lineIdx: idx + 1, title: str(line.title || line.name).slice(0, 50) });
      const lib = str(clipById[cid].libraryProductId || line.libraryProductId);
      if (lib) flagLibs.add(lib);
    }
  });

  const backupDir = path.join(__dirname, '..', '_backup', 'inv6018-to-proposal-' + ts.slice(0, 10));
  fs.mkdirSync(backupDir, { recursive: true });
  const manifest = {
    mode: APPLY ? 'apply' : 'dry-run',
    projectId: PID,
    invoiceId: INV_ID,
    invoiceNum: INV_NUM,
    plannedProposalNum: plannedProNum,
    proposalLineCount: legit.length,
    proposalMerchandiseTotal: proposalTotal,
    excludedLineCount: excluded.length,
    flagClipCount: flagClips.length,
    flagLibraryCount: flagLibs.size,
    legitLines: legit.map((x) => ({
      L: x.idx + 1,
      room: str(x.line.room),
      title: str(x.line.title || x.line.name).slice(0, 60),
      amount: lineAmount(x.line),
      clipId: str(x.line.clipId || ''),
    })),
    excludedLines: excluded.map((x) => ({
      L: x.idx + 1,
      room: str(x.line.room),
      title: str(x.line.title || x.line.name).slice(0, 60),
      amount: lineAmount(x.line),
      clipId: str(x.line.clipId || ''),
    })),
    flagClips,
    flagLibraryIds: [...flagLibs],
  };

  console.log('=== INV-6018 → Proposal ===');
  console.log('Mode:', APPLY ? 'APPLY' : 'DRY-RUN');
  console.log('Proposal lines:', legit.length, '| merchandise:', proposalTotal);
  console.log('Excluded:', excluded.length, '| flag clips:', flagClips.length, '| flag library:', flagLibs.size);
  console.log('\nLegitimate lines:');
  manifest.legitLines.forEach((r) => console.log(' ', JSON.stringify(r)));
  console.log('\nFlagged (do not reuse):');
  flagClips.forEach((r) => console.log(' ', r.lineIdx, r.title, r.clipId));

  if (!APPLY) {
    fs.writeFileSync(path.join(backupDir, 'manifest-dry-run.json'), JSON.stringify(manifest, null, 2));
    console.log('\nWrote', path.join(backupDir, 'manifest-dry-run.json'));
    console.log('Run with --apply --yes to execute.');
    process.exit(0);
  }

  if (!YES) {
    console.error('Refusing --apply without --yes');
    process.exit(1);
  }

  fs.writeFileSync(path.join(backupDir, 'invoice-backup.json'), JSON.stringify({ id: INV_ID, ...inv }, null, 2));

  const actualProNum = await getNextProNumber();
  const proposalItems = legit.map((x) => x.line);
  const proposalPayload = {
    name: actualProNum,
    proposalNum: actualProNum,
    items: proposalItems,
    total: proposalTotal,
    status: 'Draft',
    published: false,
    notes: (inv.notes || '') + (inv.notes ? '\n' : '') + 'Created from ' + INV_NUM + ' (legitimate lines only). ' + INV_NUM + ' removed after PDF archive.',
    taxRate: inv.taxRate || 0,
    clientName: inv.clientName || '',
    clientEmail: inv.clientEmail || '',
    clientAddress: inv.clientAddress || '',
    createdAt: ts,
    updatedAt: ts,
    createdBy: 'Cursor script',
    createdByEmail: 'cursor-agent',
    sourceInvoice: INV_NUM,
    sourceInvoiceId: INV_ID,
    activityLog: [{
      action: 'created',
      details: 'From ' + INV_NUM + ' — ' + proposalItems.length + ' legitimate product lines',
      userName: 'Cursor script',
      userEmail: 'cursor-agent',
      timestamp: ts,
    }],
  };

  const propRef = await db.collection('boards').doc(PID).collection('proposals').add(proposalPayload);
  manifest.proposalId = propRef.id;
  manifest.proposalNum = actualProNum;

  for (const fc of flagClips) {
    await db.collection('boards').doc(PID).collection('clips').doc(fc.clipId).set(flagPatch, { merge: true });
    const clip = clipById[fc.clipId];
    if (clip && str(clip.invoiceId) === INV_ID) {
      await db.collection('boards').doc(PID).collection('clips').doc(fc.clipId).update({
        invoiceId: admin.firestore.FieldValue.delete(),
        invoiceNum: admin.firestore.FieldValue.delete(),
      });
    }
  }

  for (const libId of flagLibs) {
    await flagProductDoNotReuse(libId, flagPatch, false);
  }

  const keepClipIds = new Set();
  proposalItems.forEach((r) => {
    const cid = str(r.clipId || r.sourceClipId);
    if (cid) keepClipIds.add(cid);
  });

  for (const cid of keepClipIds) {
    const patch = {
      proposalId: propRef.id,
      proposalNum: actualProNum,
      updatedAt: ts,
      _docLinkedAt: ts,
    };
    if (str(clipById[cid] && clipById[cid].invoiceId) === INV_ID) {
      patch.invoiceId = admin.firestore.FieldValue.delete();
      patch.invoiceNum = admin.firestore.FieldValue.delete();
    }
    await db.collection('boards').doc(PID).collection('clips').doc(cid).set(patch, { merge: true });
  }

  await invRef.delete();
  try {
    await db.collection('boards').doc(PID).update({
      proposalCount: admin.firestore.FieldValue.increment(1),
      invoiceCount: admin.firestore.FieldValue.increment(-1),
    });
  } catch (_e) { /* optional counters */ }

  manifest.appliedAt = ts;
  fs.writeFileSync(path.join(backupDir, 'manifest-applied.json'), JSON.stringify(manifest, null, 2));
  console.log('\nDone.');
  console.log('Proposal:', actualProNum, propRef.id);
  console.log('Deleted invoice:', INV_NUM);
  console.log('Manifest:', path.join(backupDir, 'manifest-applied.json'));
})().catch((e) => { console.error(e); process.exit(1); });
