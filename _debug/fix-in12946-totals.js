#!/usr/bin/env node
/**
 * Fix IN-12946 double-shipping + markup drift so list/detail match Houzz $43,115.48.
 *   node fix-in12946-totals.js           # dry-run
 *   node fix-in12946-totals.js --execute
 */
'use strict';

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const EXECUTE = process.argv.includes('--execute');
const DOC = 'boards/cloud-rolling-hills/invoices/ayKQv4sEnjAiDaymije9';
const HOUZZ_TOTAL = 43115.48;
const HOUZZ_PAID = 43115.48;

const LINES = [
  { title: 'Lakeview Signature', description: '16"  Electric - Sides of house &  pool house', qty: 12, cost: 1010, amount: 12120, shipping: 0 },
  { title: 'Lakeview Signature', description: '23" Electric - Patio & Master bedroom / Side of Large garage\nManual Control\nD. Oxidation \nFlushmount with Copper Rear channel', qty: 7, cost: 1205, amount: 8435, shipping: 0 },
  { title: 'Lakeview Signature', description: '23" Gas   GARAGE & SIDE SCONCES @ ENTRY\nD.  Oxidation \nElectronic Igniter', qty: 8, cost: 1685, amount: 13480, shipping: 0 },
  { title: 'Lakeview Signature', description: '27" Gas - ENTRY \r\nElectronic Igniter \r\nDark Oxidation - Oil Rubbed Bronze (Very Close to Black) \r\nFlush Mount (With Copper Rear Channel)  USD\r\n\r\nCurrent Estimated Lead Time: 10-12 weeks', qty: 2, cost: 1985, amount: 3970, shipping: 1500 },
];

const KEY = path.join(__dirname, 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');

function computedTotal(inv) {
  const items = inv.items || [];
  let sub = 0;
  let taxable = 0;
  let ship = 0;
  items.forEach((it) => {
    const amt = parseFloat(it.amount) || 0;
    const sh = parseFloat(it.shipping) || 0;
    sub += amt;
    ship += sh;
    if (it.taxable !== false) taxable += amt;
  });
  const rate = parseFloat(inv.taxRate) || 0;
  const tax = taxable * (rate / 100);
  return Math.round((sub + ship + tax) * 100) / 100;
}

(async () => {
  admin.initializeApp({ credential: admin.credential.cert(require(KEY)) });
  const ref = admin.firestore().doc(DOC);
  const snap = await ref.get();
  const prev = snap.data();
  const p0 = (prev.items || [])[0] || {};

  const items = LINES.map((l) => ({
    title: l.title,
    description: l.description,
    vendor: p0.vendor || 'Flambeaux',
    category: p0.category || 'Exterior',
    room: p0.room || '',
    qty: l.qty,
    cost: l.cost,
    markupPct: 0,
    shipping: l.shipping,
    amount: l.amount,
    taxable: true,
    imageUrl: p0.imageUrl || '',
    images: p0.images ? p0.images.slice() : [],
    houzzId: p0.houzzId || '',
    lineNotes: p0.lineNotes || '',
    _in12946TotalsFixedAt: new Date().toISOString(),
  }));

  const subtotal = items.reduce((s, it) => s + it.amount, 0);
  const lineShip = items.reduce((s, it) => s + (it.shipping || 0), 0);
  const taxAmt = Math.round((HOUZZ_TOTAL - subtotal - lineShip) * 100) / 100;
  const taxRate = subtotal > 0 ? Math.round((taxAmt / subtotal) * 10000) / 100 : 0;

  const patch = {
    items,
    total: HOUZZ_TOTAL,
    paidAmount: HOUZZ_PAID,
    invoiceBalance: 0,
    subtotal,
    shipping: 0,
    taxRate,
    updatedAt: new Date().toISOString(),
    lastEditedAt: new Date().toISOString(),
    lastEditedBy: 'fix-in12946-totals.js',
    _in12946TotalsFixedAt: new Date().toISOString(),
  };

  const preview = { ...prev, ...patch };
  const comp = computedTotal(preview);

  console.log('IN-12946 totals fix (' + (EXECUTE ? 'EXECUTE' : 'DRY RUN') + ')');
  console.log('  before total:', prev.total, 'items:', (prev.items || []).length);
  console.log('  after  total:', HOUZZ_TOTAL, 'items:', items.length);
  console.log('  subtotal:', subtotal, 'line shipping:', lineShip, 'tax $', taxAmt, 'taxRate %', taxRate);
  console.log('  computed check:', comp, comp === HOUZZ_TOTAL ? 'OK' : 'MISMATCH');

  if (!EXECUTE) {
    console.log('\nRun: node fix-in12946-totals.js --execute');
    process.exit(0);
  }

  const log = path.join(__dirname, 'fix-in12946-totals-apply-' + Date.now() + '.json');
  fs.writeFileSync(log, JSON.stringify({ patch, computed: comp }, null, 2));
  await ref.update(patch);
  console.log('  log:', log);
  console.log('Done.');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
