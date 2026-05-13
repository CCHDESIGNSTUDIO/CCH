/**
 * IN-12902 fix — adds missing Mudroom soapstone sink, rewrites all 9 line items
 * from tracker, sets top-level totals + shipping + tax + paid per the PDF.
 *
 * Default DRY RUN. --execute to write.
 *
 * Source of truth: invoice PDF showed SUBTOTAL=$12,473.96, SHIPPING=$1,988.40,
 * TAXES=$1,185.03, TOTAL=$15,647.39, AMOUNT RECEIVED=$15,645.43, BALANCE=$1.96.
 * Tracker for IN-12902 has 9 rows that sum exactly to $12,473.96 subtotal.
 */
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, writeBatch } = require('firebase/firestore');

const PROD = {
  apiKey: 'AIzaSyAd24U5ArVGrA24IxNcYD2NYiTVycyF4og',
  authDomain: 'cch-design-boards.firebaseapp.com',
  projectId: 'cch-design-boards',
  storageBucket: 'cch-design-boards.firebasestorage.app',
  messagingSenderId: '210388013080',
  appId: '1:210388013080:web:cch-design-boards',
};
const TRACKER = String.raw`C:\Users\cindy\Dropbox\Claude - CCH studio\Houzz FILES\ARCHIVE\project_tracker_report-2870-04-22-2026-12-22-11-342 Cloud RH.xlsx`;
const BOARD_ID = 'cloud-rolling-hills';
const TARGET = 'IN-12902';
const OUT_CSV = path.join(__dirname, 'in12902-writer-manifest.csv');
const EXECUTE = process.argv.includes('--execute');

// PDF source-of-truth top-level values
const PDF_SUBTOTAL = 12473.96;
const PDF_SHIPPING = 1988.40;
const PDF_TAX = 1185.03;
const PDF_TOTAL = 15647.39;
const PDF_PAID = 15645.43;
const PDF_BALANCE = 1.96;

