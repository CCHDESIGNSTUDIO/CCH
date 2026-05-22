// Build a bookkeeper-ready xlsx report from the latest Phase 0.1 findings JSON.
// Output: ~/Downloads/CCH-Phase0_1-Reconciliation-Findings-May22-2026.xlsx
//
// Tabs:
//   1. Executive Summary
//   2. Invoices  — 7 actionable
//   3. POs       — 22 actionable
//   4. Backfill Lines — every Houzz line for each record
//   5. Methodology

const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');

const RUN_ID = 'recon01-2026-05-22-99474';
const INPUT_JSON = path.join(__dirname, '..', '_debug', 'recon-phase0_1-' + RUN_ID + '.json');
const OUTPUT = 'C:\\Users\\cindy\\Downloads\\CCH-Phase0_1-Reconciliation-Findings-May22-2026.xlsx';

const data = JSON.parse(fs.readFileSync(INPUT_JSON, 'utf8'));
const findings = data.findings;

const invFindings = findings.filter(f => f.kind === 'invoice');
const poFindings  = findings.filter(f => f.kind === 'purchaseOrder');

// -------------------------------------------------------------------------
// Sheet 1: Executive Summary
// -------------------------------------------------------------------------
const exec = [
  ['CCH Design Inc. — Studio Line-Item Reconciliation, Phase 0.1', ''],
  ['Generated: 2026-05-22', ''],
  ['Run ID: ' + RUN_ID, ''],
  ['', ''],
  ['Source data', ''],
  ['Houzz line detail', 'Per-project FFE Reports (Project Tracker exports)'],
  ['Studio data', 'Firestore boards/{id}/{invoices|purchaseOrders|clips}'],
  ['Reference findings', 'CCH-Reconciliation-Findings-May22-2026.xlsx (Claude / Cowork)'],
  ['', ''],
  ['Scope', ''],
  ['', '7 invoices + 22 POs from your "Studio dropped line items" / "STACKED" patterns'],
  ['', ''],
  ['At a glance', 'Count'],
  ['Total findings', findings.length],
  ['Tracker reconciles to your sheet exactly (±$1)', findings.filter(f => Math.abs(f.reconciliation.trackerVsSheetDiff) < 1).length],
  ['Houzz lines found in FFE Reports', findings.filter(f => f.houzzRecord.found).length],
  ['Studio doc in boards/*/purchaseOrders (or invoices)', findings.filter(f => f.studioRecord.found && f.studioRecord.docId !== 'clip-virtual').length],
  ['Studio clip-derived (constructed from boards/*/clips)', findings.filter(f => f.subclassification === 'STUDIO_CLIP_DERIVED').length],
  ['Studio shows partial lines (doc exists but incomplete)', findings.filter(f => f.subclassification === 'STUDIO_LINES_PARTIAL').length],
  ['', ''],
  ['Dollar exposure', ''],
  ['Total Studio gap to Houzz (sum of positive gaps)', findings.filter(f => f.reconciliation.studioGapToHouzz > 0).reduce((s,f) => s + f.reconciliation.studioGapToHouzz, 0).toFixed(2)],
  ['Largest single gap', Math.max(...findings.map(f => f.reconciliation.studioGapToHouzz)).toFixed(2)],
  ['', ''],
  ['What changed vs the Cowork report', ''],
  ['', '7 invoices were classified "Studio dropped line items" — confirmed with per-line backfill detail.'],
  ['', '22 POs were classified "STACKED" or "Studio dropped lines". 21 are stored in Studio as clips (poNum field), NOT as purchaseOrders docs.'],
  ['', 'For those 21, Studio synthesizes the PO display from clips at render time (per index.html line 19902).'],
  ['', 'Backfill action: write line items into the clip-derived virtual POs, or promote clips to actual purchaseOrders docs.'],
  ['', ''],
  ['Two data anomalies (matcher correct, source data sparse)', ''],
  ['IN-10160', 'FFE Report has $592 of lines; your sheet showed $2,043 Houzz $. Missing $1,451 isn\'t in the Project Tracker.'],
  ['PO-400079', 'FFE Report has 2 lines with $0 Total Purchase Cost; your sheet shows $476. The Houzz lines exist but have no cost recorded.'],
];

