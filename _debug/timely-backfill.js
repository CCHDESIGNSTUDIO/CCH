/**
 * Backfill projectId on timelyEntries based on Cynthia's resolution map.
 * Also backfill 122 invalid-projectId timeEntries from slug drift.
 * Default DRY RUN. --execute to write.
 */
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const SERVICE_ACCOUNT = path.join(__dirname, 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
admin.initializeApp({ credential: admin.credential.cert(require(SERVICE_ACCOUNT)) });
const db = admin.firestore();
const EXECUTE = process.argv.includes('--execute');

// Resolution map: Timely project name → CCH board id
// Names normalized for matching (lowercased, whitespace collapsed)
const RESOLUTION_MAP = new Map([
  ['cch', 'cch'],
  ['holtz hill', 'holtz-hill'],
  ['cloud, rolling hills', 'cloud-rolling-hills'],
  ['katke - graceland', 'katke-graceland-dr'],
  ['greene', 'greene-hixson'],
  ['shimano', 'shimano-maverick-cir'],
  ['31 whitesail', '31-whitesail'],
  ['7225 bugle trail', '7225-bugletrail'],
  ['schneider', 'schneider-east-coast-hwy'],
  ['west avalon', 'west-avalon'],
  ['polito bvr', 'polito-bvr'],
  ['valentine', 'valentine'],
  ['morning wood dr', 'morning-wood-dr'],
  ['bradbury - high', 'bradbury-high'],
  ['johnny uriostegui', 'johnny'],
  ['elu ranch', 'elu-ranch'],
  ['day - 2590 monaco drive', 'day-2590-monaco-drive'],
  ['moelke- cypress st.', 'moelke-cypress-st'],
  ['vanessa personal', 'cbh'],   // per Cynthia May 12 — tie to CBH
]);

// Timely Project name normalizer: collapse whitespace, lowercase, normalize punctuation
function norm(s) {
  return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

// Slug-drift map for the 122 invalid-projectId timeEntries
const SLUG_DRIFT_MAP = new Map([
  ['shimano', 'shimano-maverick-cir'],
  ['greene', 'greene-hixson'],
  ['7225-bugle-trail', '7225-bugletrail'],
  ['schneider', 'schneider-east-coast-hwy'],     // per Cynthia May 12
  ['vanessa-personal', 'cbh'],                   // per Cynthia May 12 — tie to CBH
  // HELD per Cynthia May 12 (project missing or unclear):
  //   hess-archipelago (6), markussen (4), heliotrope-dr (2), unassigned (2), ccc (1)
]);

(async () => {
  console.log(`TIMELY/TIMEENTRIES BACKFILL  (${EXECUTE ? 'EXECUTE' : 'DRY RUN'})\n`);

  // Validate all target board IDs exist
  const boardsSnap = await db.collection('boards').get();
  const validIds = new Set();
  boardsSnap.forEach(d => validIds.add(d.id));
  const missingTargets = [];
  for (const v of RESOLUTION_MAP.values()) if (!validIds.has(v)) missingTargets.push(v);
  for (const v of SLUG_DRIFT_MAP.values()) if (!validIds.has(v)) missingTargets.push(v);
  if (missingTargets.length) {
    console.log(`ERROR: target board IDs not in /boards/: ${missingTargets.join(', ')}`);
    process.exit(1);
  }
  console.log(`Validated: all ${RESOLUTION_MAP.size + SLUG_DRIFT_MAP.size} target board IDs exist in /boards/.\n`);

  // 1. timelyEntries — resolve by project name
  const teSnap = await db.collection('timelyEntries').get();
  console.log(`=== timelyEntries (${teSnap.size} docs) ===`);
  const teUpdates = [];
  const teCounts = { skipAlreadySet: 0, resolved: 0, unmapped: 0 };
  const teUnmappedNames = new Map();
  teSnap.forEach(d => {
    const x = d.data();
    if (x.projectId) { teCounts.skipAlreadySet++; return; }
    const name = norm(x.project || x.projectName || '');
    const target = RESOLUTION_MAP.get(name);
    if (target) {
      teCounts.resolved++;
      teUpdates.push({ ref: d.ref, projectId: target, originalName: x.project || x.projectName || '' });
    } else {
      teCounts.unmapped++;
      teUnmappedNames.set(name, (teUnmappedNames.get(name) || 0) + 1);
    }
  });
  console.log(`  Already had projectId:  ${teCounts.skipAlreadySet}`);
  console.log(`  Will resolve:           ${teCounts.resolved}`);
  console.log(`  Stays unmapped:         ${teCounts.unmapped}`);
  if (teUnmappedNames.size) {
    console.log(`  Unmapped names:`);
    for (const [n, c] of teUnmappedNames) console.log(`    ${String(c).padStart(3)}  "${n}"`);
  }

  // 2. timeEntries — fix invalid projectIds via slug drift
  const teLedgerSnap = await db.collection('timeEntries').get();
  console.log(`\n=== timeEntries (${teLedgerSnap.size} docs) ===`);
  const ledgerUpdates = [];
  const ledgerCounts = { skipValid: 0, fixed: 0, stillInvalid: 0 };
  const ledgerUnmapped = new Map();
  teLedgerSnap.forEach(d => {
    const x = d.data();
    if (!x.projectId) return;   // no projectId at all — separate issue, not in scope
    if (validIds.has(x.projectId)) { ledgerCounts.skipValid++; return; }
    const target = SLUG_DRIFT_MAP.get(x.projectId);
    if (target) {
      ledgerCounts.fixed++;
      ledgerUpdates.push({ ref: d.ref, projectId: target, originalProjectId: x.projectId });
    } else {
      ledgerCounts.stillInvalid++;
      ledgerUnmapped.set(x.projectId, (ledgerUnmapped.get(x.projectId) || 0) + 1);
    }
  });
  console.log(`  Already valid:         ${ledgerCounts.skipValid}`);
  console.log(`  Will fix (slug drift): ${ledgerCounts.fixed}`);
  console.log(`  Stays invalid:         ${ledgerCounts.stillInvalid}`);
  if (ledgerUnmapped.size) {
    console.log(`  Still invalid projectIds:`);
    for (const [n, c] of ledgerUnmapped) console.log(`    ${String(c).padStart(3)}  "${n}"`);
  }

  console.log(`\n=== TOTAL writes planned: ${teUpdates.length + ledgerUpdates.length} ===`);

  if (!EXECUTE) {
    console.log('\nDRY RUN. Add --execute to write.');
    process.exit(0);
  }

  // EXECUTE in batches of 400
  const allUpdates = [
    ...teUpdates.map(u => ({ ref: u.ref, data: { projectId: u.projectId, _projectIdBackfilledAt: new Date().toISOString(), _projectIdSourceName: u.originalName } })),
    ...ledgerUpdates.map(u => ({ ref: u.ref, data: { projectId: u.projectId, _projectIdSlugFixedAt: new Date().toISOString(), _projectIdPrevious: u.originalProjectId } })),
  ];
  console.log(`\nWriting ${allUpdates.length} updates in batches of 400...`);
  for (let i = 0; i < allUpdates.length; i += 400) {
    const batch = db.batch();
    const slice = allUpdates.slice(i, i + 400);
    for (const u of slice) batch.update(u.ref, u.data);
    await batch.commit();
    console.log(`  batch ${i / 400 + 1}: wrote ${slice.length} (total ${i + slice.length}/${allUpdates.length})`);
  }
  console.log(`\nDONE.`);
  process.exit(0);
})().catch(e => { console.error('FAILED:', e); process.exit(1); });
