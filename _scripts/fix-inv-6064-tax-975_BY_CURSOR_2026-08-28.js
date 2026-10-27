/**
 * PRODUCTION: set INV-6064 taxRate 9.75% and rewrite taxAmount + total.
 * Dry-run default. Apply:
 *   node _scripts\fix-inv-6064-tax-975_BY_CURSOR_2026-08-28.js --apply
 */
'use strict';
const path = require('path');
const admin = require('firebase-admin');
const KEY = path.join(__dirname, '..', '_debug', 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
const app = admin.initializeApp({ credential: admin.credential.cert(require(KEY)) }, 'fix6064');
const db = app.firestore();
const BOARD = 'cloud-rolling-hills';
const APPLY = process.argv.indexOf('--apply') >= 0;

function num2(n) {
  return Math.round((parseFloat(n) || 0) * 100) / 100;
}

(async function main() {
  const snap = await db.collection('boards').doc(BOARD).collection('invoices').get();
  let ref = null;
  let x = null;
  snap.forEach(function (d) {
    const data = d.data() || {};
    if (String(data.invoiceNum || data.number || '') === 'INV-6064') {
      ref = d.ref;
      x = data;
    }
  });
  if (!ref) throw new Error('INV-6064 not found');

  let taxable = 0;
  let subtotal = 0;
  let creditTotal = 0;
  (x.items || []).forEach(function (it) {
    if (!it) return;
    const et = String(it.expenseType || '').toLowerCase();
    if (et === 'discount' || et === 'retainer_credit') {
      let creditAmt = parseFloat(it.amount);
      if (isNaN(creditAmt)) creditAmt = parseFloat(it.cost) || 0;
      creditTotal += creditAmt;
      return;
    }
    const qty = parseFloat(it.qty) || 1;
    const cost = parseFloat(it.cost) || 0;
    const mkup = parseFloat(it.markupPct) || 0;
    const sell = parseFloat(it.amount) || 0;
    let lineAmt;
    if (cost === 0 && sell !== 0) lineAmt = sell;
    else lineAmt = cost * qty * (1 + mkup / 100);
    subtotal += lineAmt;
    taxable += lineAmt;
  });
  creditTotal = num2(creditTotal);
  const tax = num2(taxable * (9.75 / 100));
  const grand = num2(subtotal + tax + creditTotal);
  const before = {
    taxRate: x.taxRate,
    taxAmount: x.taxAmount,
    total: x.total,
    qbDocId: x.qbDocId || '',
    qbSynced: !!x.qbSynced,
    status: x.status
  };
  const after = {
    taxRate: 9.75,
    taxAmount: tax,
    total: grand
  };
  console.log('BEFORE', JSON.stringify(before));
  console.log('MATH taxable', taxable, 'credit', creditTotal, 'tax9.75', tax, 'grand', grand);
  console.log('AFTER', JSON.stringify(after));
  console.log('DELTA total', num2(grand - (parseFloat(x.total) || 0)));
  if (!APPLY) {
    console.log('DRY RUN — pass --apply to write production INV-6064 only.');
    process.exit(0);
  }
  await ref.update({
    taxRate: 9.75,
    taxRatePreset: '9.75',
    taxAmount: tax,
    total: grand,
    _taxCorrectedAt: new Date().toISOString(),
    _taxCorrectedBy: 'cursor-inv-6064-975',
    _taxCorrectedFrom: {
      taxRate: before.taxRate,
      taxAmount: before.taxAmount,
      total: before.total
    },
    updatedAt: new Date().toISOString()
  });
  console.log('APPLIED production boards/' + BOARD + '/invoices/' + ref.id);
  process.exit(0);
})().catch(function (e) {
  console.error(e);
  process.exit(1);
});
