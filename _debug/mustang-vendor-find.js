/**
 * For each of the 30 wrong-vendor POs in Mustang, dump every Houzz column
 * to find where the real vendor is hiding.
 */
const XLSX = require('xlsx');
const HOUZZ_FILE = String.raw`C:\Users\cindy\Dropbox\Claude - CCH studio\Houzz FILES\Project Trackers\Cloud Mustang All transactions.xlsx`;

const WRONG_VENDOR_POs = [
  'PO-10912','PO-10914','PO-10915','PO-10917','PO-10920',
  'PO-10960','PO-10961','PO-10962','PO-11008','PO-11040',
  'PO-11443','PO-11446','PO-11449','PO-11450','PO-11507',
  'PO-11508','PO-11636','PO-11704','PO-11976','PO-12119',
  'PO-12150','PO-12325','PO-12665','PO-12716','PO-12780',
  'PO-12872','PO-12882','PO-12887','PO-12888','PO-12894',
];

const wb = XLSX.readFile(HOUZZ_FILE);
const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' });
const header = rows[4];

console.log('=== ALL 28 HOUZZ COLUMNS (Mustang) ===');
header.forEach((c, i) => console.log(`  [${String(i).padStart(2)}] ${c}`));

console.log('\n=== Sample wrong-vendor PO rows — every non-empty column ===');
for (const targetCode of WRONG_VENDOR_POs.slice(0, 3)) {
  let row = null;
  for (let i = 5; i < rows.length; i++) {
    if (String(rows[i][2] || '').trim().toUpperCase() === targetCode) { row = rows[i]; break; }
  }
  if (!row) { console.log(`\n${targetCode}: not in Houzz`); continue; }
  console.log(`\n--- ${targetCode} ---`);
  row.forEach((v, i) => {
    const s = String(v == null ? '' : v).trim();
    if (s) console.log(`  [${String(i).padStart(2)}] ${String(header[i] || '').padEnd(30)} = ${s.slice(0, 120)}`);
  });
}

// Also check what's in Billing Address (col 9) for the 30 wrong-vendor POs
console.log('\n=== Billing Address (col 9) for all 30 wrong-vendor POs ===');
for (const targetCode of WRONG_VENDOR_POs) {
  for (let i = 5; i < rows.length; i++) {
    if (String(rows[i][2] || '').trim().toUpperCase() === targetCode) {
      const billing = String(rows[i][9] || '').split('\n')[0].trim();   // first line only
      const memo = String(rows[i][10] || '').split('\n')[0].trim();
      console.log(`  ${targetCode.padEnd(12)} billing="${billing.slice(0,40).padEnd(42)}"  memo="${memo.slice(0,40)}"`);
      break;
    }
  }
}
