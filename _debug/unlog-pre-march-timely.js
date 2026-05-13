/**
 * Delete the 272 pre-March 2026 timeEntries that came from Timely (source=timely)
 * — these were accidentally logged via "log all pending".
 *
 * KEEPS:
 *   - All houzz-import entries (pre-March, billed historical)
 *   - All March 1+ timely entries (real billable)
 *   - The 2 Feb 2026 manual (no-source) test entries Cynthia made
 *
 * Default DRY RUN. --execute to delete.
 */
const path = require('path');
const admin = require('firebase-admin');

const SERVICE_ACCOUNT = path.join(__dirname, 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
admin.initializeApp({ credential: admin.credential.cert(require(SERVICE_ACCOUNT)) });
const db = admin.firestore();
const EXECUTE = process.argv.includes('--execute');

(async () => {
  console.log(`UNLOG PRE-MARCH TIMELY ENTRIES  (${EXECUTE ? 'EXECUTE' : 'DRY RUN'})\n`);

  const snap = await db.collection('timeEntries').get();
  const toDelete = [];
  snap.forEach(d => {
    const x = d.data();
    if (x.source !== 'timely') return;
    const dt = String(x.date || x.startTime || '').slice(0, 10);
    if (!dt || dt >= '2026-03-01') return;
    toDelete.push({ ref: d.ref, id: d.id, date: dt, member: x.member, hours: x.hours, project: x.project, projectId: x.projectId, timelyId: x.timelyId });
  });
  console.log(`Found ${toDelete.length} timeEntries to delete (source=timely AND date<2026-03-01)`);

  // Verify each has a timelyEntries source doc so unlogging is reversible
  let withMatchingTimelySource = 0, withoutMatching = 0;
  const noMatchSamples = [];
  for (const t of toDelete) {
    if (!t.timelyId) { withoutMatching++; if (noMatchSamples.length < 5) noMatchSamples.push(t); continue; }
    const teDoc = await db.collection('timelyEntries').doc('timely-' + t.timelyId).get();
    if (teDoc.exists) withMatchingTimelySource++;
    else { withoutMatching++; if (noMatchSamples.length < 5) noMatchSamples.push(t); }
  }
  console.log(`  Have matching timelyEntries source (reversible): ${withMatchingTimelySource}`);
  console.log(`  No matching timelyEntries source: ${withoutMatching}`);
  if (noMatchSamples.length) {
    console.log(`  Samples without matching timelyEntries:`);
    for (const s of noMatchSamples) console.log(`    ${s.id} date=${s.date} member=${s.member} hours=${s.hours} timelyId=${s.timelyId}`);
  }

  // Tally by month for summary
  const byMonth = {};
  for (const t of toDelete) {
    const m = t.date.slice(0, 7);
    byMonth[m] = (byMonth[m] || 0) + 1;
  }
  console.log(`\nBy month:`);
  for (const m of Object.keys(byMonth).sort()) console.log(`  ${m}: ${byMonth[m]}`);

  // Tally hours
  const totalHours = toDelete.reduce((s, t) => s + (parseFloat(t.hours) || 0), 0);
  console.log(`\nTotal hours being unlogged: ${totalHours.toFixed(2)}`);

  if (!EXECUTE) {
    console.log('\nDRY RUN. Add --execute to delete.');
    process.exit(0);
  }

  console.log('\nDeleting in batches of 400...');
  for (let i = 0; i < toDelete.length; i += 400) {
    const batch = db.batch();
    const slice = toDelete.slice(i, i + 400);
    for (const t of slice) batch.delete(t.ref);
    await batch.commit();
    console.log(`  batch ${i / 400 + 1}: deleted ${slice.length} (total ${i + slice.length}/${toDelete.length})`);
  }
  console.log(`\nDONE.`);
  process.exit(0);
})().catch(e => { console.error('FAILED:', e); process.exit(1); });
