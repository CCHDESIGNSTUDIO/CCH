const fs = require('fs');
const XLSX = require('xlsx');
const TRACKER = String.raw`C:\Users\cindy\Dropbox\Claude - CCH studio\Houzz FILES\ARCHIVE\project_tracker_report-2870-04-22-2026-12-22-11-342 Cloud RH.xlsx`;

const wb = XLSX.readFile(TRACKER);
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
const h = rows[0];
const I = (n) => h.findIndex(c => String(c).toLowerCase().trim() === n.toLowerCase());
const cI = I('Invoice'), cP = I('Proposal'), cT = I('Title'), cR = I('Room');

let inv12980 = 0, pr12951 = 0, both = 0, prOnly = 0, invOnly = 0;
const invOnlyTitles = [], prOnlyTitles = [];
for (let i = 1; i < rows.length; i++) {
  const r = rows[i];
  const inv = String(r[cI] || '').toUpperCase();
  const pr = String(r[cP] || '').toUpperCase();
  const isIn = inv.includes('IN-12980');
  const isPr = pr.includes('PR-12951');
  if (isIn) inv12980++;
  if (isPr) pr12951++;
  if (isIn && isPr) both++;
  else if (isPr && !isIn) { prOnly++; prOnlyTitles.push({ title: r[cT], room: r[cR] }); }
  else if (isIn && !isPr) { invOnly++; invOnlyTitles.push({ title: r[cT], room: r[cR] }); }
}
console.log('IN-12980 rows:        ', inv12980);
console.log('PR-12951 rows:        ', pr12951);
console.log('Both invoice + prop:  ', both);
console.log('PR only (NOT on inv): ', prOnly);
console.log('Inv only (NOT on prop):', invOnly);
console.log('\nFirst 10 PR-only items (in proposal, not in invoice):');
prOnlyTitles.slice(0, 10).forEach(t => console.log('  ' + (t.title || '').slice(0,60).padEnd(62) + 'room=' + t.room));
console.log('\nFirst 5 Inv-only items (on invoice, not in proposal):');
invOnlyTitles.slice(0, 5).forEach(t => console.log('  ' + (t.title || '').slice(0,60).padEnd(62) + 'room=' + t.room));
