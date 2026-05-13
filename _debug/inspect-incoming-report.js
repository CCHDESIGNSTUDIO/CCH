/** Inspect every Houzz transactions XLSX in Houzz FILES/ for Rolling Hills coverage. */
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const HOUZZ_DIR = String.raw`C:\Users\cindy\Dropbox\Claude - CCH studio\Houzz FILES`;
const FILES = [
  'OutgoingTransactionsReport_04_22_2026_ New Houzz.xlsx',
  'OutgoingTransactionsReport_03_29_2026 PO\'s new houzz.xlsx',
  'Houzz OutgoingTransactionsReport_04_06_2026.xlsx',
  'IncomingTransactionsReport_04_22_2026- New Houzz.xlsx',
  'Houzz IncomingTransactionsReport_04_06_2026.xlsx',
  'PaymentsReport_04_10_2026 All New Houzz Projects through April 4.xlsx',
  'PaymentsReport_03_19_2026 New Houzz projects.xlsx',
  'Legacy project payments.xlsx',
  'Houzz reports-2870-02-24-2026-15-11-49-044 all transactions.xlsx',
  'Houzz reports-2870-02-24-2026-15-11-49-044 all transactions qb.xlsx',
];

function safeRead(file) {
  const full = path.join(HOUZZ_DIR, file);
  if (!fs.existsSync(full)) return null;
  try { return XLSX.readFile(full); } catch (e) { return null; }
}

for (const f of FILES) {
  const wb = safeRead(f);
  if (!wb) { console.log('SKIP ' + f); continue; }
  console.log('\n=== ' + f);
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    if (rows.length < 2) continue;
    const h = rows[0];
    const codeI = h.findIndex(c => /^code$/i.test(c) || /document.*number/i.test(c));
    const projI = h.findIndex(c => /project/i.test(c));
    const titleI = h.findIndex(c => /document.*title|document.*name/i.test(c));
    let rhRows = 0, totalRows = 0;
    const rhCodes = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      totalRows++;
      const proj = String(r[projI] || '').toLowerCase();
      const title = String(r[titleI] || '').toLowerCase();
      if (/rolling/.test(proj) || /rolling/.test(title) || /cloud/.test(proj)) {
        rhRows++;
        const code = String(r[codeI] || '').trim();
        if (code) rhCodes.push(code);
      }
    }
    console.log('  Sheet "' + sheetName + '": ' + totalRows + ' rows, ' + rhRows + ' Rolling Hills');
    if (rhRows > 0) {
      const prefixes = {};
      rhCodes.forEach(c => {
        const p = c.split('-')[0] || '?';
        prefixes[p] = (prefixes[p] || 0) + 1;
      });
      console.log('    By prefix: ' + Object.entries(prefixes).map(([k,v]) => k+'='+v).join(', '));
    }
  }
}
