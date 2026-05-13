/**
 * IN-12980 line-item writer — TRUST THE TRACKER.
 * Default DRY RUN. --execute to write.
 *
 * Per-line writes (all 62 matched by image filename):
 *   - cost ← tracker Unit Selling Price
 *   - unitCost ← same
 *   - markup ← tracker Markup %
 *   - markupValue ← tracker Markup Value
 *   - unitPrice ← tracker Unit Selling Price (mirrored)
 *   - clientPrice ← tracker Unit Selling Price (mirrored)
 *   - totalSelling ← tracker Total Selling Price
 *   - total ← tracker Total Selling Price
 *   - amount ← tracker Total Selling Price
 *   - qty ← tracker Selling Quantity (only if differs)
 *   - lineNotes ← L-code parsed from clientDescription (e.g. "L39") — only when current is empty
 *   - taxable ← tracker Taxable Item == "taxable"
 *   - clientTax ← tracker Client Tax (only when differs > 0.01)
 *
 * Top-level writes:
 *   - total ← sum of new line totals
 *   - totalSelling ← sum of new line totalSelling
 *   - totalCost ← sum of (cost × qty)
 *   - _lineCostsBackfilledAt ← ISO timestamp
 *
 * Sidecar status fix (separate batch):
 *   - PR-12951 status "-" → "Invoiced"   (matches IN-12980)
 *   - PR-12957 status "-" → "Invoiced"
 */
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, updateDoc, writeBatch } = require('firebase/firestore');

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
const OUT_CSV = path.join(__dirname, 'in12980-writer-manifest.csv');
const EXECUTE = process.argv.includes('--execute');

