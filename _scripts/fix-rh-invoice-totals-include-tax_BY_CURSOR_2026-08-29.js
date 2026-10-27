/**
 * PRODUCTION: Cloud Rolling Hills invoices whose stored total is merchandise-only
 * (tax shown separately, not added). Writes tax-inclusive total. Does not push QB.
 *
 *   node _scripts\fix-rh-invoice-totals-include-tax_BY_CURSOR_2026-08-29.js
 *   node _scripts\fix-rh-invoice-totals-include-tax_BY_CURSOR_2026-08-29.js --apply
 */
'use strict';
const path = require('path');
const admin = require('firebase-admin');
const taxRules = require('../platform/cch-invoice-tax-rules.js');
const KEY = path.join(__dirname, '..', '_debug', 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
const app = admin.initializeApp({ credential: admin.credential.cert(require(KEY)) }, 'fixRhTax');
const db = app.firestore();
const BOARD = 'cloud-rolling-hills';
const APPLY = process.argv.indexOf('--apply') >= 0;

function num2(n) {
  return Math.round((parseFloat(n) || 0) * 100) / 100;
}

function isGroup(it) {
  if (!it) return true;
  if (it.isGroupHeader || it._isGroupHeader || it.itemType === 'group' || it.lineType === 'group') return true;
  return false;
}

function isClientTaxLine(it) {
  if (!it) return false;
  if (it._cchClientSalesTaxLine === true || it._cchAutoSalesTax === true) return true;
  var et = String(it.expenseType || '').toLowerCase();
  if (et !== 'sales_tax') return false;
  if (it._cchVendorPrepaidTax === true) return false;
  return true;
}

function isCredit(it) {
  var et = String((it && it.expenseType) || '').toLowerCase();
  return et === 'discount' || et === 'retainer_credit';
}

function lineAmt(it) {
  var qty = parseFloat(it.qty) || 1;
  var cost = parseFloat(it.cost) || 0;
  var mkup = parseFloat(it.markupPct) || 0;
  var sell = parseFloat(it.amount);
  if (!sell) sell = 0;
  if (isCredit(it)) {
    var c = parseFloat(it.amount);
    if (isNaN(c)) c = parseFloat(it.cost) || 0;
    if (it.expenseType === 'retainer_credit' && c > 0) c = -Math.abs(c);
    return c;
  }
  if (cost === 0 && sell !== 0) return sell;
  return cost * qty * (1 + mkup / 100);
}

(async function main() {
  const snap = await db.collection('boards').doc(BOARD).collection('invoices').get();
  const rows = [];
  snap.forEach(function (d) {
    const x = d.data() || {};
    const num = String(x.invoiceNum || x.number || d.id);
    if (!/^INV-/i.test(num)) return;
    const st = String(x.status || '').toLowerCase();
    if (st === 'void' || st === 'voided') return;
    let subtotal = 0;
    let taxable = 0;
    let credits = 0;
    let ship = 0;
    (x.items || []).forEach(function (it) {
      if (isGroup(it) || isClientTaxLine(it)) return;
      const amt = lineAmt(it);
      if (isCredit(it)) {
        credits += amt;
        return;
      }
      subtotal += amt;
      ship += parseFloat(it.shipping) || 0;
      if (taxRules.cchCaliforniaInvoiceLineIsTaxable(it)) taxable += amt;
    });
    ship += parseFloat(x.docShipping) || 0;
    const rateUsed = (parseFloat(x.taxRate) > 0) ? parseFloat(x.taxRate) : 9.75;
    const taxFromAmt = num2(x.taxAmount || x.tax);
    const taxCalc = num2(taxable * (rateUsed / 100));
    const tax = taxFromAmt > 0.01 ? taxFromAmt : taxCalc;
    const merch = num2(subtotal + ship + credits);
    const stored = num2(x.total);
    const paid = (x.payments || []).reduce(function (s, p) { return s + (parseFloat(p.amount) || 0); }, 0);
    const isPaid = st === 'paid' || paid >= stored - 0.02;
    const rateMissing = !(parseFloat(x.taxRate) > 0);
    const merchOnly = rateMissing && taxFromAmt > 0.01 && !isPaid;
    const grand = merchOnly ? num2(stored + taxFromAmt) : num2(merch + tax);
    rows.push({
      id: d.id,
      num: num,
      status: x.status,
      stored: stored,
      merch: merch,
      tax: tax,
      taxRate: rateUsed,
      grand: grand,
      merchOnly: merchOnly,
      isPaid: isPaid,
      qbDocId: x.qbDocId || '',
      square: !!String(x.squareCheckoutUrl || '').trim()
    });
  });
  const fix = rows.filter(function (r) { return r.merchOnly && !r.isPaid; });
  console.log('all_inv', rows.length, 'merch_only_unpaid', fix.length);
  rows.sort(function (a, b) { return String(a.num).localeCompare(String(b.num)); });
  rows.forEach(function (r) {
    if (!r.merchOnly && r.tax < 0.01) return;
    console.log(JSON.stringify({
      num: r.num,
      status: r.status,
      stored: r.stored,
      merch: r.merch,
      tax: r.tax,
      grand: r.grand,
      merchOnly: r.merchOnly,
      paid: r.isPaid,
      qb: !!r.qbDocId,
      square: r.square
    }));
  });
  if (!APPLY) {
    console.log('DRY RUN targets', fix.map(function (f) { return f.num + ' ' + rMoney(f.stored) + ' -> ' + rMoney(f.grand); }));
    process.exit(0);
  }
  for (var i = 0; i < fix.length; i++) {
    var f = fix[i];
    await db.collection('boards').doc(BOARD).collection('invoices').doc(f.id).update({
      taxRate: f.taxRate > 0 ? f.taxRate : 9.75,
      taxAmount: f.tax,
      tax: f.tax,
      total: f.grand,
      _taxInclusiveTotalAt: new Date().toISOString(),
      _taxInclusiveFrom: f.stored,
      updatedAt: new Date().toISOString()
    });
    console.log('APPLIED', f.num, f.stored, '->', f.grand);
  }
  process.exit(0);
})().catch(function (e) {
  console.error(e && e.message ? e.message : e);
  process.exit(1);
});

function rMoney(n) {
  return (Number(n) || 0).toFixed(2);
}
