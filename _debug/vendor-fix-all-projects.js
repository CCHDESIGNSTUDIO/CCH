/**
 * Vendor field fix — sweep across all projects with a Houzz Project Tracker.
 * Default DRY RUN. --execute to write.
 *
 * For each (projectId, trackerFile):
 *   1. Detect Studio POs with non-vendor in vendor field (client name / team member)
 *   2. Look up real vendor from Houzz Project Tracker
 *   3. Write `vendor` field with backup as `_vendorPreviousValue`
 */
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const admin = require('firebase-admin');

const SERVICE_ACCOUNT = path.join(__dirname, 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
admin.initializeApp({ credential: admin.credential.cert(require(SERVICE_ACCOUNT)) });
const db = admin.firestore();

const EXECUTE = process.argv.includes('--execute');
const ONLY = process.argv.find(a => a.startsWith('--only='))?.split('=')[1];   // optional: only this project

const ARCHIVE = String.raw`C:\Users\cindy\Dropbox\Claude - CCH studio\Houzz FILES\ARCHIVE`;

// Project ID → Project Tracker file mapping (newer Apr 22 trackers preferred)
const PROJECTS = [
  { id: 'cloud-rolling-hills',   tracker: 'project_tracker_report-2870-04-22-2026-12-22-11-342 Cloud RH.xlsx' },
  { id: 'cloud-mustang',          tracker: 'project_tracker_report-2870-04-22-2026-12-20-06-398_Cloud Mustang.xlsx' },  // already fixed; idempotent re-check
  { id: 'cloud-parker',           tracker: 'project_tracker_report-02-23-2026-20-00Parker.xlsx' },
  { id: 'cloud-huntington-beach', tracker: 'project_tracker_report-02-23-2026-20-11 Cloud HB.xlsx' },
  { id: 'katke-graceland-dr',     tracker: 'project_tracker_report-02-23-2026-19-27 Katke.xlsx' },
  { id: 'katke-puerto-vallarta',  tracker: 'project_tracker_report-02-23-2026-20-08 katke pv.xlsx' },
  { id: 'bradbury-high-drive',    tracker: 'project_tracker_report-02-23-2026-19-39 bradbury high drive.xlsx' },
];

// Internal team members — never a real vendor
const TEAM_MEMBERS = [
  /^cindy holloway/i, /^cynthia holloway/i, /^cindy$/i, /^cynthia$/i,
  /^vanessa holliday/i, /^vanessa$/i,
  /^carol gonzalez/i,
];

async function fixProject(projectId, trackerPath) {
  console.log(`\n=== ${projectId} ===`);

  // Verify project exists + get client name (so we can detect "client as vendor")
  const boardDoc = await db.collection('boards').doc(projectId).get();
  if (!boardDoc.exists) { console.log(`  SKIP: project not found`); return null; }
  const board = boardDoc.data();
  const clientNames = [board.clientName, board.client].filter(Boolean).map(s => String(s).trim()).filter(Boolean);
  console.log(`  Project: "${board.name}"  Client: "${clientNames.join(' | ')}"`);

  // Build non-vendor pattern: team members + client names + variants
  const nonVendorPatterns = [...TEAM_MEMBERS];
  for (const cn of clientNames) {
    // Add direct match + first-name-only variants
    nonVendorPatterns.push(new RegExp(`^${cn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'));
    nonVendorPatterns.push(new RegExp(`^${cn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'));   // starts with
  }
  // Also catch "Cindy Holloway - X" style
  nonVendorPatterns.push(/^cindy holloway\s*-/i);
  nonVendorPatterns.push(/^cynthia holloway\s*-/i);

  // Load tracker
  if (!fs.existsSync(trackerPath)) { console.log(`  SKIP: tracker file missing: ${trackerPath}`); return null; }
  const wb = XLSX.readFile(trackerPath);
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' });
  const h = rows[0];
  const cPO = h.findIndex(c => /purchase\s*order/i.test(String(c || '')));
  const cVendor = h.findIndex(c => /^vendor$/i.test(String(c || '')));
  if (cPO < 0 || cVendor < 0) { console.log(`  SKIP: tracker missing PO/Vendor columns`); return null; }

  const vendorByPO = new Map();
  for (let i = 1; i < rows.length; i++) {
    const m = String(rows[i][cPO] || '').toUpperCase().match(/PO-\d+/);
    const v = String(rows[i][cVendor] || '').trim();
    if (m && v) {
      const set = vendorByPO.get(m[0]) || new Set();
      set.add(v);
      vendorByPO.set(m[0], set);
    }
  }

  // Walk Studio POs
  const isWrong = (v) => v && nonVendorPatterns.some(re => re.test(String(v).trim()));
  const snap = await db.collection('boards').doc(projectId).collection('purchaseOrders').get();
  const targets = [];
  snap.forEach(d => {
    const x = d.data();
    if (!isWrong(x.vendor)) return;
    const code = String(x.number || x.poNum || d.id).trim().toUpperCase();
    const set = vendorByPO.get(code);
    if (!set || set.size === 0) targets.push({ docId: d.id, code, currentVendor: x.vendor, status: 'no-houzz-match' });
    else if (set.size > 1) targets.push({ docId: d.id, code, currentVendor: x.vendor, newVendor: [...set].join(' | '), status: 'multi' });
    else targets.push({ docId: d.id, code, currentVendor: x.vendor, newVendor: [...set][0], status: 'fix' });
  });

  const fixCount = targets.filter(t => t.status === 'fix').length;
  console.log(`  POs total: ${snap.size}  wrong-vendor: ${targets.length}  will-fix: ${fixCount}  multi: ${targets.filter(t => t.status === 'multi').length}  no-match: ${targets.filter(t => t.status === 'no-houzz-match').length}`);

  if (targets.length > 0) {
    console.log(`  Sample fixes (first 5):`);
    for (const t of targets.slice(0, 5)) {
      console.log(`    ${t.code.padEnd(12)} "${t.currentVendor}" → "${t.newVendor || '(no match)'}"  [${t.status}]`);
    }
    if (targets.length > 5) console.log(`    ...and ${targets.length - 5} more`);
  }

  if (EXECUTE && fixCount > 0) {
    const batch = db.batch();
    for (const t of targets) {
      if (t.status !== 'fix') continue;
      const ref = db.collection('boards').doc(projectId).collection('purchaseOrders').doc(t.docId);
      batch.update(ref, {
        vendor: t.newVendor,
        _vendorFixedFromHouzzAt: new Date().toISOString(),
        _vendorPreviousValue: t.currentVendor,
      });
    }
    await batch.commit();
    console.log(`  WROTE ${fixCount} fixes.`);
  }

  return { projectId, totalPOs: snap.size, targets };
}

(async () => {
  console.log(`VENDOR FIX SWEEP  (${EXECUTE ? 'EXECUTE' : 'DRY RUN'})\n`);

  const results = [];
  for (const p of PROJECTS) {
    if (ONLY && p.id !== ONLY) continue;
    const trackerPath = path.join(ARCHIVE, p.tracker);
    const r = await fixProject(p.id, trackerPath);
    if (r) results.push(r);
  }

  console.log(`\n=== SUMMARY ===`);
  let totalWrong = 0, totalFix = 0, totalMulti = 0, totalNoMatch = 0;
  for (const r of results) {
    const fixes = r.targets.filter(t => t.status === 'fix').length;
    const multi = r.targets.filter(t => t.status === 'multi').length;
    const noMatch = r.targets.filter(t => t.status === 'no-houzz-match').length;
    totalWrong += r.targets.length;
    totalFix += fixes;
    totalMulti += multi;
    totalNoMatch += noMatch;
    console.log(`  ${r.projectId.padEnd(28)} total=${String(r.totalPOs).padStart(4)}  wrong=${String(r.targets.length).padStart(3)}  fix=${String(fixes).padStart(3)}  multi=${String(multi).padStart(2)}  no-match=${String(noMatch).padStart(2)}`);
  }
  console.log(`  ${'TOTAL'.padEnd(28)}              wrong=${String(totalWrong).padStart(3)}  fix=${String(totalFix).padStart(3)}  multi=${String(totalMulti).padStart(2)}  no-match=${String(totalNoMatch).padStart(2)}`);

  if (!EXECUTE) console.log(`\nDRY RUN. --execute to write across all projects, or --execute --only=<projectId> for one.`);
  process.exit(0);
})().catch(e => { console.error('FAILED:', e); process.exit(1); });
