#!/usr/bin/env node
/**
 * Whitesail backfill — DRY RUN (no Firestore writes).
 *
 * Parses cchdesign_0427.csv using the xlsx library (battle-tested,
 * handles quoted fields with embedded commas + newlines correctly).
 * Filters to project "31 Whitesail" and types Invoice/PurchaseDocument.
 * Emits proposed Firestore doc bodies as JSON.
 *
 * Run: node _scripts/whitesail-backfill-dryrun.js
 * Output: Houzz FILES/_whitesail_extract/backfill-proposal.json
 */

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const SRC = 'C:\\Users\\cindy\\Dropbox\\Claude - CCH studio\\Houzz FILES\\cchdesign_0427\\cchdesign_0427.csv';
const OUT_DIR = 'C:\\Users\\cindy\\Dropbox\\Claude - CCH studio\\Houzz FILES\\_whitesail_extract';
const OUT_JSON = path.join(OUT_DIR, 'backfill-proposal.json');
const SOURCE_MARKER = 'houzz-0427-backfill';

// Column layout inferred from the visible Whitesail DOCUMENTS rows
const COL = {
  id: 0,
  name: 1,
  createdAt: 2,
  type: 3,
  projectName: 4,
  docNumber: 5,
  parentId: 6,
  dueDate: 7,
  status: 8,
  terms: 9,
  taxRate: 11,
  total: 13,
  amount: 15,
  paidOrBalance: 16,
  lastActivity: 20,
  memo: 25,
  sourceMethod: 26
};

const DOC_TYPES = new Set(['Invoice', 'PurchaseDocument', 'Estimate', 'Retainer']);

function safeFloat(v) { const n = parseFloat(String(v).replace(/[^0-9.\-]/g, '')); return Number.isFinite(n) ? n : 0; }
function safeISO(v) {
  if (!v) return '';
  const s = String(v).trim();
  if (!s) return '';
  if (s instanceof Date) return s.toISOString();
  const iso = s.replace(' ', 'T');
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? d.toISOString() : '';
}
function shortDate(v) { const iso = safeISO(v); return iso ? iso.slice(0, 10) : ''; }
function mapInvoiceStatus(houzz) {
  const s = String(houzz || '').toLowerCase();
  if (s === 'paid') return 'Paid';
  if (s === 'partiallypaid' || s === 'partial') return 'Partially Paid';
  if (s === 'partiallyinvoiced') return 'Partially Paid';
  if (s === 'draft') return 'Draft';
  if (s === 'cancelled' || s === 'canceled') return 'Cancelled';
  return 'Sent';
}
function mapPoStatus(houzz) {
  const s = String(houzz || '').toLowerCase();
  if (s === 'paid' || s === 'received') return 'Ordered';
  if (s === 'draft') return 'No status';
  return 'Ordered';
}

