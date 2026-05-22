// =========================================================================
// recon-phase0_1.js — Phase 0.1 line-item backfill matcher
//
// Scope: For the 29 actionable records from the May 22 reconciliation report
//   (CCH-Reconciliation-Findings-May22-2026.xlsx — patterns "Studio dropped
//   line items" + "STACKED"), produce per-line Houzz backfill detail joined
//   from project-level FFE Reports.
//
// Inputs (READ-ONLY):
//   - Cynthia's xlsx findings report (actionable record list)
//   - Per-project Project Tracker FFE Reports (line-level Houzz data)
//   - Studio Firestore boards/{projectId}/invoices/* and /purchaseOrders/*
//
// Writes (sandboxed per brief):
//   - admin/reconciliation/{newRunId}/_meta
//   - admin/reconciliation/{newRunId}/findings/items/{auto}
//
// Bug fixes vs Phase 0:
//   - BUG 1 (totals): correct formula is sum(Total Selling Price) +
//     sum(Shipping Selling Price) + sum(Sales Tax $). Phase 0 summed only
//     Q*RATE from 0427 INVOICE_ITEMS, missing markup, shipping, and tax.
//     Verified against IN-10144 ($96,059.32) and IN-10106 ($41,071.14) —
//     exact match.
//   - BUG 2 (PO join key): Phase 0 keyed on Studio doc ID (po-12934); new
//     matcher keys on Studio `number` field (PO-400082, PO-24-400020).
//   - BUG 3 (CODE collision): Phase 0 used 0427 INVOICES section, which
//     reuses CODE values across decades and includes proposals + retainers
//     under same CODE. New matcher uses per-project FFE Reports which have
//     direct Invoice Number / Purchase Order Number columns — no collision.
//   - BUG 4 (era mismatch): 0427 contains legacy-Houzz era only; her actionable
//     records are all new-Houzz era projects (Shimano- Maverick Cir., 7225
//     Bugletrail, Valentine, Morning Wood Dr) not present in 0427. Per-project
//     FFE Reports cover the new-Houzz era.
//
// Usage:
//   node _scripts/recon-phase0_1.js              # dry-run, writes local JSON
//   node _scripts/recon-phase0_1.js --apply      # writes findings to Firestore
//   node _scripts/recon-phase0_1.js --apply --delete-old   # also deletes
//                                                          # old Phase 0 run
// =========================================================================

const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');

const APPLY = process.argv.includes('--apply');
const DELETE_OLD = process.argv.includes('--delete-old');
// Previous broken Phase 0.1 run (no clip fallback) — delete with --delete-old
const OLD_RUN_ID = 'recon01-2026-05-22-68417';
const RUN_ID = 'recon01-' + new Date().toISOString().slice(0,10) + '-' + String(Math.floor(Math.random()*100000)).padStart(5,'0');

const FINDINGS_XLSX = 'C:\\Users\\cindy\\Downloads\\CCH-Reconciliation-Findings-May22-2026.xlsx';
const HOUZZ_ARCHIVE = 'C:\\Users\\cindy\\Dropbox\\Claude - CCH studio\\Houzz FILES\\ARCHIVE';

// Project name -> FFE Report file
const PROJECT_FILES = {
  'Shimano- Maverick Cir.': 'Shimano- Maverick Cir. Report.xlsx',
  '7225 Bugletrail':        '7225 Bugletrail Report FFE.xlsx',
  'Valentine':              'Valentine Report FFE.xlsx',
  'Morning Wood Dr':        'Morning Wood Dr Report FFE.xlsx',
};

// Project name -> Studio board ID (boards/{boardId})
// Best-guess slugs; verified against Firestore at runtime
const PROJECT_BOARD_ID = {
  'Shimano- Maverick Cir.': 'shimano-maverick-cir',
  '7225 Bugletrail':        '7225-bugletrail',
  'Valentine':              'valentine',
  'Morning Wood Dr':        'morning-wood-dr',
};

