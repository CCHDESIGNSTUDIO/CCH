/**
 * IN-12980 line-item matching + diff manifest. READ-ONLY.
 * Match strategy: imageFilename → sku → houzzId → normalized title.
 * Output CSV with current Studio values + tracker values + proposed action per line.
 */
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

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
const TARGET_INVOICE = 'IN-12980';
const OUT_CSV = path.join(__dirname, 'in12980-line-match-manifest.csv');

const norm = (s) => String(s || '').toLowerCase().replace(/[\s\-_"'’]+/g, ' ').replace(/\s+/g, ' ').trim();
const safeNum = (v) => { const n = parseFloat(v); return isFinite(n) ? n : null; };
const csvEsc = (v) => { if (v == null) return ''; const s = String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };

(async () => {
  // 1. Load tracker, filter to IN-12980 rows
  const wb = XLSX.readFile(TRACKER);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  const h = rows[0];
  const I = (n) => h.findIndex(c => String(c).toLowerCase().trim() === n.toLowerCase());
  const cT = I('Title'), cInv = I('Invoice'), cImg = I('Image'), cRm = I('Room'),
        cVnd = I('Vendor'), cSKU = I('SKU'), cQty = I('Selling Quantity'),
        cUSP = I('Unit Selling Price'), cMK = I('Markup %'), cMV = I('Markup Value'),
        cTSP = I('Total Selling Price'), cTax = I('Taxable Item'), cCT = I('Client Tax'),
        cCD = I('Client Description');

  const trackerRows = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (String(r[cInv] || '').toUpperCase().includes(TARGET_INVOICE)) {
      const cd = String(r[cCD] || '');
      const lm = cd.match(/L(\d+)/);
      trackerRows.push({
        idx: trackerRows.length,
        title: String(r[cT] || ''),
        image: String(r[cImg] || ''),
        room: String(r[cRm] || ''),
        vendor: String(r[cVnd] || ''),
        sku: String(r[cSKU] || ''),
        qty: safeNum(r[cQty]),
        usp: safeNum(r[cUSP]),
        markup: safeNum(r[cMK]),
        markupValue: safeNum(r[cMV]),
        tsp: safeNum(r[cTSP]),
        taxable: String(r[cTax] || '').toLowerCase() === 'taxable',
        clientTax: safeNum(r[cCT]),
        clientDescription: cd,
        lcode: lm ? 'L' + lm[1] : ''
      });
    }
  }
  console.log(`Tracker rows for ${TARGET_INVOICE}: ${trackerRows.length}`);

  // Index tracker rows by image / sku / title
  const byImage = new Map(), bySKU = new Map(), byTitle = new Map();
  for (const r of trackerRows) {
    const img = String(r.image).toLowerCase().trim();
    const sku = String(r.sku).toLowerCase().trim();
    const t = norm(r.title);
    if (img) {
      if (!byImage.has(img)) byImage.set(img, []);
      byImage.get(img).push(r);
    }
    if (sku) {
      if (!bySKU.has(sku)) bySKU.set(sku, []);
      bySKU.get(sku).push(r);
    }
    if (t) {
      if (!byTitle.has(t)) byTitle.set(t, []);
      byTitle.get(t).push(r);
    }
  }

  // 2. Load Studio IN-12980
  const app = initializeApp(PROD);
  const db = getFirestore(app);
  const snap = await getDocs(collection(db, 'boards', BOARD_ID, 'invoices'));
  let target = null;
  snap.forEach(d => {
    const x = d.data();
    if (String(x.number || x.invoiceNum || d.id).toUpperCase().includes(TARGET_INVOICE)) {
      target = { id: d.id, data: x };
    }
  });
  if (!target) { console.log('IN-12980 not found in Firestore'); process.exit(1); }
  const studioItems = target.data.items || [];
  console.log(`Studio ${TARGET_INVOICE} doc id: ${target.id}, line items: ${studioItems.length}`);
  console.log(`Studio top-level total: $${target.data.total}, totalSelling: $${target.data.totalSelling}, invoiceBalance: $${target.data.invoiceBalance}`);

  // 3. Match each Studio line; mark used tracker rows so we don't double-match
  const used = new Set();
  function pickFirst(arr) {
    for (const r of arr || []) if (!used.has(r.idx)) { used.add(r.idx); return r; }
    return null;
  }
  const results = studioItems.map((s, sIdx) => {
    const sImg = String(s.imageFilename || '').toLowerCase().trim();
    const sSku = String(s.sku || '').toLowerCase().trim();
    const sTitle = norm(s.title);

    let m = null, method = '';
    if (sImg) m = pickFirst(byImage.get(sImg)), method = m ? 'image' : '';
    if (!m && sSku) m = pickFirst(bySKU.get(sSku)), method = m ? 'sku' : '';
    if (!m && sTitle) m = pickFirst(byTitle.get(sTitle)), method = m ? 'title' : '';

    const sCost = safeNum(s.cost) || 0;
    const overwriteRisk = sCost > 0 ? 'PRESERVE-MANUAL-COST' : '';

    return {
      sIdx, method, overwriteRisk,
      sTitle: s.title || '',
      sImg: s.imageFilename || '',
      sSku: s.sku || '',
      sHouzzId: s.houzzId || '',
      sQty: s.qty,
      sCost, sUnitPrice: s.unitPrice, sMarkup: s.markup, sMarkupValue: s.markupValue,
      sTotalSelling: s.totalSelling, sTotal: s.total,
      sLineNotes: s.lineNotes || '',
      sClientDescStart: String(s.clientDescription || '').slice(0, 30),
      tIdx: m ? m.idx : '',
      tTitle: m ? m.title : '',
      tImg: m ? m.image : '',
      tSku: m ? m.sku : '',
      tQty: m ? m.qty : '',
      tUSP: m ? m.usp : '',
      tMarkup: m ? m.markup : '',
      tMarkupValue: m ? m.markupValue : '',
      tTSP: m ? m.tsp : '',
      tLcode: m ? m.lcode : '',
      tRoom: m ? m.room : '',
      tVendor: m ? m.vendor : '',
    };
  });

  // 4. Identify tracker rows not matched to any Studio line
  const unmatchedTracker = trackerRows.filter(r => !used.has(r.idx));

  // Console summary
  const breakdown = { image: 0, sku: 0, title: 0, unmatched: 0 };
  for (const r of results) breakdown[r.method || 'unmatched']++;
  console.log('\n--- Match breakdown ---');
  console.log('  image:    ', breakdown.image);
  console.log('  sku:      ', breakdown.sku);
  console.log('  title:    ', breakdown.title);
  console.log('  unmatched:', breakdown.unmatched);
  console.log('  Tracker rows not matched to any Studio line:', unmatchedTracker.length);

  // Compute proposed totals if writes happen
  let proposedTotalSelling = 0;
  for (const r of results) {
    if (r.method && r.tTSP != null) proposedTotalSelling += r.tTSP;
    else if (r.sTotalSelling) proposedTotalSelling += r.sTotalSelling;
  }
  console.log(`\n  Proposed top-level totalSelling after backfill: $${proposedTotalSelling.toFixed(2)}`);
  console.log(`  Houzz reference invoiceBalance:                  $${target.data.invoiceBalance}`);

  // 5. Write CSV manifest
  const header = ['sIdx','method','overwriteRisk','sTitle','sImg','sSku','sQty','sCost','sUnitPrice','sMarkup','sMarkupValue','sTotalSelling','sTotal','sLineNotes','sClientDescStart','tIdx','tTitle','tImg','tSku','tQty','tUSP','tMarkup','tMarkupValue','tTSP','tLcode','tRoom','tVendor'];
  const csvLines = [header.join(',')];
  for (const r of results) csvLines.push(header.map(k => csvEsc(r[k])).join(','));
  csvLines.push('');
  csvLines.push('--- UNMATCHED TRACKER ROWS (in tracker for IN-12980, not matched to any Studio line) ---');
  csvLines.push(['tIdx','tTitle','tImg','tSku','tQty','tUSP','tMarkup','tTSP','tLcode','tRoom','tVendor'].join(','));
  for (const r of unmatchedTracker) {
    csvLines.push([r.idx, r.title, r.image, r.sku, r.qty, r.usp, r.markup, r.tsp, r.lcode, r.room, r.vendor].map(csvEsc).join(','));
  }
  fs.writeFileSync(OUT_CSV, csvLines.join('\n'));
  console.log(`\n  Manifest: ${OUT_CSV}`);

  // Print first few rows + risk + unmatched to console
  console.log('\n--- Sample matched rows (first 5) ---');
  for (const r of results.slice(0, 5)) {
    console.log(`  [${r.sIdx}] ${(r.sTitle||'').slice(0,40).padEnd(42)} ${r.method.padEnd(8)} | sCost=${String(r.sCost).padStart(7)} sTotalSel=${String(r.sTotalSelling).padStart(8)} → tUSP=${String(r.tUSP).padStart(7)} tTSP=${String(r.tTSP).padStart(8)} ${r.tLcode}`);
  }
  if (results.filter(r => !r.method).length) {
    console.log('\n--- Unmatched Studio lines ---');
    for (const r of results.filter(r => !r.method)) {
      console.log(`  [${r.sIdx}] ${r.sTitle} | img=${r.sImg} sku=${r.sSku}`);
    }
  }
  if (results.filter(r => r.overwriteRisk).length) {
    console.log('\n--- Lines with manual cost (PRESERVE flag) ---');
    for (const r of results.filter(r => r.overwriteRisk)) {
      console.log(`  [${r.sIdx}] ${(r.sTitle||'').slice(0,40).padEnd(42)} sCost=$${r.sCost} → tracker tUSP=$${r.tUSP} tTSP=$${r.tTSP}`);
    }
  }
  if (unmatchedTracker.length) {
    console.log('\n--- Tracker rows not matched to any Studio line ---');
    for (const r of unmatchedTracker) {
      console.log(`  [${r.idx}] ${(r.title||'').slice(0,40).padEnd(42)} img=${r.image} sku=${r.sku} ${r.lcode}`);
    }
  }

  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
