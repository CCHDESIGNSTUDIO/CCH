/**
 * Cloud Mustang audit against Houzz "All Transactions" XLSX.
 * Read-only. Uses field-name corrections learned from Katke audit:
 *   - QB ID is in qbDocId (not qbId)
 *   - Studio total = Houzz Amount + Shipping
 *   - Derive Houzz paid from (Amount + Shipping - Balance)
 *   - Specifically check vendor field corruption
 */
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const admin = require('firebase-admin');

const SERVICE_ACCOUNT = path.join(__dirname, 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
admin.initializeApp({ credential: admin.credential.cert(require(SERVICE_ACCOUNT)) });
const db = admin.firestore();

const HOUZZ_FILE = String.raw`C:\Users\cindy\Dropbox\Claude - CCH studio\Houzz FILES\Project Trackers\Cloud Mustang All transactions.xlsx`;
const BOARD_ID = 'cloud-mustang';
const OUT_CSV = path.join(__dirname, 'mustang-delta.csv');

const safeNum = (v) => { const n = parseFloat(v); return isFinite(n) ? n : 0; };
const round2 = (n) => Math.round(n * 100) / 100;
const csvEsc = (v) => { if (v == null) return ''; const s = String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };

(async () => {
  // 1. Parse Houzz XLSX
  const wb = XLSX.readFile(HOUZZ_FILE);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  const HEADER_ROW = 4;
  const header = rows[HEADER_ROW];
  const col = (name) => header.findIndex(c => String(c || '').toLowerCase().trim() === name.toLowerCase());
  const cCode = col('Code'), cType = col('Transaction Type'),
        cAmount = col('Amount'), cShip = col('Shipping'), cTax = col('Tax Amount'), cStatus = col('Status'),
        cBal = col('Balance'), cQB = col('Quickbooks Doc id'),
        cTags = col('Document Tags'), cMemo = col('Memo/Description'), cDate = col('Doc Date'),
        cConn = col('Connected Docs'), cBilling = col('Billing Address');

  // For Houzz POs, the "Billing Address" col holds the recipient (CCH or vendor).
  // The actual VENDOR'S COMPANY isn't in this report — it's the vendor that issued the PO.
  // We have to derive it from connected docs / billing address heuristic OR we accept that
  // this XLSX doesn't tell us the canonical vendor and we need a different report.

  const houzzByCode = new Map();
  for (let i = HEADER_ROW + 1; i < rows.length; i++) {
    const r = rows[i];
    const code = String(r[cCode] || '').trim().toUpperCase();
    if (!code) continue;
    houzzByCode.set(code, {
      code,
      type: String(r[cType] || '').trim().toLowerCase(),
      amount: safeNum(r[cAmount]),
      shipping: safeNum(r[cShip]),
      tax: safeNum(r[cTax]),
      status: String(r[cStatus] || '').trim(),
      balance: safeNum(r[cBal]),
      qbId: String(r[cQB] || '').trim(),
      tags: String(r[cTags] || '').trim(),
      memo: String(r[cMemo] || '').trim(),
      date: String(r[cDate] || '').trim(),
      connected: String(r[cConn] || '').trim(),
      billingAddress: String(r[cBilling] || '').trim(),
    });
  }
  console.log(`Houzz transactions parsed: ${houzzByCode.size}`);

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
      });
    });
  }
  console.log(`\nStudio docs: ${studioByCode.size}`);

  // 3. Compare
  const deltas = [];
  const allCodes = new Set([...houzzByCode.keys(), ...studioByCode.keys()]);

  let inBoth = 0, houzzOnly = 0, studioOnly = 0;
  let amountMatchesShipping = 0, amountMismatch = 0;
  let qbIdMissing = 0, qbIdMismatch = 0;
  let statusMismatch = 0;
  let paidDelta = 0, paidMatch = 0;

  for (const code of allCodes) {
    const h = houzzByCode.get(code);
    const s = studioByCode.get(code);
    const delta = { code };

    if (h && s) {
      inBoth++;
      // Amount: Studio total should equal Houzz Amount + Shipping
      const houzzGrand = h.amount + h.shipping;
      if (Math.abs(houzzGrand - s.total) <= 0.05) amountMatchesShipping++;
      else { amountMismatch++; delta.amountDelta = round2(s.total - houzzGrand); }

      // QB ID
      if (h.qbId && !s.qbId) { qbIdMissing++; delta.qbMissing = h.qbId; }
      else if (h.qbId && s.qbId && h.qbId !== s.qbId) { qbIdMismatch++; delta.qbWrong = `${s.qbId} → ${h.qbId}`; }

      // Status (loose match — treat Paid/Closed/Sent as different)
      const hs = h.status.toLowerCase(), ss = s.status.toLowerCase();
      if (hs && ss && hs !== ss && !(hs === 'closed' && ss === 'paid') && !(hs === 'paid' && ss === 'closed')) {
        statusMismatch++; delta.statusDelta = `${s.status} → ${h.status}`;
      }

      // Paid: derive Houzz paid from grandTotal - balance
      const houzzPaid = round2(houzzGrand - h.balance);
      if (Math.abs(houzzPaid - s.paidAmount) <= 0.05) paidMatch++;
      else { paidDelta++; delta.paidDelta = round2(s.paidAmount - houzzPaid); }

      delta.inHouzz = true; delta.inStudio = true;
      delta.hAmount = h.amount; delta.hShip = h.shipping; delta.hGrand = houzzGrand;
      delta.sTotal = s.total;
      delta.hPaid = houzzPaid; delta.sPaid = s.paidAmount;
      delta.hStatus = h.status; delta.sStatus = s.status;
      delta.hQB = h.qbId; delta.sQB = s.qbId;
      delta.sVendor = s.vendor;
    } else if (h) { houzzOnly++; delta.inHouzz = true; delta.inStudio = false; delta.hAmount = h.amount; delta.hStatus = h.status; }
    else if (s) { studioOnly++; delta.inHouzz = false; delta.inStudio = true; delta.sTotal = s.total; delta.sVendor = s.vendor; delta.sStatus = s.status; }
    deltas.push(delta);
  }

  // 4. Vendor field audit
  const NON_VENDOR_PATTERNS = [/^ron & tracey/i, /^tracey cloud/i, /^cindy holloway/i, /^cynthia holloway/i, /^vanessa holliday/i, /^cch design/i];
  let wrongVendorCount = 0;
  const wrongVendorsList = [];
  for (const [, s] of studioByCode) {
    if (s.sub !== 'purchaseOrders') continue;
    if (!s.vendor) continue;
    if (NON_VENDOR_PATTERNS.some(re => re.test(s.vendor))) {
      wrongVendorCount++;
      wrongVendorsList.push({ code: s.code, vendor: s.vendor });
    }
  }

  console.log('\n=== SUMMARY ===');
  console.log(`  In both:            ${inBoth}`);
  console.log(`  Houzz only:         ${houzzOnly}`);
  console.log(`  Studio only:        ${studioOnly}`);
  console.log(`  Amount matches (Studio = Houzz Amount + Shipping): ${amountMatchesShipping}`);
  console.log(`  Amount real-mismatch (after shipping): ${amountMismatch}`);
  console.log(`  QB ID present + matches:  ${inBoth - qbIdMissing - qbIdMismatch}`);
  console.log(`  QB ID missing in Studio:  ${qbIdMissing}`);
  console.log(`  QB ID mismatch:           ${qbIdMismatch}`);
  console.log(`  Status mismatch:    ${statusMismatch}`);
  console.log(`  Paid amount matches: ${paidMatch}`);
  console.log(`  Paid amount delta:   ${paidDelta}`);
  console.log(`  PO Vendors that are CLIENT/TEAM names: ${wrongVendorCount}`);

  // Roll-up
  let hInvTotal = 0, hInvShip = 0, hInvBal = 0, hPOTotal = 0, hPOShip = 0, hPOBal = 0, hRetTotal = 0;
  for (const [, h] of houzzByCode) {
    if (h.type === 'invoice') { hInvTotal += h.amount; hInvShip += h.shipping; hInvBal += h.balance; }
    else if (h.type === 'purchase order') { hPOTotal += h.amount; hPOShip += h.shipping; hPOBal += h.balance; }
    else if (h.type === 'retainer') { hRetTotal += h.amount; }
  }
  let sInvTotal = 0, sInvPaid = 0, sPOTotal = 0, sPOPaid = 0;
  for (const [, s] of studioByCode) {
    if (s.sub === 'invoices') { sInvTotal += s.total; sInvPaid += s.paidAmount; }
    else if (s.sub === 'purchaseOrders') { sPOTotal += s.total; sPOPaid += s.paidAmount; }
  }
  console.log('\n=== TOTALS RECONCILIATION ===');
  console.log(`  Houzz Inv subtotal+ship: $${round2(hInvTotal + hInvShip)}  | Studio Inv total: $${round2(sInvTotal)}  | delta: $${round2(sInvTotal - hInvTotal - hInvShip)}`);
  console.log(`  Houzz Inv paid (grand-balance): $${round2(hInvTotal + hInvShip - hInvBal)}  | Studio Inv paid: $${round2(sInvPaid)}  | delta: $${round2(sInvPaid - (hInvTotal + hInvShip - hInvBal))}`);
  console.log(`  Houzz PO subtotal+ship: $${round2(hPOTotal + hPOShip)}  | Studio PO total: $${round2(sPOTotal)}  | delta: $${round2(sPOTotal - hPOTotal - hPOShip)}`);
  console.log(`  Houzz PO paid (grand-balance): $${round2(hPOTotal + hPOShip - hPOBal)}  | Studio PO paid: $${round2(sPOPaid)}  | delta: $${round2(sPOPaid - (hPOTotal + hPOShip - hPOBal))}`);
  console.log(`  Houzz Retainers total (not in Studio by design): $${round2(hRetTotal)}`);

  // List wrong vendor POs
  if (wrongVendorsList.length) {
    console.log(`\n--- POs with wrong vendor (CLIENT/TEAM in vendor field) — full list ---`);
    for (const w of wrongVendorsList) console.log(`  ${w.code.padEnd(12)} vendor="${w.vendor}"`);
  }

  // Show Studio-only docs (likely orphans/corruption)
  if (studioOnly > 0) {
    console.log(`\n--- Studio-only docs (not in Houzz, possibly corrupt) ---`);
    for (const d of deltas.filter(d => !d.inHouzz && d.inStudio)) {
      console.log(`  ${d.code.padEnd(20)} sTotal=$${d.sTotal} sStatus=${d.sStatus} sVendor=${d.sVendor}`);
    }
  }

  // CSV
  const csvHeader = ['code','inHouzz','inStudio','hAmount','hShip','hGrand','sTotal','hPaid','sPaid','paidDelta','hStatus','sStatus','hQB','sQB','sVendor','flags'];
  const csvLines = [csvHeader.join(',')];
  for (const d of deltas) {
    const flags = [];
    if (d.amountDelta != null) flags.push(`amountDelta:$${d.amountDelta}`);
    if (d.qbMissing) flags.push(`qbMissing:${d.qbMissing}`);
    if (d.qbWrong) flags.push(`qbWrong:${d.qbWrong}`);
    if (d.statusDelta) flags.push(`status:${d.statusDelta}`);
    if (d.paidDelta != null) flags.push(`paidDelta:$${d.paidDelta}`);
    if (!d.inHouzz) flags.push('STUDIO-ONLY');
    if (!d.inStudio) flags.push('HOUZZ-ONLY');
    csvLines.push([d.code, d.inHouzz, d.inStudio, d.hAmount, d.hShip, d.hGrand, d.sTotal, d.hPaid, d.sPaid, d.paidDelta, d.hStatus, d.sStatus, d.hQB, d.sQB, d.sVendor, flags.join('|')].map(csvEsc).join(','));
  }
  fs.writeFileSync(OUT_CSV, csvLines.join('\n'));
  console.log(`\nDelta CSV: ${OUT_CSV}`);

  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