// -------------------------------------------------------------------------
// Sheet 2 & 3: Invoices / POs detail
// -------------------------------------------------------------------------
function buildDetail(set, kind) {
  const sorted = set.sort((a, b) => Math.abs(b.reconciliation.studioGapToHouzz) - Math.abs(a.reconciliation.studioGapToHouzz));
  return sorted.map(f => ({
    'Studio #':     f.studioRecord.number,
    'Project':      f.project,
    'Pattern':      f.pattern,
    'Subclass':     f.subclassification,
    'Studio $ (live Firestore)': Number(f.studioRecord.total.toFixed(2)),
    'Studio $ (Cowork sheet)':   Number((f.cynthiaReport.studioDollar||0).toFixed(2)),
    'QB $ (Cowork sheet)':       Number((f.cynthiaReport.qbDollar||0).toFixed(2)),
    'Houzz $ (Cowork sheet)':    Number((f.cynthiaReport.houzzDollar||0).toFixed(2)),
    'Houzz Total (FFE calc)':    Number(f.houzzRecord.total.toFixed(2)),
    'Houzz line count':          f.houzzRecord.lineCount,
    'Studio item count':         f.studioRecord.itemCount,
    'Δ Studio→Houzz (gap)':      Number(f.reconciliation.studioGapToHouzz.toFixed(2)),
    'Δ FFE vs Cowork sheet':     Number(f.reconciliation.trackerVsSheetDiff.toFixed(2)),
    'Studio Storage':            f.studioRecord.ref ? (f.studioRecord.ref.startsWith('boards') && f.studioRecord.ref.includes('clips') ? 'clips' : 'doc') : 'none',
    'Studio Source':             f.studioRecord.source || '',
    'Studio Status':             f.studioRecord.status || '',
    'FFE Report':                f.houzzRecord.trackerFile || '',
    'Likely Missing Line Count': f.backfill.missingCount,
    'Studio Ref':                f.studioRecord.ref || '',
  }));
}
const invRows = buildDetail(invFindings, 'invoice');
const poRows  = buildDetail(poFindings, 'purchaseOrder');

// -------------------------------------------------------------------------
// Sheet 4: Backfill Lines — every Houzz line, tagged with action
// -------------------------------------------------------------------------
const lineRows = [];
findings.forEach(f => {
  f.backfill.lines.forEach((l, i) => {
    lineRows.push({
      'Studio #':         f.studioRecord.number,
      'Kind':             f.kind,
      'Project':          f.project,
      'Pattern':          f.pattern,
      'Line #':           i + 1,
      'Title':            l.title,
      'Description':      l.description,
      'Quantity':         l.quantity,
      'Unit Selling Price':  l.unitSellPrice,
      'Total Selling Price': Number((l.totalSellPrice||0).toFixed(2)),
      'Unit Purchase Cost':  l.unitPurchaseCost,
      'Total Purchase Cost': Number((l.totalPurchaseCost||0).toFixed(2)),
      'Shipping (Sell)':  l.shipSellPrice,
      'Shipping (Cost)':  l.shipPurchaseCost,
      'Tax':              l.tax,
      'Vendor':           l.vendor,
      'Manufacturer':     l.manufacturer,
      'SKU':              l.sku,
      'Room':             l.room,
      'Category':         l.category,
      'Likely Missing in Studio': l.likelyMissing ? 'YES' : '',
      'Studio Match':     l.studioMatch ? l.studioMatch.title : '',
    });
  });
});

