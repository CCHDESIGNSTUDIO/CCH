/**
 * Read-only inspection of IN-12902.
 * Compares Studio doc state vs tracker rows vs houzz_doc_links.
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
const DOC_LINKS = path.join(__dirname, '..', 'platform', 'houzz_doc_links.json');
const QB_IDS = path.join(__dirname, '..', 'platform', 'houzz_qb_ids.json');
const BOARD_ID = 'cloud-rolling-hills';
const TARGET = 'IN-12902';

const safeNum = (v) => { const n = parseFloat(v); return isFinite(n) ? n : null; };
const round2 = (n) => Math.round(n * 100) / 100;

(async () => {
  // 1. houzz_doc_links + qb_ids
  const dl = JSON.parse(fs.readFileSync(DOC_LINKS, 'utf-8'));
  const qb = JSON.parse(fs.readFileSync(QB_IDS, 'utf-8'));
  console.log('=== houzz_doc_links.json[IN-12902] ===');
  console.log(JSON.stringify(dl[TARGET], null, 2));
  console.log('\n=== houzz_qb_ids.json[IN-12902] ===');
  console.log(qb[TARGET]);

  // 2. tracker rows
  console.log('\n=== TRACKER ROWS for IN-12902 ===');
  const wb = XLSX.readFile(TRACKER);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  const h = rows[0];
  const I = (n) => h.findIndex(c => String(c).toLowerCase().trim() === n.toLowerCase());
  const cT = I('Title'), cInv = I('Invoice'), cImg = I('Image'),
        cQty = I('Selling Quantity'), cUSP = I('Unit Selling Price'),
        cMK = I('Markup %'), cMV = I('Markup Value'), cTSP = I('Total Selling Price'),
        cCT = I('Client Tax'), cRm = I('Room'), cVnd = I('Vendor');
  const trackerRows = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (String(r[cInv] || '').toUpperCase().includes(TARGET)) {
      trackerRows.push({
        title: r[cT], image: r[cImg], room: r[cRm], vendor: r[cVnd],
        qty: safeNum(r[cQty]), usp: safeNum(r[cUSP]),
        markup: safeNum(r[cMK]), markupValue: safeNum(r[cMV]),
        tsp: safeNum(r[cTSP]), clientTax: safeNum(r[cCT])
      });
    }
  }
  console.log(`  Tracker rows: ${trackerRows.length}`);
  let trackerSubtotal = 0, trackerTax = 0;
  for (const r of trackerRows) {
    trackerSubtotal += r.tsp || 0;
    trackerTax += r.clientTax || 0;
    console.log(`  ${(r.title||'').slice(0,40).padEnd(42)} qty=${r.qty} USP=$${r.usp} MK=${r.markup}% MV=$${r.markupValue} TSP=$${r.tsp} tax=$${r.clientTax}  vendor=${r.vendor}  room=${r.room}`);
  }
  console.log(`  TRACKER subtotal: $${round2(trackerSubtotal)}  client tax: $${round2(trackerTax)}  total w/tax: $${round2(trackerSubtotal + trackerTax)}`);

  // 3. Studio doc
  const app = initializeApp(PROD);
  const db = getFirestore(app);
  const snap = await getDocs(collection(db, 'boards', BOARD_ID, 'invoices'));
  let target = null;
  snap.forEach(d => {
    const x = d.data();
    if (String(x.number || x.invoiceNum || d.id).toUpperCase().includes(TARGET)) target = { id: d.id, data: x };
  });
  if (!target) { console.log(`\nIN-12902 not found`); process.exit(1); }
  console.log(`\n=== STUDIO IN-12902 ===`);
  console.log(`  docId: ${target.id}`);
  for (const k of ['number','invoiceNum','status','total','totalSelling','totalCost','clientTax','paidAmount','invoiceBalance','qbId','qbInvoiceId','date','vendor','_houzzPaymentBackfilledAt']) {
    if (target.data[k] !== undefined) console.log(`  ${k}: ${typeof target.data[k] === 'object' ? JSON.stringify(target.data[k]) : target.data[k]}`);
  }
  const items = target.data.items || target.data.lineItems || [];
  console.log(`  line items: ${items.length}`);
  let studioSubtotal = 0;
  items.forEach((it, i) => {
    const ts = safeNum(it.totalSelling) || safeNum(it.total) || 0;
    studioSubtotal += ts;
    console.log(`  [${i}] ${(it.title||it.name||'').slice(0,40).padEnd(42)} qty=${it.qty} cost=$${it.cost} mk=${it.markup}% TS=$${it.totalSelling} total=$${it.total} img=${it.imageFilename||''} sku=${it.sku||''}`);
  });
  console.log(`  STUDIO sum of line totalSelling: $${round2(studioSubtotal)}`);

  console.log('\n=== DELTA ===');
  console.log(`  Cynthia says: total=$15647.39, wire paid=$15645.43, balance=$1.96`);
  console.log(`  Studio total: $${target.data.total}  (delta from $15647.39: $${round2(15647.39 - (target.data.total||0))})`);
  console.log(`  Studio paid:  $${target.data.paidAmount}  (delta from $15645.43: $${round2(15645.43 - (target.data.paidAmount||0))})`);
  console.log(`  Tracker subtotal: $${round2(trackerSubtotal)} + tax $${round2(trackerTax)} = $${round2(trackerSubtotal + trackerTax)}`);

  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