(async () => {
  if (!fs.existsSync(SRC)) { console.error('Source not found:', SRC); process.exit(1); }
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log('Reading 0427 via xlsx...');
  const wb = XLSX.readFile(SRC, { raw: true, codepage: 65001 });
  const sheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', blankrows: true, raw: false });
  console.log(`Total rows: ${rows.length}`);

  // Filter to Whitesail docs
  const whitesailDocs = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!Array.isArray(row)) continue;
    const type = String(row[COL.type] || '').trim();
    if (!DOC_TYPES.has(type)) continue;
    const projectName = String(row[COL.projectName] || '').trim();
    if (projectName !== '31 Whitesail') continue;
    whitesailDocs.push({
      _row: i + 1,
      id: row[COL.id],
      name: row[COL.name],
      createdAt: row[COL.createdAt],
      type,
      projectName,
      docNumber: row[COL.docNumber],
      parentId: row[COL.parentId],
      dueDate: row[COL.dueDate],
      status: row[COL.status],
      terms: row[COL.terms],
      taxRate: row[COL.taxRate],
      total: row[COL.total],
      amount: row[COL.amount],
      paidOrBalance: row[COL.paidOrBalance],
      lastActivity: row[COL.lastActivity],
      sourceMethod: row[COL.sourceMethod]
    });
  }

  console.log(`Whitesail docs found: ${whitesailDocs.length}`);

  // Split by type
  const invoices = whitesailDocs.filter(d => d.type === 'Invoice');
  const pos = whitesailDocs.filter(d => d.type === 'PurchaseDocument');
  const estimates = whitesailDocs.filter(d => d.type === 'Estimate');

  const now = new Date().toISOString();

  const invoiceDocs = invoices.map(d => {
    const status = mapInvoiceStatus(d.status);
    const total = safeFloat(d.total);
    const isPaid = status === 'Paid';
    return {
      _firestorePath: `boards/31-whitesail/invoices/{auto}`,
      invoiceNum: String(d.docNumber || ''),
      number: String(d.docNumber || ''),
      name: d.name || '',
      status,
      total,
      paidAmount: isPaid ? total : 0,
      payments: isPaid ? [{
        amount: total,
        date: shortDate(d.lastActivity) || shortDate(d.createdAt),
        method: 'Houzz',
        note: 'Backfilled from cchdesign_0427.csv (Houzz Paid status)',
        _source: SOURCE_MARKER
      }] : [],
      dueDate: shortDate(d.dueDate),
      datePaid: isPaid ? (shortDate(d.lastActivity) || shortDate(d.createdAt)) : '',
      taxRate: safeFloat(d.taxRate),
      terms: d.terms || '',
      items: [],
      published: false,
      createdAt: safeISO(d.createdAt) || now,
      updatedAt: now,
      _source: SOURCE_MARKER,
      _houzzId: String(d.id),
      _houzzType: d.type,
      _houzzStatus: d.status,
      _houzzParentEstimateId: String(d.parentId || ''),
      _backfillNote: 'Doc shell only — line items not populated. Run line-item backfill pass next.'
    };
  });

  const poDocs = pos.map(d => {
    const total = safeFloat(d.total);
    const status = mapPoStatus(d.status);
    const isPaid = String(d.status || '').toLowerCase() === 'paid';
    return {
      _firestorePath: `boards/31-whitesail/purchaseOrders/{auto}`,
      poNum: String(d.docNumber || ''),
      number: String(d.docNumber || ''),
      name: d.name || '',
      status,
      vendor: '',
      total,
      paidAmount: isPaid ? total : 0,
      items: [{
        title: d.name || '',
        cost: total,
        qty: 1,
        amount: total,
        _source: SOURCE_MARKER,
        _houzzPoId: String(d.id)
      }],
      published: false,
      createdAt: safeISO(d.createdAt) || now,
      updatedAt: now,
      _source: SOURCE_MARKER,
      _houzzId: String(d.id),
      _houzzType: d.type,
      _houzzStatus: d.status,
      _houzzParentInvoiceId: String(d.parentId || ''),
      _backfillNote: 'Vendor empty — DOCUMENTS section has no vendor field. Resolve from PRODUCTS section in follow-up pass.'
    };
  });

  const proposal = {
    generatedAt: now,
    source: SRC,
    sourceMarker: SOURCE_MARKER,
    targetProject: '31-whitesail',
    decisions: {
      skipEstimates: true,
      reason: 'Studio has 3 existing Draft proposals (manual, distinct dates). Importing Houzz Estimates would create parallel proposals.'
    },
    totals: {
      whitesailDocsFound: whitesailDocs.length,
      invoices: invoiceDocs.length,
      purchaseOrders: poDocs.length,
      estimatesSkipped: estimates.length
    },
    invoices: invoiceDocs,
    purchaseOrders: poDocs,
    estimatesSkipped: estimates.map(d => ({ docNumber: d.docNumber, name: d.name, status: d.status, total: safeFloat(d.total), createdAt: safeISO(d.createdAt), _houzzId: String(d.id) }))
  };

  fs.writeFileSync(OUT_JSON, JSON.stringify(proposal, null, 2), 'utf8');

  console.log('\n=== Whitesail backfill DRY RUN ===');
  console.log(`Whitesail docs found:    ${whitesailDocs.length}`);
  console.log(`  Invoices to create:    ${invoiceDocs.length}`);
  console.log(`  POs to create:         ${poDocs.length}`);
  console.log(`  Estimates skipped:     ${estimates.length}`);
  console.log('');
  console.log('INVOICES:');
  for (const d of invoiceDocs) {
    console.log(`  #${String(d.invoiceNum).padEnd(8)} ${d.status.padEnd(15)} $${d.total.toFixed(2).padStart(10)}  due ${d.dueDate || '—'.padEnd(10)}  paid ${d.datePaid || '—'.padEnd(10)}  houzzId=${d._houzzId}`);
  }
  console.log('\nPURCHASE ORDERS:');
  for (const d of poDocs) {
    console.log(`  #${String(d.poNum).padEnd(8)} ${d.status.padEnd(15)} $${d.total.toFixed(2).padStart(10)}  ${(d.name || '').slice(0, 50).padEnd(50)} -> inv ${d._houzzParentInvoiceId}`);
  }
  console.log('\nESTIMATES SKIPPED (for your reference):');
  for (const d of proposal.estimatesSkipped) {
    console.log(`  #${String(d.docNumber).padEnd(8)} ${String(d.status).padEnd(20)} $${d.total.toFixed(2).padStart(10)}  ${d.createdAt.slice(0,10)}`);
  }
  console.log('\nProposal JSON: ' + OUT_JSON);
})();
