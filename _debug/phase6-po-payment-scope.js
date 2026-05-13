/**
 * READ-ONLY analysis of PO QB ID + payment coverage gap.
 * Focus on per-project breakdown (Bugletrail + Rolling Hills called out).
 * Sources:
 *   - platform/houzz_qb_ids.json   → PO-XXXXX -> QB ID mapping
 *   - platform/houzz_doc_links.json → PO-XXXXX -> { project, status, balance, connected[] }
 *   - boards/{projectId}/purchaseOrders → current Studio PO docs
 *
 * NO writes.
 */
const fs = require('fs');
const path = require('path');
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

const QB_IDS_PATH = path.join(__dirname, '..', 'platform', 'houzz_qb_ids.json');
const DOC_LINKS_PATH = path.join(__dirname, '..', 'platform', 'houzz_doc_links.json');
const OUT_CSV = path.join(__dirname, 'phase6-po-coverage-manifest.csv');

function csvEsc(v) { if (v == null) return ''; const s = String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
function normPoNum(s) {
  if (!s) return '';
  const m = String(s).trim().toUpperCase().match(/PO[\s-]?(\d+)/);
  return m ? 'PO-' + m[1] : '';
}

(async () => {
  console.log('READ-ONLY PO coverage analysis\n');

  // Load QB ID map
  const qbIds = JSON.parse(fs.readFileSync(QB_IDS_PATH, 'utf-8'));
  const qbByPo = {};
  for (const [k, v] of Object.entries(qbIds)) {
    if (k.startsWith('PO-')) qbByPo[k] = String(v).trim();
  }
  console.log(`  ${Object.keys(qbByPo).length} POs mapped to QB IDs in houzz_qb_ids.json`);

  // Load doc links (status, balance)
  const docLinks = JSON.parse(fs.readFileSync(DOC_LINKS_PATH, 'utf-8'));
  const linksByPo = {};
  for (const [k, v] of Object.entries(docLinks)) {
    if (k.startsWith('PO-')) linksByPo[k] = v;
  }
  console.log(`  ${Object.keys(linksByPo).length} POs in houzz_doc_links.json (status + balance)`);

  // Read all Studio POs
  console.log('\n  Reading production /boards/*/purchaseOrders ...');
  const app = initializeApp(PROD);
  const db = getFirestore(app);
  const bsnap = await getDocs(collection(db, 'boards'));
  console.log(`  ${bsnap.size} boards`);

  const allPos = [];
  let boardsScanned = 0;
  for (const bd of bsnap.docs) {
    boardsScanned++;
    if (boardsScanned % 50 === 0) console.log(`    ${boardsScanned}/${bsnap.size} boards scanned`);
    const projectId = bd.id;
    const projectName = bd.data().name || projectId;
    try {
      const psnap = await getDocs(collection(db, 'boards', projectId, 'purchaseOrders'));
      psnap.forEach(d => {
        const x = d.data();
        allPos.push({
          docId: d.id, projectId, projectName,
          number: x.number || x.poNum || '',
          vendor: x.vendor || '',
          total: parseFloat(x.total) || 0,
          paidAmount: parseFloat(x.paidAmount) || 0,
          poBalance: parseFloat(x.poBalance) || 0,
          poStatus: x._poPaymentStatus || x.status || '',
          qbId: x.qbId || x.qbInvoiceId || x.quickbooksId || '',
          qbStatus: x.qbStatus || '',
        });
      });
    } catch (e) { console.log(`    skip ${projectId}: ${e.message}`); }
  }
  console.log(`\n  Total Studio POs: ${allPos.length}`);

  // Bucket per project
  const byProject = new Map();
  for (const p of allPos) {
    if (!byProject.has(p.projectId)) byProject.set(p.projectId, { name: p.projectName, pos: [] });
    byProject.get(p.projectId).pos.push(p);
  }

  // Coverage analysis
  console.log('\n=== COVERAGE GAP BY PROJECT ===');
  console.log('  Project'.padEnd(40) + ' | POs | NeedQbId | NeedPaid | StatusMismatch');
  console.log('-'.repeat(95));

  let totalNeedQb = 0, totalNeedPaid = 0, totalStatusMismatch = 0;
  const manifestRows = [];
  const sorted = [...byProject.entries()].sort((a, b) => b[1].pos.length - a[1].pos.length);

  for (const [pid, info] of sorted) {
    let needQb = 0, needPaid = 0, statusMismatch = 0;
    for (const p of info.pos) {
      const num = normPoNum(p.number);
      if (!num) continue;
      const wantQb = qbByPo[num];
      const link = linksByPo[num];
      let action = [];
      if (wantQb && wantQb !== p.qbId) { needQb++; action.push('add-qbid'); }
      if (link && link.status === 'Paid' && p.paidAmount === 0 && p.total > 0) { needPaid++; action.push('mark-paid'); }
      if (link && link.status && p.poStatus && link.status.toLowerCase() !== String(p.poStatus).toLowerCase()) {
        if (!(link.status === 'Paid' && /paid/i.test(p.poStatus))) { statusMismatch++; action.push('status-fix'); }
      }
      if (action.length) {
        manifestRows.push({
          projectId: pid, projectName: info.name, docId: p.docId, number: num, vendor: p.vendor,
          total: p.total, currentPaid: p.paidAmount, currentQbId: p.qbId, currentStatus: p.poStatus,
          newQbId: wantQb || '', linkStatus: link ? link.status : '', linkBalance: link ? link.balance : '',
          action: action.join('+'),
        });
      }
    }
    totalNeedQb += needQb; totalNeedPaid += needPaid; totalStatusMismatch += statusMismatch;
    if (info.pos.length >= 5 || /bugletrail|rolling hills|cloud/i.test(info.name)) {
      console.log('  ' + info.name.slice(0, 38).padEnd(40) + ' | ' + String(info.pos.length).padStart(3) + ' | ' +
        String(needQb).padStart(8) + ' | ' + String(needPaid).padStart(8) + ' | ' + String(statusMismatch).padStart(13));
    }
  }
  console.log('-'.repeat(95));
  console.log(`  TOTAL across ${sorted.length} projects: ${allPos.length} POs, ${totalNeedQb} need QB ID, ${totalNeedPaid} need payment, ${totalStatusMismatch} status mismatch`);

  // Write manifest
  const csv = ['projectId,projectName,docId,number,vendor,total,currentPaid,currentQbId,currentStatus,newQbId,linkStatus,linkBalance,action'];
  for (const r of manifestRows) csv.push(Object.values(r).map(csvEsc).join(','));
  fs.writeFileSync(OUT_CSV, csv.join('\n'));
  console.log(`\n  Manifest: ${OUT_CSV} (${manifestRows.length} rows)`);
  process.exit(0);
})().catch(e => { console.error('FAILED:', e); process.exit(1); });
