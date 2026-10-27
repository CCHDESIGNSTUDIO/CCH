/**
 * WO-235 PRODUCTION: stamp library ID on Large Rec Glass Lantern sconce.
 * Clip + PRO-3025 line 1 + INV-6067 line 1. Money / images / titles unchanged.
 *
 *   node _scripts\wo235-rh-large-rec-libid_BY_CURSOR_2026-09-18.js
 *   node _scripts\wo235-rh-large-rec-libid_BY_CURSOR_2026-09-18.js --apply
 */
'use strict';
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const APPLY = process.argv.includes('--apply');
const BOARD = 'cloud-rolling-hills';
const CLIP_ID = 'y1225j48vzeYDheN0BXm';
const PROP_ID = 'QdIB3AClnotrP9YgBLTs';
const INV_ID = 'tDCQlNyXqkGjdYMaCehL';
const LIB_ID = 'gWPgnpfAdJXlcjVlwRUq';
const HOUZZ = '54545585';
const TITLE = 'Large Rec Glass Lantern sconce';

const KEY = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
const db = admin.initializeApp({ credential: admin.credential.cert(require(KEY)) }, 'wo235lib').firestore();

function str(v) { return String(v == null ? '' : v).trim(); }
function moneySnap(it) {
  return {
    qty: it.qty, cost: it.cost, markupPct: it.markupPct, amount: it.amount,
    shipping: it.shipping, taxable: it.taxable, clientPrice: it.clientPrice
  };
}
function stampLine(it) {
  const next = Object.assign({}, it);
  next.libraryProductId = LIB_ID;
  next.linkedLibraryProductId = LIB_ID;
  next.libraryProductIdLocked = true;
  if (!str(next.houzzId) && !str(next.houzzProductId)) {
    next.houzzId = HOUZZ;
    next.houzzProductId = HOUZZ;
  }
  next._wo235LibIdAt = new Date().toISOString();
  return next;
}

(async function main() {
  const board = db.collection('boards').doc(BOARD);
  const clipRef = board.collection('clips').doc(CLIP_ID);
  const propRef = board.collection('proposals').doc(PROP_ID);
  const invRef = board.collection('invoices').doc(INV_ID);
  const [clipSnap, propSnap, invSnap, libSnap] = await Promise.all([
    clipRef.get(), propRef.get(), invRef.get(),
    db.collection('products').doc(LIB_ID).get()
  ]);
  if (!clipSnap.exists) throw new Error('clip missing: ' + CLIP_ID);
  if (!propSnap.exists) throw new Error('proposal missing');
  if (!invSnap.exists) throw new Error('invoice missing');
  if (!libSnap.exists) throw new Error('library product missing: ' + LIB_ID);

  const clip = clipSnap.data() || {};
  const prop = propSnap.data() || {};
  const inv = invSnap.data() || {};
  if (str(clip.title) !== TITLE) throw new Error('clip title mismatch: ' + clip.title);

  const pItems = (prop.items || []).slice();
  const iItems = (inv.items || []).slice();
  const pIdx = pItems.findIndex((it, i) => i === 1 || str(it.title) === TITLE);
  const iIdx = iItems.findIndex((it, i) => i === 1 || str(it.title) === TITLE);
  if (pIdx < 0) throw new Error('PRO-3025 line not found');
  if (iIdx < 0) throw new Error('INV-6067 line not found');
  if (str(pItems[pIdx].clipId) !== CLIP_ID) throw new Error('PRO clipId mismatch');
  if (str(iItems[iIdx].clipId) !== CLIP_ID) throw new Error('INV clipId mismatch');

  const planned = {
    libId: LIB_ID,
    houzzId: HOUZZ,
    clip: { id: CLIP_ID, before: { libraryProductId: clip.libraryProductId || '', houzzId: clip.houzzId || '' } },
    proposal: { id: PROP_ID, num: prop.proposalNum, idx: pIdx, money: moneySnap(pItems[pIdx]) },
    invoice: { id: INV_ID, num: inv.invoiceNum, idx: iIdx, money: moneySnap(iItems[iIdx]) }
  };
  console.log(JSON.stringify({ apply: APPLY, planned }, null, 2));

  if (!APPLY) {
    console.log('DRY RUN — pass --apply to write');
    process.exit(0);
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(__dirname, '..', '_backup', 'wo235-large-rec-libid-' + stamp);
  fs.mkdirSync(backupDir, { recursive: true });
  fs.writeFileSync(path.join(backupDir, 'clip.json'), JSON.stringify({ id: CLIP_ID, data: clip }, null, 2));
  fs.writeFileSync(path.join(backupDir, 'proposal.json'), JSON.stringify({ id: PROP_ID, data: prop }, null, 2));
  fs.writeFileSync(path.join(backupDir, 'invoice.json'), JSON.stringify({ id: INV_ID, data: inv }, null, 2));

  pItems[pIdx] = stampLine(pItems[pIdx]);
  iItems[iIdx] = stampLine(iItems[iIdx]);

  await clipRef.set({
    libraryProductId: LIB_ID,
    linkedLibraryProductId: LIB_ID,
    houzzId: str(clip.houzzId) || HOUZZ,
    houzzProductId: str(clip.houzzProductId) || HOUZZ,
    invoiceId: INV_ID,
    invoiceNum: str(inv.invoiceNum) || 'INV-6067',
    _wo235LibIdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }, { merge: true });

  await propRef.update({ items: pItems, updatedAt: new Date().toISOString() });
  await invRef.update({ items: iItems, updatedAt: new Date().toISOString() });

  console.log('APPLIED backup', backupDir);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