const norm = (s) => String(s || '').toLowerCase().replace(/[\s\-_"'’]+/g, ' ').replace(/\s+/g, ' ').trim();
const safeNum = (v) => { const n = parseFloat(v); return isFinite(n) ? n : null; };
const csvEsc = (v) => { if (v == null) return ''; const s = String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const round2 = (n) => Math.round(n * 100) / 100;

(async () => {
  console.log(`IN-12980 WRITER  (${EXECUTE ? 'EXECUTE' : 'DRY RUN'})\n`);

  // 1. Load tracker rows for IN-12980
  const wb = XLSX.readFile(TRACKER);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  const h = rows[0];
  const I = (n) => h.findIndex(c => String(c).toLowerCase().trim() === n.toLowerCase());
  const cT = I('Title'), cInv = I('Invoice'), cImg = I('Image'),
        cSKU = I('SKU'), cQty = I('Selling Quantity'),
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
        sku: String(r[cSKU] || ''),
        qty: safeNum(r[cQty]),
        usp: safeNum(r[cUSP]),
        markup: safeNum(r[cMK]),
        markupValue: safeNum(r[cMV]),
        tsp: safeNum(r[cTSP]),
        taxable: String(r[cTax] || '').toLowerCase() === 'taxable',
        clientTax: safeNum(r[cCT]),
        lcode: lm ? 'L' + lm[1] : ''
      });
    }
  }

  const byImage = new Map();
  for (const r of trackerRows) {
    const img = String(r.image).toLowerCase().trim();
    if (img) {
      if (!byImage.has(img)) byImage.set(img, []);
      byImage.get(img).push(r);
    }
  }

  // 2. Load Studio doc
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
  if (!target) { console.log('IN-12980 not found'); process.exit(1); }
  const items = target.data.items || [];
  console.log(`Studio doc: ${target.id}, items: ${items.length}, current top.total: $${target.data.total}\n`);

  // 3. Match each line + build new items array
  const used = new Set();
  function pickFirst(arr) {
    for (const r of arr || []) if (!used.has(r.idx)) { used.add(r.idx); return r; }
    return null;
  }

  const manifest = [];
  let newTotalSelling = 0, newTotalCost = 0, newTotal = 0;
  let writeCount = 0;

  const newItems = items.map((s, sIdx) => {
    const sImg = String(s.imageFilename || '').toLowerCase().trim();
    const m = sImg ? pickFirst(byImage.get(sImg)) : null;

    if (!m) {
      // No tracker match — preserve as-is
      const existingTotal = safeNum(s.total) || safeNum(s.totalSelling) || 0;
      const existingCostQty = (safeNum(s.cost) || 0) * (safeNum(s.qty) || 0);
      newTotalSelling += safeNum(s.totalSelling) || 0;
      newTotalCost += existingCostQty;
      newTotal += existingTotal;
      manifest.push({ sIdx, action: 'no-match-skip', sTitle: s.title, sImg: s.imageFilename || '' });
      return s;
    }

    const newCost = m.usp != null ? round2(m.usp) : 0;
    const newMarkup = m.markup != null ? m.markup : 0;
    const newMarkupValue = m.markupValue != null ? round2(m.markupValue) : 0;
    const newQty = m.qty != null ? m.qty : (safeNum(s.qty) || 1);
    const newTSP = m.tsp != null ? round2(m.tsp) : round2(newCost * newQty * (1 + newMarkup / 100));
    const oldLineNotes = String(s.lineNotes || '').trim();
    const newLineNotes = (!oldLineNotes && m.lcode) ? m.lcode : oldLineNotes;

    const updated = {
      ...s,
      cost: newCost,
      unitCost: newCost,
      unitPrice: newCost,
      clientPrice: newCost,
      markup: newMarkup,
      markupValue: newMarkupValue,
      totalSelling: newTSP,
      total: newTSP,
      amount: newTSP,
      qty: newQty,
      lineNotes: newLineNotes,
      taxable: m.taxable,
      clientTax: m.clientTax != null ? round2(m.clientTax) : safeNum(s.clientTax) || 0,
    };

    newTotalSelling += newTSP;
    newTotalCost += newCost * newQty;
    newTotal += newTSP;
    writeCount++;

    manifest.push({
      sIdx, action: 'tracker-write',
      sTitle: s.title,
      oldCost: safeNum(s.cost) || 0,
      newCost,
      oldMarkup: safeNum(s.markup) || 0,
      newMarkup,
      oldTotal: safeNum(s.total) != null ? safeNum(s.total) : (safeNum(s.totalSelling) || 0),
      newTotal: newTSP,
      oldQty: safeNum(s.qty),
      newQty,
      oldLineNotes,
      newLineNotes,
      lcodeAdded: (newLineNotes !== oldLineNotes && m.lcode) ? m.lcode : '',
      manualCostOverwritten: (safeNum(s.cost) || 0) > 0 ? 'YES' : '',
    });

    return updated;
  });

  // Top-level
  const newTopFields = {
    items: newItems,
    total: round2(newTotal),
    totalSelling: round2(newTotalSelling),
    totalCost: round2(newTotalCost),
    _lineCostsBackfilledAt: new Date().toISOString(),
  };

  // Manifest
  const header = ['sIdx','action','sTitle','oldCost','newCost','oldMarkup','newMarkup','oldTotal','newTotal','oldQty','newQty','oldLineNotes','newLineNotes','lcodeAdded','manualCostOverwritten'];
  const csvLines = [header.join(',')];
  for (const r of manifest) csvLines.push(header.map(k => csvEsc(r[k])).join(','));
  csvLines.push('');
  csvLines.push('TOP-LEVEL CHANGES');
  csvLines.push('field,old,new');
  csvLines.push(`total,${target.data.total},${newTopFields.total}`);
  csvLines.push(`totalSelling,${target.data.totalSelling},${newTopFields.totalSelling}`);
  csvLines.push(`totalCost,${target.data.totalCost || 0},${newTopFields.totalCost}`);
  fs.writeFileSync(OUT_CSV, csvLines.join('\n'));

  console.log('--- IN-12980 line writes ---');
  console.log(`  lines updated:               ${writeCount}/${items.length}`);
  console.log(`  manual costs overwritten:    ${manifest.filter(m => m.manualCostOverwritten).length}`);
  console.log(`  L-codes added to lineNotes:  ${manifest.filter(m => m.lcodeAdded).length}`);
  console.log('\n--- top-level changes ---');
  console.log(`  total:        $${target.data.total}  →  $${newTopFields.total}`);
  console.log(`  totalSelling: $${target.data.totalSelling}  →  $${newTopFields.totalSelling}`);
  console.log(`  totalCost:    $${target.data.totalCost || 0}  →  $${newTopFields.totalCost}`);
  console.log(`  invoiceBalance (unchanged): $${target.data.invoiceBalance}`);

  // 4. Sidecar: PR-12951 / PR-12957 status fix
  const propSnap = await getDocs(collection(db, 'boards', BOARD_ID, 'proposals'));
  const propFixes = [];
  propSnap.forEach(d => {
    const x = d.data();
    const num = String(x.number || x.proposalNum || d.id).toUpperCase();
    if ((num.includes('PR-12951') || num.includes('PR-12957')) && String(x.status || '').trim() === '-') {
      propFixes.push({ docId: d.id, number: num, currentStatus: x.status, newStatus: 'Invoiced' });
    }
  });
  console.log('\n--- proposal status fixes ---');
  for (const p of propFixes) console.log(`  ${p.number}: status "${p.currentStatus}" → "${p.newStatus}"`);
  if (!propFixes.length) console.log('  (no proposals to fix — statuses no longer "-")');

  console.log(`\n  Manifest: ${OUT_CSV}`);

  if (!EXECUTE) { console.log('\nDRY RUN. --execute to write.'); process.exit(0); }

  // EXECUTE
  console.log('\nWRITING TO PRODUCTION...');
  const batch = writeBatch(db);
  batch.update(doc(db, 'boards', BOARD_ID, 'invoices', target.id), newTopFields);
  for (const p of propFixes) {
    batch.update(doc(db, 'boards', BOARD_ID, 'proposals', p.docId), { status: p.newStatus, _statusFixedFromDashAt: new Date().toISOString() });
  }
  await batch.commit();
  console.log('  Wrote IN-12980 (62 line items + top-level totals)');
  for (const p of propFixes) console.log(`  Wrote ${p.number} status → ${p.newStatus}`);
  console.log('\nDONE.');
  process.exit(0);
})().catch(e => { console.error('FAILED:', e); process.exit(1); });
