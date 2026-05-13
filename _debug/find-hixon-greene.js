const path = require('path');
const admin = require('firebase-admin');
const SA = path.join(__dirname, 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
admin.initializeApp({ credential: admin.credential.cert(require(SA)) });
const db = admin.firestore();
(async () => {
  const snap = await db.collection('boards').get();
  const matches = [];
  snap.forEach(d => {
    const x = d.data();
    const fs = [x.name, x.clientName, x.client, d.id].filter(Boolean).map(v => String(v).toLowerCase());
    if (fs.some(v => v.includes('hixon') || v.includes('greene'))) {
      matches.push({ id: d.id, name: x.name || '', client: x.clientName || x.client || '', archived: !!x.archived });
    }
  });
  console.log(`Matches: ${matches.length}`);
  for (const x of matches) console.log(`  id=${x.id.padEnd(30)}  name="${x.name}"  client="${x.client}"  archived=${x.archived}`);

  // Also check timeEntries grouped by date for both projectIds to see when each was active
  for (const id of matches.map(m => m.id)) {
    const teSnap = await db.collection('timeEntries').where('projectId', '==', id).get();
    if (teSnap.size === 0) { console.log(`\n  ${id}: 0 timeEntries`); continue; }
    let minDate = null, maxDate = null;
    teSnap.forEach(d => {
      const dt = String(d.data().date || d.data().startTime || '').slice(0, 10);
      if (!dt) return;
      if (!minDate || dt < minDate) minDate = dt;
      if (!maxDate || dt > maxDate) maxDate = dt;
    });
    console.log(`\n  ${id}: ${teSnap.size} timeEntries, date range ${minDate} → ${maxDate}`);
  }

  process.exit(0);
})();
