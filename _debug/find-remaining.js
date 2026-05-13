const path = require('path');
const admin = require('firebase-admin');
const SA = path.join(__dirname, 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
admin.initializeApp({ credential: admin.credential.cert(require(SA)) });
const db = admin.firestore();
(async () => {
  const snap = await db.collection('boards').get();
  const PATTERNS = ['hess', 'markussen', 'heliotrope', 'ccc'];
  console.log('Searches for unresolved slugs:\n');
  for (const p of PATTERNS) {
    console.log(`  "${p}":`);
    let found = false;
    snap.forEach(d => {
      const x = d.data();
      const fs = [x.name, x.clientName, x.client, d.id].filter(Boolean).map(v => String(v).toLowerCase());
      if (fs.some(v => v.includes(p))) {
        console.log(`    id=${d.id.padEnd(35)}  name="${x.name || ''}"  client="${x.clientName || x.client || ''}"`);
        found = true;
      }
    });
    if (!found) console.log('    (no match)');
  }
  process.exit(0);
})();