const norm = (s) => String(s || '').toLowerCase().replace(/[\s\-_"'’″]+/g, ' ').replace(/\s+/g, ' ').trim();
const safeNum = (v) => { const n = parseFloat(v); return isFinite(n) ? n : null; };
const csvEsc = (v) => { if (v == null) return ''; const s = String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const round2 = (n) => Math.round(n * 100) / 100;

(async () => {
  console.log(`IN-12902 WRITER  (${EXECUTE ? 'EXECUTE' : 'DRY RUN'})\n`);

  // 1. Load tracker rows for IN-12902
  const wb = XLSX.readFile(TRACKER);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  const h = rows[0];
  const I = (n) => h.findIndex(c => String(c).toLowerCase().trim() === n.toLowerCase());
  const cT = I('Title'), cInv = I('Invoice'), cImg = I('Image'),
        cCat = I('Category'), cRm = I('Room'), cVnd = I('Vendor'),
        cVDsc = I('Vendor Description'), cMat = I('Materials'), cFin = I('Finish/Color'),
        cSKU = I('SKU'), cQty = I('Selling Quantity'),
        cUSP = I('Unit Selling Price'), cMK = I('Markup %'), cMV = I('Markup Value'),
        cTSP = I('Total Selling Price'), cTax = I('Taxable Item'), cCT = I('Client Tax'),
        cCD = I('Client Description');

  const trackerRows = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (String(r[cInv] || '').toUpperCase().includes(TARGET)) {
      trackerRows.push({
        idx: trackerRows.length,
        title: String(r[cT] || ''),
        image: String(r[cImg] || ''),
        category: String(r[cCat] || ''),
        room: String(r[cRm] || ''),
        vendor: String(r[cVnd] || ''),
        vendorDescription: String(r[cVDsc] || ''),
        materials: String(r[cMat] || ''),
        finish: String(r[cFin] || ''),
        sku: String(r[cSKU] || ''),
        qty: safeNum(r[cQty]) || 1,
        usp: safeNum(r[cUSP]) || 0,
        markup: safeNum(r[cMK]) || 0,
        markupValue: safeNum(r[cMV]) || 0,
        tsp: safeNum(r[cTSP]) || 0,
        taxable: String(r[cTax] || '').toLowerCase() === 'taxable',
        clientTax: safeNum(r[cCT]) || 0,
        clientDescription: String(r[cCD] || ''),
      });
    }
  }
  console.log(`Tracker rows for ${TARGET}: ${trackerRows.length}`);
  const trackerSubtotal = trackerRows.reduce((s, r) => s + r.tsp, 0);
  console.log(`Tracker subtotal: $${round2(trackerSubtotal)}  (PDF subtotal: $${PDF_SUBTOTAL})`);

  // 2. Load Studio doc
  const app = initializeApp(PROD);
  const db = getFirestore(app);
  const snap = await getDocs(collection(db, 'boards', BOARD_ID, 'invoices'));
  let target = null;
  snap.forEach(d => {
    const x = d.data();
    if (String(x.number || x.invoiceNum || d.id).toUpperCase().includes(TARGET)) target = { id: d.id, data: x };
  });
  if (!target) { console.log(`${TARGET} not found`); process.exit(1); }
  const items = target.data.items || target.data.lineItems || [];
  console.log(`Studio doc: ${target.id}, items: ${items.length}, top.total: $${target.data.total}, paid: $${target.data.paidAmount}`);

  // 3. Match Studio items to tracker rows.
  // Strategy: norm-title primary; for duplicates (Custom Soapstone Kitchen Sink × 2),
  // disambiguate by room if Studio has it, else assign greedy in tracker order
  // (which puts Mudroom first, Laundry second). The Studio item is the Laundry one
  // per the PDF gap (Mudroom is the missing one).
  const used = new Set();
  function findMatch(studioItem) {
    const sNorm = norm(studioItem.title || studioItem.name);
    const sRoom = norm(studioItem.room);
    // Prefer same title + same room
    if (sRoom) {
      for (const t of trackerRows) {
        if (used.has(t.idx)) continue;
        if (norm(t.title) === sNorm && norm(t.room) === sRoom) { used.add(t.idx); return t; }
      }
    }
    // Title-only match (skip the "wrong" duplicate if possible — prefer Laundry over Mudroom for Soapstone Sink)
    const candidates = trackerRows.filter(t => !used.has(t.idx) && norm(t.title) === sNorm);
    if (candidates.length === 1) { used.add(candidates[0].idx); return candidates[0]; }
    if (candidates.length > 1) {
      // Multiple — pick Laundry over Mudroom (since Mudroom is the missing one)
      const laundry = candidates.find(c => norm(c.room) === 'laundry');
      const pick = laundry || candidates[0];
      used.add(pick.idx);
      return pick;
    }
    return null;
  }

  const manifest = [];
  const newItems = [];
  let lineSubtotal = 0, lineCostSum = 0;

  for (let i = 0; i < items.length; i++) {
    const s = items[i];
    const m = findMatch(s);
    if (!m) {
      manifest.push({ action: 'no-match-keep', sIdx: i, sTitle: s.title || s.name });
      newItems.push(s);
      lineSubtotal += safeNum(s.totalSelling) || safeNum(s.total) || 0;
      lineCostSum += (safeNum(s.cost) || 0) * (safeNum(s.qty) || 0);
      continue;
    }
    const updated = {
      ...s,
      title: s.title || m.title,
      cost: m.usp,
      unitCost: m.usp,
      unitPrice: m.usp,
      clientPrice: m.usp,
      markup: m.markup,
      markupValue: m.markupValue,
      totalSelling: m.tsp,
      total: m.tsp,
      amount: m.tsp,
      qty: m.qty,
      taxable: m.taxable,
      clientTax: m.clientTax,
      room: s.room || m.room,
      vendor: s.vendor || m.vendor,
      vendorDescription: s.vendorDescription || m.vendorDescription,
      materials: s.materials || m.materials,
      finish: s.finish || m.finish,
      sku: s.sku || m.sku,
      category: s.category || m.category,
      imageFilename: s.imageFilename || m.image,
      clientDescription: s.clientDescription || m.clientDescription,
    };
    newItems.push(updated);
    lineSubtotal += m.tsp;
    lineCostSum += m.usp * m.qty;
    manifest.push({
      action: 'tracker-write',
      sIdx: i,
      sTitle: s.title || s.name,
      sRoom: s.room || '',
      tTitle: m.title,
      tRoom: m.room,
      oldCost: safeNum(s.cost),
      newCost: m.usp,
      oldMarkup: s.markup,
      newMarkup: m.markup,
      oldTotal: safeNum(s.total) != null ? safeNum(s.total) : safeNum(s.totalSelling),
      newTotal: m.tsp,
    });
  }

  // 4. Append the missing tracker rows as new line items
  for (const m of trackerRows) {
    if (used.has(m.idx)) continue;
    const newItem = {
      title: m.title,
      cost: m.usp,
      unitCost: m.usp,
      unitPrice: m.usp,
      clientPrice: m.usp,
      markup: m.markup,
      markupValue: m.markupValue,
      totalSelling: m.tsp,
      total: m.tsp,
      amount: m.tsp,
      qty: m.qty,
      taxable: m.taxable,
      clientTax: m.clientTax,
      room: m.room,
      vendor: m.vendor,
      vendorDescription: m.vendorDescription,
      materials: m.materials,
      finish: m.finish,
      sku: m.sku,
      category: m.category,
      imageFilename: m.image,
      clientDescription: m.clientDescription,
      description: '',
      lineNotes: '',
      shippingCost: 0,
      shippingSelling: 0,
      _addedFromPdfAt: new Date().toISOString(),
    };
    newItems.push(newItem);
    lineSubtotal += m.tsp;
    lineCostSum += m.usp * m.qty;
    manifest.push({
      action: 'NEW-LINE-APPENDED',
      sIdx: '',
      sTitle: m.title,
      sRoom: '',
      tTitle: m.title,
      tRoom: m.room,
      oldCost: '',
      newCost: m.usp,
      oldMarkup: '',
      newMarkup: m.markup,
      oldTotal: '',
      newTotal: m.tsp,
    });
  }

  // 5. Top-level fields
  const newTopFields = {
    items: newItems,
    total: PDF_TOTAL,
    totalSelling: round2(lineSubtotal),
    totalCost: round2(lineCostSum),
    shippingCost: PDF_SHIPPING,
    shippingSelling: PDF_SHIPPING,
    clientTax: PDF_TAX,
    paidAmount: PDF_PAID,
    invoiceBalance: PDF_BALANCE,
    _in12902FixedFromPdfAt: new Date().toISOString(),
  };

  // 6. Console output
  console.log('\n--- Per-line manifest ---');
  for (const r of manifest) {
    const tag = r.action === 'NEW-LINE-APPENDED' ? '[NEW]' : `[${r.sIdx}]`;
    console.log(`  ${tag.padEnd(6)} ${(r.tTitle || r.sTitle || '').slice(0,40).padEnd(42)} room=${(r.tRoom || r.sRoom || '').padEnd(15)} cost=${String(r.oldCost).padStart(7)}→${String(r.newCost).padStart(7)} mk=${String(r.oldMarkup).padStart(3)}→${String(r.newMarkup).padStart(3)} total=${String(r.oldTotal).padStart(8)}→${String(r.newTotal).padStart(8)}`);
  }

  console.log('\n--- Top-level changes ---');
  console.log(`  items count:    ${items.length}  →  ${newItems.length}  (added ${newItems.length - items.length})`);
  console.log(`  total:          $${target.data.total}  →  $${newTopFields.total}`);
  console.log(`  totalSelling:   $${target.data.totalSelling || 0}  →  $${newTopFields.totalSelling}`);
  console.log(`  totalCost:      $${target.data.totalCost || 0}  →  $${newTopFields.totalCost}`);
  console.log(`  shippingCost:   $${target.data.shippingCost || 0}  →  $${newTopFields.shippingCost}`);
  console.log(`  shippingSell:   $${target.data.shippingSelling || 0}  →  $${newTopFields.shippingSelling}`);
  console.log(`  clientTax:      $${target.data.clientTax || 0}  →  $${newTopFields.clientTax}`);
  console.log(`  paidAmount:     $${target.data.paidAmount}  →  $${newTopFields.paidAmount}`);
  console.log(`  invoiceBalance: $${target.data.invoiceBalance}  →  $${newTopFields.invoiceBalance}`);

  console.log('\n--- Math check ---');
  const grandTotalCheck = round2(lineSubtotal + PDF_SHIPPING + PDF_TAX);
  console.log(`  line subtotal + shipping + tax = $${round2(lineSubtotal)} + $${PDF_SHIPPING} + $${PDF_TAX} = $${grandTotalCheck}`);
  console.log(`  PDF total:                     = $${PDF_TOTAL}  ${grandTotalCheck === PDF_TOTAL ? '✓ MATCHES' : '✗ MISMATCH'}`);

  // CSV
  const header = ['action','sIdx','sTitle','sRoom','tTitle','tRoom','oldCost','newCost','oldMarkup','newMarkup','oldTotal','newTotal'];
  const csvLines = [header.join(',')];
  for (const r of manifest) csvLines.push(header.map(k => csvEsc(r[k])).join(','));
  csvLines.push('');
  csvLines.push('TOP-LEVEL,old,new');
  csvLines.push(`total,${target.data.total},${newTopFields.total}`);
  csvLines.push(`totalSelling,${target.data.totalSelling || 0},${newTopFields.totalSelling}`);
  csvLines.push(`shippingCost,${target.data.shippingCost || 0},${newTopFields.shippingCost}`);
  csvLines.push(`clientTax,${target.data.clientTax || 0},${newTopFields.clientTax}`);
  csvLines.push(`paidAmount,${target.data.paidAmount},${newTopFields.paidAmount}`);
  csvLines.push(`invoiceBalance,${target.data.invoiceBalance},${newTopFields.invoiceBalance}`);
  fs.writeFileSync(OUT_CSV, csvLines.join('\n'));
  console.log(`\n  Manifest: ${OUT_CSV}`);

  if (!EXECUTE) { console.log('\nDRY RUN. --execute to write.'); process.exit(0); }

  console.log('\nWRITING TO PRODUCTION...');
  const batch = writeBatch(db);
  batch.update(doc(db, 'boards', BOARD_ID, 'invoices', target.id), newTopFields);
  await batch.commit();
  console.log(`  Wrote ${target.id} (${newItems.length} line items + top-level + shipping + tax + paid)`);
  console.log('\nDONE.');
  process.exit(0);
})().catch(e => { console.error('FAILED:', e); process.exit(1); });
