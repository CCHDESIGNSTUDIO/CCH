/**
 * Check the Houzz Project Tracker XLSX (different format from "All Transactions").
 * This one has per-line vendor data.
 */
const XLSX = require('xlsx');
const TRACKER = String.raw`C:\Users\cindy\Dropbox\Claude - CCH studio\Houzz FILES\ARCHIVE\project_tracker_report-2870-04-22-2026-12-20-06-398_Cloud Mustang.xlsx`;

const wb = XLSX.readFile(TRACKER);
const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' });
const h = rows[0];
console.log('Sheets:', wb.SheetNames);
console.log('Total rows:', rows.length);
console.log('\nHeader columns:');
h.forEach((c, i) => console.log(`  [${String(i).padStart(2)}] ${c}`));

// Find Vendor column
const vendorIdx = h.findIndex(c => /vendor/i.test(String(c || '')));
const poIdx = h.findIndex(c => /purchase\s*order/i.test(String(c || '')));
console.log(`\nVendor column index: ${vendorIdx}`);
console.log(`PO column index: ${poIdx}`);

// For the 30 wrong-vendor POs, look up the real vendor
const WRONG_VENDOR_POs = [
  'PO-10912','PO-10914','PO-10915','PO-10917','PO-10920',
  'PO-10960','PO-10961','PO-10962','PO-11008','PO-11040',
  'PO-11443','PO-11446','PO-11449','PO-11450','PO-11507',
  'PO-11508','PO-11636','PO-11704','PO-11976','PO-12119',
  'PO-12150','PO-12325','PO-12665','PO-12716','PO-12780',
  'PO-12872','PO-12882','PO-12887','PO-12888','PO-12894',
];

console.log('\n=== Vendor lookup from Project Tracker for the 30 wrong-vendor POs ===');
for (const code of WRONG_VENDOR_POs) {
  // Find rows where the PO column contains this code
  const vendors = new Set();
  for (let i = 1; i < rows.length; i++) {
    const poVal = String(rows[i][poIdx] || '').toUpperCase();
    if (poVal.includes(code)) {
      const v = String(rows[i][vendorIdx] || '').trim();
      if (v) vendors.add(v);
    }
  }
  console.log(`  ${code.padEnd(12)} vendors found: ${vendors.size ? [...vendors].join(' | ') : '(none)'}`);
}
