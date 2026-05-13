const path = require('path');
const admin = require('firebase-admin');
const SA = path.join(__dirname, 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
admin.initializeApp({ credential: admin.credential.cert(require(SA)) });
const db = admin.firestore();
(async () => {
  const STUCK = ['hess-archipelago', 'markussen', 'heliotrope-dr', 'unassigned', 'ccc'];
  for (const slug of STUCK) {
    const snap = await db.collection('timeEntries').where('projectId', '==', slug).get();
    if (!snap.size) { console.log(`\n${slug}: 0 entries`); continue; }
    console.log(`\n${slug}: ${snap.size} entries`);
    let minDate = null, maxDate = null;
    snap.forEach(d => {
      const x = d.data();
      const dt = String(x.date || x.startTime || '').slice(0, 10);
      if (!dt) return;
      if (!minDate || dt < minDate) minDate = dt;
      if (!maxDate || dt > maxDate) maxDate = dt;
    });
    console.log(`  date range: ${minDate} → ${maxDate}`);
    let n = 0;
    snap.forEach(d => {
      if (n++ < 3) {
        const x = d.data();
        console.log(`  sample: date=${x.date || ''}  hours=${x.hours || ''}  member=${x.member || ''}  source=${x.source || x._source || ''}`);
      }
    });
  }
  process.exit(0);
})();
