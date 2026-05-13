/**
 * READ-ONLY: count unique POs per data source so we can plan a unified backfill.
 */
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const HOUZZ_DIR = String.raw`C:\Users\cindy\Dropbox\Claude - CCH studio\Houzz FILES`;
const XLSX_FILES = [
  'OutgoingTransactionsReport_04_22_2026_ New Houzz.xlsx',
  'OutgoingTransactionsReport_03_29_2026 PO\'s new houzz.xlsx',
  'Houzz OutgoingTransactionsReport_04_06_2026.xlsx',
];
const QB_IDS = path.join(__dirname, '..', 'platform', 'houzz_qb_ids.json');
const DOC_LINKS = path.join(__dirname, '..', 'platform', 'houzz_doc_links.json');

function normPo(s) { const m = String(s||'').trim().toUpperCase().match(/PO[\s-]?(\d+)/); return m ? 'PO-'+m[1] : ''; }

const fromQb = new Set();
const fromLinks = new Set();
const fromXlsx = new Set();
const xlsxData = {}; // poNum -> { paid, total, status, ... }

const qb = JSON.parse(fs.readFileSync(QB_IDS, 'utf-8'));
for (const k of Object.keys(qb)) if (k.startsWith('PO-')) fromQb.add(k);

const dl = JSON.parse(fs.readFileSync(DOC_LINKS, 'utf-8'));
for (const k of Object.keys(dl)) if (k.startsWith('PO-')) fromLinks.add(k);

const linkStatusCounts = {};
for (const [k, v] of Object.entries(dl)) {
  if (!k.startsWith('PO-')) continue;
  const s = (v && v.status) || '(empty)';
  linkStatusCounts[s] = (linkStatusCounts[s] || 0) + 1;
}

for (const f of XLSX_FILES) {
  const full = path.join(HOUZZ_DIR, f);
  if (!fs.existsSync(full)) continue;
  const wb = XLSX.readFile(full);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  const h = rows[0];
  const cCode = h.indexOf('Code'), cStatus = h.indexOf('Status'),
        cTotal = h.indexOf('Total'), cBalance = h.indexOf('Balance'),
        cBilled = h.indexOf('Billed Amount'), cPaid = h.indexOf('Paid payments'),
        cProj = h.indexOf('Project Name'), cVendor = h.indexOf('Vendor/Sub'),
        cBillDate = h.indexOf('Billing Date');
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const code = normPo(r[cCode]);
    if (!code) continue;
    fromXlsx.add(code);
    if (!xlsxData[code]) {
      xlsxData[code] = {
        project: String(r[cProj] || '').trim(),
        vendor: String(r[cVendor] || '').trim(),
        status: String(r[cStatus] || '').trim(),
        total: parseFloat(r[cTotal]) || 0,
        balance: parseFloat(r[cBalance]) || 0,
        billed: parseFloat(r[cBilled]) || 0,
        paidText: String(r[cPaid] || '').trim(),
        sourceFile: f,
      };
    }
  }
}

const allPos = new Set([...fromQb, ...fromLinks, ...fromXlsx]);

console.log('=== PO source coverage ===');
console.log(`  houzz_qb_ids.json:                       ${fromQb.size} POs`);
console.log(`  houzz_doc_links.json:                    ${fromLinks.size} POs`);
console.log(`  XLSX outgoing transactions (combined):   ${fromXlsx.size} POs`);
console.log(`  UNION (any source):                      ${allPos.size} POs`);
console.log();

console.log('=== doc_links status breakdown ===');
for (const [k, v] of Object.entries(linkStatusCounts).sort((a,b)=>b[1]-a[1])) console.log(`  ${k.padEnd(20)} ${String(v).padStart(5)}`);
console.log();

// Parse "Paid payments" text from XLSX to extract amount + date
const paidRegex = /\$?([\d,]+(?:\.\d{1,2})?)\s*-?\s*paid on\s+(.+)/i;
let xlsxParsedPaid = 0, xlsxNoPaidText = 0, xlsxStatusPaid = 0;
for (const [k, v] of Object.entries(xlsxData)) {
  if (v.status === 'Paid') xlsxStatusPaid++;
  if (!v.paidText) { xlsxNoPaidText++; continue; }
  if (paidRegex.test(v.paidText)) xlsxParsedPaid++;
}
console.log('=== XLSX payment data quality ===');
console.log(`  Status === "Paid":               ${xlsxStatusPaid}`);
console.log(`  Has paid-payments text:          ${fromXlsx.size - xlsxNoPaidText}`);
console.log(`  Empty paid-payments text:        ${xlsxNoPaidText}`);
console.log(`  Parsed amount + date from text:  ${xlsxParsedPaid}`);

// Cross-source: how many POs covered by QB ID also have payment data
let bothQbAndPay = 0, qbOnly = 0, payOnly = 0;
for (const po of allPos) {
  const hasQb = fromQb.has(po);
  const hasPay = fromXlsx.has(po) || (fromLinks.has(po) && dl[po] && dl[po].status === 'Paid');
  if (hasQb && hasPay) bothQbAndPay++;
  else if (hasQb) qbOnly++;
  else if (hasPay) payOnly++;
}
console.log('\n=== Cross-source coverage ===');
console.log(`  QB ID + payment data:    ${bothQbAndPay}`);
console.log(`  QB ID only (no payment): ${qbOnly}`);
console.log(`  Payment only (no QB):    ${payOnly}`);
