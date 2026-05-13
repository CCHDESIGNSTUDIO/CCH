/**
 * Compare unique invoice/proposal/PO numbers in the RH Project Tracker XLSX
 * vs what Studio currently has in boards/cloud-rolling-hills/.
 * Output: list of missing docs with line item counts.
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

function normNum(s, prefix) {
  if (!s) return '';
  const m = String(s).trim().toUpperCase().match(new RegExp('(' + prefix + ')[\\s-]?(\\d+)'));
  return m ? m[1] + '-' + m[2] : '';
}

(async () => {
  const wb = XLSX.readFile(TRACKER);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  const h = rows[0];
  const idx = (n) => h.findIndex(c => String(c).toLowerCase().trim() === n.toLowerCase());
  const cProp = idx('Proposal'), cInv = idx('Invoice'), cPO = idx('Purchase Order');

  const propLines = new Map(), invLines = new Map(), poLines = new Map();
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const prop = normNum(r[cProp], 'PR');
    const inv = normNum(r[cInv], 'IN');
    const po = normNum(r[cPO], 'PO');
    if (prop) propLines.set(prop, (propLines.get(prop) || 0) + 1);
    if (inv) invLines.set(inv, (invLines.get(inv) || 0) + 1);
    if (po) poLines.set(po, (poLines.get(po) || 0) + 1);
  }
  console.log('Project Tracker (Houzz):');
  console.log('  Total line-item rows: ' + (rows.length - 1));
  console.log('  Unique Proposals: ' + propLines.size);
  console.log('  Unique Invoices:  ' + invLines.size);
  console.log('  Unique POs:       ' + poLines.size);

  const app = initializeApp(PROD);
  const db = getFirestore(app);
  const studioByPrefix = { IN: new Set(), PR: new Set(), PO: new Set() };
  for (const [sub, prefix] of [['invoices', 'IN'], ['proposals', 'PR'], ['purchaseOrders', 'PO']]) {
    const snap = await getDocs(collection(db, 'boards', 'cloud-rolling-hills', sub));
    snap.forEach(d => {
      const x = d.data();
      const num = normNum(x.number || x.invoiceNum || x.proposalNum || x.poNumber || d.id, prefix);
      if (num) studioByPrefix[prefix].add(num);
    });
  }
  console.log('\nStudio cloud-rolling-hills:');
  console.log('  Invoices: ' + studioByPrefix.IN.size);
  console.log('  Proposals: ' + studioByPrefix.PR.size);
  console.log('  POs: ' + studioByPrefix.PO.size);

  console.log('\n=== MISSING (in Houzz tracker, NOT in Studio) ===');
  for (const [prefix, lineMap] of [['PR', propLines], ['IN', invLines], ['PO', poLines]]) {
    const missing = [...lineMap.entries()].filter(([num]) => !studioByPrefix[prefix].has(num));
    console.log('\n' + prefix + ' missing: ' + missing.length);
    missing.sort((a,b) => a[0].localeCompare(b[0])).forEach(([num, count]) => {
      console.log('  ' + num.padEnd(12) + '  ' + count + ' line items');
    });
  }
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
