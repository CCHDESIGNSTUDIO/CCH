#!/usr/bin/env node
'use strict';
/**
 * Read-only Holtz Hill financial audit from Studio Firestore (production).
 * Uses the same buckets as project Financial Health + Profit Tracker.
 */
const path = require('path');
const admin = require('firebase-admin');

const KEY = path.join(
  __dirname,
  '..',
  '_debug',
  'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json'
);

const BOARD_ID = 'holtz-hill';
const OWNER_NAMES = ['cynthia', 'cindy', 'holloway'];
const CONTRACTOR_NAMES = ['vanessa', 'vanessaholiday', 'vanessa-holiday', 'vanessa-holliday', 'vholliday'];
const OWNER_RATE = 250;
const CONTRACTOR_COST_RATES = { vanessa: 65, default: 125 };

function contractorCostRate(member) {
  const m = norm(member);
  if (['vanessa', 'vholliday', 'vanessa-holiday', 'vanessa-holliday'].some((n) => m.includes(n))) return CONTRACTOR_COST_RATES.vanessa;
  return CONTRACTOR_COST_RATES.default;
}

const HOLTZ_ALIASES = ['holtz hill', 'holtz', 'holtzs hill', 'holtz-hill'];
const SHIMANO_ALIASES = ['shimano - westridge lane', 'shimano- maverick cir.', 'shimano- maverick cir', 'shimano maverick'];

function money(n) {
  return Math.round((parseFloat(n) || 0) * 100) / 100;
}

