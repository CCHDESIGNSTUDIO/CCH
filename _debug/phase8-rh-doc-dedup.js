/**
 * PHASE 8 — Rolling Hills doc deduplication.
 * Removes case-sensitive duplicate doc IDs in invoices/proposals/purchaseOrders.
 * Same invoice number imported with different case (IN-12946 + in-12946) creates
 * two docs. Keep one per number, prefer the one with the most data + latest update.
 *
 * Default DRY RUN. --execute to write.
 */
const fs = require('fs');
const path = require('path');
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

const BOARD_ID = 'cloud-rolling-hills';
const OUT_CSV = path.join(__dirname, 'phase8-doc-dedup-manifest.csv');
const EXECUTE = process.argv.includes('--execute');

function csvEsc(v) { if (v == null) return ''; const s = String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
function normNum(s, prefix) {
  const m = String(s||'').trim().toUpperCase().match(new RegExp('(' + prefix + ')[\\s-]?(\\d+)'));
  return m ? m[1] + '-' + m[2] : '';
}
function richnessScore(d) {
  // More data = higher score. Prefer longer items[], more populated fields, more recent updatedAt.
  let s = 0;
  if (Array.isArray(d.items) && d.items.length) s += d.items.length * 10;
  if (Array.isArray(d.payments) && d.payments.length) s += d.payments.length * 5;
  for (const k of ['vendor','status','total','paidAmount','number','poNum','invoiceNum','proposalNum','date','qbId','qbInvoiceId']) {
    if (d[k] != null && String(d[k]).trim() !== '' && d[k] !== 0) s += 1;
  }
  if (d.updatedAt) {
    const t = new Date(d.updatedAt).getTime();
    if (isFinite(t)) s += t / 1e10;
  }
  return s;
}

(async () => {
  console.log(`PHASE 8 — RH doc dedup  (${EXECUTE ? 'EXECUTE' : 'DRY RUN'})\n`);

  const app = initializeApp(PROD);
  const db = getFirestore(app);

  const subDefs = [
    { sub: 'invoices', prefix: 'IN', numField: 'invoiceNum' },
    { sub: 'proposals', prefix: 'PR', numField: 'proposalNum' },
    { sub: 'purchaseOrders', prefix: 'PO', numField: 'poNumber' },
  ];

  const allDeletions = [];
  const summaryRows = [];

  for (const def of subDefs) {
    console.log(`\n--- /${def.sub}/ ---`);
    const snap = await getDocs(collection(db, 'boards', BOARD_ID, def.sub));
    const groups = new Map();
    snap.forEach(d => {
      const x = d.data();
      const num = normNum(x.number || x[def.numField] || d.id, def.prefix);
      if (!num) return;
      if (!groups.has(num)) groups.set(num, []);
      groups.get(num).push({ docId: d.id, data: x, score: richnessScore(x) });
    });

    let dupGroups = 0, deletions = 0;
    for (const [num, group] of groups) {
      if (group.length < 2) continue;
      dupGroups++;
      // Sort by score desc — winner is highest
      group.sort((a, b) => b.score - a.score);
      const winner = group[0];
      const losers = group.slice(1);
      for (const loser of losers) {
        deletions++;
        allDeletions.push({ sub: def.sub, num, deleteDocId: loser.docId, keepDocId: winner.docId,
          deletedTotal: parseFloat(loser.data.total) || 0, keptTotal: parseFloat(winner.data.total) || 0 });
      }
    }
    console.log(`  ${snap.size} docs, ${groups.size} unique ${def.prefix} numbers`);
    console.log(`  ${dupGroups} numbers have duplicates → ${deletions} docs to delete`);
    summaryRows.push({ sub: def.sub, total: snap.size, unique: groups.size, dupGroups, deletions });
  }

  console.log('\n--- SUMMARY ---');
  for (const r of summaryRows) console.log(`  ${r.sub.padEnd(18)} total=${r.total} unique=${r.unique} dupGroups=${r.dupGroups} deletions=${r.deletions}`);

  // Manifest
  const csv = ['subcollection,number,deleteDocId,keepDocId,deletedTotal,keptTotal'];
  for (const a of allDeletions) csv.push([a.sub, a.num, a.deleteDocId, a.keepDocId, a.deletedTotal, a.keptTotal].map(csvEsc).join(','));
  fs.writeFileSync(OUT_CSV, csv.join('\n'));
  console.log(`\n  Manifest: ${OUT_CSV} (${allDeletions.length} planned deletions)`);

  if (!EXECUTE) { console.log('\nDRY RUN. --execute to write.'); process.exit(0); }

  console.log('\nDELETING duplicates...');
  const BATCH = 400;
  let done = 0;
  for (let i = 0; i < allDeletions.length; i += BATCH) {
    const batch = writeBatch(db);
    const slice = allDeletions.slice(i, i + BATCH);
    for (const a of slice) batch.delete(doc(db, 'boards', BOARD_ID, a.sub, a.deleteDocId));
    await batch.commit();
    done += slice.length;
    console.log(`  deleted ${done}/${allDeletions.length}`);
  }
  console.log('\nDONE.');
  process.exit(0);
})().catch(e => { console.error('FAILED:', e); process.exit(1); });
