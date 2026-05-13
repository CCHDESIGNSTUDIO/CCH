/**
 * Find every Firestore doc that references the wrong "katke-graceland" slug
 * (instead of the correct "katke-graceland-dr"). Includes timeEntries,
 * timelyEntries, settings, mappings, and any other collection that might
 * carry a projectId string.
 */
const path = require('path');
const admin = require('firebase-admin');
const SA = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
admin.initializeApp({ credential: admin.credential.cert(require(SA)) });
const db = admin.firestore();

const COLLECTIONS_TO_SCAN = [
  'timeEntries', 'timelyEntries', 'desktopTimeLogs', 'timeBuckets',
  'activity', 'admin', 'feedbackRequests'
];
// Fields that commonly hold a project slug
const FIELDS = ['projectId', 'project', 'boardId', 'projectSlug'];

(async () => {
  console.log('Scanning for references to bad slug "katke-graceland"...\n');

  for (const coll of COLLECTIONS_TO_SCAN) {
    let matches = [];
    for (const field of FIELDS) {
      try {
        const snap = await db.collection(coll).where(field, '==', 'katke-graceland').get();
        snap.forEach(d => matches.push({ docId: d.id, field, data: d.data() }));
      } catch (e) { /* field may not be indexed — skip */ }
    }
    if (matches.length) {
      console.log(`${coll}: ${matches.length} doc(s) reference "katke-graceland"`);
      for (const m of matches.slice(0, 10)) {
        const d = m.data;
        console.log(`  ${m.docId}  field=${m.field}  date=${d.date || d.timestamp || d.createdAt || '?'}  member=${d.member || d.user || '?'}  hours=${d.hours || d.duration || '?'}  desc="${(d.description || d.task || d.note || '').slice(0, 50)}"`);
      }
      if (matches.length > 10) console.log(`  ... and ${matches.length - 10} more`);
    } else {
      console.log(`${coll}: clean`);
    }
  }

  // Also check settings/mappings/admin docs that might hold a project-ID lookup
  console.log('\nChecking admin docs for slug mappings...');
  const adminSnap = await db.collection('admin').get();
  for (const d of adminSnap.docs) {
    const json = JSON.stringify(d.data());
    if (json.includes('katke-graceland') && !json.includes('katke-graceland-dr')) {
      console.log(`  admin/${d.id} contains bad slug:`, json.slice(0, 200));
    }
  }

  process.exit(0);
})().catch(e => { console.error('FATAL:', e); process.exit(1); });
