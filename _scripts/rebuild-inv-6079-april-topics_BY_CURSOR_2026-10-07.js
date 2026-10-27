#!/usr/bin/env node
'use strict';
/**
 * PRODUCTION: Rebuild Cloud Rolling Hills INV-6079 lines by work topic (not rate).
 * Dated notes on each line. April 2026 only. Total stays $7,570.
 * Complimentary lighting 4.5 hrs @ $0.
 *
 *   node _scripts\rebuild-inv-6079-april-topics_BY_CURSOR_2026-10-07.js
 *   node _scripts\rebuild-inv-6079-april-topics_BY_CURSOR_2026-10-07.js --apply
 */
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const KEY = path.join(__dirname, '..', '_debug', 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
const app = admin.initializeApp({ credential: admin.credential.cert(require(KEY)) }, 'inv6079rebuild');
const db = app.firestore();
const APPLY = process.argv.indexOf('--apply') >= 0;
const BOARD = 'cloud-rolling-hills';
const DOC_ID = 'bCqEJW17QgBgGCDpUqqu';

function money(n) { return Math.round((parseFloat(n) || 0) * 100) / 100; }

function dated(ymd, hrs, text) {
  return ymd + ' — ' + hrs + ' hrs — ' + text;
}

function svcLine(title, hours, rate, noteLines, dmin, dmax) {
  const qty = hours;
  const amt = money(rate * qty);
  const desc = noteLines.join('\n');
  return {
    title: title,
    name: title,
    description: desc,
    lineNotes: desc,
    notes: desc,
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

function outcome(title, hours, dmin, dmax, noteLines, intro) {
  return {
    title: title,
    hours: hours,
    dateRange: dmin === dmax ? dmin : (dmin + ' – ' + dmax),
    description: [intro].concat(noteLines).filter(Boolean).join('\n')
  };
}

const meetingsNotes = [
  dated('2026-04-09', 2.5, 'Call with Tracey — fireplaces and lighting'),
  dated('2026-04-10', 2.5, 'Call with Tracey — fireplaces and lighting'),
  dated('2026-04-13', 2.5, 'Call with Tracey — cabinet revisions')
];
const onsiteNotes = [
  dated('2026-04-27', 1.5, 'Job-site walk-through and cabinet finishes')
];
const travelNotes = [
  dated('2026-04-27', 1.75, 'Travel to and from the site meeting')
];
const lightingNotes = [
  dated('2026-04-02', 0.5, 'Exterior lighting backplates and ETAs'),
  dated('2026-04-06', 5.25, 'Lighting schedules and specs, room board updates'),
  dated('2026-04-07', 6.5, 'Lighting proposals, specifications, and room board updates'),
  dated('2026-04-08', 1.75, 'Lighting schedule and proposals'),
  dated('2026-04-10', 1.75, 'Lighting revisions after the call with Tracey'),
  dated('2026-04-13', 4.5, 'Suite 3 updates, new lighting options, schedule'),
  dated('2026-04-14', 4.25, 'Lighting specifications'),
  dated('2026-04-15', 0.25, 'Decorative accent lighting correspondence'),
  dated('2026-04-15', 2.5, 'Lighting specifications'),
  dated('2026-04-16', 3.25, 'Model updates with lighting selections and new renderings'),
  dated('2026-04-27', 0.5, 'Lighting schedules')
];
const freeNotes = [
  dated('2026-04-09', 2.25, 'Lighting schedule and proposals — not billed'),
  dated('2026-04-14', 2.25, 'Lighting schedules and proposals — not billed')
];
const outdoorNotes = [
  dated('2026-04-11', 0.75, 'Outdoor layouts'),
  dated('2026-04-15', 3, 'Outdoor BBQ and bar materials and selections'),
  dated('2026-04-21', 2.25, 'Outdoor landscape plan'),
  dated('2026-04-23', 4.25, 'Cabinets, finishes, landscape, and pool house'),
  dated('2026-04-24', 1.5, 'Bar shelf design'),
  dated('2026-04-28', 0.25, 'BBQ follow-up')
];
const gameNotes = [
  dated('2026-04-01', 4.5, 'Game room SketchUp and theater slab samples')
];
const entryNotes = [
  dated('2026-04-17', 2.75, 'Entry ceiling renderings')
];
const windowNotes = [
  dated('2026-04-30', 1, 'Master-bath windows')
];

const items = [
  svcLine('Meetings with Tracey', 7.5, 195, meetingsNotes, '2026-04-09', '2026-04-13'),
  svcLine('On-site meeting', 1.5, 195, onsiteNotes, '2026-04-27', '2026-04-27'),
  svcLine('Travel', 1.75, 75, travelNotes, '2026-04-27', '2026-04-27'),
  svcLine('Lighting selections, schedules & specs', 31, money(2760 / 31), lightingNotes, '2026-04-02', '2026-04-27'),
  svcLine('Complimentary — lighting schedules & proposals', 4.5, 0, freeNotes, '2026-04-09', '2026-04-14'),
  svcLine('Outdoor BBQ, bar, landscape & pool house', 12, 170, outdoorNotes, '2026-04-11', '2026-04-28'),
  svcLine('Game room & theater samples', 4.5, 95, gameNotes, '2026-04-01', '2026-04-01'),
  svcLine('Entry ceiling renderings', 2.75, 95, entryNotes, '2026-04-17', '2026-04-17'),
  svcLine('Master-bath windows', 1, 195, windowNotes, '2026-04-30', '2026-04-30')
];
items[3].amount = 2760;
items[3].rate = money(2760 / 31);
items[3].clientPrice = items[3].rate;
items[5].amount = 2040;
items[5].rate = 170;
items[5].clientPrice = 170;

const outcomes = [
  outcome('Meetings with Tracey', 7.5, '2026-04-09', '2026-04-13', meetingsNotes, 'Three working calls with you this month.'),
  outcome('On-site meeting', 1.5, '2026-04-27', '2026-04-27', onsiteNotes, 'Walked the job together.'),
  outcome('Travel', 1.75, '2026-04-27', '2026-04-27', travelNotes, ''),
  outcome('Lighting selections, schedules & specs', 31, '2026-04-02', '2026-04-27', lightingNotes, 'Lighting was the heart of the billed month.'),
  outcome('Complimentary — lighting schedules & proposals', 4.5, '2026-04-09', '2026-04-14', freeNotes, 'These hours are included so you can see the work. They are not billed ($0.00).'),
  outcome('Outdoor BBQ, bar, landscape & pool house', 12, '2026-04-11', '2026-04-28', outdoorNotes, 'Outdoor living, bar, landscape, and pool house.'),
  outcome('Game room & theater samples', 4.5, '2026-04-01', '2026-04-01', gameNotes, ''),
  outcome('Entry ceiling renderings', 2.75, '2026-04-17', '2026-04-17', entryNotes, ''),
  outcome('Master-bath windows', 1, '2026-04-30', '2026-04-30', windowNotes, '')
];

const total = money(items.reduce((s, it) => s + (parseFloat(it.amount) || 0), 0));
const hours = items.reduce((s, it) => s + (parseFloat(it.qty) || 0), 0);

(async function main() {
  const ref = db.collection('boards').doc(BOARD).collection('invoices').doc(DOC_ID);
  const snap = await ref.get();
  if (!snap.exists) throw new Error('INV-6079 missing');
  const prev = snap.data() || {};

  console.log('PREV lines', (prev.items || []).length, 'total', prev.total);
  (prev.items || []).forEach(function (it, i) {
    console.log(' ', i + 1, it.title, it.qty, 'h $' + it.amount);
  });
  console.log('NEW lines', items.length, 'hours', hours, 'total', total);
  items.forEach(function (it, i) {
    console.log(' ', i + 1, it.title, it.qty, 'h @', it.rate, ' $' + it.amount);
    console.log('    ', it.lineNotes.split('\n').join('\n     '));
  });
  if (Math.abs(total - 7570) > 0.001) throw new Error('Total must stay 7570, got ' + total);
  if (Math.abs(hours - 66.5) > 0.001) throw new Error('Hours must stay 66.5, got ' + hours);

  const backupDir = path.join(__dirname, '..', '_backup', 'wo282-inv-6079-' + new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19));
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
  console.log('APPLIED INV-6079 topical dated lines, total $7570');
  process.exit(0);
})().catch(function (e) {
  console.error(e);
  process.exit(1);
});
