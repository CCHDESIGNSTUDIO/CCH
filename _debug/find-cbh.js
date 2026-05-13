const path = require('path');
const admin = require('firebase-admin');
const SA = path.join(__dirname, 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
admin.initializeApp({ credential: admin.credential.cert(require(SA)) });
const db = admin.firestore();
(async () => {
  const snap = await db.collection('boards').get();
  snap.forEach(d => {
    const x = d.data();
    const fs = [x.name, x.clientName, x.client, d.id].filter(Boolean).map(v => String(v).toLowerCase());
    if (fs.some(v => v === 'cbh' || v.includes('cbh'))) {
      console.log(`  id=${d.id.padEnd(35)}  name="${x.name || ''}"  client="${x.clientName || x.client || ''}"`);
    }
  });
  process.exit(0);
})();
