const path = require('path');
const admin = require('firebase-admin');
const SA = path.join(__dirname, 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
admin.initializeApp({ credential: admin.credential.cert(require(SA)) });
const db = admin.firestore();
(async () => {
  const snap = await db.collection('boards').get();
  const m = [];
  snap.forEach(d => {
    const x = d.data();
    const fs = [x.name, x.clientName, x.client, d.id].filter(Boolean).map(v => String(v).toLowerCase());
    if (fs.some(v => v.includes('bradbury') || v.includes('hollister') || v.includes('surf'))) {
      m.push({ id: d.id, name: x.name || '', client: x.clientName || x.client || '', archived: !!x.archived });
    }
  });
  for (const x of m) console.log(`  id=${x.id.padEnd(35)}  name="${x.name}"  client="${x.client}"  archived=${x.archived}`);
  // Also count existing ideabooks per match
  for (const x of m) {
    const ib = await db.collection('boards').doc(x.id).collection('ideabooks').get();
    console.log(`    ${x.id} ideabooks: ${ib.size}`);
  }
  process.exit(0);
})();
