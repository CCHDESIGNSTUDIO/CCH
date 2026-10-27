/**
 * Render DS Client View HTML for the golden fixture (no Firebase).
 * Writes Docs/golden/ds-invoice-expenses/v1/client-view.html
 * Usage: node _scripts/render-ds-expense-golden_BY_CURSOR.js
 */
'use strict';
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var root = path.join(__dirname, '..');
var fixturePath = path.join(root, 'Docs', 'golden', 'ds-invoice-expenses', 'v1', 'FIXTURE.json');
var outPath = process.env.CCH_GOLDEN_OUT
  || path.join(root, 'Docs', 'golden', 'ds-invoice-expenses', 'v1', 'client-view.html');
var redesignPath = path.join(root, 'platform', 'cch-invoice-redesign.js');

var fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
var sandbox = {
  window: {},
  global: {},
  console: console,
  parseFloat: parseFloat,
  Math: Math,
  Date: Date,
  String: String,
  Array: Array,
  Object: Object,
  isNaN: isNaN,
  JSON: JSON
};
sandbox.global = sandbox;
sandbox.window = sandbox;

sandbox.formatMoney = function (n) {
  var v = parseFloat(n) || 0;
  return '$' + v.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};
sandbox.esc = function (s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
};
sandbox.isProposalGroupHeaderItem = function () { return false; };
sandbox.cchIsClientSalesTaxLine = function () { return false; };
sandbox.cchIsCreditLineType = function () { return false; };
sandbox.invoiceLineDisplayTitle = function (it) { return (it && (it.title || it.name)) || 'Item'; };
sandbox.invoiceLineAmountForTotals = function (it) {
  var qty = parseFloat(it.qty) || 1;
  var cost = parseFloat(it.cost) || 0;
  var amt = parseFloat(it.amount) || 0;
  if (cost > 0) return { lineAmt: Math.round(cost * qty * 100) / 100 };
  return { lineAmt: amt };
};
sandbox.cchLineNotesBodyText = function (it) { return String((it && (it.lineNotes || it.notes)) || '').trim(); };
sandbox.cchLineExplicitNotesText = sandbox.cchLineNotesBodyText;
sandbox.cchStripDateOnlyNoteLines = function (t) { return String(t || '').trim(); };
sandbox.sanitizeInvoicePreviewLineText = function (t) { return t; };
sandbox.cchInvoiceClientDisplayStatus = function () { return 'Draft'; };
sandbox.invoiceViewTotals = function (doc, items) {
  var sub = 0;
  (items || []).forEach(function (it) {
    sub += sandbox.invoiceLineAmountForTotals(it).lineAmt;
  });
  return { grandTotal: sub, subtotal: sub, credits: [], creditTotal: 0, tax: 0, totalShipping: 0, taxRate: 0 };
};
sandbox.invoiceDocPaymentSummary = function (doc, gt) {
  return { rows: [], totalPaid: 0, balance: gt, grandTotal: gt };
};

/* Mirror platform cchInvoiceLineKind (type-only) for offline render. */
var CCH_EXPENSE_PRODUCT_BILLING = {
  't&e': 1, 'travel & entertainment': 1, 'travel and entertainment': 1,
  'reimbursable expense': 1, 'reimbursable': 1,
  'print & post': 1, 'print and post': 1,
  'handling & packing': 1, 'packing fee': 1,
  'shipping & handling': 1, 'freight & delivery': 1
};
sandbox.cchNormBillingCategory = function (s) {
  return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
};
sandbox.cchInvoiceLineKind = function (it) {
  if (!it) return 'other';
  var et = String(it.expenseType || '').toLowerCase().trim();
  var itype = String(it.itemType || '').toLowerCase().trim();
  var bc = sandbox.cchNormBillingCategory(it.billingCategory);
  if (et === 'retainer_credit' || et === 'discount') return 'credit';
  if (et === 'sales_tax') return 'prepaid_tax';
  if (et === 'expense' || et === 'other_expense' || et === 'shipping' || et === 'handling' || et === 'freight') return 'expense_product';
  if (bc && CCH_EXPENSE_PRODUCT_BILLING[bc]) return 'expense_product';
  if (et === 'product' || itype === 'product' || itype === 'ffe') return 'product';
  if (et === 'service' || itype === 'service') return 'service';
  return 'service';
};

var code = fs.readFileSync(redesignPath, 'utf8');
vm.runInNewContext(code, sandbox, { filename: 'cch-invoice-redesign.js' });

var html = sandbox.cchBuildDesignServicesInvoiceInner(
  fixture.docData,
  fixture.items,
  fixture.proj,
  fixture.projectId,
  fixture.docNum,
  '2026-07-30'
);

var banner = '<!-- GOLDEN v1 FABLE_DECISION_ds-invoice-expenses_CW_Jul30 — do not edit by hand; regenerate via render-ds-expense-golden_BY_CURSOR.js -->\n';
fs.writeFileSync(outPath, banner + html, 'utf8');
console.log('Wrote', outPath);
console.log('bytes', Buffer.byteLength(banner + html));
