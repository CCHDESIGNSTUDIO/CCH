/**
 * Add Taxable_Item_Corrected to a Houzz Project Tracker .xlsx using CA rules
 * (same logic as platform/cch-invoice-tax-rules.js).
 *
 * Usage:
 *   node tracker-add-taxable-corrected.js "path\to\tracker.xlsx"
 *   node tracker-add-taxable-corrected.js "path\to\tracker.xlsx" --out "path\to\out.xlsx"
 *
 * Writes:
 *   - <basename>-tax-corrected.xlsx  (unless --out)
 *   - <basename>-tax-mismatches.csv  (rows where corrected ≠ Houzz Taxable Item)
 *
 * Does NOT touch Firestore.
 */
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const taxRules = require('../platform/cch-invoice-tax-rules.js');

const OUT_COL = 'Taxable_Item_Corrected';
const MISMATCH_COL = 'Taxable_Item_Mismatch';

function parseArgs(argv) {
  const args = { inPath: null, outPath: null };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--out' && argv[i + 1]) {
      args.outPath = argv[++i];
    } else if (!argv[i].startsWith('-') && !args.inPath) {
      args.inPath = argv[i];
    }
  }
  return args;
}

function firstNonEmpty(row, names) {
  for (const n of names) {
    const v = row[n];
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
}

function houzzTaxableToBool(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (!s) return null;
  if (s.indexOf('non') >= 0 || s === 'no' || s === 'n' || s === 'false') return false;
  if (s.indexOf('tax') >= 0 || s === 'yes' || s === 'y' || s === 'true') return true;
  return null;
}

function boolToHouzzTaxable(b) {
  return b ? 'taxable' : 'non-taxable';
}

function trackerRowToLineInput(row) {
  const category = firstNonEmpty(row, ['Category', 'category']);
  const title = firstNonEmpty(row, ['Title', 'title']);
  const description = firstNonEmpty(row, [
    'Client Description',
    'Description (client facing)',
    'Description (Client Facing)',
    'Vendor Description',
  ]);
  const itemTypeRaw = firstNonEmpty(row, ['Item Type', 'Item_Type', 'Item type']);
  let expenseType = '';
  if (itemTypeRaw) {
    const t = itemTypeRaw.toLowerCase();
    if (t.indexOf('service') >= 0 || t.indexOf('fee') >= 0 || t.indexOf('time') >= 0) {
      expenseType = 'service';
    } else if (t.indexOf('product') >= 0 || t.indexOf('goods') >= 0) {
      expenseType = 'product';
    }
  }
  const cost = parseFloat(String(row['Unit Purchase Cost'] || row['Total Purchase Cost'] || '0').replace(/[$,]/g, '')) || 0;
  return { category, title, description, expenseType, itemType: expenseType, cost, unitPurchaseCost: cost };
}

function main() {
  const { inPath, outPath: outArg } = parseArgs(process.argv);
  if (!inPath || !fs.existsSync(inPath)) {
    console.error('Usage: node tracker-add-taxable-corrected.js <tracker.xlsx> [--out corrected.xlsx]');
    process.exit(1);
  }

  const wb = XLSX.readFile(inPath);
  const sheetName = wb.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: '' });
  if (!rows.length) {
    console.error('No data rows in sheet:', sheetName);
    process.exit(1);
  }

  const hasOrig = Object.prototype.hasOwnProperty.call(rows[0], 'Taxable Item');
  if (!hasOrig) {
    console.warn('Warning: column "Taxable Item" not found — mismatch report will be empty.');
  }

  const mismatches = [];
  let correctedCount = 0;
  let mismatchCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const lineIn = trackerRowToLineInput(row);
    const shouldTax = taxRules.cchInvoiceLineCaliforniaTaxableDefault(lineIn);
    const correctedLabel = boolToHouzzTaxable(shouldTax);
    row[OUT_COL] = correctedLabel;

    const origRaw = row['Taxable Item'] || '';
    const origBool = houzzTaxableToBool(origRaw);
    const mismatch = origBool !== null && origBool !== shouldTax;
    row[MISMATCH_COL] = mismatch ? 'YES' : '';

    if (mismatch) {
      mismatchCount++;
      mismatches.push({
        row: i + 2,
        invoice: row['Invoice'] || '',
        proposal: row['Proposal'] || '',
        title: lineIn.title,
        category: lineIn.category,
        taxable_item: origRaw,
        taxable_item_corrected: correctedLabel,
      });
    }
    if (origBool !== shouldTax) correctedCount++;
  }

  const base = path.basename(inPath, path.extname(inPath));
  const dir = path.dirname(inPath);
  const outPath = outArg || path.join(dir, `${base}-tax-corrected.xlsx`);
  const csvPath = path.join(path.dirname(outPath), `${path.basename(outPath, path.extname(outPath))}-mismatches.csv`);

  const newSheet = XLSX.utils.json_to_sheet(rows);
  const newWb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(newWb, newSheet, sheetName);
  XLSX.writeFile(newWb, outPath);

  const csvLines = [
    'row,invoice,proposal,title,category,taxable_item,taxable_item_corrected',
    ...mismatches.map((m) =>
      [m.row, m.invoice, m.proposal, m.title, m.category, m.taxable_item, m.taxable_item_corrected]
        .map((c) => `"${String(c).replace(/"/g, '""')}"`)
        .join(',')
    ),
  ];
  fs.writeFileSync(csvPath, csvLines.join('\n'), 'utf8');

  console.log('Input:', inPath);
  console.log('Rows:', rows.length);
  console.log('Output workbook:', outPath);
  console.log('Mismatch CSV:', csvPath);
  console.log('Rows with YES in Taxable_Item_Mismatch:', mismatchCount);
  console.log('');
  console.log('Next: open the mismatch CSV, spot-check design fees vs furniture.');
  console.log('Then import', path.basename(outPath), 'in Studio (Houzz import uses', OUT_COL, 'first).');
}

main();
