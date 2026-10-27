#!/usr/bin/env node
'use strict';
/** Read-only: Holtz Hill PO COGS vs invoice reconciliation (production Firestore). */
const path = require('path');
const admin = require('firebase-admin');

const KEY = path.join(__dirname, '..', '_debug', 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
const BOARD_ID = 'holtz-hill';

function money(n) { return Math.round((parseFloat(n) || 0) * 100) / 100; }
function fmt(n) { return '$' + money(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

function poDocTotal(po) {
  if (!po) return 0;
  var t = parseFloat(po.total);
  if (t > 0) return t;
  return (po.items || []).reduce(function (s, it) {
    var q = parseFloat(it.qty) || 1;
    var c = parseFloat(it.cost) || 0;
    var sh = parseFloat(it.shipping) || 0;
    var amt = parseFloat(it.amount) || 0;
    return s + (c > 0 ? c * q + sh : amt + sh);
  }, 0);
}

function poAtSend(po) {
  var bill = po.bill || {};
  if (bill.poTotalAtSend != null) return parseFloat(bill.poTotalAtSend) || 0;
  if (po.poTotalAtSend != null) return parseFloat(po.poTotalAtSend) || 0;
  return poDocTotal(po);
}

function vendorBillTotal(po) {
  var bill = po.bill || {};
  if (bill.billTotal != null && (bill.received || bill.qbBillId || (bill.vendorInvoices && bill.vendorInvoices.length))) {
    return parseFloat(bill.billTotal) || 0;
  }
  return 0;
}

function procurementLane(po) {
  if (po.poSentAt || po.poLocked) return po.procurementStatus === 'Confirmed' ? 'confirmed' : 'waiting';
  var st = String(po.status || po.poStatus || '').toLowerCase();
  if (['closed', 'paid', 'installed', 'received'].includes(st)) return 'legacy-closed';
  return 'draft';
}

function poCountsForProfit(po) {
  if (String(po.id || '').indexOf('clip-po-') === 0) return false;
  var lane = procurementLane(po);
  if (lane !== 'draft') return true;
  var st = String(po.status || po.poStatus || '').toLowerCase();
  return ['closed', 'paid', 'installed', 'received'].includes(st);
}

function vendorBillCostForProfit(po) {
  if (!poCountsForProfit(po)) return 0;
  var bill = po.bill || {};
  if (bill.received || bill.billTotal != null) {
    var bt = vendorBillTotal(po);
    if (bt > 0.01) return bt;
  }
  var baseline = poAtSend(po);
  return baseline > 0.01 ? baseline : 0;
}

function invoiceGrandTotal(inv) {
  if (typeof inv.grandTotal === 'number') return inv.grandTotal;
  if (typeof inv.total === 'number') return inv.total;
  var items = inv.items || inv.lineItems || [];
  if (items.length) return items.reduce(function (s, li) { return s + (parseFloat(li.total || li.amount) || 0); }, 0);
  return parseFloat(inv.amount) || 0;
}

function lineBreakdown(items) {
  var merch = 0, ship = 0, labor = 0, other = 0;
  (items || []).forEach(function (it) {
    var q = parseFloat(it.qty) || 1;
    var c = parseFloat(it.cost) || 0;
    var sh = parseFloat(it.shipping) || 0;
    var amt = c > 0 ? c * q + sh : (parseFloat(it.amount) || 0) + sh;
    var blob = (String(it.title || '') + ' ' + String(it.category || '') + ' ' + String(it.expenseType || '')).toLowerCase();
    if (/\binstall|labor|fabricat|upholster|workroom|drapery|window treatment|wallcover|bedding|wallpaper/.test(blob)) labor += amt;
    else if (/\bfreight|shipping|delivery|handling/.test(blob) || sh > 0) ship += amt;
    else merch += amt;
  });
  return { merch: money(merch), ship: money(ship), labor: money(labor), other: money(other), total: money(merch + ship + labor + other) };
}

async function main() {
  admin.initializeApp({ credential: admin.credential.cert(require(KEY)) });
  var db = admin.firestore();

  var invSnap = await db.collection('boards').doc(BOARD_ID).collection('invoices').get();
  var invoices = [];
  invSnap.forEach(function (d) { invoices.push({ id: d.id, num: d.data().invoiceNum || d.data().number || d.id.slice(0, 8), ...d.data() }); });

  var poSnap = await db.collection('boards').doc(BOARD_ID).collection('purchaseOrders').get();
  var pos = [];
  poSnap.forEach(function (d) { pos.push({ id: d.id, ...d.data() }); });
  pos.sort(function (a, b) { return String(a.number || a.num || '').localeCompare(String(b.number || b.num || '')); });

  var invTotal = money(invoices.reduce(function (s, i) { return s + invoiceGrandTotal(i); }, 0));
  var docSum = 0, profitSum = 0, excludedSum = 0;

  console.log('='.repeat(72));
  console.log('HOLTZ HILL — PO COGS audit (read-only production Firestore)');
  console.log('Board: holtz-hill | Invoices:', invoices.length, '| PO docs:', pos.length);
  console.log('Total invoiced to client:', fmt(invTotal));
  console.log('='.repeat(72));

  pos.forEach(function (po, idx) {
    var num = po.number || po.num || po.id.slice(0, 8);
    var vendor = po.vendor || '—';
    var lane = procurementLane(po);
    var counts = poCountsForProfit(po);
    var docT = money(poDocTotal(po));
    var atSend = money(poAtSend(po));
    var billT = vendorBillTotal(po);
    var profitCost = money(vendorBillCostForProfit(po));
    var bd = lineBreakdown(po.items || []);
    docSum += docT;
    if (counts) profitSum += profitCost; else excludedSum += docT;

    console.log('\n--- PO ' + (idx + 1) + ': ' + num + ' (' + po.id + ') ---');
    console.log('  Vendor:', vendor);
    console.log('  Status:', po.status || po.poStatus || '—', '| Lane:', lane, '| Counts in P&L COGS:', counts ? 'YES' : 'NO ($0)');
    console.log('  Doc total (line costs):', fmt(docT), '| PO at send:', fmt(atSend), '| Vendor bill:', billT > 0 ? fmt(billT) : '(none)');
    console.log('  → Financial Health COGS:', fmt(profitCost));
    if (Math.abs(docT - profitCost) > 0.02 && counts) {
      console.log('  ⚠ Doc vs P&L gap:', fmt(docT - profitCost), '(bill variance or at-send baseline differs from doc lines)');
    }
    if (!counts && docT > 0) {
      console.log('  ⚠ EXCLUDED from COGS — draft/not sent or clip-only rule');
    }
    console.log('  Line mix — merch:', fmt(bd.merch), '| freight/shipping:', fmt(bd.ship), '| install/labor-ish:', fmt(bd.labor));
    if (po.bill && po.bill.received) console.log('  Bill received: yes | QB:', po.bill.qbBillId || '—');
  });

  console.log('\n' + '='.repeat(72));
  console.log('SUMMARY');
  console.log('  Sum of all PO doc totals (line cost):     ', fmt(docSum));
  console.log('  Sum counting in P&L COGS (platform rule): ', fmt(profitSum));
  console.log('  PO cost EXCLUDED from P&L:                ', fmt(excludedSum));
  console.log('  Gap (doc − P&L):                          ', fmt(docSum - profitSum));
  console.log('\n  Client invoices total:                    ', fmt(invTotal));
  console.log('  Product margin (inv − P&L COGS only):     ', fmt(invTotal - profitSum));
  console.log('\n  Note: Design time / subs are SEPARATE from this PO COGS line.');
  console.log('  Platform UI may show ~$26K PO doc vs ~$17.5K COGS if some POs are draft or bill baseline differs.');
  console.log('='.repeat(72));

  console.log('\nINVOICES (newest first, top 12 by total):');
  invoices.sort(function (a, b) { return invoiceGrandTotal(b) - invoiceGrandTotal(a); }).slice(0, 12).forEach(function (inv) {
    console.log('  ', inv.num, fmt(invoiceGrandTotal(inv)), inv.status || '—');
  });
}

main().catch(function (e) { console.error(e); process.exit(1); });
