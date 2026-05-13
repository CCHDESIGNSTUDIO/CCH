/**
 * Full Rolling Hills audit against the new May 12 tracker.
 * Read-only. Checks: vendor field, totals, paid amounts, QB IDs, status, missing docs.
 */
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const admin = require('firebase-admin');

const SERVICE_ACCOUNT = path.join(__dirname, 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
admin.initializeApp({ credential: admin.credential.cert(require(SERVICE_ACCOUNT)) });
const db = admin.firestore();

const TRACKER = String.raw`C:\Users\cindy\Dropbox\Claude - CCH studio\Houzz FILES\Project Trackers\Cloud -= Rolling Hills reports-2870-05-12-2026-09-17-08-433.xlsx`;
const BOARD_ID = 'cloud-rolling-hills';
const OUT_CSV = path.join(__dirname, 'rh-delta.csv');

const safeNum = (v) => { const n = parseFloat(v); return isFinite(n) ? n : 0; };
const round2 = (n) => Math.round(n * 100) / 100;
const csvEsc = (v) => { if (v == null) return ''; const s = String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };

(async () => {
  // 1. Parse tracker
  const wb = XLSX.readFile(TRACKER);
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' });
  const HEADER_ROW = 4;
  const header = rows[HEADER_ROW];
  const col = (n) => header.findIndex(c => String(c || '').toLowerCase().trim() === n.toLowerCase());
  const cCode = col('Code'), cType = col('Transaction Type'),
        cAmount = col('Amount'), cShip = col('Shipping'),
        cStatus = col('Status'), cBal = col('Balance'), cQB = col('Quickbooks Doc id'),
        cTags = col('Document Tags'), cMemo = col('Memo/Description'), cDate = col('Doc Date'),
        cBilling = col('Billing Address');

  const houzzByCode = new Map();
  for (let i = HEADER_ROW + 1; i < rows.length; i++) {
    const r = rows[i];
    const code = String(r[cCode] || '').trim().toUpperCase();
    if (!code) continue;
    houzzByCode.set(code, {
      code, type: String(r[cType] || '').trim().toLowerCase(),
      amount: safeNum(r[cAmount]), shipping: safeNum(r[cShip]),
      status: String(r[cStatus] || '').trim(),
      balance: safeNum(r[cBal]), qbId: String(r[cQB] || '').trim(),
      tags: String(r[cTags] || '').trim(),
      memo: String(r[cMemo] || '').trim(),
      date: String(r[cDate] || '').trim(),
      billing: String(r[cBilling] || '').split('\n')[0].trim(),
    });
  }
  console.log(`Houzz transactions: ${houzzByCode.size}`);
  const tally = {};
  for (const [, h] of houzzByCode) tally[h.type] = (tally[h.type] || 0) + 1;
  console.log('Houzz by type:', tally);

  // 2. Pull Studio
  const studioByCode = new Map();
  for (const sub of ['invoices', 'purchaseOrders', 'proposals']) {
    const snap = await db.collection('boards').doc(BOARD_ID).collection(sub).get();
    snap.forEach(d => {
      const x = d.data();
      const code = String(x.number || x.invoiceNum || x.proposalNum || x.poNum || d.id).trim().toUpperCase();
      if (!code) return;
      studioByCode.set(code, {
        sub, docId: d.id, code,
        total: safeNum(x.total),
        paidAmount: safeNum(x.paidAmount),
        invoiceBalance: safeNum(x.invoiceBalance != null ? x.invoiceBalance : x.balance),
        status: String(x.status || '').trim(),
        qbId: String(x.qbDocId || x.qbId || x.qbInvoiceId || '').trim(),
        vendor: String(x.vendor || '').trim(),
        date: String(x.date || x.createdAt || '').trim(),
        houzzImport: !!x.houzzImport,
        items_count: (x.items || []).length,
      });
    });
    console.log(`  Studio /${sub}/: ${snap.size}`);
  }

  // 3. Compare every code
  const deltas = [];
  const allCodes = new Set([...houzzByCode.keys(), ...studioByCode.keys()]);
  let inBoth = 0, houzzOnly = 0, studioOnly = 0;
  let amountMatch = 0, amountMismatch = 0, paidMatch = 0, paidDelta = 0;
  let qbMissing = 0, qbMismatch = 0, statusMismatch = 0;

  for (const code of allCodes) {
    const h = houzzByCode.get(code);
    const s = studioByCode.get(code);
    const d = { code };

    if (h && s) {
      inBoth++;
      const houzzGrand = h.amount + h.shipping;
      if (Math.abs(houzzGrand - s.total) <= 0.05) amountMatch++;
      else { amountMismatch++; d.amountDelta = round2(s.total - houzzGrand); }

      const houzzPaid = round2(houzzGrand - h.balance);
      if (Math.abs(houzzPaid - s.paidAmount) <= 0.05) paidMatch++;
      else { paidDelta++; d.paidDelta = round2(s.paidAmount - houzzPaid); d.hPaid = houzzPaid; d.sPaid = s.paidAmount; }

      if (h.qbId && !s.qbId) { qbMissing++; d.qbMissing = h.qbId; }
      else if (h.qbId && s.qbId && h.qbId !== s.qbId) { qbMismatch++; d.qbWrong = `${s.qbId}→${h.qbId}`; }

      const hs = h.status.toLowerCase(), ss = s.status.toLowerCase();
      if (hs && ss && hs !== ss && !(hs === 'closed' && ss === 'paid') && !(hs === 'paid' && ss === 'closed')) {
        statusMismatch++; d.statusDelta = `${s.status}→${h.status}`;
      }

      d.inHouzz = true; d.inStudio = true;
      d.type = h.type;
      d.hAmount = h.amount; d.hShip = h.shipping; d.hGrand = houzzGrand;
      d.sTotal = s.total; d.hStatus = h.status; d.sStatus = s.status;
      d.hQB = h.qbId; d.sQB = s.qbId; d.sVendor = s.vendor; d.hBilling = h.billing;
    } else if (h) { houzzOnly++; d.inHouzz = true; d.inStudio = false; d.type = h.type; d.hAmount = h.amount; d.hStatus = h.status; d.hQB = h.qbId; d.hBilling = h.billing; }
    else if (s) { studioOnly++; d.inHouzz = false; d.inStudio = true; d.type = s.sub; d.sTotal = s.total; d.sStatus = s.status; d.sVendor = s.vendor; }
    deltas.push(d);
  }

  // 4. Totals roll-up
  let hInvTotal = 0, hInvBal = 0, hPOTotal = 0, hPOBal = 0, hRetTotal = 0;
  for (const [, h] of houzzByCode) {
    const grand = h.amount + h.shipping;
    if (h.type === 'invoice') { hInvTotal += grand; hInvBal += h.balance; }
    else if (h.type === 'purchase order') { hPOTotal += grand; hPOBal += h.balance; }
    else if (h.type === 'retainer') { hRetTotal += grand; }
  }
  let sInvTotal = 0, sInvPaid = 0, sPOTotal = 0, sPOPaid = 0;
  for (const [, s] of studioByCode) {
    if (s.sub === 'invoices') { sInvTotal += s.total; sInvPaid += s.paidAmount; }
    else if (s.sub === 'purchaseOrders') { sPOTotal += s.total; sPOPaid += s.paidAmount; }
  }

  console.log('\n=== SUMMARY ===');
  console.log(`  In both:        ${inBoth}`);
  console.log(`  Houzz only:     ${houzzOnly} (missing from Studio)`);
  console.log(`  Studio only:    ${studioOnly} (in Studio but NOT in Houzz May 12 export — potential corruption or post-import)`);
  console.log(`  Amount matches: ${amountMatch}  mismatches: ${amountMismatch}`);
  console.log(`  Paid matches:   ${paidMatch}   deltas: ${paidDelta}`);
  console.log(`  QB ID missing:  ${qbMissing}   mismatch: ${qbMismatch}`);
  console.log(`  Status mismatch: ${statusMismatch}`);

  console.log('\n=== TOTALS RECONCILIATION ===');
  console.log(`                  Houzz                Studio              Delta`);
  console.log(`  Invoice $       $${String(round2(hInvTotal)).padEnd(18)} $${String(round2(sInvTotal)).padEnd(18)} $${round2(sInvTotal - hInvTotal)}`);
  console.log(`  Invoice paid    $${String(round2(hInvTotal - hInvBal)).padEnd(18)} $${String(round2(sInvPaid)).padEnd(18)} $${round2(sInvPaid - (hInvTotal - hInvBal))}`);
  console.log(`  PO $            $${String(round2(hPOTotal)).padEnd(18)} $${String(round2(sPOTotal)).padEnd(18)} $${round2(sPOTotal - hPOTotal)}`);
  console.log(`  PO paid         $${String(round2(hPOTotal - hPOBal)).padEnd(18)} $${String(round2(sPOPaid)).padEnd(18)} $${round2(sPOPaid - (hPOTotal - hPOBal))}`);
  console.log(`  Retainers       $${String(round2(hRetTotal)).padEnd(18)} (not in Studio by design)`);

  // 5. Studio-only docs (corruption candidates)
  const studioOnlyDocs = deltas.filter(d => !d.inHouzz);
  if (studioOnlyDocs.length) {
    console.log(`\n=== STUDIO-ONLY DOCS (${studioOnlyDocs.length}) — not in May 12 Houzz export ===`);
    for (const d of studioOnlyDocs) {
      console.log(`  ${d.code.padEnd(15)} type=${(d.type||'').padEnd(15)} total=$${d.sTotal}  status=${d.sStatus}  vendor=${d.sVendor}`);
    }
  }

  // 6. Houzz-only docs (missing from Studio)
  const houzzOnlyDocs = deltas.filter(d => !d.inStudio);
  if (houzzOnlyDocs.length) {
    console.log(`\n=== HOUZZ-ONLY DOCS (${houzzOnlyDocs.length}) — in Houzz, missing from Studio ===`);
    for (const d of houzzOnlyDocs) {
      console.log(`  ${d.code.padEnd(15)} type=${(d.type||'').padEnd(15)} amount=$${d.hAmount}  status=${d.hStatus}  qb=${d.hQB}  billing="${(d.hBilling||'').slice(0,30)}"`);
    }
  }

  // 7. Mismatches
  const issueDeltas = deltas.filter(d => d.inHouzz && d.inStudio && (d.amountDelta != null || d.paidDelta != null || d.statusDelta || d.qbMissing || d.qbWrong));
  if (issueDeltas.length) {
    console.log(`\n=== DOCS WITH MISMATCHES (${issueDeltas.length}) ===`);
    for (const d of issueDeltas) {
      const flags = [];
      if (d.amountDelta != null) flags.push(`amount:$${d.amountDelta}`);
      if (d.paidDelta != null) flags.push(`paid:$${d.paidDelta} (h=${d.hPaid} s=${d.sPaid})`);
      if (d.statusDelta) flags.push(`status:${d.statusDelta}`);
      if (d.qbMissing) flags.push(`qbMissing:${d.qbMissing}`);
      if (d.qbWrong) flags.push(`qbWrong:${d.qbWrong}`);
      console.log(`  ${d.code.padEnd(15)} type=${(d.type||'').padEnd(15)} ${flags.join('  |  ')}`);
    }
  }

  // CSV
  const csvHeader = ['code','type','inHouzz','inStudio','hAmount','hShip','hGrand','sTotal','hPaid','sPaid','paidDelta','hStatus','sStatus','hQB','sQB','sVendor','flags'];
  const csvLines = [csvHeader.join(',')];
  for (const d of deltas) {
    const flags = [];
    if (d.amountDelta != null) flags.push(`amt:$${d.amountDelta}`);
    if (d.paidDelta != null) flags.push(`paid:$${d.paidDelta}`);
    if (d.statusDelta) flags.push(`stat:${d.statusDelta}`);
    if (d.qbMissing) flags.push(`qbMiss:${d.qbMissing}`);
    if (d.qbWrong) flags.push(`qbWrong:${d.qbWrong}`);
    if (!d.inHouzz) flags.push('STUDIO-ONLY');
    if (!d.inStudio) flags.push('HOUZZ-ONLY');
    csvLines.push([d.code, d.type, d.inHouzz, d.inStudio, d.hAmount, d.hShip, d.hGrand, d.sTotal, d.hPaid, d.sPaid, d.paidDelta, d.hStatus, d.sStatus, d.hQB, d.sQB, d.sVendor, flags.join('|')].map(csvEsc).join(','));
  }
  fs.writeFileSync(OUT_CSV, csvLines.join('\n'));
  console.log(`\nDelta CSV: ${OUT_CSV}`);

  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
