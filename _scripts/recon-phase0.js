#!/usr/bin/env node
/**
 * STUDIO ↔ QB RECONCILIATION ENGINE — Phase 0 only.
 *
 * Per the spec v1.2 Section 0 write matrix:
 *   - READ-ONLY on Studio financial data (invoices, POs, line items)
 *   - READ-ONLY on Houzz source data (0427 CSV)
 *   - WRITES exclusively to admin/reconciliation/{runId}/findings/{findingId}
 *   - NEVER writes to any board, invoice, PO, or line-item field
 *
 * Phase 0 algorithm (Section 5.1):
 *   For every Studio invoice/PO whose source flag indicates Houzz origin,
 *   find the corresponding Houzz record in 0427, diff line items, and write
 *   a finding if any Houzz lines are missing from the Studio doc.
 *
 * Run modes:
 *   node _scripts/recon-phase0.js           # dry-run — no writes
 *   node _scripts/recon-phase0.js --apply   # writes findings only
 *
 * Output:
 *   - Console summary
 *   - Local report at _debug/recon-phase0-{runId}.json
 *   - With --apply: findings written to admin/reconciliation/{runId}/findings/*
 */

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const admin = require('firebase-admin');

// ── Configuration ────────────────────────────────────────────────────────
const APPLY = process.argv.includes('--apply');

const HOUZZ_CSV = 'C:\\Users\\cindy\\Dropbox\\Claude - CCH studio\\Houzz FILES\\cchdesign_0427\\cchdesign_0427.csv';
const PROD_KEY = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
const REPORT_DIR = path.join(__dirname, '..', '_debug');

// Studio source-flag values that indicate Houzz origin.
const HOUZZ_SOURCE_FLAGS = new Set([
  'houzz-import',
  'new-houzz',
  'old-houzz',
  'legacy-houzz',
]);
const HOUZZ_UNDERSCORE_SOURCE_FLAGS = new Set([
  'houzz-0427-backfill', // my May 13 backfill marker
]);

// Run identifier (per Section 8.1 schema)
const RUN_ID = (() => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `recon-${yyyy}-${mm}-${dd}-${String(Math.floor(d.getTime() / 1000) % 100000).padStart(5, '0')}`;
})();

// ── Helpers ──────────────────────────────────────────────────────────────

function normCore(num) {
  // Strip IN-/PO-/RR-/PRO-/BL- prefix and any year prefix like "24-".
  if (num == null) return '';
  return String(num).toUpperCase().trim()
    .replace(/^(IN|PO|RR|PRO|BL)-?/, '')
    .replace(/^(\d{2})-/, '')
    .replace(/\s+/g, '')
    .replace(/^0+/, '');
}

