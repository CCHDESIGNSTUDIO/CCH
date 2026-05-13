/**
 * For the top mismatch POs, dump every Houzz column value so we can see
 * which one (or combination) explains the delta.
 */
const path = require('path');
const XLSX = require('xlsx');
const admin = require('firebase-admin');

const SERVICE_ACCOUNT = path.join(__dirname, 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
admin.initializeApp({ credential: admin.credential.cert(require(SERVICE_ACCOUNT)) });
const db = admin.firestore();

const HOUZZ_FILE = String.raw`C:\Users\cindy\Dropbox\Claude - CCH studio\Houzz FILES\Project Trackers\Katke - Graceland All Transactions.xlsx`;
const safeNum = (v) => { const n = parseFloat(v); return isFinite(n) ? n : 0; };

const TARGETS = ['PO-12913', 'PO-12895', 'PO-12869', 'PO-10053', 'PO-12896'];

(async () => {
  const wb = XLSX.readFile(HOUZZ_FILE);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  const header = rows[4];

  // Studio side: pull these PO totals
  const studioByCode = new Map();
  const snap = await db.collection('boards').doc('katke-graceland-dr').collection('purchaseOrders').get();
  snap.forEach(d => {
    const x = d.data();
    const code = String(x.number || x.poNum || d.id).trim().toUpperCase();
    studioByCode.set(code, x);
  });

  for (const target of TARGETS) {
    console.log(`\n=== ${target} ===`);
    let houzzRow = null;
    for (let i = 5; i < rows.length; i++) {
      const code = String(rows[i][2] || '').trim().toUpperCase();
      if (code === target) { houzzRow = rows[i]; break; }
    }
    if (!houzzRow) { console.log('  not in Houzz'); continue; }

    console.log('  Houzz columns (non-empty only):');
    houzzRow.forEach((v, i) => {
      const s = String(v == null ? '' : v).trim();
      if (s) console.log(`    [${String(i).padStart(2)}] ${header[i].padEnd(30)} = ${s.slice(0, 80)}`);
    });

    const s = studioByCode.get(target);
    if (s) {
      console.log('  Studio fields:');
      console.log(`    total            = ${s.total}`);
      console.log(`    totalCost        = ${s.totalCost || 'n/a'}`);
      console.log(`    totalSelling     = ${s.totalSelling || 'n/a'}`);
      console.log(`    subtotal         = ${s.subtotal || 'n/a'}`);
      console.log(`    shippingCost     = ${s.shippingCost || 'n/a'}`);
      console.log(`    shippingSelling  = ${s.shippingSelling || 'n/a'}`);
      console.log(`    clientTax        = ${s.clientTax || 'n/a'}`);
      console.log(`    vendorTax        = ${s.vendorTax || 'n/a'}`);
      console.log(`    transactionFee   = ${s.transactionFee || 'n/a'}`);
      console.log(`    ccFee / processingFee = ${s.ccFee || s.processingFee || 'n/a'}`);
      // dump any field with "fee" or "tax" in the name
      for (const k of Object.keys(s).filter(k => /fee|tax|charge|transaction/i.test(k))) {
        console.log(`    ${k.padEnd(25)} = ${s[k]}`);
      }
    } else {
      console.log('  Studio: not found');
    }
  }

  process.exit(0);
})().catch(e => { console.error('FAILED:', e); process.exit(1); });
