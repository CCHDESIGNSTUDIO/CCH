/**
 * PHASE 10 — Rolling Hills invoices + proposals: backfill QB ID, payment status, paidAmount, balance.
 * Default DRY RUN. --execute to write.
 *
 * Sources:
 *   - houzz_qb_ids.json   (PO-XXXX / IN-XXXX / PR-XXXX → QB ID)
 *   - houzz_doc_links.json (PO/IN/PR → { status, balance, project })
 *
 * For each Studio invoice/proposal in RH:
 *   1. Normalize the number: "IN-12902 - Partially Paid" → "IN-12902" (clean field)
 *   2. Write qbId from houzz_qb_ids.json if not already set
 *   3. Update status / paidAmount / balance from houzz_doc_links.json
 *   4. Marker: _houzzPaymentBackfilledAt
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
const QB_IDS_PATH = path.join(__dirname, '..', 'platform', 'houzz_qb_ids.json');
const DOC_LINKS_PATH = path.join(__dirname, '..', 'platform', 'houzz_doc_links.json');
const BOARD_ID = 'cloud-rolling-hills';
const OUT_CSV = path.join(__dirname, 'phase10-inv-prop-backfill-manifest.csv');
const EXECUTE = process.argv.includes('--execute');

function csvEsc(v) { if (v == null) return ''; const s = String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
function normNum(s, prefix) { const m = String(s||'').trim().toUpperCase().match(new RegExp('(' + prefix + ')[\\s-]?(\\d+)')); return m ? m[1] + '-' + m[2] : ''; }
function safeNum(v) { const n = parseFloat(v); return isFinite(n) && n >= 0 ? n : 0; }

(async () => {
  console.log(`PHASE 10 — RH invoice + proposal backfill  (${EXECUTE ? 'EXECUTE' : 'DRY RUN'})\n`);

  const qb = JSON.parse(fs.readFileSync(QB_IDS_PATH, 'utf-8'));
  const dl = JSON.parse(fs.readFileSync(DOC_LINKS_PATH, 'utf-8'));

  const app = initializeApp(PROD);
  const db = getFirestore(app);

  const subDefs = [
    { sub: 'invoices', prefix: 'IN', numField: 'invoiceNum' },
    { sub: 'proposals', prefix: 'PR', numField: 'proposalNum' },
  ];

  const updates = [];
  const summary = { invoices: { total: 0, qbAdded: 0, statusUpdated: 0, paidUpdated: 0, numberCleaned: 0 }, proposals: { total: 0, qbAdded: 0, statusUpdated: 0, paidUpdated: 0, numberCleaned: 0 } };

  for (const def of subDefs) {
    const snap = await getDocs(collection(db, 'boards', BOARD_ID, def.sub));
    snap.forEach(d => {
      const x = d.data();
      const rawNumberField = String(x.number || x[def.numField] || '').trim();
      const cleanNum = normNum(rawNumberField || d.id, def.prefix);
      if (!cleanNum) return;

      const fields = {};
      let actions = [];

      // 1. Clean number field if it has status concatenated (e.g. "IN-12902 - Partially Paid")
      if (rawNumberField !== cleanNum && rawNumberField) {
        fields.number = cleanNum;
        fields[def.numField] = cleanNum;
        actions.push('clean-number');
        summary[def.sub].numberCleaned++;
      }

      // 2. QB ID
      const wantQb = qb[cleanNum];
      const curQb = String(x.qbId || x.qbInvoiceId || '').trim();
      if (wantQb && wantQb !== curQb) {
        fields.qbId = String(wantQb);
        if (def.sub === 'invoices') fields.qbInvoiceId = String(wantQb);
        actions.push('qb-id');
        summary[def.sub].qbAdded++;
      }

      // 3. Status + paidAmount + balance from doc_links
      const link = dl[cleanNum];
      const total = safeNum(x.total);
      if (link) {
        const linkStatus = String(link.status || '').trim();
        const linkBalance = safeNum(link.balance);
        // Status update — write to both `status` and `_paymentStatus` for clarity
        if (linkStatus && linkStatus !== x.status) {
          fields.status = linkStatus;
          actions.push('status:' + linkStatus.toLowerCase().replace(/\s+/g, '-'));
          summary[def.sub].statusUpdated++;
        }
        // Paid + balance — only for invoices (proposals don't have payment in same sense)
        if (def.sub === 'invoices' && total > 0) {
          let derivedPaid = null;
          if (linkStatus === 'Paid') derivedPaid = total;
          else if (linkStatus === 'Partially Paid') derivedPaid = Math.max(0, total - linkBalance);
          else if (linkStatus === 'Open' || linkStatus === 'Sent') derivedPaid = 0;
          if (derivedPaid !== null && Math.abs((safeNum(x.paidAmount)) - derivedPaid) > 0.01) {
            fields.paidAmount = derivedPaid;
            fields.invoiceBalance = linkBalance;
            actions.push('paid-' + (linkStatus === 'Paid' ? 'full' : linkStatus === 'Partially Paid' ? 'partial' : 'zero'));
            summary[def.sub].paidUpdated++;
          }
        }
      }

      summary[def.sub].total++;
      if (Object.keys(fields).length === 0) return;
      fields._houzzPaymentBackfilledAt = new Date().toISOString();
      updates.push({ sub: def.sub, docId: d.id, number: cleanNum, rawNumber: rawNumberField, total,
        currentQb: curQb, newQb: fields.qbId || curQb,
        currentStatus: x.status || '', newStatus: fields.status || (x.status || ''),
        currentPaid: safeNum(x.paidAmount), newPaid: fields.paidAmount != null ? fields.paidAmount : safeNum(x.paidAmount),
        action: actions.join('+'), fields });
    });
  }

  console.log('--- Summary ---');
  for (const k of ['invoices', 'proposals']) {
    const s = summary[k];
    console.log('  /' + k + '/  scanned=' + s.total + '  numberCleaned=' + s.numberCleaned + '  qbAdded=' + s.qbAdded + '  statusUpdated=' + s.statusUpdated + '  paidUpdated=' + s.paidUpdated);
  }
  console.log('  TOTAL writes: ' + updates.length);

  // Manifest
  const csv = ['sub,docId,number,rawNumber,total,currentQb,newQb,currentStatus,newStatus,currentPaid,newPaid,action'];
  for (const u of updates) csv.push([u.sub, u.docId, u.number, u.rawNumber, u.total, u.currentQb, u.newQb, u.currentStatus, u.newStatus, u.currentPaid, u.newPaid, u.action].map(csvEsc).join(','));
  fs.writeFileSync(OUT_CSV, csv.join('\n'));
  console.log('\n  Manifest: ' + OUT_CSV);

  if (!EXECUTE) { console.log('\nDRY RUN. --execute to write.'); process.exit(0); }

  console.log('\nWRITING TO PRODUCTION...');
  const BATCH = 400;
  let done = 0;
  for (let i = 0; i < updates.length; i += BATCH) {
    const batch = writeBatch(db);
    const slice = updates.slice(i, i + BATCH);
    for (const u of slice) batch.update(doc(db, 'boards', BOARD_ID, u.sub, u.docId), u.fields);
    await batch.commit();
    done += slice.length;
    console.log('  wrote ' + done + '/' + updates.length);
  }
  console.log('\nDONE.');
  process.exit(0);
})().catch(e => { console.error('FAILED:', e); process.exit(1); });
