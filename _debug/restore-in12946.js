#!/usr/bin/env node
/**
 * Restore IN-12946 (cloud-rolling-hills) — 4 Lakeview Signature lines from May 22 recon.
 * Replaces items[] on ayKQv4sEnjAiDaymije9; sets totals to match Houzz ($43,115.48 paid).
 *
 *   node restore-in12946.js           # dry-run
 *   node restore-in12946.js --execute # write prod
 */
'use strict';

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const EXECUTE = process.argv.includes('--execute');
const BOARD_ID = 'cloud-rolling-hills';
const DOC_ID = 'ayKQv4sEnjAiDaymije9';
const INVOICE_NUM = 'IN-12946';

const HOUZZ_TOTAL = 43115.48;
const HOUZZ_PAID = 43115.48;

const PROD_KEY = path.join(__dirname, 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');

const RECON_LINES = [
  {
    title: 'Lakeview Signature',
    description: '16"  Electric - Sides of house &  pool house',
    qty: 12,
    cost: 1010,
    amount: 12120,
    shipping: 0,
  },
  {
    title: 'Lakeview Signature',
    description: '23" Electric - Patio & Master bedroom / Side of Large garage\nManual Control\nD. Oxidation \nFlushmount with Copper Rear channel',
    qty: 7,
    cost: 1205,
    amount: 8435,
    shipping: 0,
  },
  {
    title: 'Lakeview Signature',
    description: '23" Gas   GARAGE & SIDE SCONCES @ ENTRY\nD.  Oxidation \nElectronic Igniter',
    qty: 8,
    cost: 1685,
    amount: 13480,
    shipping: 0,
  },
  {
    title: 'Lakeview Signature',
    description: '27" Gas - ENTRY \r\nElectronic Igniter \r\nDark Oxidation - Oil Rubbed Bronze (Very Close to Black) \r\nFlush Mount (With Copper Rear Channel)  USD\r\n\r\nCurrent Estimated Lead Time: 10-12 weeks',
    qty: 2,
    cost: 1985,
    amount: 5470,
    shipping: 1500,
  },
];

function round2(n) {
  return Math.round(n * 100) / 100;
}

function markupPct(cost, sell, qty) {
  const c = parseFloat(cost) || 0;
  const q = parseFloat(qty) || 1;
  const s = parseFloat(sell) || 0;
  if (c <= 0 || q <= 0) return 100;
  return Math.round(((s / q - c) / c) * 100);
}

function buildLine(src, preserved) {
  const qty = src.qty;
  const cost = src.cost;
  const amount = src.amount;
  return {
    title: src.title,
    description: src.description,
    vendor: preserved.vendor || 'Flambeaux',
    category: preserved.category || 'Exterior',
    room: preserved.room || '',
    qty,
    cost,
    markupPct: markupPct(cost, amount, qty),
    shipping: src.shipping || 0,
    amount,
    imageUrl: preserved.imageUrl || '',
    images: preserved.images ? preserved.images.slice() : (preserved.imageUrl ? [preserved.imageUrl] : []),
    houzzId: preserved.houzzId || '',
    lineNotes: preserved.lineNotes || '',
    _restoredFromReconAt: new Date().toISOString(),
  };
}

(async () => {
  const key = require(PROD_KEY);
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(key) });
  }
  const db = admin.firestore();
  const ref = db.doc(`boards/${BOARD_ID}/invoices/${DOC_ID}`);
  const snap = await ref.get();
  if (!snap.exists) {
    console.error('Invoice doc not found:', DOC_ID);
    process.exit(1);
  }
  const prev = snap.data();
  const prevItems = prev.items || prev.lineItems || [];
  const preserved = prevItems[0] || {};

  const items = RECON_LINES.map((line) => buildLine(line, preserved));
  const linesSubtotal = round2(items.reduce((s, it) => s + (parseFloat(it.amount) || 0), 0));
  const lineShipping = round2(items.reduce((s, it) => s + (parseFloat(it.shipping) || 0), 0));
  const remainder = round2(HOUZZ_TOTAL - linesSubtotal - lineShipping);

  const patch = {
    items,
    number: INVOICE_NUM,
    invoiceNum: INVOICE_NUM,
    total: HOUZZ_TOTAL,
    paidAmount: HOUZZ_PAID,
    invoiceBalance: 0,
    status: prev.status || 'Paid',
    subtotal: linesSubtotal,
    shipping: lineShipping + Math.max(0, remainder),
    updatedAt: new Date().toISOString(),
    lastEditedAt: new Date().toISOString(),
    lastEditedBy: 'restore-in12946.js',
    _in12946RestoredAt: new Date().toISOString(),
    _in12946RestoreNote: '4 Lakeview lines from recon-phase0 May 22; Phase 8 had deleted in-12946/IN-12946 copies',
  };

  if (prev.qbId || prev.qbDocId) {
    patch.qbId = prev.qbId || prev.qbDocId;
    patch.qbDocId = prev.qbDocId || prev.qbId;
  }

  const log = {
    mode: EXECUTE ? 'execute' : 'dry-run',
    docId: DOC_ID,
    before: {
      itemCount: prevItems.length,
      total: prev.total,
      paidAmount: prev.paidAmount,
    },
    after: {
      itemCount: items.length,
      total: patch.total,
      linesSubtotal,
      lineShipping,
      remainderToShipping: remainder,
    },
    items: items.map((it) => ({
      title: it.title,
      qty: it.qty,
      cost: it.cost,
      amount: it.amount,
      shipping: it.shipping,
    })),
  };

  const logPath = path.join(__dirname, `restore-in12946-${EXECUTE ? 'apply' : 'dryrun'}-${Date.now()}.json`);
  fs.writeFileSync(logPath, JSON.stringify(log, null, 2));

  console.log(`IN-12946 restore (${EXECUTE ? 'EXECUTE' : 'DRY RUN'})`);
  console.log('  doc:', DOC_ID);
  console.log('  before:', log.before.itemCount, 'lines, total $' + log.before.total);
  console.log('  after: ', log.after.itemCount, 'lines, total $' + log.after.total);
  console.log('  lines subtotal: $' + linesSubtotal, '+ line shipping $' + lineShipping, '+ remainder on doc.shipping $' + Math.max(0, remainder));
  items.forEach((it, i) => {
    console.log(`  [${i + 1}] qty ${it.qty} @ $${it.cost} → $${it.amount}` + (it.shipping ? ` (+ship $${it.shipping})` : ''));
  });
  console.log('  log:', logPath);

  if (!EXECUTE) {
    console.log('\nDry run only. To apply: node restore-in12946.js --execute');
    process.exit(0);
  }

  const activityEntry = {
    action: 'edited',
    details: `${items.length} items, total $${HOUZZ_TOTAL.toLocaleString('en-US', { minimumFractionDigits: 2 })} (IN-12946 recon restore)`,
    userName: 'restore-in12946.js',
    userEmail: 'restore-in12946.js',
    timestamp: patch.lastEditedAt,
  };
  const activityLog = Array.isArray(prev.activityLog) ? prev.activityLog.slice() : [];
  activityLog.push(activityEntry);
  patch.activityLog = activityLog;

  await ref.update(patch);
  console.log('\nDone. Refresh IN-12946 in Studio.');
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