const PROD_KEY = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');

const num = v => parseFloat(String(v == null ? '' : v).replace(/[$,]/g, '')) || 0;

// -------------------------------------------------------------------------
// 1. Read Cynthia's actionable list from the findings xlsx
// -------------------------------------------------------------------------
function readFindingsXlsx() {
  const wb = XLSX.readFile(FINDINGS_XLSX);
  function readSheet(name) {
    const sh = wb.Sheets[name];
    const rows = XLSX.utils.sheet_to_json(sh, { header: 1, defval: '', blankrows: false });
    const headers = rows[2].map(h => String(h).trim());
    return rows.slice(3).map(r => {
      const o = {};
      headers.forEach((h, i) => { o[h] = r[i]; });
      return o;
    });
  }
  const invoices = readSheet('Invoices');
  const pos      = readSheet('POs');

  const actionableInv = invoices.filter(r =>
    /Studio dropped line items/i.test(String(r.Pattern || '')) ||
    /STACKED|stacked/i.test(String(r.Pattern || ''))
  );
  const actionablePO = pos.filter(r =>
    /Studio dropped line items/i.test(String(r.Pattern || '')) ||
    /STACKED|stacked/i.test(String(r.Pattern || ''))
  );

  return {
    invoices: actionableInv.map(r => ({
      kind: 'invoice',
      number: String(r['Studio #'] || '').trim(),
      project: String(r.Project || '').trim(),
      pattern: String(r.Pattern || '').trim(),
      studioDollar: num(r['Studio $']),
      qbDollar: num(r['QB $']),
      houzzDollar: num(r['Houzz $']),
    })),
    pos: actionablePO.map(r => ({
      kind: 'purchaseOrder',
      number: String(r['Studio #'] || '').trim(),
      project: String(r.Project || r.Vendor || '').trim(),
      pattern: String(r.Pattern || '').trim(),
      studioDollar: num(r['Studio $']),
      qbDollar: num(r['QB $']),
      houzzDollar: num(r['Houzz $']),
    })),
  };
}

// -------------------------------------------------------------------------
// 2. Load FFE Reports per project; index by Invoice Number / PO Number
// -------------------------------------------------------------------------
function loadProjectTracker(projectName) {
  const fname = PROJECT_FILES[projectName];
  if (!fname) return null;
  const fp = path.join(HOUZZ_ARCHIVE, fname);
  if (!fs.existsSync(fp)) return null;
  const wb = XLSX.readFile(fp);
  const sh = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sh, { header: 1, defval: '', blankrows: false });
  const headers = rows[0].map(h => String(h || '').trim());
  const idx = name => headers.findIndex(h => h === name);

  const cInv     = idx('Invoice Number');
  const cPO      = idx('Purchase Order Number');
  const cTitle   = idx('Title');
  const cDesc    = idx('Description (client facing)');
  const cQty     = idx('Quantity');
  const cUSP     = idx('Unit Selling Price');
  const cTSP     = idx('Total Selling Price');
  const cTax     = idx('Sales Tax $');
  const cShipSP  = idx('Shipping Selling Price');
  const cShipPC  = idx('Shipping Purchase Cost');
  const cTaxable = idx('Taxable Item');
  const cTaxPct  = idx('Sales Tax %');
  const cVendor  = idx('Vendor');
  const cSKU     = idx('SKU');
  const cMfg     = idx('Manufacturer');
  const cRoom    = idx('Room');
  const cCategory= idx('Category');
  const cUnitType= idx('Unit Type');
  const cMarkupPct = idx('Markup %');
  const cUnitPC  = idx('Unit Purchase Cost');
  const cTotalPC = idx('Total Purchase Cost');

  const byInv = new Map();
  const byPO  = new Map();
  rows.slice(1).forEach((r, rowIdx) => {
    const line = {
      sourceRow: rowIdx + 2,
      title:        String(r[cTitle] || ''),
      description:  String(r[cDesc] || ''),
      quantity:     num(r[cQty]),
      unitSellPrice:num(r[cUSP]),
      totalSellPrice:num(r[cTSP]),
      tax:          num(r[cTax]),
      shipSellPrice:num(r[cShipSP]),
      shipPurchaseCost:num(r[cShipPC]),
      taxable:      String(r[cTaxable] || ''),
      taxPct:       num(r[cTaxPct]),
      vendor:       String(r[cVendor] || ''),
      sku:          String(r[cSKU] || ''),
      manufacturer: String(r[cMfg] || ''),
      room:         String(r[cRoom] || ''),
      category:     String(r[cCategory] || ''),
      unitType:     String(r[cUnitType] || ''),
      markupPct:    num(r[cMarkupPct]),
      unitPurchaseCost: num(r[cUnitPC]),
      totalPurchaseCost:num(r[cTotalPC]),
    };
    const invNum = String(r[cInv] || '').trim();
    const poNum  = String(r[cPO] || '').trim();
    if (invNum) {
      if (!byInv.has(invNum)) byInv.set(invNum, []);
      byInv.get(invNum).push(line);
    }
    if (poNum) {
      if (!byPO.has(poNum)) byPO.set(poNum, []);
      byPO.get(poNum).push(line);
    }
  });
  return { byInv, byPO, project: projectName, source: fname };
}

