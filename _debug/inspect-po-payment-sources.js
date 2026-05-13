/**
 * READ-ONLY inspector for PO payment data sources.
 * Goal: understand the shape of the Houzz outgoing-transactions xlsx files
 * AND the shape of Studio production PO docs, so we can plan a payment backfill
 * for project 7225-bugletrail. NO writes anywhere.
 */
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, query, limit } = require('firebase/firestore');

const HOUZZ_DIR = String.raw`C:\Users\cindy\Dropbox\Claude - CCH studio\Houzz FILES`;
const FILES = [
  'OutgoingTransactionsReport_04_22_2026_ New Houzz.xlsx',
  'OutgoingTransactionsReport_03_29_2026 PO\'s new houzz.xlsx',
  'Houzz OutgoingTransactionsReport_04_06_2026.xlsx',
  'PaymentsReport_04_10_2026 All New Houzz Projects through April 4.xlsx',
];

const PROD = {
  apiKey: 'AIzaSyAd24U5ArVGrA24IxNcYD2NYiTVycyF4og',
  authDomain: 'cch-design-boards.firebaseapp.com',
  projectId: 'cch-design-boards',
  storageBucket: 'cch-design-boards.appspot.com',
  messagingSenderId: '210388013080',
  appId: '1:210388013080:web:cch-design-boards',
};

function dumpXlsx(file) {
  const full = path.join(HOUZZ_DIR, file);
  if (!fs.existsSync(full)) {
    console.log(`  MISSING: ${file}`);
    return;
  }
  const wb = XLSX.readFile(full);
  console.log(`\n=== ${file}`);
  console.log(`    Sheets: ${wb.SheetNames.join(' | ')}`);
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    console.log(`\n    --- Sheet: "${sheetName}" (${rows.length} rows)`);
    if (rows.length === 0) continue;
    const header = rows[0];
    console.log(`    HEADERS (${header.length}): ${header.map((h, i) => `[${i}] ${h}`).join(' | ')}`);
    const samples = rows.slice(1, 4);
    samples.forEach((r, i) => {
      console.log(`    SAMPLE ROW ${i + 1}:`);
      header.forEach((h, ci) => {
        const v = r[ci];
        if (v !== '' && v != null) console.log(`        ${h}: ${String(v).slice(0, 120)}`);
      });
    });
  }
}

(async () => {
  console.log('=== HOUZZ OUTGOING-TRANSACTIONS / PAYMENTS FILE SHAPES ===');
  for (const f of FILES) {
    try { dumpXlsx(f); } catch (e) { console.log(`  ERROR reading ${f}: ${e.message}`); }
  }

  console.log('\n\n=== STUDIO PRODUCTION BUGLETRAIL PO DOCS (sample 5) ===');
  const app = initializeApp(PROD);
  const db = getFirestore(app);
  const psnap = await getDocs(query(collection(db, 'boards', '7225-bugletrail', 'purchaseOrders'), limit(5)));
  let i = 0;
  psnap.forEach(d => {
    i++;
    const x = d.data();
    console.log(`\n--- PO ${i}: ${d.id}`);
    const keys = Object.keys(x).sort();
    for (const k of keys) {
      let v = x[k];
      if (Array.isArray(v)) v = `[Array len=${v.length}] ` + (v.length ? JSON.stringify(v[0]).slice(0, 200) : '');
      else if (typeof v === 'object' && v !== null) v = JSON.stringify(v).slice(0, 200);
      else v = String(v).slice(0, 200);
      console.log(`    ${k}: ${v}`);
    }
  });
  console.log(`\n(read ${i} PO docs from boards/7225-bugletrail/purchaseOrders)`);

  process.exit(0);
})().catch(e => { console.error('FAILED:', e); process.exit(1); });
