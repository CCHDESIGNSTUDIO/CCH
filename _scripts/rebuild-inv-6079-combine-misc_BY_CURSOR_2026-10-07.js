#!/usr/bin/env node
'use strict';
/**
 * PRODUCTION: INV-6079 — combine meetings, lighting, outdoor; Misc services;
 * drop Complimentary. Total stays $7,570. Hours 62 (was 66.5 minus 4.5 complimentary).
 *
 *   node _scripts\rebuild-inv-6079-combine-misc_BY_CURSOR_2026-10-07.js
 *   node _scripts\rebuild-inv-6079-combine-misc_BY_CURSOR_2026-10-07.js --apply
 */
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const KEY = path.join(__dirname, '..', '_debug', 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
const app = admin.initializeApp({ credential: admin.credential.cert(require(KEY)) }, 'inv6079comb');
const db = app.firestore();
const APPLY = process.argv.indexOf('--apply') >= 0;
const BOARD = 'cloud-rolling-hills';
const DOC_ID = 'bCqEJW17QgBgGCDpUqqu';

function money(n) { return Math.round((parseFloat(n) || 0) * 100) / 100; }

function svcLine(title, hours, rate, amountOverride, blurb, dmin, dmax) {
  const qty = hours;
  const amt = amountOverride != null ? money(amountOverride) : money(rate * qty);
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

const MISC_BLURB = 'Entry ceiling rendering, master-bath window treatments, and game room & theater model updates and renderings.';

const items = [
  svcLine('Meetings', 9, 195, null, '', '2026-04-09', '2026-04-27'),
  svcLine('Travel', 1.75, 75, null, '', '2026-04-27', '2026-04-27'),
  svcLine('Lighting selections, schedules & specs', 31, 0, 2760, '', '2026-04-02', '2026-04-27'),
  svcLine('Outdoor BBQ, bar, landscape & pool house', 12, 0, 2040, '', '2026-04-11', '2026-04-28'),
  svcLine('Misc services', 8.25, 0, 883.75, '', '2026-04-01', '2026-04-30')
];

const outcomes = [
  outcome('Meetings', 9, '2026-04-09', '2026-04-27', 'Calls with Tracey and the job-site walk-through.'),
  outcome('Travel', 1.75, '2026-04-27', '2026-04-27', 'Travel to and from the site meeting.'),
  outcome('Lighting selections, schedules & specs', 31, '2026-04-02', '2026-04-27', 'Lighting selections, schedules, specs, and room boards.'),
  outcome('Outdoor BBQ, bar, landscape & pool house', 12, '2026-04-11', '2026-04-28', 'Outdoor living, bar, landscape, and pool house.'),
  outcome('Misc services', 8.25, '2026-04-01', '2026-04-30', MISC_BLURB)
];

function uiLineAmt(it) {
  const qty = parseFloat(it.qty) || 0;
  const rate = parseFloat(it.rate) || 0;
  const sell = parseFloat(it.amount) || 0;
  var lineAmt = money(rate * qty);
  if (!lineAmt && sell !== 0) lineAmt = sell;
  return lineAmt;
}

const total = money(items.reduce((s, it) => s + (parseFloat(it.amount) || 0), 0));
const hours = items.reduce((s, it) => s + (parseFloat(it.qty) || 0), 0);
const uiTotal = money(items.reduce((s, it) => s + uiLineAmt(it), 0));

(async function main() {
  const ref = db.collection('boards').doc(BOARD).collection('invoices').doc(DOC_ID);
  const snap = await ref.get();
  if (!snap.exists) throw new Error('INV-6079 missing');
  const prev = snap.data() || {};

  console.log('PREV lines', (prev.items || []).length, 'stored total', prev.total);
  (prev.items || []).forEach(function (it, i) {
    console.log(' ', i + 1, it.title, it.qty, 'h @', it.rate, ' $' + it.amount);
  });
  console.log('NEW lines', items.length, 'hours', hours, 'amount-sum', total, 'UI', uiTotal);
  items.forEach(function (it, i) {
    console.log(' ', i + 1, it.title, it.qty, 'h @', it.rate, ' $' + it.amount, 'UI', uiLineAmt(it));
  });
  if (Math.abs(total - 7570) > 0.001) throw new Error('Total must stay 7570, got ' + total);
  if (Math.abs(uiTotal - 7570) > 0.001) throw new Error('UI total must stay 7570, got ' + uiTotal);
  if (Math.abs(hours - 62) > 0.001) throw new Error('Hours must be 62 after dropping complimentary, got ' + hours);

  const backupDir = path.join(__dirname, '..', '_backup', 'wo284-inv-6079-' + new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19));
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
    clientSummary: 'Hi Tracey, April was a full one on Rolling Hills. Lighting took up a big chunk of the billed month, and we also met with you, walked the job, and moved outdoor living, cabinets, and the pool house forward. All time is April 1–30, 2026 — nothing from May.',
    notes: 'Service period 2026-04-01 to 2026-04-30',
    shortDescription: 'Design Services — April 2026',
    allowTimeNotesEnrich: false,
    updatedAt: new Date().toISOString()
  });
  console.log('APPLIED INV-6079 combined lines, no complimentary, total $7570');
  process.exit(0);
})().catch(function (e) {
  console.error(e);
  process.exit(1);
});