function sumHouzzInvoice(lines) {
  // Invoice: client-facing totals = selling price + shipping selling + tax
  let tsp = 0, ship = 0, tax = 0;
  lines.forEach(l => { tsp += l.totalSellPrice; ship += l.shipSellPrice; tax += l.tax; });
  return { tsp, ship, tax, total: tsp + ship + tax, formula: 'TSP + ShipSP + Tax' };
}
function sumHouzzPO(lines) {
  // PO: vendor PO total = sum of Total Purchase Cost (no markup, no tax)
  // Shipping is tracked separately for transparency but excluded from main total
  // (verified: this matches Cynthia's report Houzz $ for PO-400082 and PO-400024)
  let tpc = 0, shipPC = 0;
  lines.forEach(l => { tpc += l.totalPurchaseCost; shipPC += l.shipPurchaseCost; });
  return { tpc, shipPC, tsp: tpc, ship: 0, tax: 0, total: tpc, shippingExcluded: shipPC, formula: 'sum(TPC); shipping tracked separately' };
}

// -------------------------------------------------------------------------
// 3. Read Studio Firestore items[] for each actionable record
// -------------------------------------------------------------------------
async function readStudioRecord(db, projectName, kind, number) {
  const boardId = PROJECT_BOARD_ID[projectName];
  if (!boardId) return null;
  const col = kind === 'invoice' ? 'invoices' : 'purchaseOrders';
  // 1. Try lookup by `number` field in canonical subcollection
  const q = await db.collection('boards').doc(boardId).collection(col).where('number', '==', number).limit(1).get();
  if (!q.empty) {
    const d = q.docs[0];
    return { ref: `boards/${boardId}/${col}/${d.id}`, docId: d.id, data: d.data(), storage: 'doc' };
  }
  // 2. Try docId == number (legacy pattern)
  const direct = await db.collection('boards').doc(boardId).collection(col).doc(number).get();
  if (direct.exists) {
    return { ref: `boards/${boardId}/${col}/${number}`, docId: number, data: direct.data(), storage: 'doc' };
  }
  // 3. Fallback: clip-derived virtual record
  // Per platform/index.html line 19902-19942, Studio constructs virtual POs from
  // boards/{id}/clips/* where poNum matches. Same idea for invoices via invoiceNum.
  const clipField = kind === 'invoice' ? 'invoiceNum' : 'poNum';
  const clipsSnap = await db.collection('boards').doc(boardId).collection('clips').where(clipField, '==', number).get();
  if (!clipsSnap.empty) {
    let total = 0, sellTotal = 0, vendor = '';
    const items = [];
    clipsSnap.forEach(d => {
      const c = d.data();
      const cost = parseFloat(c.totalCost || c.cost) || 0;
      const sell = parseFloat(c.totalSelling || c.clientPrice) || 0;
      total += cost;
      sellTotal += sell;
      if (!vendor && c.vendor) vendor = c.vendor;
      // For POs, "total" is purchase cost. For invoices clipped, it's selling price.
      const lineTotal = (kind === 'invoice') ? sell : cost;
      items.push({
        title: c.title || '',
        vendor: c.vendor || '',
        room: c.room || '',
        category: c.category || '',
        quantity: parseFloat(c.qty || 1),
        cost,
        clientPrice: sell,
        total: lineTotal,
        clipId: d.id,
      });
    });
    return {
      ref: `boards/${boardId}/clips/* where ${clipField}==${number}`,
      docId: 'clip-virtual',
      storage: 'clips',
      clipCount: clipsSnap.size,
      data: { number, vendor, total, sellTotal, items, source: 'clips' },
    };
  }
  return null;
}

