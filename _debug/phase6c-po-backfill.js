/**
 * PHASE 6C — Backfill QB IDs + payment data on production POs.
 * Default DRY RUN. Pass --execute to write.
 *
 * For each PO across all boards:
 *   - qbId   ← houzz_qb_ids.json
 *   - paidAmount / poBalance / _poPaymentStatus / paidDate ← doc_links + XLSX
 *   - marker  _paymentImportedFromHouzzMay2 = now
 *
 * Fields are OVERWRITTEN with Houzz source-of-truth values per user request.
 * Output: phase6c-backfill-manifest.csv
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

const HOUZZ_DIR = String.raw`C:\Users\cindy\Dropbox\Claude - CCH studio\Houzz FILES`;
const XLSX_FILES = [
  'OutgoingTransactionsReport_04_22_2026_ New Houzz.xlsx',
  'OutgoingTransactionsReport_03_29_2026 PO\'s new houzz.xlsx',
  'Houzz OutgoingTransactionsReport_04_06_2026.xlsx',
];
const QB_IDS = path.join(__dirname, '..', 'platform', 'houzz_qb_ids.json');
const DOC_LINKS = path.join(__dirname, '..', 'platform', 'houzz_doc_links.json');
const OUT_CSV = path.join(__dirname, 'phase6c-backfill-manifest.csv');
const EXECUTE = process.argv.includes('--execute');

function csvEsc(v) { if (v == null) return ''; const s = String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
function normPo(s) { const m = String(s||'').trim().toUpperCase().match(/PO[\s-]?(\d+)/); return m ? 'PO-'+m[1] : ''; }
function safeNum(v) { const n = parseFloat(v); return isFinite(n) && n >= 0 ? n : 0; }

(async () => {
  console.log(`PHASE 6C — PO backfill  (mode: ${EXECUTE ? 'EXECUTE — WRITES' : 'DRY RUN'})\n`);

  const qbIds = JSON.parse(fs.readFileSync(QB_IDS, 'utf-8'));
  const qbByPo = {};
  for (const [k, v] of Object.entries(qbIds)) if (k.startsWith('PO-')) qbByPo[k] = String(v).trim();
  const docLinks = JSON.parse(fs.readFileSync(DOC_LINKS, 'utf-8'));
  const linksByPo = {};
  for (const [k, v] of Object.entries(docLinks)) if (k.startsWith('PO-')) linksByPo[k] = v;

  // XLSX: parse out paid amount + date for the small subset that has detailed text
  const xlsxByPo = {};
  for (const f of XLSX_FILES) {
    const full = path.join(HOUZZ_DIR, f);
    if (!fs.existsSync(full)) continue;
    const wb = XLSX.readFile(full);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    const h = rows[0];
    const idx = (n) => h.indexOf(n);
    const cCode = idx('Code'), cStatus = idx('Status'), cTotal = idx('Total'),
          cBalance = idx('Balance'), cBilled = idx('Billed Amount'), cPaid = idx('Paid payments');
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const code = normPo(r[cCode]);
      if (!code) continue;
      if (xlsxByPo[code]) continue; // first wins (most recent file is FILES[0])
      const paidText = String(r[cPaid] || '').trim();
      const m = paidText.match(/\$?([\d,]+(?:\.\d{1,2})?)\s*-?\s*paid on\s+(.+)/i);
      xlsxByPo[code] = {
        status: String(r[cStatus] || '').trim(),
        total: safeNum(r[cTotal]),
        balance: safeNum(r[cBalance]),
        billed: safeNum(r[cBilled]),
        paidAmount: m ? parseFloat(m[1].replace(/,/g, '')) : 0,
        paidDate: m ? String(m[2]).trim() : '',
        paidText,
      };
    }
  }
  console.log(`  Loaded: ${Object.keys(qbByPo).length} qbIds, ${Object.keys(linksByPo).length} doc_links, ${Object.keys(xlsxByPo).length} XLSX`);

  // Read all Studio POs
  const app = initializeApp(PROD);
  const db = getFirestore(app);
  const bsnap = await getDocs(collection(db, 'boards'));
  console.log(`  ${bsnap.size} boards. Scanning POs...`);
  const allPos = [];
  let scanned = 0;
  for (const bd of bsnap.docs) {
    scanned++;
    if (scanned % 50 === 0) console.log(`    ${scanned}/${bsnap.size}`);
    const projectId = bd.id;
    const projectName = bd.data().name || projectId;
    try {
      const psnap = await getDocs(collection(db, 'boards', projectId, 'purchaseOrders'));
      psnap.forEach(d => allPos.push({ docId: d.id, projectId, projectName, ...d.data() }));
    } catch (_e) {}
  }
  console.log(`  ${allPos.length} Studio POs total\n`);

  const updates = [];
  let willQb = 0, willPaid = 0, willPartial = 0, willStatus = 0, skipNoMatch = 0, skipNoNumber = 0;
  const nowIso = new Date().toISOString();

  for (const p of allPos) {
    const num = normPo(p.number || p.poNum);
    if (!num) { skipNoNumber++; continue; }

    const wantQb = qbByPo[num];
    const link = linksByPo[num];
    const xlsx = xlsxByPo[num];
    if (!wantQb && !link && !xlsx) { skipNoMatch++; continue; }

    const fields = { _paymentImportedFromHouzzMay2: nowIso };
    let action = [];

    // QB ID — overwrite if Houzz has one
    if (wantQb && wantQb !== p.qbId) {
      fields.qbId = wantQb;
      action.push('qb-id');
      willQb++;
    }

    // Payment status + amount: prefer XLSX (precise) > doc_links
    const total = safeNum(p.total);
    let derivedPaid = null, derivedStatus = null, derivedBalance = null, derivedDate = null;

    if (xlsx) {
      derivedStatus = xlsx.status || null;
      derivedBalance = xlsx.balance;
      if (xlsx.paidAmount > 0) { derivedPaid = xlsx.paidAmount; derivedDate = xlsx.paidDate; }
      else if (xlsx.status === 'Paid') { derivedPaid = total || xlsx.total; }
      else if (xlsx.balance >= 0 && (total || xlsx.total) > 0) {
        derivedPaid = Math.max(0, (total || xlsx.total) - xlsx.balance);
      }
    } else if (link) {
      derivedStatus = link.status || null;
      derivedBalance = safeNum(link.balance);
      if (link.status === 'Paid') {
        derivedPaid = total;
      } else if (link.status === 'Partially Paid') {
        derivedPaid = Math.max(0, total - derivedBalance);
      } else if (link.status === 'Open' || link.status === 'Sent') {
        derivedPaid = 0;
      } else if (link.status === 'Closed') {
        // Closed but unclear payment — leave amounts, set status
      }
    }

    if (derivedStatus && derivedStatus !== p._poPaymentStatus) {
      fields._poPaymentStatus = derivedStatus;
      action.push('status:' + derivedStatus.toLowerCase().replace(/\s+/g, '-'));
      willStatus++;
    }
    if (derivedPaid !== null && Math.abs((p.paidAmount || 0) - derivedPaid) > 0.01) {
      fields.paidAmount = derivedPaid;
      if (derivedStatus === 'Paid') { willPaid++; action.push('paid-full'); }
      else { willPartial++; action.push('paid-partial'); }
    }
    if (derivedBalance !== null && Math.abs((p.poBalance || 0) - derivedBalance) > 0.01) {
      fields.poBalance = derivedBalance;
    }
    if (derivedDate && !p.paidDate) {
      fields.paidDate = derivedDate;
    }

    if (Object.keys(fields).length === 1) continue; // only the marker, no real change
    updates.push({ docId: p.docId, projectId: p.projectId, projectName: p.projectName, number: num, vendor: p.vendor || '',
                   currentQbId: p.qbId || '', newQbId: fields.qbId || (p.qbId || ''),
                   currentPaid: p.paidAmount || 0, newPaid: fields.paidAmount != null ? fields.paidAmount : (p.paidAmount || 0),
                   currentStatus: p._poPaymentStatus || '', newStatus: fields._poPaymentStatus || (p._poPaymentStatus || ''),
                   total, action: action.join('+'), fields });
  }

  console.log('--- Action plan ---');
  console.log(`  Will set qbId:           ${willQb}`);
  console.log(`  Will mark fully paid:    ${willPaid}`);
  console.log(`  Will mark partially paid:${willPartial}`);
  console.log(`  Will set status:         ${willStatus}`);
  console.log(`  Skip (no match):         ${skipNoMatch}`);
  console.log(`  Skip (no PO number):     ${skipNoNumber}`);
  console.log(`  TOTAL doc updates:       ${updates.length}`);

  // Manifest
  const csv = ['projectId,projectName,docId,number,vendor,total,currentQbId,newQbId,currentPaid,newPaid,currentStatus,newStatus,action'];
  for (const u of updates) csv.push([u.projectId, u.projectName, u.docId, u.number, u.vendor, u.total, u.currentQbId, u.newQbId, u.currentPaid, u.newPaid, u.currentStatus, u.newStatus, u.action].map(csvEsc).join(','));
  fs.writeFileSync(OUT_CSV, csv.join('\n'));
  console.log(`\n  Manifest: ${OUT_CSV}`);

  if (!EXECUTE) { console.log('\nDRY RUN. Re-run with --execute to write.'); process.exit(0); }

  console.log('\nWRITING TO PRODUCTION...');
  const BATCH = 400;
  let written = 0;
  for (let i = 0; i < updates.length; i += BATCH) {
    const batch = writeBatch(db);
    const slice = updates.slice(i, i + BATCH);
    for (const u of slice) batch.update(doc(db, 'boards', u.projectId, 'purchaseOrders', u.docId), u.fields);
    await batch.commit();
    written += slice.length;
    console.log(`  wrote ${written}/${updates.length}`);
  }
  console.log(`\nDONE. Wrote ${written}.`);
  process.exit(0);
})().catch(e => { console.error('FAILED:', e); process.exit(1); });
