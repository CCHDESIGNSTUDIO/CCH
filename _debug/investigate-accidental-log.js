/**
 * Investigate the accidental "log all pending" action.
 * Need to find: timeEntries that were created from Timely (not Houzz) and are pre-March-1.
 * Look at field shape, sources, recent createdAt timestamps.
 */
const path = require('path');
const admin = require('firebase-admin');

const SERVICE_ACCOUNT = path.join(__dirname, 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
admin.initializeApp({ credential: admin.credential.cert(require(SERVICE_ACCOUNT)) });
const db = admin.firestore();

(async () => {
  const teSnap = await db.collection('timeEntries').get();
  console.log(`Total timeEntries: ${teSnap.size}\n`);

  // Distinct source values
  const sourceCounts = {};
  const sourceByDate = {};   // source → { pre-march, post-march }
  let preMarchTotal = 0, postMarchTotal = 0;
  const sampleByCategory = { 'pre-march-houzz': [], 'pre-march-timely': [], 'pre-march-other': [], 'post-march': [] };

  // Look for fields that link back to timelyEntries
  const fieldsUsed = new Map();
  let withTimelyId = 0, withTimelyLink = 0;

  teSnap.forEach(d => {
    const x = d.data();
    const src = x.source || x._source || '(none)';
    sourceCounts[src] = (sourceCounts[src] || 0) + 1;

    const dt = String(x.date || x.startTime || '').slice(0, 10);
    const isPreMarch = dt && dt < '2026-03-01';
    if (isPreMarch) preMarchTotal++; else postMarchTotal++;

    if (!sourceByDate[src]) sourceByDate[src] = { pre: 0, post: 0 };
    if (isPreMarch) sourceByDate[src].pre++; else sourceByDate[src].post++;

    // Look for Timely linkage
    if (x.timelyId || x.timelyEntryId) withTimelyId++;
    if (x.timelyProjectId || x.timelyName) withTimelyLink++;

    for (const k of Object.keys(x)) fieldsUsed.set(k, (fieldsUsed.get(k) || 0) + 1);

    // Bucket samples
    let bucket;
    if (!isPreMarch) bucket = 'post-march';
    else if (src === 'houzz-import') bucket = 'pre-march-houzz';
    else if (/timely/i.test(src) || x.timelyId || x.timelyEntryId) bucket = 'pre-march-timely';
    else bucket = 'pre-march-other';
    if (sampleByCategory[bucket].length < 5) {
      sampleByCategory[bucket].push({
        id: d.id, date: dt, source: src, member: x.member || '', hours: x.hours || x.duration || '',
        timelyId: x.timelyId || x.timelyEntryId || '', timelyProjectId: x.timelyProjectId || '',
        projectId: x.projectId || '', createdAt: x.createdAt || x._createdAt || '',
        loggedAt: x.loggedAt || x._loggedAt || x.logToLedgerAt || '',
      });
    }
  });

  console.log('=== By source ===');
  for (const [src, n] of Object.entries(sourceCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(5)}  "${src}"  (pre-March: ${sourceByDate[src]?.pre || 0}, post-March: ${sourceByDate[src]?.post || 0})`);
  }

  console.log(`\n=== Date split ===`);
  console.log(`  Pre-March (< 2026-03-01):  ${preMarchTotal}`);
  console.log(`  March 1+ (>= 2026-03-01):  ${postMarchTotal}`);

  console.log(`\n=== Timely linkage on timeEntries ===`);
  console.log(`  with timelyId/timelyEntryId field: ${withTimelyId}`);
  console.log(`  with timelyProjectId/timelyName field: ${withTimelyLink}`);

  console.log(`\n=== Fields used (top 25) ===`);
  for (const [k, n] of [...fieldsUsed.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25)) {
    console.log(`  ${String(n).padStart(5)}  ${k}`);
  }

  console.log(`\n=== Sample: pre-March HOUZZ-import (do NOT touch) ===`);
  for (const s of sampleByCategory['pre-march-houzz']) console.log(`  ${s.id}  date=${s.date}  src=${s.source}  member=${s.member}  hours=${s.hours}  proj=${s.projectId}  timelyId=${s.timelyId}`);

  console.log(`\n=== Sample: pre-March TIMELY-sourced (the accidentally-logged ones?) ===`);
  for (const s of sampleByCategory['pre-march-timely']) console.log(`  ${s.id}  date=${s.date}  src=${s.source}  member=${s.member}  hours=${s.hours}  proj=${s.projectId}  timelyId=${s.timelyId}  logged=${s.loggedAt}`);

  console.log(`\n=== Sample: pre-March OTHER (neither Houzz nor Timely-tagged) ===`);
  for (const s of sampleByCategory['pre-march-other']) console.log(`  ${s.id}  date=${s.date}  src="${s.source}"  member=${s.member}  hours=${s.hours}  proj=${s.projectId}  timelyId=${s.timelyId}  created=${s.createdAt}`);

  console.log(`\n=== Sample: post-March (keep) ===`);
  for (const s of sampleByCategory['post-march']) console.log(`  ${s.id}  date=${s.date}  src=${s.source}  member=${s.member}  hours=${s.hours}  proj=${s.projectId}  timelyId=${s.timelyId}`);

  // Also: count timeEntries with createdAt in the last 7 days (today's accidental log?)
  console.log(`\n=== timeEntries created in last 7 days ===`);
  const cutoff = Date.now() - 7 * 24 * 3600 * 1000;
  let recent7 = 0, recent7preMarch = 0;
  const recentSamples = [];
  teSnap.forEach(d => {
    const x = d.data();
    const ca = x.createdAt || x._createdAt || '';
    if (!ca) return;
    const t = Date.parse(ca);
    if (!t || t < cutoff) return;
    recent7++;
    const dt = String(x.date || x.startTime || '').slice(0, 10);
    if (dt && dt < '2026-03-01') recent7preMarch++;
    if (recentSamples.length < 8) recentSamples.push({ id: d.id, date: dt, createdAt: ca, source: x.source, member: x.member, hours: x.hours, projectId: x.projectId });
  });
  console.log(`  created last 7 days: ${recent7}`);
  console.log(`     of which pre-March date: ${recent7preMarch}`);
  for (const s of recentSamples) console.log(`    ${s.id}  date=${s.date}  created=${s.createdAt}  src=${s.source}  member=${s.member}  hours=${s.hours}  proj=${s.projectId}`);

  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
