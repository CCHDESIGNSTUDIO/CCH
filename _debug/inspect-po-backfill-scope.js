/**
 * READ-ONLY scope inspector for PO payment backfill.
 * Lists every project that appears in Houzz outgoing-transactions files,
 * shows how many POs that project has in Houzz, and whether a matching
 * production board exists (matched by name fuzzy + by board id).
 * NO writes.
 */
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

const HOUZZ_DIR = String.raw`C:\Users\cindy\Dropbox\Claude - CCH studio\Houzz FILES`;
const FILES = [
  'OutgoingTransactionsReport_04_22_2026_ New Houzz.xlsx',
  'OutgoingTransactionsReport_03_29_2026 PO\'s new houzz.xlsx',
  'Houzz OutgoingTransactionsReport_04_06_2026.xlsx',
];

const PROD = {
  apiKey: 'AIzaSyAd24U5ArVGrA24IxNcYD2NYiTVycyF4og',
  authDomain: 'cch-design-boards.firebaseapp.com',
  projectId: 'cch-design-boards',
  storageBucket: 'cch-design-boards.appspot.com',
  messagingSenderId: '210388013080',
  appId: '1:210388013080:web:cch-design-boards',
};

function norm(s) { return String(s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim(); }

function readPOsFromFile(file) {
  const full = path.join(HOUZZ_DIR, file);
  if (!fs.existsSync(full)) return [];
  const wb = XLSX.readFile(full);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  if (rows.length === 0) return [];
  const header = rows[0];
  const idx = (n) => header.indexOf(n);
  const cCode = idx('Code'), cProj = idx('Project Name'), cVend = idx('Vendor/Sub'),
        cStat = idx('Status'), cTotal = idx('Total'), cBal = idx('Balance'),
        cBilled = idx('Billed Amount'), cPaid = idx('Paid payments');
  const out = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const code = String(r[cCode] || '').trim();
    if (!/^PO-?\d+/i.test(code)) continue; // only PO-XXXX rows
    out.push({
      code: code.replace(/^PO[\s-]?/i, 'PO-').replace('PO--', 'PO-'),
      project: String(r[cProj] || '').trim(),
      vendor: String(r[cVend] || '').trim(),
      status: String(r[cStat] || '').trim(),
      total: parseFloat(r[cTotal] || 0) || 0,
      balance: parseFloat(r[cBal] || 0) || 0,
      billed: parseFloat(r[cBilled] || 0) || 0,
      paidText: String(r[cPaid] || '').trim(),
      sourceFile: file,
    });
  }
  return out;
}

(async () => {
  console.log('=== Reading Houzz outgoing files ===');
  const allPOs = [];
  for (const f of FILES) {
    const r = readPOsFromFile(f);
    console.log(`  ${f}: ${r.length} PO rows`);
    allPOs.push(...r);
  }
  // Dedupe by code, prefer most recent file (FILES[0] first)
  const byCode = new Map();
  for (const po of allPOs) {
    if (!byCode.has(po.code)) byCode.set(po.code, po);
  }
  console.log(`\n  Unique POs across all files: ${byCode.size}`);

  // Group by project
  const byProject = new Map();
  for (const po of byCode.values()) {
    const k = po.project || '(no project)';
    if (!byProject.has(k)) byProject.set(k, []);
    byProject.get(k).push(po);
  }

  // Read production board ids + names
  console.log('\n=== Reading production boards (read-only) ===');
  const app = initializeApp(PROD);
  const db = getFirestore(app);
  const bsnap = await getDocs(collection(db, 'boards'));
  const boards = [];
  bsnap.forEach(d => boards.push({ id: d.id, name: d.data().name || '' }));
  console.log(`  ${boards.length} production boards`);

  function findBoard(houzzProjName) {
    if (!houzzProjName) return null;
    const target = norm(houzzProjName);
    let exact = boards.find(b => norm(b.name) === target);
    if (exact) return exact;
    // try by id-name match (e.g. "7225 Bugletrail" → boardid contains "7225-bugletrail" or "bugletrail")
    let idMatch = boards.find(b => norm(b.id).includes(target) || target.includes(norm(b.id)));
    if (idMatch) return idMatch;
    // partial name match
    return boards.find(b => norm(b.name).includes(target) || target.includes(norm(b.name))) || null;
  }

  console.log('\n=== Houzz projects with POs (sorted by PO count desc) ===');
  console.log('   Houzz Project'.padEnd(45) + ' | POs | Paid | OutBal | Prod board');
  console.log('-'.repeat(110));
  const sorted = [...byProject.entries()].sort((a, b) => b[1].length - a[1].length);
  let totalPOs = 0, totalMatched = 0;
  const rows = [];
  for (const [proj, pos] of sorted) {
    const paid = pos.filter(p => /paid/i.test(p.status)).length;
    const outstanding = pos.reduce((s, p) => s + p.balance, 0);
    const total = pos.reduce((s, p) => s + p.total, 0);
    const board = findBoard(proj);
    const boardLabel = board ? `${board.id}` : '(no match)';
    console.log(`  ${proj.slice(0, 43).padEnd(45)} | ${String(pos.length).padStart(3)} | ${String(paid).padStart(4)} | $${outstanding.toFixed(0).padStart(7)} | ${boardLabel}`);
    totalPOs += pos.length;
    if (board) totalMatched += pos.length;
    rows.push({
      houzzProject: proj,
      poCount: pos.length,
      paidCount: paid,
      totalDollars: total,
      outstandingDollars: outstanding,
      boardId: board ? board.id : '',
      boardName: board ? board.name : '',
    });
  }
  console.log('-'.repeat(110));
  console.log(`  TOTAL: ${totalPOs} POs across ${sorted.length} Houzz projects, ${totalMatched} POs matchable to production boards`);

  // Save scope CSV for picking
  const csvPath = path.join(__dirname, 'po-backfill-scope.csv');
  const csv = ['houzzProject,poCount,paidCount,totalDollars,outstandingDollars,boardId,boardName'];
  for (const r of rows) {
    csv.push([r.houzzProject, r.poCount, r.paidCount, r.totalDollars.toFixed(2), r.outstandingDollars.toFixed(2), r.boardId, r.boardName]
      .map(v => /[",\n]/.test(String(v)) ? '"' + String(v).replace(/"/g, '""') + '"' : String(v)).join(','));
  }
  fs.writeFileSync(csvPath, csv.join('\n'));
  console.log(`\n  Scope CSV written: ${csvPath}`);

  process.exit(0);
})().catch(e => { console.error('FAILED:', e); process.exit(1); });
