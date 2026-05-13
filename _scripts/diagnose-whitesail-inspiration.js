const path = require('path');
const admin = require('firebase-admin');
const SA = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
admin.initializeApp({ credential: admin.credential.cert(require(SA)) });
const db = admin.firestore();
(async () => {
  console.log('=== boards/31-whitesail/ideabooks ===');
  const sub = await db.collection('boards').doc('31-whitesail').collection('ideabooks').get();
  console.log('count:', sub.size);
  sub.forEach(d => {
    const x = d.data();
    console.log('  id:', d.id);
    console.log('    name:', x.name || x.title);
    console.log('    published:', x.published);
    console.log('    items:', (x.items || x.clips || []).length);
    console.log('    keys:', Object.keys(x).join(', '));
  });

  console.log('\n=== TOP-LEVEL ideabooks where projectId="31-whitesail" ===');
  const top = await db.collection('ideabooks').where('projectId','==','31-whitesail').get();
  console.log('count:', top.size);
  top.forEach(d => {
    const x = d.data();
    console.log('  id:', d.id, '— name:', x.name || x.title, '— published:', x.published, '— items:', (x.items||[]).length);
  });

  console.log('\n=== Compare: Greene-Hixson ideabooks ===');
  const gx = await db.collection('boards').doc('greene-hixson').collection('ideabooks').get();
  console.log('count:', gx.size);
  gx.forEach(d => {
    const x = d.data();
    console.log('  id:', d.id, '— name:', x.name || x.title, '— published:', x.published, '— items:', (x.items||[]).length);
  });

  console.log('\n=== Whitesail published state across collections ===');
  const ref = db.collection('boards').doc('31-whitesail');
  for (const coll of ['proposals', 'invoices', 'purchaseOrders']) {
    const all = await ref.collection(coll).get();
    let pub = 0, unpub = 0;
    all.forEach(d => { if (d.data().published) pub++; else unpub++; });
    console.log(`  ${coll}: ${pub} published / ${unpub} unpublished`);
  }
  process.exit(0);
})();
