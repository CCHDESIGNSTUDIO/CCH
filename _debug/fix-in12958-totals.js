#!/usr/bin/env node
/**
 * Fix IN-12958: match Houzz line (150 × $71.50), single shipping $1,900, total $13,643.88 paid.
 *   node fix-in12958-totals.js           # dry-run
 *   node fix-in12958-totals.js --execute
 */
'use strict';

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const EXECUTE = process.argv.includes('--execute');
const BOARD = 'cloud-rolling-hills';
const INVOICE_NUM = 'IN-12958';
const HOUZZ_TOTAL = 13643.88;
const HOUZZ_PAID = 13643.88;
const TAX_RATE = 9.5;

const KEY = path.join(__dirname, 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');

const LINE = {
  title: 'Soapstone slabs & backsplash',
  description:
    'Belvedere 2 1/2 slabs. Mudroom Countertop and backsplash. Laundry - countertops. Butler Pantry - Fabrication & Installation not included. Forklift required for delivery - delivery to fabricator.',
  qty: 150,
  rate: 71.5,
  unitPrice: 71.5,
  cost: 71.5,
  amount: 10725,
  markupPct: 0,
  shipping: 1900,
  taxable: true,
  expenseType: 'product',
  itemType: 'product',
};

function computedTotal(inv) {
  const items = inv.items || [];
  let sub = 0;
  let taxable = 0;
  let ship = 0;
  items.forEach((it) => {
    const qty = parseFloat(it.qty) || 1;
    const rate = parseFloat(it.rate) || parseFloat(it.unitPrice) || parseFloat(it.cost) || 0;
    let amt = parseFloat(it.amount) || 0;
    if (!amt && rate > 0) amt = Math.round(rate * qty * 100) / 100;
    const mk = parseFloat(it.markupPct) || 0;
    if (!amt && parseFloat(it.cost) > 0) {
      amt = Math.round(parseFloat(it.cost) * qty * (1 + mk / 100) * 100) / 100;
    }
    sub += amt;
    ship += parseFloat(it.shipping) || 0;
    if (it.taxable !== false) taxable += amt;
  });
  const taxR = parseFloat(inv.taxRate) || 0;
  const tax = taxable * (taxR / 100);
  return Math.round((sub + ship + tax) * 100) / 100;
}

(async () => {
  admin.initializeApp({ credential: admin.credential.cert(require(KEY)) });
  const db = admin.firestore();
  const snap = await db.collection('boards').doc(BOARD).collection('invoices').get();
  let ref = null;
  let prev = null;
  snap.forEach((d) => {
    const x = d.data();
    const n = String(x.number || x.invoiceNum || d.id).trim().toUpperCase();
    if (n === INVOICE_NUM) {
      ref = d.ref;
      prev = x;
    }
  });
  if (!ref) {
    console.error(INVOICE_NUM, 'not found on', BOARD);
    process.exit(1);
  }

  const p0 = (prev.items || [])[0] || {};
  const item = {
    ...LINE,
    vendor: p0.vendor || 'Ron & Tracey Cloud',
    category: p0.category || 'Stone',
    room: p0.room || '',
    imageUrl: p0.imageUrl || null,
    images: p0.images ? p0.images.slice() : [],
    houzzId: p0.houzzId || '',
    sku: p0.sku || '',
    lineNotes: p0.lineNotes || '',
    _in12958TotalsFixedAt: new Date().toISOString(),
  };

  const items = [item];
  const subtotal = LINE.amount;
  const lineShip = LINE.shipping;
  const taxAmt = Math.round(subtotal * (TAX_RATE / 100) * 100) / 100;

  const patch = {
    items,
    total: HOUZZ_TOTAL,
    paidAmount: HOUZZ_PAID,
    invoiceBalance: 0,
    subtotal,
    shipping: 0,
    taxRate: TAX_RATE,
    status: prev.status || 'Paid',
    updatedAt: new Date().toISOString(),
    lastEditedAt: new Date().toISOString(),
    lastEditedBy: 'fix-in12958-totals.js',
    _in12958TotalsFixedAt: new Date().toISOString(),
  };

  const preview = { ...prev, ...patch };
  const comp = computedTotal(preview);

  console.log(INVOICE_NUM + ' totals fix (' + (EXECUTE ? 'EXECUTE' : 'DRY RUN') + ')');
  console.log('  docId:', ref.id);
  console.log('  before total:', prev.total, 'items:', (prev.items || []).length);
  if ((prev.items || [])[0]) {
    const o = prev.items[0];
    console.log('  before line:', { qty: o.qty, cost: o.cost, markupPct: o.markupPct, shipping: o.shipping, amount: o.amount });
  }
  console.log('  after  total:', HOUZZ_TOTAL, 'subtotal:', subtotal, 'tax:', taxAmt, 'ship:', lineShip);
  console.log('  computed check:', comp, Math.abs(comp - HOUZZ_TOTAL) < 0.02 ? 'OK' : 'MISMATCH');

  if (!EXECUTE) {
    console.log('\nRun: node fix-in12958-totals.js --execute');
    process.exit(0);
  }

  const logPath = path.join(__dirname, 'fix-in12958-totals-apply-' + Date.now() + '.json');
  fs.writeFileSync(logPath, JSON.stringify({ docId: ref.id, patch, computed: comp, before: { total: prev.total, items: prev.items } }, null, 2));
  await ref.update(patch);
  console.log('  log:', logPath);
  console.log('Done.');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
