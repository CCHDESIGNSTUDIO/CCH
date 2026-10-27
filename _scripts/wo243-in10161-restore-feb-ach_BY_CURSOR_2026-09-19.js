/**
 * WO-243 PRODUCTION: IN-10161 — drop Studio July 17 $5k Check; restore
 * second Houzz ACH from Jul 5 backup (py_3T1ZR2FdCE6n8elI0nX1AeRI).
 * Money total stays $10,000 paid. Items / tax / invoice total untouched.
 *
 *   node _scripts\wo243-in10161-restore-feb-ach_BY_CURSOR_2026-09-19.js
 *   node _scripts\wo243-in10161-restore-feb-ach_BY_CURSOR_2026-09-19.js --apply
 */
'use strict';
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const APPLY = process.argv.includes('--apply');
const BOARD = 'west-avalon';
const INV_ID = 'vEsvMohWndbv6HqXMd8a';
const INV_NUM = 'IN-10161';
const DROP_ID = 'pay_1783968333086';
const KEEP_REF = 'py_3T1a0fFdCE6n8elI1ZmLhB2O';
const RESTORE_REF = 'py_3T1ZR2FdCE6n8elI0nX1AeRI';

const KEY = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
const db = admin.initializeApp({ credential: admin.credential.cert(require(KEY)) }, 'wo243pay').firestore();

function slimPay(p) {
  if (!p || typeof p !== 'object') return p;
  const o = {};
  Object.keys(p).forEach((k) => {
    const v = p[k];
    if (v && typeof v.toDate === 'function') o[k] = v.toDate().toISOString();
    else o[k] = v;
  });
  return o;
}

function payRef(p) {
  p = p || {};
  return String(p.ref || p.reference || p.id || p.qbPaymentId || '').trim();
}

function withStableId(p, py) {
  const next = Object.assign({}, p);
  next.ref = py;
  next.reference = py;
  next.id = py;
  next.method = 'ACH';
  next.source = 'houzz-new';
  return next;
}

(async function main() {
  const ref = db.collection('boards').doc(BOARD).collection('invoices').doc(INV_ID);
  const snap = await ref.get();
  if (!snap.exists) throw new Error('invoice missing: ' + INV_ID);
  const inv = snap.data() || {};
  const num = String(inv.invoiceNum || inv.number || '').trim();
  if (num !== INV_NUM) throw new Error('invoiceNum mismatch: ' + num);

  const payments = Array.isArray(inv.payments) ? inv.payments.slice() : [];
  const keepIdx = payments.findIndex((p) => payRef(p) === KEEP_REF);
  const dropIdx = payments.findIndex((p) => String(p.id || '') === DROP_ID ||
    (String(p.date || '').indexOf('2026-07-17') >= 0 && Number(p.amount) === 5000));
  const alreadyRestored = payments.some((p) => payRef(p) === RESTORE_REF);

  if (keepIdx < 0) throw new Error('first Houzz ACH missing: ' + KEEP_REF);
  if (alreadyRestored && dropIdx < 0) throw new Error('already restored; nothing to do');
  if (dropIdx < 0) throw new Error('July 17 Studio check not found (id ' + DROP_ID + ')');
  if (alreadyRestored) throw new Error('second ACH already present AND July check still there — abort');

  const keep = withStableId(payments[keepIdx], KEEP_REF);
  if (!keep.date) keep.date = '02/15/2026';
  keep.amount = 5000;
  if (!keep.importedAt) keep.importedAt = '2026-03-29T00:28:05.909Z';

  const restored = {
    date: '02/15/2026',
    amount: 5000,
    method: 'ACH',
    ref: RESTORE_REF,
    reference: RESTORE_REF,
    id: RESTORE_REF,
    source: 'houzz-new',
    importedAt: '2026-03-29T00:28:05.909Z',
    _wo243RestoredAt: new Date().toISOString()
  };

  const nextPays = payments.map((p, i) => {
    if (i === keepIdx) return keep;
    if (i === dropIdx) return restored;
    return p;
  });

  const sum = Math.round(nextPays.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0) * 100) / 100;
  if (Math.abs(sum - 10000) > 0.01) throw new Error('paid sum would be ' + sum + ' not 10000');

  const planned = {
    path: ref.path,
    invoiceNum: num,
    status: inv.status,
    total: inv.total,
    paidAmountBefore: inv.paidAmount,
    datePaid: inv.datePaid || '',
    paymentsBefore: payments.map(slimPay),
    paymentsAfter: nextPays.map(slimPay),
    paidAmountAfter: sum,
    itemsTouched: false
  };
  console.log(JSON.stringify({ apply: APPLY, planned }, null, 2));

  if (!APPLY) {
    console.log('DRY RUN — pass --apply to write');
    process.exit(0);
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(__dirname, '..', '_backup', 'wo243-in10161-payments-' + stamp);
  fs.mkdirSync(backupDir, { recursive: true });
  fs.writeFileSync(path.join(backupDir, 'invoice.json'), JSON.stringify({ id: INV_ID, data: inv }, null, 2));

  await ref.update({
    payments: nextPays,
    paidAmount: sum,
    totalPaid: sum,
    paymentCount: nextPays.length,
    _wo243PaymentFixAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  const after = await ref.get();
  const x = after.data() || {};
  console.log(JSON.stringify({
    backupDir,
    wrote: true,
    payments: (x.payments || []).map(slimPay),
    paidAmount: x.paidAmount,
    total: x.total,
    status: x.status
  }, null, 2));
})().catch((e) => { console.error(e); process.exit(1); });
