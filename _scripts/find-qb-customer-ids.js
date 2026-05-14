const path = require('path');
const admin = require('firebase-admin');
const SA = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
admin.initializeApp({ credential: admin.credential.cert(require(SA)) });
const db = admin.firestore();

(async () => {
  // Check boards collection for qbCustomerId populated
  const boards = await db.collection('boards').get();
  console.log(`Total boards: ${boards.size}\n`);
  const withQbId = [];
  const fieldsScan = {};
  for (const d of boards.docs) {
    const x = d.data();
    for (const k of Object.keys(x)) {
      if (/qb/i.test(k)) fieldsScan[k] = (fieldsScan[k] || 0) + 1;
    }
    if (x.qbCustomerId) withQbId.push({ id: d.id, qbCustomerId: x.qbCustomerId, name: x.name, clientName: x.clientName });
  }
  console.log('All "qb*"-named fields seen across boards (count of boards with that field set):');
  for (const k of Object.keys(fieldsScan).sort()) console.log(`  ${k}: ${fieldsScan[k]}`);
  console.log('');
  console.log(`Boards with qbCustomerId populated: ${withQbId.length}`);
  for (const b of withQbId.slice(0, 30)) {
    console.log(`  ${b.id.padEnd(35)} qbCustomerId=${b.qbCustomerId}  name="${b.name || ''}"  client="${b.clientName || ''}"`);
  }
  if (withQbId.length > 30) console.log(`  ... ${withQbId.length - 30} more`);
  process.exit(0);
})();
