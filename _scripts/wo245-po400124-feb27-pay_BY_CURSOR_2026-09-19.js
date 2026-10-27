/**
 * WO-245 PRODUCTION: PO-400124 — add Feb 27 vendor payment $10,367.50.
 * Cindy: she paid $10,367.50 on 2/27. The $20,735 row is already gone;
 * only the Feb 26 Deposit $10,367.50 remains. Do not touch lines or IN-10161.
 *
 *   node _scripts\wo245-po400124-feb27-pay_BY_CURSOR_2026-09-19.js
 *   node _scripts\wo245-po400124-feb27-pay_BY_CURSOR_2026-09-19.js --apply
 */
'use strict';
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const APPLY = process.argv.includes('--apply');
const BOARD = 'west-avalon';
const PO_ID = 'gbiAgUUR5lp1baB3MZO4';
const PO_NUM = 'PO-400124';
const AMT = 10367.5;
const DATE = '2026-02-27';

const KEY = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
const db = admin.initializeApp({ credential: admin.credential.cert(require(KEY)) }, 'wo245pay').firestore();

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

(async function main() {
  const ref = db.collection('boards').doc(BOARD).collection('purchaseOrders').doc(PO_ID);
  const snap = await ref.get();
  if (!snap.exists) throw new Error('PO missing: ' + PO_ID);
  const po = snap.data() || {};
  const num = String(po.poNum || po.number || '').trim();
  if (num !== PO_NUM) throw new Error('poNum mismatch: ' + num);

  const payments = Array.isArray(po.payments) ? po.payments.slice() : [];
  const already = payments.some((p) => {
    const d = String(p.date || '').slice(0, 10);
    const a = Math.round((parseFloat(p.amount) || 0) * 100) / 100;
    return (d === DATE || d === '02/27/2026') && Math.abs(a - AMT) < 0.02;
  });
  if (already) throw new Error('Feb 27 $10,367.50 already present — abort');

  const now = new Date().toISOString();
  const row = {
    id: 'pay_' + Date.now(),
    amount: AMT,
    date: DATE,
    method: 'ACH/Wire',
    note: '',
    reference: '',
    vendorInvoiceNumber: '66640',
    recordedAt: now,
    source: 'po_bill_variance',
    _wo245PayFixAt: now
  };
  payments.push(row);

  const totalPaid = Math.round(payments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0) * 100) / 100;
  const billTotal = parseFloat((po.bill && po.bill.billTotal) != null ? po.bill.billTotal : po.total) || 0;
  const balance = Math.round((billTotal - totalPaid) * 100) / 100;
  const fullyPaid = billTotal > 0.01 && totalPaid >= billTotal - 0.02;

  const patch = {
    payments,
    paidAmount: totalPaid,
    paymentCount: payments.length,
    balance,
    updatedAt: now,
    _wo245PayFixAt: now
  };
  if (fullyPaid) {
    patch.poStatus = 'paid';
    patch.paymentStatus = 'paid';
  } else if (totalPaid > 0.02) {
    patch.paymentStatus = 'partial';
  }

  console.log(JSON.stringify({
    apply: APPLY,
    path: ref.path,
    poNum: num,
    billTotal,
    paymentsBefore: (po.payments || []).map(slimPay),
    paymentsAfter: payments.map(slimPay),
    paidAmountBefore: po.paidAmount,
    paidAmountAfter: totalPaid,
    balanceAfter: balance,
    itemsTouched: false
  }, null, 2));

  if (!APPLY) {
    console.log('DRY RUN — pass --apply to write');
    process.exit(0);
  }

  const stamp = now.replace(/[:.]/g, '-');
  const backupDir = path.join(__dirname, '..', '_backup', 'wo245-po400124-pay-' + stamp);
  fs.mkdirSync(backupDir, { recursive: true });
  fs.writeFileSync(path.join(backupDir, 'po.json'), JSON.stringify({ id: PO_ID, data: po }, null, 2));

  await ref.update(patch);
  const after = (await ref.get()).data() || {};
  console.log(JSON.stringify({
    backupDir,
    wrote: true,
    payments: (after.payments || []).map(slimPay),
    paidAmount: after.paidAmount,
    balance: after.balance,
    paymentStatus: after.paymentStatus,
    total: after.total
  }, null, 2));
})().catch((e) => { console.error(e); process.exit(1); });
