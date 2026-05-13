/**
 * PR-12951 line-item writer — TRUST THE TRACKER.
 * Same shape as IN-12980 writer but for proposals (no shipping/tax/paid section).
 *
 * Default DRY RUN. --execute to write.
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
const TARGET = 'PR-12951';
const SUB = 'proposals';
const NUM_COL = 'Proposal';   // tracker column to filter by
const OUT_CSV = path.join(__dirname, 'pr12951-writer-manifest.csv');
const EXECUTE = process.argv.includes('--execute');

const norm = (s) => String(s || '').toLowerCase().replace(/[\s\-_"'’″]+/g, ' ').replace(/\s+/g, ' ').trim();
const safeNum = (v) => { const n = parseFloat(v); return isFinite(n) ? n : null; };
const csvEsc = (v) => { if (v == null) return ''; const s = String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const round2 = (n) => Math.round(n * 100) / 100;

(async () => {
  console.log(`PR-12951 WRITER  (${EXECUTE ? 'EXECUTE' : 'DRY RUN'})\n`);

  const wb = XLSX.readFile(TRACKER);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  const h = rows[0];
  const I = (n) => h.findIndex(c => String(c).toLowerCase().trim() === n.toLowerCase());
  const cT = I('Title'), cNum = I(NUM_COL), cImg = I('Image'),
        cQty = I('Selling Quantity'),
        cUSP = I('Unit Selling Price'), cMK = I('Markup %'), cMV = I('Markup Value'),
        cTSP = I('Total Selling Price'), cTax = I('Taxable Item'), cCT = I('Client Tax'),
        cCD = I('Client Description');

  const trackerRows = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (String(r[cNum] || '').toUpperCase().includes(TARGET)) {
      const cd = String(r[cCD] || '');
      const lm = cd.match(/L(\d+)/);
      trackerRows.push({
        idx: trackerRows.length,
        title: String(r[cT] || ''),
        image: String(r[cImg] || ''),
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
  console.log(`Tracker rows for ${TARGET}: ${trackerRows.length}`);

  const byImage = new Map();
  for (const r of trackerRows) {
    const img = String(r.image).toLowerCase().trim();
    if (img) {
      if (!byImage.has(img)) byImage.set(img, []);
      byImage.get(img).push(r);
    }
  }

  const app = initializeApp(PROD);
  const db = getFirestore(app);
  const snap = await getDocs(collection(db, 'boards', BOARD_ID, SUB));
  let target = null;
  snap.forEach(d => {
    const x = d.data();
    if (String(x.number || x.proposalNum || d.id).toUpperCase().includes(TARGET)) target = { id: d.id, data: x };
  });
  if (!target) { console.log(`${TARGET} not found`); process.exit(1); }
  const items = target.data.items || [];
  console.log(`Studio doc: ${target.id}, items: ${items.length}, current top.total: $${target.data.total}\n`);

  const used = new Set();
  function pickFirst(arr) {
    for (const r of arr || []) if (!used.has(r.idx)) { used.add(r.idx); return r; }
    return null;
  }

  const manifest = [];
  let newTotalSelling = 0, newTotalCost = 0, writeCount = 0, manualOverwrite = 0, lcodeAdded = 0, noMatch = 0;

  const newItems = items.map((s, sIdx) => {
    const sImg = String(s.imageFilename || '').toLowerCase().trim();
    const m = sImg ? pickFirst(byImage.get(sImg)) : null;

    if (!m) {
      noMatch++;
      newTotalSelling += safeNum(s.totalSelling) || 0;
      newTotalCost += (safeNum(s.cost) || 0) * (safeNum(s.qty) || 0);
      manifest.push({ sIdx, action: 'no-match-skip', sTitle: s.title || '' });
      return s;
    }

    const newCost = m.usp != null ? round2(m.usp) : 0;
    const newMarkup = m.markup != null ? m.markup : 0;
    const newMarkupValue = m.markupValue != null ? round2(m.markupValue) : 0;
    const newQty = m.qty != null ? m.qty : (safeNum(s.qty) || 1);
    const newTSP = m.tsp != null ? round2(m.tsp) : round2(newCost * newQty * (1 + newMarkup / 100));
    const oldLineNotes = String(s.lineNotes || '').trim();
    const newLineNotes = (!oldLineNotes && m.lcode) ? m.lcode : oldLineNotes;

    if ((safeNum(s.cost) || 0) > 0) manualOverwrite++;
    if (newLineNotes !== oldLineNotes && m.lcode) lcodeAdded++;

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
    writeCount++;

    manifest.push({
      sIdx, action: 'tracker-write',
      sTitle: s.title,
      oldCost: safeNum(s.cost) || 0, newCost,
      oldMarkup: safeNum(s.markup) || 0, newMarkup,
      oldTotal: safeNum(s.total) != null ? safeNum(s.total) : (safeNum(s.totalSelling) || 0),
      newTotal: newTSP,
      oldQty: safeNum(s.qty), newQty,
      oldLineNotes, newLineNotes,
    });

    return updated;
  });

  const newTopFields = {
    items: newItems,
    total: round2(newTotalSelling),
    totalSelling: round2(newTotalSelling),
    totalCost: round2(newTotalCost),
    _lineCostsBackfilledAt: new Date().toISOString(),
  };

  console.log('--- PR-12951 line writes ---');
  console.log(`  lines updated:         ${writeCount}/${items.length}`);
  console.log(`  no-match (preserved):  ${noMatch}`);
  console.log(`  manual costs overwrit: ${manualOverwrite}`);
  console.log(`  L-codes added:         ${lcodeAdded}`);
  console.log('\n--- Top-level changes ---');
  console.log(`  total:        $${target.data.total}  →  $${newTopFields.total}`);
  console.log(`  totalSelling: $${target.data.totalSelling}  →  $${newTopFields.totalSelling}`);
  console.log(`  totalCost:    $${target.data.totalCost || 0}  →  $${newTopFields.totalCost}`);

  const header = ['sIdx','action','sTitle','oldCost','newCost','oldMarkup','newMarkup','oldTotal','newTotal','oldQty','newQty','oldLineNotes','newLineNotes'];
  const csvLines = [header.join(',')];
  for (const r of manifest) csvLines.push(header.map(k => csvEsc(r[k])).join(','));
  fs.writeFileSync(OUT_CSV, csvLines.join('\n'));
  console.log(`\n  Manifest: ${OUT_CSV}`);

  if (!EXECUTE) { console.log('\nDRY RUN. --execute to write.'); process.exit(0); }

  console.log('\nWRITING TO PRODUCTION...');
  const batch = writeBatch(db);
  batch.update(doc(db, 'boards', BOARD_ID, SUB, target.id), newTopFields);
  await batch.commit();
  console.log(`  Wrote ${target.id}`);
  console.log('\nDONE.');
  process.exit(0);
})().catch(e => { console.error('FAILED:', e); process.exit(1); });