function fmt(n) {
  return '$' + money(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function norm(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[\u2013\u2014]/g, '-');
}

function isOwner(member) {
  const m = norm(member);
  return OWNER_NAMES.some((n) => m.indexOf(n) >= 0);
}

function isContractor(member) {
  const m = norm(member);
  return CONTRACTOR_NAMES.some((n) => m.indexOf(n) >= 0);
}

function invoiceGrandTotal(inv) {
  if (typeof inv.grandTotal === 'number') return inv.grandTotal;
  if (typeof inv.total === 'number') return inv.total;
  if (typeof inv.amount === 'number') return inv.amount;
  const items = inv.items || inv.lineItems || [];
  if (items.length) {
    return items.reduce((s, li) => s + (parseFloat(li.total || li.amount) || 0), 0);
  }
  return 0;
}

function poTotal(po) {
  let t = parseFloat(po.total || po.amount) || 0;
  if (!t && po.items && po.items.length) {
    t = po.items.reduce((s, i) => s + (parseFloat(i.total || i.amount || i.cost) || 0), 0);
  }
  return t;
}

/** Vendor bill total — same logic as cchPoVendorBillTotal in Studio. */
function vendorBillTotal(po) {
  if (!po) return 0;
  const bill = po.bill || {};
  if (bill.billTotal != null && (bill.received || bill.qbBillId || (bill.vendorInvoices && bill.vendorInvoices.length))) {
    return parseFloat(bill.billTotal) || 0;
  }
  if (po.poTotalAtSend != null) return parseFloat(po.poTotalAtSend) || 0;
  return poTotal(po);
}

function matchesAlias(project, aliases) {
  const p = norm(project);
  return aliases.some((a) => p === norm(a) || p.indexOf(norm(a)) >= 0);
}

function filterTimeEntries(all, mode) {
  return all.filter((t) => {
    if (t.projectId === BOARD_ID) return true;
    const p = t.project || '';
    if (mode === 'holtz_only') return matchesAlias(p, HOLTZ_ALIASES);
    if (mode === 'holtz_plus_shimano') {
      return matchesAlias(p, HOLTZ_ALIASES) || matchesAlias(p, SHIMANO_ALIASES) || norm(p).includes('shimano');
    }
    return norm(p) === norm(p); // all
  });
}

function summarizeTime(entries) {
  const byMember = {};
  let loggedHours = 0;
  let loggedValue = 0;
  let contractorCost = 0;
  let ownerLaborValue = 0;
  let uninvoicedBillable = 0;
  let invoicedLinked = 0;

  entries.forEach((t) => {
    const member = t.member || t.user || 'Unknown';
    const hrs = parseFloat(t.hours) || 0;
    const rate = parseFloat(t.rate || t.hourlyRate || t.billableRate) || (isOwner(member) ? OWNER_RATE : 125);
    const total = parseFloat(t.total) || hrs * rate;
    const billable = t.billable !== false;

    if (!byMember[member]) byMember[member] = { hrs: 0, value: 0, cost: 0, rows: 0 };
    byMember[member].hrs += hrs;
    byMember[member].rows += 1;

    loggedHours += hrs;
    if (billable) {
      loggedValue += total;
      byMember[member].value += total;
      if (t.invoiceId) invoicedLinked += total;
      else uninvoicedBillable += total;
    }

    if (isOwner(member)) {
      ownerLaborValue += (parseFloat(t.hours) || 0) * OWNER_RATE;
    } else {
      const costRate = parseFloat(t.internalCostRate) || contractorCostRate(member);
      const c = hrs * costRate;
      contractorCost += c;
      byMember[member].cost += c;
    }
  });

  return {
    rows: entries.length,
    loggedHours: money(loggedHours),
    loggedValue: money(loggedValue),
    contractorCost: money(contractorCost),
    ownerLaborValue: money(ownerLaborValue),
    uninvoicedBillable: money(uninvoicedBillable),
    invoicedLinkedTime: money(invoicedLinked),
    byMember,
  };
}

async function loadPOs(db, boardId) {
  const pos = [];
  const snap = await db.collection('boards').doc(boardId).collection('purchaseOrders').get();
  snap.forEach((d) => pos.push({ id: d.id, ...d.data() }));

  const clipMap = {};
  const cs = await db.collection('boards').doc(boardId).collection('clips').get();
  cs.forEach((d) => {
    const c = d.data();
    if (!c.poNum) return;
    if (!clipMap[c.poNum]) {
      clipMap[c.poNum] = {
        id: 'clip-' + c.poNum,
        number: c.poNum,
        vendor: c.vendor || '',
        total: 0,
        items: [],
        _fromClips: true,
      };
    }
    clipMap[c.poNum].total += parseFloat(c.totalCost || c.cost) || 0;
  });
  Object.values(clipMap).forEach((po) => {
    if (!pos.find((x) => String(x.number || x.num) === String(po.number))) pos.push(po);
  });
  return pos;
}

async function main() {
  admin.initializeApp({ credential: admin.credential.cert(require(KEY)) });
  const db = admin.firestore();

  const boardDoc = await db.collection('boards').doc(BOARD_ID).get();
  if (!boardDoc.exists) {
    console.error('Board not found:', BOARD_ID);
    process.exit(1);
  }
  const board = { id: boardDoc.id, ...boardDoc.data() };

  const invSnap = await db.collection('boards').doc(BOARD_ID).collection('invoices').get();
  const invoices = [];
  invSnap.forEach((d) => invoices.push({ id: d.id, ...d.data() }));

  const pos = await loadPOs(db, BOARD_ID);

  const teSnap = await db.collection('timeEntries').get();
  const allTime = [];
  teSnap.forEach((d) => allTime.push({ id: d.id, ...d.data() }));

  const invoicedValue = money(invoices.reduce((s, i) => s + invoiceGrandTotal(i), 0));
  const collectedValue = money(
    invoices.reduce((s, i) => {
      const fromPayments = (i.payments || []).reduce((ps, p) => ps + (parseFloat(p.amount) || 0), 0);
      const fromPaid = parseFloat(i.paidAmount || i.amountPaid || 0);
      const fromStatus = i.status === 'Paid' ? invoiceGrandTotal(i) : 0;
      return s + (fromPayments > 0.01 ? fromPayments : fromPaid > 0.01 ? fromPaid : fromStatus);
    }, 0)
  );
  const poCost = money(pos.reduce((s, po) => s + poTotal(po), 0));
  const vendorBillCost = money(pos.reduce((s, po) => s + vendorBillTotal(po), 0));
  const contractFee = money(parseFloat(board.contractFee || board.flatFee || board.budget) || 0);

  console.log('='.repeat(60));
  console.log('HOLTZ HILL — Studio Firestore financial audit (read-only)');
  console.log('Board:', board.name || BOARD_ID, '| client:', board.clientName || '—');
  console.log('Contract fee:', contractFee > 0 ? fmt(contractFee) : '(none — hourly model)');
  console.log('='.repeat(60));
  console.log('\n--- INVOICES (boards/holtz-hill/invoices) ---');
  console.log('Count:', invoices.length);
  console.log('Invoiced total (invoice lines/grandTotal):', fmt(invoicedValue));
  console.log('Collected (payments / paid status):', fmt(collectedValue));
  console.log('\n--- PURCHASE ORDERS ---');
  console.log('PO count:', pos.length, '(incl. clip-derived POs)');
  console.log('PO document totals:', fmt(poCost));
  console.log('Vendor bill totals (profit basis):', fmt(vendorBillCost));

  for (const mode of ['holtz_only', 'holtz_plus_shimano', 'all_studio_entries_for_board_id']) {
    let entries;
    if (mode === 'all_studio_entries_for_board_id') {
      entries = allTime.filter((t) => t.projectId === BOARD_ID);
    } else {
      entries = filterTimeEntries(allTime, mode);
    }
    const t = summarizeTime(entries);
    const revenue = contractFee > 0 ? contractFee : invoicedValue;
    const cashProfit = money(revenue - vendorBillCost - t.contractorCost);
    const loadedProfit = money(cashProfit - t.ownerLaborValue);
    const coworkStyle = money(invoicedValue - vendorBillCost - t.contractorCost - t.ownerLaborValue);

    console.log('\n--- TIME:', mode, '---');
    console.log('Rows:', t.rows, '| Hours:', t.loggedHours, '| Logged value:', fmt(t.loggedValue));
    console.log('Uninvoiced billable (no invoiceId):', fmt(t.uninvoicedBillable));
    console.log('Time linked to Studio invoice:', fmt(t.invoicedLinkedTime));
    Object.entries(t.byMember)
      .sort((a, b) => b[1].value - a[1].value)
      .forEach(([m, v]) => {
        console.log(' ', m + ':', v.hrs.toFixed(2) + 'h', fmt(v.value), '(' + v.rows + ' rows)');
      });
    console.log('Contractor labor cost (Vanessa @ $65/hr internal):', fmt(t.contractorCost));
    console.log('Owner labor value (Cindy billable):', fmt(t.ownerLaborValue));
    console.log('\n  Profit formulas:');
    console.log('  Cash profit  = invoiced - vendor bills - sub fees');
    console.log('             =', fmt(revenue), '-', fmt(vendorBillCost), '-', fmt(t.contractorCost), '=', fmt(cashProfit));
    console.log('  Loaded profit (after owner time) =', fmt(loadedProfit));
    console.log('  Cowork-style (Invoiced - bills - sub - owner time) =', fmt(coworkStyle));
  }

  console.log('\n--- PROFIT TRACKER GAPS (why numbers may disagree) ---');
  console.log('• Profit Tracker loads timeEntries with .limit(2000) — you have', allTime.length, 'total firmwide entries');
  console.log('• Project overview time query uses project name match + limit(500) — may miss rows');
  console.log('• Time Ledger merges Holtz aliases; Profit Tracker matches exact project name only');
  console.log('• Shimano Westridge / Maverick time may be same client but separate Houzz projects');
  console.log('='.repeat(60));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