function normDesc(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function descSimilar(a, b) {
  const na = normDesc(a);
  const nb = normDesc(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.length >= 4 && nb.length >= 4) {
    if (na.includes(nb) || nb.includes(na)) return true;
  }
  // Jaccard token overlap ≥ 0.6 as backup
  const ta = new Set(na.split(' ').filter(t => t.length >= 2));
  const tb = new Set(nb.split(' ').filter(t => t.length >= 2));
  if (!ta.size || !tb.size) return false;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  const union = ta.size + tb.size - inter;
  return union > 0 && inter / union >= 0.6;
}

function amountClose(a, b, tol) {
  const x = Number(a) || 0;
  const y = Number(b) || 0;
  return Math.abs(x - y) <= (tol == null ? 0.01 : tol);
}

function safeNum(v) {
  if (v == null || v === '') return 0;
  const s = String(v).replace(/[$,]/g, '').trim();
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

function classifyLine(desc) {
  const s = normDesc(desc);
  if (!s) return 'other';
  if (/(^|\s)(ship|freight|delivery)(\s|$|ping)/.test(s)) return 'shipping';
  if (/install|labor/.test(s)) return 'install';
  if (/(^|\s)tax(\s|$)/.test(s) || /sales tax/.test(s)) return 'tax';
  return 'other';
}

// ── 0427 CSV section parser ──────────────────────────────────────────────

/**
 * Parse cchdesign_0427.csv into named sections.
 * The file is one big CSV with multiple sections; each section starts
 * with an all-caps single-cell row (e.g. "INVOICES") followed by a blank
 * row, then the column-header row, then data rows until the next section.
 */
function loadHouzzSections(csvPath) {
  console.log('  Reading Houzz 0427 (this takes ~20s)...');
  const wb = XLSX.readFile(csvPath, { raw: true, codepage: 65001 });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', blankrows: true, raw: false });
  console.log(`  Loaded ${rows.length} rows`);

  // The sections we care about for Phase 0.
  const WANT = new Set(['INVOICES', 'INVOICE_ITEMS', 'PURCHASE_ORDERS', 'PURCHASE_ORDER_ITEMS']);

  const sections = {};
  let curName = null;
  let curHeaders = null;
  let curRows = [];
  let expectHeaderRow = false;

  function commit() {
    if (curName && WANT.has(curName) && curHeaders && curRows.length) {
      sections[curName] = { headers: curHeaders, rows: curRows };
    }
    curName = null;
    curHeaders = null;
    curRows = [];
    expectHeaderRow = false;
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!Array.isArray(row)) continue;
    const firstCell = String((row[0] || '')).trim();
    const allCols = row.map(c => String(c == null ? '' : c).trim());
    const nonBlank = allCols.filter(Boolean).length;

    // Section header: single all-caps cell, 3-30 chars, only [A-Z_]
    if (nonBlank === 1 && /^[A-Z_]{3,30}$/.test(firstCell)) {
      commit();
      curName = firstCell;
      expectHeaderRow = true;
      continue;
    }

    if (curName) {
      if (expectHeaderRow) {
        if (nonBlank === 0) continue; // skip blank rows after section header
        curHeaders = allCols;
        expectHeaderRow = false;
        continue;
      }
      if (!curHeaders) continue;
      // Data row: only keep if it has some content
      if (nonBlank > 0) curRows.push(allCols);
    }
  }
  commit();

  // Convert each section to array of plain objects keyed by header name
  const out = {};
  for (const name of Object.keys(sections)) {
    const { headers, rows: dr } = sections[name];
    out[name] = dr.map(r => {
      const o = {};
      for (let j = 0; j < headers.length; j++) {
        o[headers[j]] = r[j] == null ? '' : r[j];
      }
      return o;
    });
  }
  return out;
}

// ── Houzz lookup builders ────────────────────────────────────────────────

function buildHouzzInvoiceLookup(sections) {
  const invoices = sections.INVOICES || [];
  const items = sections.INVOICE_ITEMS || [];
  const byCode = {};       // CODE -> invoice record (with internal INVOICE_NUMBER + lineItems)
  const byNumber = {};     // INVOICE_NUMBER -> invoice record
  const linesByInvoiceNumber = {};
  for (const it of items) {
    const num = String(it.INVOICE_NUMBER || '').trim();
    if (!num) continue;
    if (!linesByInvoiceNumber[num]) linesByInvoiceNumber[num] = [];
    linesByInvoiceNumber[num].push({
      title: String(it.TITLE || '').trim(),
      description: String(it.DESCRIPTION || '').trim(),
      quantity: safeNum(it.QUANTITY),
      rate: safeNum(it.RATE),
      markup: safeNum(it.MARKUP),
      billable: String(it.BILLABLE || '').trim(),
      shippingCost: safeNum(it.SHIPPING_COST),
      shippingMarkup: safeNum(it.SHIPPING_MARKUP),
      msrp: safeNum(it.MSRP),
      amount: safeNum(it.RATE) * (safeNum(it.QUANTITY) || 1) + safeNum(it.SHIPPING_COST),
      // Use BILLABLE column when present as authoritative line $; fallback to RATE * QTY + SHIP
    });
  }
  for (const inv of invoices) {
    const code = String(inv.CODE || '').trim();
    const num = String(inv.INVOICE_NUMBER || '').trim();
    if (!num) continue;
    const lines = linesByInvoiceNumber[num] || [];
    const rec = {
      kind: 'invoice',
      INVOICE_NUMBER: num,
      CODE: code,
      INVOICE_TYPE: String(inv.INVOICE_TYPE || '').trim(),
      CLIENT_NAME: String(inv.CLIENT_NAME || '').trim(),
      PROJECT_NAME: String(inv.PROJECT_NAME || '').trim(),
      INVOICE_DATE: String(inv.INVOICE_DATE || '').trim(),
      TOTAL_PAYMENT: safeNum(inv.TOTAL_PAYMENT),
      TOTAL_PAID: safeNum(inv.TOTAL_PAID),
      SUBTOTAL_DERIVED: safeNum(inv.SUBTOTAL_DERIVED),
      SHIPPING_COST_DERIVED: safeNum(inv.SHIPPING_COST_DERIVED),
      TAXES_DERIVED: safeNum(inv.TAXES_DERIVED),
      lineItems: lines,
    };
    byNumber[num] = rec;
    if (code) byCode[code] = rec;
    // Also key by normalized core (strip leading zeros etc.) for fuzzy lookup
    const coreCode = normCore(code);
    if (coreCode && !byCode[coreCode]) byCode[coreCode] = rec;
  }
  return { byCode, byNumber, count: invoices.length, linesCount: items.length };
}

function buildHouzzPOLookup(sections) {
  const pos = sections.PURCHASE_ORDERS || [];
  const items = sections.PURCHASE_ORDER_ITEMS || [];
  const byCode = {};
  const byNumber = {};
  const linesByPONumber = {};
  for (const it of items) {
    const num = String(it.PURCHASE_ORDER_NUMBER || '').trim();
    if (!num) continue;
    if (!linesByPONumber[num]) linesByPONumber[num] = [];
    linesByPONumber[num].push({
      title: String(it.TITLE || '').trim(),
      description: String(it.DESCRIPTION || '').trim(),
      quantity: safeNum(it.QUANTITY),
      rate: safeNum(it.RATE),
      markup: safeNum(it.MARKUP),
      shippingCost: safeNum(it.SHIPPING_COST),
      sideMark: String(it.SIDE_MARK || '').trim(),
      sku: String(it.SKU || '').trim(),
      manufacturer: String(it.MANUFACTURER || '').trim(),
      totalPayment: safeNum(it.TOTAL_PAYMENT),
      amount: safeNum(it.TOTAL_PAYMENT) || (safeNum(it.RATE) * (safeNum(it.QUANTITY) || 1) + safeNum(it.SHIPPING_COST)),
    });
  }
  for (const po of pos) {
    const code = String(po.CODE || '').trim();
    const num = String(po.PURCHASE_ORDER_NUMBER || '').trim();
    if (!num) continue;
    const lines = linesByPONumber[num] || [];
    const rec = {
      kind: 'purchaseOrder',
      PURCHASE_ORDER_NUMBER: num,
      CODE: code,
      CLIENT_NAME: String(po.CLIENT_NAME || '').trim(),
      VENDOR_COMPANY: String(po.VENDOR_COMPANY || '').trim(),
      PURCHASE_ORDER_DATE: String(po.PURCHASE_ORDER_DATE || '').trim(),
      TOTAL_PAYMENT: safeNum(po.TOTAL_PAYMENT),
      TOTAL_PAID: safeNum(po.TOTAL_PAID),
      SALES_TAX_AMOUNT: safeNum(po.SALES_TAX_AMOUNT),
      lineItems: lines,
    };
    byNumber[num] = rec;
    if (code) byCode[code] = rec;
    const coreCode = normCore(code);
    if (coreCode && !byCode[coreCode]) byCode[coreCode] = rec;
  }
  return { byCode, byNumber, count: pos.length, linesCount: items.length };
}

// ── Studio doc filter + line normalization ───────────────────────────────

function isHouzzSourced(doc) {
  const s1 = String(doc.source || '').toLowerCase();
  const s2 = String(doc._source || '').toLowerCase();
  if (HOUZZ_SOURCE_FLAGS.has(s1)) return true;
  if (HOUZZ_UNDERSCORE_SOURCE_FLAGS.has(s2)) return true;
  // Defensive: docs my backfill created had _houzzId set
  if (doc._houzzId && String(doc._houzzId).trim()) return true;
  return false;
}

// Per dry-run findings 2026-05-22: production POs (2241/2247) have NO source
// field, so brief's source-filter excludes virtually all PO data. Phase 0 now
// scans EVERY invoice/PO and lets the 0427 lookup decide what is Houzz-sourced.
// If a Studio doc's number matches a Houzz CODE in 0427, it's reconciled.
const SCAN_ALL = true;

function studioLines(doc) {
  const arr = Array.isArray(doc.items) ? doc.items : [];
  return arr.map((it) => ({
    title: String(it.title || it.description || it.name || '').trim(),
    description: String(it.description || it.title || '').trim(),
    amount: safeNum(it.amount != null ? it.amount : (it.lineTotal != null ? it.lineTotal : (it.totalSellingPrice != null ? it.totalSellingPrice : (safeNum(it.unitPrice) * (safeNum(it.qty) || 1))))),
    qty: safeNum(it.qty || it.quantity),
    expenseType: String(it.expenseType || it.itemType || '').toLowerCase(),
  }));
}

// ── Diff logic ───────────────────────────────────────────────────────────

function diffLines(studioItems, houzzItems) {
  // For each Houzz line, search Studio items for a description-similar line
  // with amount within ±$0.01. If none, that Houzz line is "missing" from Studio.
  const missing = [];
  const usedStudioIndexes = new Set();
  for (const hl of houzzItems) {
    let matchedIdx = -1;
    for (let i = 0; i < studioItems.length; i++) {
      if (usedStudioIndexes.has(i)) continue;
      const sl = studioItems[i];
      if (descSimilar(sl.description || sl.title, hl.description || hl.title) &&
          amountClose(sl.amount, hl.amount, 0.01)) {
        matchedIdx = i; break;
      }
    }
    if (matchedIdx >= 0) {
      usedStudioIndexes.add(matchedIdx);
    } else {
      missing.push(hl);
    }
  }
  return missing;
}

function classifyMissing(lines) {
  const out = { shipping: [], install: [], tax: [], other: [] };
  for (const l of lines) {
    const cat = classifyLine((l.description || '') + ' ' + (l.title || ''));
    out[cat].push(l);
  }
  return out;
}

// ── Main ─────────────────────────────────────────────────────────────────

(async () => {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('STUDIO ↔ QB RECONCILIATION ENGINE — Phase 0 (line-item integrity)');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('Mode:    ', APPLY ? 'APPLY (writes findings to Firestore)' : 'DRY-RUN (local report only)');
  console.log('Run ID:  ', RUN_ID);
  console.log('Houzz:   ', HOUZZ_CSV);
  console.log('');

  // 1. Load Houzz sections from 0427
  console.log('[1/4] Loading Houzz 0427...');
  if (!fs.existsSync(HOUZZ_CSV)) {
    console.error('Houzz file not found:', HOUZZ_CSV);
    process.exit(1);
  }
  const sections = loadHouzzSections(HOUZZ_CSV);
  console.log('  Sections parsed:');
  for (const name of Object.keys(sections)) {
    console.log(`    ${name.padEnd(25)} ${sections[name].length} rows`);
  }

  // 2. Build lookups
  console.log('\n[2/4] Building Houzz lookups...');
  const invLookup = buildHouzzInvoiceLookup(sections);
  const poLookup = buildHouzzPOLookup(sections);
  console.log(`  Invoices indexed: ${invLookup.count} (${invLookup.linesCount} line items)`);
  console.log(`  POs indexed:      ${poLookup.count} (${poLookup.linesCount} line items)`);

  // 3. Read Studio docs (READ-ONLY)
  console.log('\n[3/4] Reading Studio Firestore (READ-ONLY)...');
  admin.initializeApp({ credential: admin.credential.cert(require(PROD_KEY)) });
  const db = admin.firestore();

  const boards = await db.collection('boards').get();
  console.log(`  Boards: ${boards.size}`);

  const studioInvoices = [];
  const studioPOs = [];
  for (const b of boards.docs) {
    const projectId = b.id;
    const [invSnap, poSnap] = await Promise.all([
      b.ref.collection('invoices').get(),
      b.ref.collection('purchaseOrders').get(),
    ]);
    for (const d of invSnap.docs) {
      const data = d.data();
      if (SCAN_ALL || isHouzzSourced(data)) {
        studioInvoices.push({ projectId, docId: d.id, ref: d.ref.path, data });
      }
    }
    for (const d of poSnap.docs) {
      const data = d.data();
      if (SCAN_ALL || isHouzzSourced(data)) {
        studioPOs.push({ projectId, docId: d.id, ref: d.ref.path, data });
      }
    }
  }
  console.log(`  Houzz-sourced invoices: ${studioInvoices.length}`);
  console.log(`  Houzz-sourced POs:      ${studioPOs.length}`);

  // 4. Diff
  console.log('\n[4/4] Running line-item integrity check...');
  const findings = [];
  const stats = {
    invoices: { scanned: 0, originNotFound: 0, linesIntact: 0, missingLines: 0 },
    pos: { scanned: 0, originNotFound: 0, linesIntact: 0, missingLines: 0 },
    totalVarianceDollars: 0,
  };

  function processDoc(kind, doc, lookup, houzzKindLabel) {
    const data = doc.data;
    const studioNumber = String(data.number || data.invoiceNum || data.poNum || '').trim();
    const core = normCore(studioNumber);
    let houzzOrigin = (lookup.byCode[studioNumber] ||
                      lookup.byCode[core] ||
                      lookup.byNumber[studioNumber] ||
                      lookup.byNumber[core]);
    // Try the _houzzId backfill marker
    if (!houzzOrigin && data._houzzId) {
      const hid = String(data._houzzId).trim();
      houzzOrigin = lookup.byNumber[hid] || lookup.byCode[hid];
    }

    const sStats = kind === 'invoice' ? stats.invoices : stats.pos;
    sStats.scanned++;

    if (!houzzOrigin) {
      // With SCAN_ALL=true we expect many non-Houzz-sourced docs to not match.
      // Only flag as "missing in Houzz" when the Studio doc was claimed to be
      // Houzz-sourced. Otherwise count silently as "non-Houzz scanned".
      if (isHouzzSourced(data)) {
        sStats.originNotFound++;
        findings.push({
          phase: 0,
          classification: 'HOUZZ_ORIGIN_NOT_FOUND',
          kind,
          studioRecord: {
            ref: doc.ref,
            projectId: doc.projectId,
            docId: doc.docId,
            number: studioNumber,
            total: safeNum(data.total),
            source: data.source || data._source,
          },
          houzzRecord: null,
          missingLines: null,
          categories: null,
          totalDiff: null,
          recommendation: `Studio ${kind} #${studioNumber} (board ${doc.projectId}) is flagged as Houzz-sourced but no matching Houzz ${houzzKindLabel} record exists in cchdesign_0427.csv. May be older than 0427 cutoff or imported from a legacy file.`,
          approved: null,
          rejected: null,
          executed: false,
          runId: RUN_ID,
          detectedAt: new Date().toISOString(),
        });
      } else {
        sStats.nonHouzzNoMatch = (sStats.nonHouzzNoMatch || 0) + 1;
      }
      return;
    }

    const sLines = studioLines(data);
    const hLines = houzzOrigin.lineItems || [];
    const missing = diffLines(sLines, hLines);

    if (missing.length === 0) {
      sStats.linesIntact++;
      return;
    }

    // Compute totals on both sides — the brief's key signal is $ variance.
    // If Studio total == Houzz total within $1 but lines differ in count,
    // Studio just stored a rolled-up summary, not a dropped line. Filter
    // those into a separate low-priority bucket so the noise doesn't drown
    // the real losses.
    const studioTotal = safeNum(data.total);
    const houzzTotal = houzzOrigin.TOTAL_PAYMENT;
    const totalsMatch = Math.abs(studioTotal - houzzTotal) <= 1.00;

    const isHeaderOnly = sLines.length === 0 && hLines.length > 0;
    let classification;
    if (isHeaderOnly) {
      classification = 'STUDIO_HEADER_ONLY_NO_LINES';
      sStats.headerOnly = (sStats.headerOnly || 0) + 1;
    } else if (totalsMatch) {
      classification = 'STUDIO_LINE_GRANULARITY_MISMATCH';
      sStats.granularity = (sStats.granularity || 0) + 1;
    } else {
      classification = 'STUDIO_MISSING_LINE_ITEMS';
      sStats.realMissing = (sStats.realMissing || 0) + 1;
    }
    sStats.missingLines++;
    const totalDiff = missing.reduce((s, m) => s + (m.amount || 0), 0);
    stats.totalVarianceDollars += totalDiff;
    const categories = classifyMissing(missing);

    findings.push({
      phase: 0,
      classification,
      kind,
      studioRecord: {
        ref: doc.ref,
        projectId: doc.projectId,
        docId: doc.docId,
        number: studioNumber,
        total: safeNum(data.total),
        itemCount: sLines.length,
        source: data.source || data._source,
      },
      houzzRecord: {
        kind: houzzOrigin.kind,
        code: houzzOrigin.CODE,
        internalNumber: houzzOrigin.INVOICE_NUMBER || houzzOrigin.PURCHASE_ORDER_NUMBER,
        total: houzzOrigin.TOTAL_PAYMENT,
        itemCount: hLines.length,
      },
      totals: {
        studio: studioTotal,
        houzz: houzzTotal,
        diff: studioTotal - houzzTotal,
        match: totalsMatch,
      },
      missingLines: missing,
      categories: {
        shipping: categories.shipping.length,
        install: categories.install.length,
        tax: categories.tax.length,
        other: categories.other.length,
      },
      categoryAmounts: {
        shipping: categories.shipping.reduce((s,l)=>s+(l.amount||0),0),
        install: categories.install.reduce((s,l)=>s+(l.amount||0),0),
        tax: categories.tax.reduce((s,l)=>s+(l.amount||0),0),
        other: categories.other.reduce((s,l)=>s+(l.amount||0),0),
      },
      totalDiff,
      proposedActions: [
        { target: 'studio', type: 'append_line_items', note: 'Held for Phase 4 — requires per-finding approval before any write to Studio items[]', payload: missing.map(m => ({ title: m.title, description: m.description, qty: m.quantity, rate: m.rate, amount: m.amount })) },
      ],
      recommendation: `Append ${missing.length} missing line item(s) (${formatBreakdown(categories)}) to Studio ${kind} #${studioNumber} on board ${doc.projectId}. Total variance: $${totalDiff.toFixed(2)}.`,
      approved: null,
      rejected: null,
      rejectedReason: null,
      executed: false,
      executedAt: null,
      executionResult: null,
      runId: RUN_ID,
      detectedAt: new Date().toISOString(),
    });
  }

  function formatBreakdown(c) {
    const parts = [];
    if (c.shipping.length) parts.push(`${c.shipping.length} shipping`);
    if (c.install.length) parts.push(`${c.install.length} install`);
    if (c.tax.length) parts.push(`${c.tax.length} tax`);
    if (c.other.length) parts.push(`${c.other.length} other`);
    return parts.join(', ');
  }

  for (const inv of studioInvoices) processDoc('invoice', inv, invLookup, 'Invoice');
  for (const po of studioPOs) processDoc('purchaseOrder', po, poLookup, 'PurchaseOrder');

  // ── Summary ──────────────────────────────────────────────────────────
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('PHASE 0 RESULTS');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  console.log('Invoices:');
  console.log(`  Scanned (all):                              ${stats.invoices.scanned}`);
  console.log(`  Lines intact (no finding):                  ${stats.invoices.linesIntact}`);
  console.log(`  STUDIO_HEADER_ONLY_NO_LINES:                ${stats.invoices.headerOnly || 0}`);
  console.log(`  STUDIO_LINE_GRANULARITY_MISMATCH (totals=): ${stats.invoices.granularity || 0}`);
  console.log(`  STUDIO_MISSING_LINE_ITEMS (real $ loss):    ${stats.invoices.realMissing || 0}  ⭐ brief's target`);
  console.log(`  Houzz-sourced, not in 0427:                 ${stats.invoices.originNotFound}`);
  console.log(`  Non-Houzz, no 0427 match:                   ${stats.invoices.nonHouzzNoMatch || 0}`);
  console.log('');
  console.log('Purchase orders:');
  console.log(`  Scanned (all):                              ${stats.pos.scanned}`);
  console.log(`  Lines intact (no finding):                  ${stats.pos.linesIntact}`);
  console.log(`  STUDIO_HEADER_ONLY_NO_LINES:                ${stats.pos.headerOnly || 0}`);
  console.log(`  STUDIO_LINE_GRANULARITY_MISMATCH (totals=): ${stats.pos.granularity || 0}`);
  console.log(`  STUDIO_MISSING_LINE_ITEMS (real $ loss):    ${stats.pos.realMissing || 0}  ⭐ brief's target`);
  console.log(`  Houzz-sourced, not in 0427:                 ${stats.pos.originNotFound}`);
  console.log(`  Non-Houzz, no 0427 match:                   ${stats.pos.nonHouzzNoMatch || 0}`);
  console.log('');
  console.log(`Total dollar variance from missing lines: $${stats.totalVarianceDollars.toFixed(2)}`);
  console.log('');
  console.log(`Findings total: ${findings.length}`);

  // Write local report
  if (!fs.existsSync(REPORT_DIR)) fs.mkdirSync(REPORT_DIR, { recursive: true });
  const reportPath = path.join(REPORT_DIR, `recon-phase0-${RUN_ID}.json`);
  fs.writeFileSync(reportPath, JSON.stringify({
    runId: RUN_ID, phase: 0, mode: APPLY ? 'apply' : 'dry-run',
    generatedAt: new Date().toISOString(),
    stats, findings,
  }, null, 2), 'utf8');
  console.log(`Local report:  ${reportPath}`);

  if (!APPLY) {
    console.log('\nDRY-RUN — no writes. Re-run with --apply to write findings to Firestore.');
    process.exit(0);
  }

  // Write findings to Firestore — admin/reconciliation/{runId}/findings/{auto}
  // Safety: writes are confined to this collection path. No invoice/PO/board doc is touched.
  console.log('\nWriting findings to admin/reconciliation/' + RUN_ID + '/findings/* ...');
  // Recursively replace undefined with null (Firestore rejects undefined)
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
  const runDocRef = db.collection('admin').doc('reconciliation').collection(RUN_ID).doc('_meta');
  await runDocRef.set(nullifyUndefined({
    runId: RUN_ID, phase: 0, startedAt: new Date().toISOString(),
    stats, mode: 'apply', tool: '_scripts/recon-phase0.js',
  }));
  // Use batched writes for findings
  const BATCH = 400;
  let written = 0;
  let batch = db.batch();
  let n = 0;
  for (const f of findings) {
    const findingRef = db.collection('admin').doc('reconciliation').collection(RUN_ID).doc('findings').collection('items').doc();
    batch.set(findingRef, nullifyUndefined(f));
    n++;
    if (n >= BATCH) {
      await batch.commit();
      written += n; n = 0;
      batch = db.batch();
      console.log(`  ${written} findings written...`);
    }
  }
  if (n > 0) { await batch.commit(); written += n; }
  console.log(`Done. ${written} findings written.`);
  console.log(`Findings root: admin/reconciliation/${RUN_ID}/findings/items/*`);
  console.log(`Run meta:      admin/reconciliation/${RUN_ID}/_meta`);
  process.exit(0);
})().catch((e) => { console.error('FATAL:', e); process.exit(1); });
