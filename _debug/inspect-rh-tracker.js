/** Inspect Rolling Hills project tracker XLSX. */
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const FILE = String.raw`C:\Users\cindy\Dropbox\Claude - CCH studio\Houzz FILES\ARCHIVE\project_tracker_report-2870-04-22-2026-12-22-11-342 Cloud RH.xlsx`;

if (!fs.existsSync(FILE)) { console.log('FILE NOT FOUND:', FILE); process.exit(1); }
const wb = XLSX.readFile(FILE);
console.log('File:', path.basename(FILE));
console.log('Sheets:', wb.SheetNames.join(' | '));
console.log();

for (const sheetName of wb.SheetNames) {
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  console.log('=== Sheet: "' + sheetName + '" (' + rows.length + ' rows) ===');
  if (rows.length === 0) { console.log('  (empty)\n'); continue; }
  const header = rows[0];
  console.log('  Headers (' + header.length + '):');
  header.forEach((h, i) => console.log('    [' + i + '] ' + h));
  console.log('  Sample rows (next 3):');
  for (let r = 1; r < Math.min(4, rows.length); r++) {
    console.log('    ROW ' + r + ':');
    header.forEach((h, ci) => {
      const v = rows[r][ci];
      if (v !== '' && v != null) console.log('      ' + h + ': ' + String(v).slice(0, 100));
    });
  }
  console.log();
}
