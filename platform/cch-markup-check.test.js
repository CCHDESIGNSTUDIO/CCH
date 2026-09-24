/**
 * WO-122 markup check — node tests. No Firestore, no price writes.
 * Run: node platform/cch-markup-check.test.js
 */
'use strict';

var assert = require('assert');
var m = require('./cch-markup-check.js');

function line(extra) {
  var row = {
    title: 'Pull',
    vendor: 'Mix',
    sku: 'MIX1',
    room: 'Kitchen',
    qty: 1,
    expenseType: 'product'
  };
  Object.keys(extra || {}).forEach(function (k) { row[k] = extra[k]; });
  return row;
}

var failures = 0;
function check(name, fn) {
  try {
    fn();
    console.log('ok  ' + name);
  } catch (e) {
    failures++;
    console.error('FAIL ' + name);
    console.error(e && e.stack ? e.stack : e);
  }
}

check('nearest nickel of 20% counts as 20%', function () {
  var cost = 819;
  var exact = 819 * 1.2;
  var nickel = m.roundNickel(exact);
  assert.strictEqual(nickel, 982.8);
  assert.strictEqual(m.priceMatchesRate(cost, nickel, 20, line()), true);
});

check('nearest dollar of 20% counts as 20%', function () {
  assert.strictEqual(m.priceMatchesRate(819, 983, 20, line()), true);
});

check('ceil to next $5 of 20% counts as 20%', function () {
  assert.strictEqual(m.roundUp5(982.8), 985);
  assert.strictEqual(m.priceMatchesRate(819, 985, 20, line()), true);
});

check('a real 28% does not count as 20 or 35', function () {
  var unit = Math.round(100 * 1.28 * 100) / 100;
  assert.strictEqual(m.priceMatchesRate(100, unit, 20, line()), false);
  assert.strictEqual(m.priceMatchesRate(100, unit, 35, line()), false);
  var issues = m.analyzeItems([line({ cost: 100, clientPrice: unit, amount: unit })], {}, { status: 'Draft' }, 'proposals');
  assert.ok(issues.length === 1);
  assert.ok(/not an allowed rate/i.test(issues[0].reasons.join(' ')));
});

check('no client price, equal cost, and below cost are flagged', function () {
  var none = m.analyzeItems([line({ cost: 40, clientPrice: 0, amount: 0 })], {}, { status: 'Draft' }, 'proposals');
  assert.ok(/No client price/.test(none[0].reasons.join(' ')));
  var same = m.analyzeItems([line({ cost: 40, clientPrice: 40, amount: 40 })], {}, { status: 'Draft' }, 'proposals');
  assert.ok(/equals cost/.test(same[0].reasons.join(' ')));
  var under = m.analyzeItems([line({ cost: 40, clientPrice: 30, amount: 30 })], {}, { status: 'Draft' }, 'proposals');
  assert.ok(/below cost/.test(under[0].reasons.join(' ')));
});

check('project default is an allowed rate', function () {
  m.setStudioRatesForTest([20, 35]);
  var unit = 130;
  var issues = m.analyzeItems(
    [line({ cost: 100, clientPrice: unit, amount: unit })],
    { defaultProductMarkupPct: 30 },
    { status: 'Draft' },
    'proposals'
  );
  assert.strictEqual(issues.length, 0);
});

check('same SKU at two client prices is flagged', function () {
  var a = line({ room: 'Kitchen', cost: 819, clientPrice: 985, amount: 985 });
  var b = line({ room: 'Bar', cost: 819, clientPrice: 819, amount: 819 });
  var issues = m.analyzeItems([a, b], {}, { status: 'Draft' }, 'proposals');
  assert.ok(issues.some(function (iss) { return /priced differently/.test(iss.reasons.join(' ')); }));
});

check('paid invoice is locked and not prompted as a row to fix', function () {
  var doc = { status: 'Sent', payments: [{ amount: 500 }], items: [] };
  var lock = m.priceLock(doc, 'invoices', null);
  assert.strictEqual(lock.docLocked, true);
  assert.ok(/payment/.test(lock.reason));
  var issues = m.analyzeItems(
    [line({ cost: 100, clientPrice: 128, amount: 128 })],
    {},
    doc,
    'invoices'
  );
  assert.strictEqual(issues.length, 0);
});

check('Paid status, partial payment, QB paid, approved, and signed lock the document', function () {
  assert.strictEqual(m.priceLock({ status: 'Paid' }, 'invoices', null).docLocked, true);
  assert.strictEqual(m.priceLock({ status: 'Partially Paid', paidAmount: 10 }, 'invoices', null).docLocked, true);
  assert.strictEqual(m.priceLock({ status: 'Sent', qbStatus: 'paid' }, 'invoices', null).docLocked, true);
  assert.strictEqual(m.priceLock({ status: 'Approved' }, 'proposals', null).docLocked, true);
  assert.strictEqual(m.priceLock({ status: 'Draft', clientApprovedTotalAt: '2026-05-01T00:00:00.000Z' }, 'proposals', null).docLocked, true);
  assert.strictEqual(m.priceLock({ status: 'Signed' }, 'proposals', null).docLocked, true);
  assert.strictEqual(m.priceLock({ status: 'Draft' }, 'proposals', null).docLocked, false);
  assert.strictEqual(m.priceLock({ status: 'Published' }, 'proposals', null).docLocked, false);
  assert.strictEqual(m.priceLock({ status: 'Sent' }, 'invoices', null).docLocked, false);
});

check('an invoiced proposal line is locked even when the proposal still has open lines', function () {
  globalThis.proposalLineIsInvoiced = function (item) { return !!item.invoicedOnInvoiceId; };
  globalThis.proposalHasEditableUninvoicedLines = function () { return true; };
  var doc = { status: 'Partially Invoiced' };
  var invoiced = line({ invoicedOnInvoiceId: 'inv1', cost: 10, clientPrice: 10, amount: 10 });
  var open = line({ sku: 'OTHER', title: 'Other', cost: 10, clientPrice: 10, amount: 10 });
  assert.strictEqual(m.priceLock(doc, 'proposals', invoiced).lineLocked, true);
  assert.strictEqual(m.priceLock(doc, 'proposals', open).locked, false);
  var issues = m.analyzeItems([invoiced, open], {}, doc, 'proposals');
  assert.ok(issues.every(function (iss) { return iss.title !== 'Pull'; }));
  delete globalThis.proposalLineIsInvoiced;
  delete globalThis.proposalHasEditableUninvoicedLines;
});

check('group headers, freight, and tax lines are not flagged', function () {
  var issues = m.analyzeItems([
    { lineKind: 'group', title: 'Kitchen', amount: 0 },
    { expenseType: 'freight', title: 'Freight', cost: 40, amount: 40, qty: 1 },
    { expenseType: 'sales_tax', title: 'Tax', cost: 0, amount: 10, qty: 1 }
  ], {}, { status: 'Draft' }, 'proposals');
  assert.strictEqual(issues.length, 0);
});

if (failures) {
  console.error(failures + ' failed');
  process.exit(1);
}
console.log('all passed');
