/**
 * Cloud - Parker audit. Read-only. Sizes the work before any backfill.
 *  - Tracker: unique IN/PR/PO numbers, line counts, date range
 *  - Studio: invoice/proposal/PO counts, items needing backfill
 */
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
const TRACKER = String.raw`C:\Users\cindy\Dropbox\Claude - CCH studio\Houzz FILES\ARCHIVE\project_tracker_report-02-23-2026-20-00Parker.xlsx`;
const BOARD_ID = 'cloud-parker';

const safeNum = (v) => { const n = parseFloat(v); return isFinite(n) ? n : null; };

(async () => {
  console.log('=== CLOUD - PARKER AUDIT ===\n');

  // 1. Tracker
  console.log('--- Tracker ---');
  const wb = XLSX.readFile(TRACKER);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  const h = rows[0];
  console.log('  columns:', h.length);
  console.log('  rows:   ', rows.length - 1);

  const I = (n) => h.findIndex(c => String(c).toLowerCase().trim() === n.toLowerCase());
  const cInv = I('Invoice'), cProp = I('Proposal'), cPO = I('Purchase Order'),
        cTitle = I('Title'), cImg = I('Image'),
        cUSP = I('Unit Selling Price'), cTSP = I('Total Selling Price');

  const invMap = new Map(), propMap = new Map(), poMap = new Map();
  let withImg = 0, withUSP = 0;
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const inv = String(r[cInv] || '').toUpperCase();
    const pr = String(r[cProp] || '').toUpperCase();
    const po = String(r[cPO] || '').toUpperCase();
    const im = inv.match(/IN-\d+/);
    const pm = pr.match(/PR-\d+/);
    const om = po.match(/PO-\d+/);
    if (im) invMap.set(im[0], (invMap.get(im[0]) || 0) + 1);
    if (pm) propMap.set(pm[0], (propMap.get(pm[0]) || 0) + 1);
    if (om) poMap.set(om[0], (poMap.get(om[0]) || 0) + 1);
    if (r[cImg]) withImg++;
    if (safeNum(r[cUSP])) withUSP++;
  }
  console.log(`  Unique invoices:      ${invMap.size}`);
  console.log(`  Unique proposals:     ${propMap.size}`);
  console.log(`  Unique POs:           ${poMap.size}`);
  console.log(`  Lines with image:     ${withImg} / ${rows.length - 1}`);
  console.log(`  Lines with USP > 0:   ${withUSP} / ${rows.length - 1}`);

  // 2. Studio
  console.log('\n--- Studio (boards/' + BOARD_ID + ') ---');
  const app = initializeApp(PROD);
  const db = getFirestore(app);

  const sub = async (name) => {
    const snap = await getDocs(collection(db, 'boards', BOARD_ID, name));
    let total = 0, withQbId = 0, missingNumber = 0, lineItems = 0, linesNeedBackfill = 0, linesAlreadyLinked = 0, linesNoMatch = 0;
    snap.forEach(d => {
      total++;
      const x = d.data();
      if (x.qbId || x.qbInvoiceId) withQbId++;
      if (!x.number && !x.invoiceNum && !x.proposalNum && !x.poNum) missingNumber++;
      const items = x.items || x.lineItems || [];
      for (const it of items) {
        lineItems++;
        if (it._matchedClipId) linesAlreadyLinked++;
        const sCost = safeNum(it.cost) || 0;
        const sTotal = safeNum(it.total);
        if (sCost === 0 || sTotal == null) linesNeedBackfill++;
      }
    });
    return { total, withQbId, missingNumber, lineItems, linesNeedBackfill, linesAlreadyLinked };
  };

  const inv = await sub('invoices');
  console.log(`  invoices:        ${inv.total}  qbId-linked: ${inv.withQbId}  missing-number: ${inv.missingNumber}`);
  console.log(`    line items:    ${inv.lineItems}  already-linked-to-clip: ${inv.linesAlreadyLinked}  needs-pricing-backfill: ${inv.linesNeedBackfill}`);

  const prop = await sub('proposals');
  console.log(`  proposals:       ${prop.total}  qbId-linked: ${prop.withQbId}  missing-number: ${prop.missingNumber}`);
  console.log(`    line items:    ${prop.lineItems}  already-linked-to-clip: ${prop.linesAlreadyLinked}  needs-pricing-backfill: ${prop.linesNeedBackfill}`);

  try {
    const po = await sub('purchaseOrders');
    console.log(`  purchaseOrders:  ${po.total}  qbId-linked: ${po.withQbId}  missing-number: ${po.missingNumber}`);
    console.log(`    line items:    ${po.lineItems}  already-linked-to-clip: ${po.linesAlreadyLinked}  needs-pricing-backfill: ${po.linesNeedBackfill}`);
  } catch (e) {}

  // 3. Clips count
  const clipsSnap = await getDocs(collection(db, 'boards', BOARD_ID, 'clips'));
  console.log(`  clips:           ${clipsSnap.size}`);

  // Tracker doc-num overlap with Studio
  console.log('\n--- Tracker / Studio doc-num overlap ---');
  const studioInv = new Set(), studioProp = new Set(), studioPO = new Set();
  (await getDocs(collection(db, 'boards', BOARD_ID, 'invoices'))).forEach(d => {
    const n = String(d.data().number || d.data().invoiceNum || d.id).match(/IN-\d+/);
    if (n) studioInv.add(n[0]);
  });
  (await getDocs(collection(db, 'boards', BOARD_ID, 'proposals'))).forEach(d => {
    const n = String(d.data().number || d.data().proposalNum || d.id).match(/PR-\d+/);
    if (n) studioProp.add(n[0]);
  });
  try {
    (await getDocs(collection(db, 'boards', BOARD_ID, 'purchaseOrders'))).forEach(d => {
      const n = String(d.data().number || d.data().poNum || d.id).match(/PO-\d+/);
      if (n) studioPO.add(n[0]);
    });
  } catch (e) {}

  const intersect = (a, b) => [...a].filter(x => b.has(x));
  const onlyA = (a, b) => [...a].filter(x => !b.has(x));
  console.log(`  Invoices  — tracker: ${invMap.size}  studio: ${studioInv.size}  both: ${intersect([...invMap.keys()].reduce((s, k) => s.add(k), new Set()), studioInv).length}  studio-only (post-Feb-23 or new): ${onlyA(studioInv, new Set(invMap.keys())).length}  tracker-only (in tracker, not in Studio): ${onlyA(new Set(invMap.keys()), studioInv).length}`);
  console.log(`  Proposals — tracker: ${propMap.size}  studio: ${studioProp.size}  both: ${intersect(new Set(propMap.keys()), studioProp).length}  studio-only: ${onlyA(studioProp, new Set(propMap.keys())).length}  tracker-only: ${onlyA(new Set(propMap.keys()), studioProp).length}`);
  console.log(`  POs       — tracker: ${poMap.size}  studio: ${studioPO.size}  both: ${intersect(new Set(poMap.keys()), studioPO).length}  studio-only: ${onlyA(studioPO, new Set(poMap.keys())).length}  tracker-only: ${onlyA(new Set(poMap.keys()), studioPO).length}`);

  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