// -------------------------------------------------------------------------
// 4. Compare Studio items[] to Houzz lines; tag candidate backfills
// -------------------------------------------------------------------------
function classifyBackfill(studioItems, houzzLines) {
  // Normalize Studio items
  const sItems = (Array.isArray(studioItems) ? studioItems : []).map(it => ({
    title:    String(it.title || it.name || it.productName || '').toLowerCase().trim(),
    qty:      num(it.quantity || it.qty),
    total:    num(it.total || it.amount || it.lineTotal || it.priceTotal),
    raw: it,
  }));

  // For each Houzz line, find best Studio match
  const out = [];
  houzzLines.forEach(hl => {
    const hTitle = String(hl.title || '').toLowerCase().trim();
    const cand = sItems.find(si =>
      si.title === hTitle ||
      (hTitle && si.title && (si.title.startsWith(hTitle.slice(0, 12)) || hTitle.startsWith(si.title.slice(0, 12))))
    );
    out.push({
      ...hl,
      studioMatch: cand ? { title: cand.raw.title || cand.raw.name, qty: cand.qty, total: cand.total } : null,
      likelyMissing: !cand,
    });
  });
  const missingCount = out.filter(x => x.likelyMissing).length;
  return { houzzLinesEnriched: out, missingCount };
}

