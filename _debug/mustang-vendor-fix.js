/**
 * Cloud Mustang PO vendor fix.
 * For each PO with a wrong vendor (client/team name), look up real vendor from
 * Houzz Project Tracker XLSX and write it back.
 *
 * Default DRY RUN. --execute to write.
 */
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const admin = require('firebase-admin');

const SERVICE_ACCOUNT = path.join(__dirname, 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
admin.initializeApp({ credential: admin.credential.cert(require(SERVICE_ACCOUNT)) });
const db = admin.firestore();

const PROJECT_TRACKER = String.raw`C:\Users\cindy\Dropbox\Claude - CCH studio\Houzz FILES\ARCHIVE\project_tracker_report-2870-04-22-2026-12-20-06-398_Cloud Mustang.xlsx`;
const BOARD_ID = 'cloud-mustang';
const OUT_CSV = path.join(__dirname, 'mustang-vendor-fix-manifest.csv');
const EXECUTE = process.argv.includes('--execute');

const NON_VENDOR_PATTERNS = [/^ron & tracey/i, /^tracey cloud/i, /^cindy holloway/i, /^cynthia holloway/i, /^vanessa holliday/i, /^cch design/i];
const isWrongVendor = (v) => v && NON_VENDOR_PATTERNS.some(re => re.test(String(v).trim()));

(async () => {
  console.log(`MUSTANG VENDOR FIX  (${EXECUTE ? 'EXECUTE' : 'DRY RUN'})\n`);

  // 1. Build vendor lookup from Project Tracker
  const wb = XLSX.readFile(PROJECT_TRACKER);
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' });
  const h = rows[0];
  const cPO = h.findIndex(c => /purchase\s*order/i.test(String(c || '')));
  const cVendor = h.findIndex(c => /^vendor$/i.test(String(c || '')));

  const vendorByPO = new Map();
  for (let i = 1; i < rows.length; i++) {
    const po = String(rows[i][cPO] || '').toUpperCase().match(/PO-\d+/);
    const v = String(rows[i][cVendor] || '').trim();
    if (po && v) {
      const code = po[0];
      const existing = vendorByPO.get(code);
      if (!existing) vendorByPO.set(code, new Set([v]));
      else existing.add(v);
    }
  }
  console.log(`Project Tracker: vendor data found for ${vendorByPO.size} POs`);

  // 2. Find Studio POs with wrong vendors
  const snap = await db.collection('boards').doc(BOARD_ID).collection('purchaseOrders').get();
  const targets = [];
  snap.forEach(d => {
    const x = d.data();
    const code = String(x.number || x.poNum || d.id).trim().toUpperCase();
    if (!isWrongVendor(x.vendor)) return;
    const vendorSet = vendorByPO.get(code);
    if (!vendorSet || vendorSet.size === 0) {
      targets.push({ docId: d.id, code, currentVendor: x.vendor, newVendor: null, status: 'no-houzz-match' });
      return;
    }
    if (vendorSet.size > 1) {
      targets.push({ docId: d.id, code, currentVendor: x.vendor, newVendor: [...vendorSet].join(' | '), status: 'multiple-vendors-in-tracker', vendorSet: [...vendorSet] });
      return;
    }
    targets.push({ docId: d.id, code, currentVendor: x.vendor, newVendor: [...vendorSet][0], status: 'fix' });
  });

  console.log(`\nMustang POs with wrong vendor: ${targets.length}`);
  const willFix = targets.filter(t => t.status === 'fix');
  console.log(`  Will fix:           ${willFix.length}`);
  console.log(`  Multi-vendor flag:  ${targets.filter(t => t.status === 'multiple-vendors-in-tracker').length}`);
  console.log(`  No Houzz match:     ${targets.filter(t => t.status === 'no-houzz-match').length}`);

  console.log('\n--- Plan ---');
  for (const t of targets) {
    const tag = t.status === 'fix' ? '+ FIX' : t.status === 'multiple-vendors-in-tracker' ? '⚠ MULTI' : '· no-match';
    console.log(`  ${tag.padEnd(10)} ${t.code.padEnd(12)} "${t.currentVendor}" → "${t.newVendor || '(none found)'}"`);
  }

  // CSV
  const csvLines = ['code,docId,currentVendor,newVendor,status'];
  for (const t of targets) csvLines.push([t.code, t.docId, `"${t.currentVendor}"`, `"${t.newVendor || ''}"`, t.status].join(','));
  fs.writeFileSync(OUT_CSV, csvLines.join('\n'));
  console.log(`\nManifest: ${OUT_CSV}`);

  if (!EXECUTE) { console.log('\nDRY RUN. --execute to write.'); process.exit(0); }

  console.log('\nWRITING...');
  const batch = db.batch();
  let writes = 0;
  for (const t of willFix) {
    const ref = db.collection('boards').doc(BOARD_ID).collection('purchaseOrders').doc(t.docId);
    batch.update(ref, {
      vendor: t.newVendor,
      _vendorFixedFromHouzzAt: new Date().toISOString(),
      _vendorPreviousValue: t.currentVendor,
    });
    writes++;
  }
  await batch.commit();
  console.log(`\nDONE.  Wrote ${writes} vendor fixes.`);
  process.exit(0);
})().catch(e => { console.error('FAILED:', e); process.exit(1); });