// -------------------------------------------------------------------------
// Sheet 5: Methodology
// -------------------------------------------------------------------------
const meth = [
  ['Phase 0.1 — Methodology', ''],
  ['', ''],
  ['1. Goal', ''],
  ['', 'For each actionable record in the Cowork findings report (May 22 v1.0), pull the per-line Houzz detail and reconcile against Studio Firestore. Output backfill source data for the bookkeeper.'],
  ['', ''],
  ['2. Source data', ''],
  ['Houzz line detail', 'Per-project FFE Report xlsx in /Houzz FILES/ARCHIVE/'],
  ['Houzz invoice total formula', 'sum(Total Selling Price) + sum(Shipping Selling Price) + sum(Sales Tax $)'],
  ['Houzz PO total formula', 'sum(Total Purchase Cost). Shipping tracked separately.'],
  ['Studio invoices', 'boards/{boardId}/invoices/{docId}  — direct doc lookup by `number` field'],
  ['Studio POs (path 1)', 'boards/{boardId}/purchaseOrders/{docId} — direct doc by `number` field'],
  ['Studio POs (path 2 — clip fallback)', 'boards/{boardId}/clips/* where poNum == Studio#. Per index.html ~line 19902, Studio synthesizes virtual PO records from these at render time.'],
  ['', ''],
  ['3. Subclassifications', ''],
  ['STUDIO_LINES_PARTIAL',  'Studio has the doc; line items incomplete vs Houzz tracker. Backfill missing lines on existing doc.'],
  ['STUDIO_CLIP_DERIVED',   'Studio shows the PO but it\'s synthesized from clips, not a real purchaseOrders doc. Backfill by writing items to the clip-virtual structure or promoting clips to a real PO doc.'],
  ['STUDIO_HEADER_ONLY',    'Doc exists but items[] empty. (Unused in this run.)'],
  ['STUDIO_NOT_IN_FIRESTORE','Not found in any path. (Unused in this run — every actionable record was found.)'],
  ['', ''],
  ['4. Bugs fixed vs Phase 0', ''],
  ['BUG 1', 'Phase 0 summed only Q*RATE from cchdesign_0427.csv. Phase 0.1 uses correct formulas (TSP+ShipSP+Tax for invoices, TPC for POs). Verified: IN-10144 and IN-10106 reconcile to the dollar against your Cowork sheet.'],
  ['BUG 2', 'Phase 0 keyed POs on Studio doc ID (po-12934). Phase 0.1 keys on user-facing PO number (PO-400082).'],
  ['BUG 3', 'Phase 0 used cchdesign_0427.csv INVOICES section which has CODE collisions across years (CODE=10106 = old Bradbury proposal AND new Shimano invoice). Per-project FFE Reports have direct Invoice Number / PO Number columns — no collision.'],
  ['BUG 4', 'cchdesign_0427.csv doesn\'t contain the new-Houzz era projects (Maverick, Bugletrail, Valentine, Morning Wood). FFE Reports cover them.'],
  ['BUG 5 (the big one)', 'Phase 0.1 originally only checked boards/{id}/purchaseOrders, found 1 of 22 POs, and falsely flagged 21 as STUDIO_DOC_MISSING. Fix: also check clips collection. After fix, 29/29 records are found in Studio.'],
  ['', ''],
  ['5. Known data anomalies', ''],
  ['IN-10160', 'FFE Report (sum TSP+Ship+Tax) = $592.35. Your Cowork sheet Houzz $ = $2,043.84. The missing $1,451 isn\'t in the Project Tracker for that invoice — may be a separate retainer transaction.'],
  ['PO-400079', 'FFE Report has 2 lines for this PO but both have $0 Total Purchase Cost. Your Cowork sheet Houzz $ = $476. The PO is real but cost data is missing in the FFE Report.'],
  ['', ''],
  ['6. What was NOT changed', ''],
  ['', 'No writes to invoices, purchaseOrders, clips, or any other Studio data.'],
  ['', 'Findings written ONLY to admin/reconciliation/' + RUN_ID + '/findings/items/* (sandboxed per recon brief Section 0).'],
];

// -------------------------------------------------------------------------
// Assemble + write
// -------------------------------------------------------------------------
const wb = XLSX.utils.book_new();
const execSh = XLSX.utils.aoa_to_sheet(exec);
execSh['!cols'] = [{ wch: 50 }, { wch: 80 }];
XLSX.utils.book_append_sheet(wb, execSh, 'Executive Summary');

const invSh = XLSX.utils.json_to_sheet(invRows);
invSh['!cols'] = [{ wch: 14 },{ wch: 22 },{ wch: 30 },{ wch: 22 },{ wch: 14 },{ wch: 14 },{ wch: 14 },{ wch: 14 },{ wch: 14 },{ wch: 14 },{ wch: 14 },{ wch: 14 },{ wch: 14 },{ wch: 14 },{ wch: 30 },{ wch: 18 },{ wch: 30 },{ wch: 16 },{ wch: 60 }];
XLSX.utils.book_append_sheet(wb, invSh, 'Invoices');

const poSh  = XLSX.utils.json_to_sheet(poRows);
poSh['!cols']  = invSh['!cols'];
XLSX.utils.book_append_sheet(wb, poSh, 'POs');

const linesSh = XLSX.utils.json_to_sheet(lineRows);
XLSX.utils.book_append_sheet(wb, linesSh, 'Backfill Lines');

const methSh = XLSX.utils.aoa_to_sheet(meth);
methSh['!cols'] = [{ wch: 30 }, { wch: 120 }];
XLSX.utils.book_append_sheet(wb, methSh, 'Methodology');

XLSX.writeFile(wb, OUTPUT);
console.log('Wrote: ' + OUTPUT);
console.log('Tabs: Executive Summary, Invoices, POs, Backfill Lines, Methodology');
console.log('Total findings: ' + findings.length);
console.log('  Invoices: ' + invFindings.length);
console.log('  POs:      ' + poFindings.length);
console.log('Total line rows: ' + lineRows.length);