// -------------------------------------------------------------------------
// 5. Main
// -------------------------------------------------------------------------
(async () => {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('Phase 0.1 — line-item backfill matcher (FFE Report join)');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('Mode:', APPLY ? 'APPLY (writes to Firestore)' : 'DRY-RUN (local report only)');
  console.log('Run ID:', RUN_ID);
  console.log('Delete old findings:', DELETE_OLD ? 'YES (admin/reconciliation/' + OLD_RUN_ID + ')' : 'NO');
  console.log('');

  console.log('[1/5] Reading actionable list from findings xlsx...');
  const actionable = readFindingsXlsx();
  console.log('  Actionable invoices:', actionable.invoices.length);
  console.log('  Actionable POs:     ', actionable.pos.length);

  console.log('[2/5] Loading FFE Reports per project...');
  const trackers = {};
  for (const proj of Object.keys(PROJECT_FILES)) {
    trackers[proj] = loadProjectTracker(proj);
    if (!trackers[proj]) {
      console.log('  ! Missing tracker for: ' + proj);
    } else {
      console.log('  ' + proj + ': INV=' + trackers[proj].byInv.size + ' PO=' + trackers[proj].byPO.size);
    }
  }

  console.log('[3/5] Reading Studio Firestore (READ-ONLY)...');
  const admin = require('firebase-admin');
  const sa = require(PROD_KEY);
  admin.initializeApp({ credential: admin.credential.cert(sa) });
  const db = admin.firestore();

  const findings = [];
  const all = [...actionable.invoices, ...actionable.pos];
  console.log('  Resolving ' + all.length + ' Studio records...');

  for (const a of all) {
    const tracker = trackers[a.project];
    let houzzLines = [];
    let trackerFound = !!tracker;
    if (tracker) {
      const map = a.kind === 'invoice' ? tracker.byInv : tracker.byPO;
      houzzLines = map.get(a.number) || [];
    }
    const houzzTotals = a.kind === 'invoice'
      ? sumHouzzInvoice(houzzLines)
      : sumHouzzPO(houzzLines);

    const studioRec = await readStudioRecord(db, a.project, a.kind, a.number);
    const studioItems = studioRec && studioRec.data ? (studioRec.data.items || studioRec.data.lineItems || []) : [];
    // For clip-derived invoices use sellTotal; otherwise data.total
    let studioTotal = 0;
    if (studioRec && studioRec.data) {
      if (studioRec.storage === 'clips' && a.kind === 'invoice') {
        studioTotal = num(studioRec.data.sellTotal);
      } else {
        studioTotal = num(studioRec.data.total || studioRec.data.grandTotal || studioRec.data.totalAmount);
      }
    }
    const classify = classifyBackfill(studioItems, houzzLines);

    // Classification: studio doc absent entirely vs lines partial vs clip-derived
    let subclass;
    if (!studioRec) subclass = 'STUDIO_NOT_IN_FIRESTORE';                     // not found in any path
    else if (studioRec.storage === 'clips') subclass = 'STUDIO_CLIP_DERIVED'; // Studio shows it but synthesizes from clips
    else if (studioItems.length === 0) subclass = 'STUDIO_HEADER_ONLY';       // doc exists, no items[]
    else if (Math.abs(studioTotal - houzzTotals.total) < 1) subclass = 'STUDIO_TOTAL_MATCHES_HOUZZ';
    else subclass = 'STUDIO_LINES_PARTIAL';                                   // doc exists, lines incomplete

    const finding = {
      phase: 0.1,
      classification: 'STUDIO_MISSING_LINES_V2',
      subclassification: subclass,
      kind: a.kind,
      pattern: a.pattern,
      project: a.project,
      studioRecord: {
        ref:       studioRec ? studioRec.ref : null,
        found:     !!studioRec,
        docId:     studioRec ? studioRec.docId : null,
        number:    a.number,
        total:     studioTotal,
        itemCount: studioItems.length,
        source:    studioRec && studioRec.data ? (studioRec.data.source || null) : null,
        status:    studioRec && studioRec.data ? (studioRec.data.status || null) : null,
      },
      houzzRecord: {
        found:        houzzLines.length > 0,
        trackerFile:  tracker ? tracker.source : null,
        lineCount:    houzzLines.length,
        totalTSP:     houzzTotals.tsp,
        totalShip:    houzzTotals.ship,
        totalTax:     houzzTotals.tax,
        total:        houzzTotals.total,
        formula:      houzzTotals.formula,
      },
      cynthiaReport: {
        studioDollar: a.studioDollar,
        qbDollar:     a.qbDollar,
        houzzDollar:  a.houzzDollar,
      },
      reconciliation: {
        // Does my tracker total agree with her sheet's Houzz $?
        trackerVsSheetDiff: houzzTotals.total - a.houzzDollar,
        // What does Studio actually owe to reach Houzz total?
        studioGapToHouzz:   houzzTotals.total - studioTotal,
        // Cross-check: studio total here vs her Studio $
        studioVsSheetDiff:  studioTotal - a.studioDollar,
      },
      backfill: {
        missingCount:   classify.missingCount,
        lines:          classify.houzzLinesEnriched,
      },
      generatedAt: new Date().toISOString(),
    };
    findings.push(finding);
  }

  // -------------------------------------------------------------------------
  // 6. Local report (always)
  // -------------------------------------------------------------------------
  const reportDir = path.join(__dirname, '..', '_debug');
  if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });
  const localJson = path.join(reportDir, 'recon-phase0_1-' + RUN_ID + '.json');
  fs.writeFileSync(localJson, JSON.stringify({ runId: RUN_ID, generatedAt: new Date().toISOString(), findings }, null, 2));
  console.log('  Local JSON: ' + localJson);

  // Also emit a flat xlsx summary
  const summaryRows = findings.map(f => ({
    Kind:          f.kind,
    Subclass:      f.subclassification,
    Pattern:       f.pattern,
    Project:       f.project,
    'Studio #':    f.studioRecord.number,
    'Studio Ref':  f.studioRecord.ref,
    'Studio Found':f.studioRecord.found ? 'YES' : 'NO',
    'Studio Item Count': f.studioRecord.itemCount,
    'Studio $ (Firestore)': f.studioRecord.total,
    'Studio $ (her sheet)': f.cynthiaReport.studioDollar,
    'Houzz Lines Found':    f.houzzRecord.lineCount,
    'Houzz TSP':            f.houzzRecord.totalTSP.toFixed(2),
    'Houzz Ship':           f.houzzRecord.totalShip.toFixed(2),
    'Houzz Tax':            f.houzzRecord.totalTax.toFixed(2),
    'Houzz Total (calc)':   f.houzzRecord.total.toFixed(2),
    'Houzz $ (her sheet)':  f.cynthiaReport.houzzDollar,
    'Tracker vs Sheet Δ':   f.reconciliation.trackerVsSheetDiff.toFixed(2),
    'Studio Gap to Houzz':  f.reconciliation.studioGapToHouzz.toFixed(2),
    'Likely Missing Lines': f.backfill.missingCount,
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), 'Summary');
  // Per-record line dump
  const lineRows = [];
  findings.forEach(f => {
    f.backfill.lines.forEach(l => {
      lineRows.push({
        Kind:        f.kind,
        'Studio #':  f.studioRecord.number,
        Project:     f.project,
        Title:       l.title,
        Description: l.description,
        Quantity:    l.quantity,
        'Unit Sell': l.unitSellPrice,
        'Total Sell':l.totalSellPrice,
        Tax:         l.tax,
        Ship:        l.shipSellPrice,
        Vendor:      l.vendor,
        SKU:         l.sku,
        Manufacturer:l.manufacturer,
        Room:        l.room,
        Category:    l.category,
        'Likely Missing in Studio': l.likelyMissing ? 'YES' : '',
        'Studio Match Title': l.studioMatch ? l.studioMatch.title : '',
      });
    });
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(lineRows), 'Lines');
  const localXlsx = path.join(reportDir, 'recon-phase0_1-' + RUN_ID + '.xlsx');
  XLSX.writeFile(wb, localXlsx);
  console.log('  Local XLSX: ' + localXlsx);

  // Summary console
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('PHASE 0.1 RESULTS');
  console.log('═══════════════════════════════════════════════════════════════');
  const found = findings.filter(f => f.studioRecord.found).length;
  const houzzMatched = findings.filter(f => f.houzzRecord.found).length;
  const reconciledOK = findings.filter(f => Math.abs(f.reconciliation.trackerVsSheetDiff) < 1).length;
  console.log('Total findings:                       ', findings.length);
  console.log('Studio doc found in Firestore:        ', found, '/', findings.length);
  console.log('Houzz lines found in FFE Report:      ', houzzMatched, '/', findings.length);
  console.log('Tracker total reconciles to her sheet:', reconciledOK, '/', findings.length);
  console.log('');
  // Subclass counts
  const subCounts = {};
  findings.forEach(f => { subCounts[f.subclassification] = (subCounts[f.subclassification]||0)+1; });
  console.log('Subclassification counts:');
  Object.entries(subCounts).forEach(([k,v]) => console.log('  ' + k.padEnd(30) + ' ' + v));
  console.log('');
  console.log('Per-record summary:');
  findings.forEach(f => {
    const flag = (Math.abs(f.reconciliation.trackerVsSheetDiff) < 1 ? 'OK' : 'Δ');
    console.log('  ' + flag + ' ' + f.kind.padEnd(14) + ' ' + (f.studioRecord.number || '').padEnd(16) + ' ' +
      (f.subclassification || '').padEnd(28) + ' ' +
      ('houzz_lines=' + f.houzzRecord.lineCount).padEnd(18) + ' ' +
      ('houzz_total=' + f.houzzRecord.total.toFixed(2)).padEnd(22) + ' ' +
      ('sheet=' + f.cynthiaReport.houzzDollar.toFixed(2)).padEnd(18) + ' ' +
      ('gap=' + f.reconciliation.studioGapToHouzz.toFixed(2)).padEnd(16));
  });

  if (!APPLY) {
    console.log('');
    console.log('DRY-RUN — no Firestore writes. Re-run with --apply to write findings.');
    process.exit(0);
  }

  // -------------------------------------------------------------------------
  // 7. APPLY: write new findings, optionally delete old run
  // -------------------------------------------------------------------------
  function nullifyUndefined(v) {
    if (v === undefined) return null;
    if (v === null) return null;
    if (Array.isArray(v)) return v.map(nullifyUndefined);
    if (typeof v === 'object') {
      const out = {};
      for (const k of Object.keys(v)) out[k] = nullifyUndefined(v[k]);
      return out;
    }
    return v;
  }

  console.log('');
  console.log('Writing findings to admin/reconciliation/' + RUN_ID + '/findings/items/* ...');
  const runMeta = db.collection('admin').doc('reconciliation').collection(RUN_ID).doc('_meta');
  await runMeta.set(nullifyUndefined({
    runId: RUN_ID, phase: 0.1, startedAt: new Date().toISOString(), mode: 'apply',
    tool: '_scripts/recon-phase0_1.js',
    inputs: { findingsXlsx: FINDINGS_XLSX, houzzArchive: HOUZZ_ARCHIVE },
    stats: {
      totalFindings: findings.length,
      studioFound: found, houzzMatched, reconciledOK,
    },
  }));
  const BATCH = 200;
  let written = 0;
  let batch = db.batch();
  let n = 0;
  for (const f of findings) {
    const ref = db.collection('admin').doc('reconciliation').collection(RUN_ID).doc('findings').collection('items').doc();
    batch.set(ref, nullifyUndefined(f));
    n++;
    if (n >= BATCH) { await batch.commit(); written += n; n = 0; batch = db.batch(); }
  }
  if (n > 0) { await batch.commit(); written += n; }
  console.log('Wrote ' + written + ' findings.');

  if (DELETE_OLD) {
    console.log('');
    console.log('Deleting old Phase 0 run: admin/reconciliation/' + OLD_RUN_ID + ' ...');
    // Delete _meta
    const oldMeta = db.collection('admin').doc('reconciliation').collection(OLD_RUN_ID).doc('_meta');
    await oldMeta.delete().catch(() => {});
    // Delete findings/items in batches
    const itemsCol = db.collection('admin').doc('reconciliation').collection(OLD_RUN_ID).doc('findings').collection('items');
    let total = 0;
    while (true) {
      const snap = await itemsCol.limit(400).get();
      if (snap.empty) break;
      const b = db.batch();
      snap.docs.forEach(d => b.delete(d.ref));
      await b.commit();
      total += snap.size;
      console.log('  Deleted ' + total + ' old findings...');
    }
    // Delete findings/_root if present (just in case)
    await db.collection('admin').doc('reconciliation').collection(OLD_RUN_ID).doc('findings').delete().catch(() => {});
    console.log('Deleted ' + total + ' old findings + meta.');
  }

  console.log('');
  console.log('Done. New run: admin/reconciliation/' + RUN_ID);
  process.exit(0);
})().catch(e => { console.error('FATAL:', e); process.exit(1); });
