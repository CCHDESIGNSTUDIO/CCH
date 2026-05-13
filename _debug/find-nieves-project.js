/**
 * Find the Nieves project board(s) in Studio so the importer knows where to write.
 */
const path = require('path');
const admin = require('firebase-admin');

const SERVICE_ACCOUNT = path.join(__dirname, 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
admin.initializeApp({ credential: admin.credential.cert(require(SERVICE_ACCOUNT)) });
const db = admin.firestore();

(async () => {
  const snap = await db.collection('boards').get();
  const matches = [];
  snap.forEach(d => {
    const x = d.data();
    const fields = [x.name, x.clientName, x.client, d.id].filter(Boolean).map(v => String(v).toLowerCase());
    if (fields.some(v => v.includes('nieves'))) {
      matches.push({ id: d.id, name: x.name || '', clientName: x.clientName || x.client || '', archived: !!x.archived });
    }
  });
  console.log(`Nieves-matching boards: ${matches.length}`);
  for (const m of matches) {
    console.log(`  id=${m.id.padEnd(30)}  name="${m.name}"  client="${m.clientName}"  archived=${m.archived}`);
    // Also peek at existing ideabooks
    try {
      const ibSnap = await db.collection('boards').doc(m.id).collection('ideabooks').get();
      console.log(`    existing ideabooks: ${ibSnap.size}`);
      let n = 0;
      ibSnap.forEach(d => {
        if (n++ < 5) {
          const ib = d.data();
          const imgCount = (ib.images || []).length;
          console.log(`      • ${(ib.name || '(unnamed)').padEnd(35)}  ${imgCount} images  source=${ib.source || '(none)'}`);
        }
      });
      if (ibSnap.size > 5) console.log(`      ...and ${ibSnap.size - 5} more`);
    } catch (e) {
      console.log(`    ideabook scan error: ${e.message}`);
    }
  }
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
