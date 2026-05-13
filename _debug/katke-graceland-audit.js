/**
 * Audit Katke - Graceland Dr against Houzz "All Transactions" export.
 * Read-only — produces delta report, no writes.
 *
 * Source files:
 *   - Houzz: C:\Users\cindy\Dropbox\Claude - CCH studio\Houzz FILES\Project Trackers\Katke - Graceland All Transactions.xlsx
 *   - Studio: boards/katke-graceland-dr (invoices, purchaseOrders, proposals)
 */
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const admin = require('firebase-admin');

const SERVICE_ACCOUNT = path.join(__dirname, 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
admin.initializeApp({ credential: admin.credential.cert(require(SERVICE_ACCOUNT)) });
const db = admin.firestore();

const HOUZZ_FILE = String.raw`C:\Users\cindy\Dropbox\Claude - CCH studio\Houzz FILES\Project Trackers\Katke - Graceland All Transactions.xlsx`;
const BOARD_ID = 'katke-graceland-dr';
const OUT_CSV = path.join(__dirname, 'katke-graceland-delta.csv');

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
        cAmount = col('Amount'), cMarkup = col('Markup'), cStatus = col('Status'),
        cPay = col('Payments'), cBal = col('Balance'), cQB = col('Quickbooks Doc id'),
        cTags = col('Document Tags'), cMemo = col('Memo/Description'), cDate = col('Doc Date'),
        cConn = col('Connected Docs');

  const houzzByCode = new Map();
  for (let i = HEADER_ROW + 1; i < rows.length; i++) {
    const r = rows[i];
    const code = String(r[cCode] || '').trim().toUpperCase();
    if (!code) continue;
    const type = String(r[cType] || '').trim().toLowerCase();
    houzzByCode.set(code, {
      code, type,
      amount: safeNum(r[cAmount]),
      markup: safeNum(r[cMarkup]),
      status: String(r[cStatus] || '').trim(),
      payments: safeNum(r[cPay]),
      balance: safeNum(r[cBal]),
      qbId: String(r[cQB] || '').trim(),
      tags: String(r[cTags] || '').trim(),
      memo: String(r[cMemo] || '').trim(),
      date: String(r[cDate] || '').trim(),
      connected: String(r[cConn] || '').trim(),
    });
  }
  console.log(`Houzz transactions parsed: ${houzzByCode.size}`);

  // Tally by transaction type
  const tally = {};
  for (const [, h] of houzzByCode) {
    tally[h.type] = (tally[h.type] || 0) + 1;
  }
  console.log('Houzz by type:', tally);

  // 2. Pull Studio docs
  console.log(`\nLoading Studio data for ${BOARD_ID}...`);
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
        qbId: String(x.qbId || x.qbInvoiceId || '').trim(),
        date: String(x.date || x.createdAt || '').trim(),
        raw: x,
      });
    });
    console.log(`  ${sub}: ${snap.size}`);
  }
  console.log(`  total Studio docs: ${studioByCode.size}`);

  // 3. Compare
  console.log('\n--- DELTA REPORT ---');
  const deltas = [];
  const allCodes = new Set([...houzzByCode.keys(), ...studioByCode.keys()]);

  let inBoth = 0, houzzOnly = 0, studioOnly = 0;
  let amountMismatch = 0, statusMismatch = 0, qbIdMismatch = 0, paidMismatch = 0;

  for (const code of allCodes) {
    const h = houzzByCode.get(code);
    const s = studioByCode.get(code);
    const delta = { code, type: (h && h.type) || (s && s.sub) || '?',
                    inHouzz: !!h, inStudio: !!s,
                    hAmount: h ? h.amount : '', sAmount: s ? s.total : '',
                    hStatus: h ? h.status : '', sStatus: s ? s.status : '',
                    hPaid: h ? h.payments : '', sPaid: s ? s.paidAmount : '',
                    hBalance: h ? h.balance : '', sBalance: s ? s.invoiceBalance : '',
                    hQB: h ? h.qbId : '', sQB: s ? s.qbId : '',
                    issues: [] };

    if (h && s) {
      inBoth++;
      if (Math.abs(h.amount - s.total) > 0.01) { delta.issues.push(`amount-delta:$${round2(s.total - h.amount)}`); amountMismatch++; }
      if (h.status && s.status && h.status.toLowerCase() !== s.status.toLowerCase()) {
        // tolerate "Paid" vs "Closed" or other equivalences? for now flag
        delta.issues.push(`status:${s.status}→${h.status}`); statusMismatch++;
      }
      if (h.qbId && s.qbId && h.qbId !== s.qbId) { delta.issues.push(`qbId:${s.qbId}→${h.qbId}`); qbIdMismatch++; }
      if (h.qbId && !s.qbId) { delta.issues.push(`qbId-missing-in-studio:${h.qbId}`); qbIdMismatch++; }
      if (Math.abs(h.payments - s.paidAmount) > 0.01) { delta.issues.push(`paid-delta:$${round2(s.paidAmount - h.payments)}`); paidMismatch++; }
    } else if (h) {
      houzzOnly++;
      delta.issues.push('MISSING-IN-STUDIO');
    } else if (s) {
      studioOnly++;
      delta.issues.push('NOT-IN-HOUZZ');
    }
    deltas.push(delta);
  }

  console.log(`  In both:        ${inBoth}`);
  console.log(`  Houzz only:     ${houzzOnly} (missing from Studio)`);
  console.log(`  Studio only:    ${studioOnly} (in Studio but not in Houzz — may be corruption)`);
  console.log(`  Amount mismatches:   ${amountMismatch}`);
  console.log(`  Status mismatches:   ${statusMismatch}`);
  console.log(`  qbId issues:         ${qbIdMismatch}`);
  console.log(`  Paid amount mismatches: ${paidMismatch}`);

  console.log('\n--- Top 20 Studio-only entries (likely corruption / orphans) ---');
  for (const d of deltas.filter(d => !d.inHouzz).slice(0, 20)) {
    console.log(`  ${d.code.padEnd(15)} type=${(d.type||'').padEnd(15)} sAmount=$${d.sAmount} sStatus=${d.sStatus} sQB=${d.sQB}`);
  }

  console.log('\n--- Top 20 Houzz-only entries (missing from Studio) ---');
  for (const d of deltas.filter(d => !d.inStudio).slice(0, 20)) {
    console.log(`  ${d.code.padEnd(15)} type=${d.type.padEnd(15)} hAmount=$${d.hAmount} hStatus=${d.hStatus} hQB=${d.hQB}`);
  }

  console.log('\n--- Top 20 amount mismatches ---');
  const amts = deltas.filter(d => d.issues.some(i => i.startsWith('amount-delta'))).sort((a, b) => Math.abs(b.sAmount - b.hAmount) - Math.abs(a.sAmount - a.hAmount)).slice(0, 20);
  for (const d of amts) {
    console.log(`  ${d.code.padEnd(15)} hAmount=$${d.hAmount}  sAmount=$${d.sAmount}  delta=$${round2(d.sAmount - d.hAmount)}`);
  }

  // Roll-up totals
  let hInvTotal = 0, hInvPaid = 0, hPOTotal = 0, hPOPaid = 0;
  for (const [, h] of houzzByCode) {
    if (h.type === 'invoice') { hInvTotal += h.amount; hInvPaid += h.payments; }
    else if (h.type === 'purchase order' || h.type === 'po') { hPOTotal += h.amount; hPOPaid += h.payments; }
  }
  let sInvTotal = 0, sInvPaid = 0, sPOTotal = 0, sPOPaid = 0;
  for (const [, s] of studioByCode) {
    if (s.sub === 'invoices') { sInvTotal += s.total; sInvPaid += s.paidAmount; }
    else if (s.sub === 'purchaseOrders') { sPOTotal += s.total; sPOPaid += s.paidAmount; }
  }
  console.log('\n--- TOTALS RECONCILIATION ---');
  console.log(`               Houzz             Studio            Delta`);
  console.log(`  Invoice $:   ${String('$' + round2(hInvTotal)).padEnd(18)} ${String('$' + round2(sInvTotal)).padEnd(18)} $${round2(sInvTotal - hInvTotal)}`);
  console.log(`  Invoice Paid:${String('$' + round2(hInvPaid)).padEnd(18)} ${String('$' + round2(sInvPaid)).padEnd(18)} $${round2(sInvPaid - hInvPaid)}`);
  console.log(`  PO $:        ${String('$' + round2(hPOTotal)).padEnd(18)} ${String('$' + round2(sPOTotal)).padEnd(18)} $${round2(sPOTotal - hPOTotal)}`);
  console.log(`  PO Paid:     ${String('$' + round2(hPOPaid)).padEnd(18)} ${String('$' + round2(sPOPaid)).padEnd(18)} $${round2(sPOPaid - hPOPaid)}`);

  // CSV
  const csvHeader = ['code','type','inHouzz','inStudio','hAmount','sAmount','hStatus','sStatus','hPaid','sPaid','hBalance','sBalance','hQB','sQB','issues'];
  const csvLines = [csvHeader.join(',')];
  for (const d of deltas) {
    csvLines.push([d.code, d.type, d.inHouzz, d.inStudio, d.hAmount, d.sAmount, d.hStatus, d.sStatus, d.hPaid, d.sPaid, d.hBalance, d.sBalance, d.hQB, d.sQB, d.issues.join('|')].map(csvEsc).join(','));
  }
  fs.writeFileSync(OUT_CSV, csvLines.join('\n'));
  console.log(`\nDelta manifest: ${OUT_CSV}`);

  process.exit(0);
})().catch(e => { console.error('FAILED:', e); process.exit(1); });
