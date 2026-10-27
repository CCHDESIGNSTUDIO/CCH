#!/usr/bin/env node
'use strict';
/**
 * PRODUCTION: INV-6079 — real CCH rates only, no dated daily notes.
 * Hours stay on the line qty (quarter hours). Total stays $7,570.
 *
 *   node _scripts\rebuild-inv-6079-quarter-rates_BY_CURSOR_2026-10-07.js
 *   node _scripts\rebuild-inv-6079-quarter-rates_BY_CURSOR_2026-10-07.js --apply
 */
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const KEY = path.join(__dirname, '..', '_debug', 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
const app = admin.initializeApp({ credential: admin.credential.cert(require(KEY)) }, 'inv6079qtr');
const db = app.firestore();
const APPLY = process.argv.indexOf('--apply') >= 0;
const BOARD = 'cloud-rolling-hills';
const DOC_ID = 'bCqEJW17QgBgGCDpUqqu';

function money(n) { return Math.round((parseFloat(n) || 0) * 100) / 100; }

function svcLine(title, hours, rate, blurb, dmin, dmax) {
  const qty = hours;
  const amt = money(rate * qty);
  return {
    title: title,
    name: title,
    description: '',
    lineNotes: '',
    notes: '',
    additionalNotes: '',
    expenseType: 'service',
    itemType: 'service',
    category: title,
    qty: qty,
    hours: qty,
    rate: rate,
    clientPrice: rate,
    cost: 0,
    markupPct: 0,
    shipping: 0,
    amount: amt,
    taxable: false,
    vendor: '',
    room: '',
    retailPrice: 0,
    serviceDateStart: dmin,
    serviceDateEnd: dmax,
    lineNotesUserEdited: true
  };
}

function outcome(title, hours, dmin, dmax, blurb) {
  return {
    title: title,
    hours: hours,
    dateRange: dmin === dmax ? dmin : (dmin + ' – ' + dmax),
    description: blurb || ''
  };
}

const items = [
  svcLine('Meetings with Tracey', 7.5, 195, '', '2026-04-09', '2026-04-13'),
  svcLine('On-site meeting', 1.5, 195, '', '2026-04-27', '2026-04-27'),
  svcLine('Travel', 1.75, 75, '', '2026-04-27', '2026-04-27'),
  svcLine('Lighting selections, schedules & specs', 21.75, 95, '', '2026-04-02', '2026-04-16'),
  svcLine('Lighting specifications & support', 9.25, 75, '', '2026-04-10', '2026-04-27'),
  svcLine('Complimentary — lighting schedules & proposals', 4.5, 0, '', '2026-04-09', '2026-04-14'),
  svcLine('Outdoor BBQ, bar, landscape & pool house', 9, 195, '', '2026-04-11', '2026-04-28'),
  svcLine('Outdoor BBQ and bar selections', 3, 95, '', '2026-04-15', '2026-04-15'),
  svcLine('Game room & theater samples', 4.5, 95, '', '2026-04-01', '2026-04-01'),
  svcLine('Entry ceiling renderings', 2.75, 95, '', '2026-04-17', '2026-04-17'),
  svcLine('Master-bath windows', 1, 195, '', '2026-04-30', '2026-04-30')
];

const outcomes = [
  outcome('Meetings with Tracey', 7.5, '2026-04-09', '2026-04-13', 'Working calls with you this month.'),
  outcome('On-site meeting', 1.5, '2026-04-27', '2026-04-27', 'Walked the job together.'),
  outcome('Travel', 1.75, '2026-04-27', '2026-04-27', 'Travel to and from the site meeting.'),
  outcome('Lighting selections, schedules & specs', 21.75, '2026-04-02', '2026-04-16', 'Lighting selections, schedules, specs, and room boards.'),
  outcome('Lighting specifications & support', 9.25, '2026-04-10', '2026-04-27', 'Lighting specifications and follow-up.'),
  outcome('Complimentary — lighting schedules & proposals', 4.5, '2026-04-09', '2026-04-14', 'These hours are included so you can see the work. They are not billed ($0.00).'),
  outcome('Outdoor BBQ, bar, landscape & pool house', 9, '2026-04-11', '2026-04-28', 'Outdoor living, bar, landscape, and pool house.'),
  outcome('Outdoor BBQ and bar selections', 3, '2026-04-15', '2026-04-15', 'BBQ and bar materials and selections.'),
  outcome('Game room & theater samples', 4.5, '2026-04-01', '2026-04-01', 'Game room SketchUp and theater slab samples.'),
  outcome('Entry ceiling renderings', 2.75, '2026-04-17', '2026-04-17', 'Entry ceiling renderings.'),
  outcome('Master-bath windows', 1, '2026-04-30', '2026-04-30', 'Master-bath windows.')
];

const total = money(items.reduce((s, it) => s + (parseFloat(it.amount) || 0), 0));
const hours = items.reduce((s, it) => s + (parseFloat(it.qty) || 0), 0);
const uiTotal = money(items.reduce((s, it) => s + money((parseFloat(it.rate) || 0) * (parseFloat(it.qty) || 0)), 0));

(async function main() {
  const ref = db.collection('boards').doc(BOARD).collection('invoices').doc(DOC_ID);
  const snap = await ref.get();
  if (!snap.exists) throw new Error('INV-6079 missing');
  const prev = snap.data() || {};

  console.log('PREV lines', (prev.items || []).length, 'stored total', prev.total);
  (prev.items || []).forEach(function (it, i) {
    const q = parseFloat(it.qty) || 0;
    const r = parseFloat(it.rate) || 0;
    console.log(' ', i + 1, it.title, q, 'h @', r, ' stored $' + it.amount, ' UI $' + money(r * q));
  });
  console.log('NEW lines', items.length, 'hours', hours, 'amount-sum', total, 'rate*qty', uiTotal);
  items.forEach(function (it, i) {
    console.log(' ', i + 1, it.title, it.qty, 'h @', it.rate, ' $' + it.amount);
  });
  if (Math.abs(total - 7570) > 0.001) throw new Error('Total must stay 7570, got ' + total);
  if (Math.abs(uiTotal - 7570) > 0.001) throw new Error('rate×qty must stay 7570, got ' + uiTotal);
  if (Math.abs(hours - 66.5) > 0.001) throw new Error('Hours must stay 66.5, got ' + hours);
  items.forEach(function (it) {
    const r = parseFloat(it.rate) || 0;
    if (r !== 0 && r !== 75 && r !== 95 && r !== 195) throw new Error('Non-canonical rate ' + r + ' on ' + it.title);
    const q = parseFloat(it.qty) || 0;
    if (Math.abs(q * 4 - Math.round(q * 4)) > 0.001) throw new Error('Hours not on quarter: ' + q + ' ' + it.title);
  });

  const backupDir = path.join(__dirname, '..', '_backup', 'wo283-inv-6079-' + new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19));
  fs.mkdirSync(backupDir, { recursive: true });
  fs.writeFileSync(path.join(backupDir, 'INV-6079-before.json'), JSON.stringify(prev, null, 2));
  console.log('Backup', backupDir);

  if (!APPLY) {
    console.log('DRY RUN — pass --apply to write production');
    process.exit(0);
  }

  await ref.update({
    items: items,
    total: 7570,
    taxAmount: 0,
    tax: 0,
    clientOutcomes: outcomes,
    clientSummary: 'Hi Tracey, April was a full one on Rolling Hills. Lighting took up a big chunk of the billed month, and we also met with you, walked the job, and moved outdoor living, cabinets, and the pool house forward. 4.5 hours of lighting schedules and proposals are on this invoice at $0.00 so you can see work that was not billed. All time is April 1–30, 2026 — nothing from May.',
    notes: 'Service period 2026-04-01 to 2026-04-30',
    shortDescription: 'Design Services — April 2026',
    allowTimeNotesEnrich: false,
    updatedAt: new Date().toISOString()
  });
  console.log('APPLIED INV-6079 real rates, hours only, total $7570');
  process.exit(0);
})().catch(function (e) {
  console.error(e);
  process.exit(1);
});
