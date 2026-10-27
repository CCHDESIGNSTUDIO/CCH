/** READ-ONLY staging: Katke workOrders */
const path = require('path');
const admin = require('firebase-admin');
const KEY = path.join(
  __dirname,
  '..',
  '_debug',
  'service-account.json',
  'cch-studio-staging-firebase-adminsdk-fbsvc-b93c6f1cf4.json'
);
const app = admin.initializeApp({ credential: admin.credential.cert(require(KEY)) }, 'probeStagingWO');
const db = app.firestore();

(async () => {
  for (const b of ['katke-graceland-dr', 'katke-graceland']) {
    const board = await db.collection('boards').doc(b).get();
    const wo = await db.collection('boards').doc(b).collection('workOrders').get();
    console.log(b, 'board=', board.exists, 'wo=', wo.size);
    wo.forEach((d) => {
      const x = d.data() || {};
      console.log(' ', d.id, x.workOrderNumber || x.workOrder, x.room, x.category);
    });
  }
  const cg = await db.collectionGroup('workOrders').get();
  console.log('staging total workOrders:', cg.size);
  const katke = [];
  cg.forEach((d) => {
    const x = d.data() || {};
    const blob = [d.ref.path, x.projectId, x.projectName, x.project].join(' ').toLowerCase();
    if (/katke|graceland/.test(blob)) katke.push(d.ref.path + ' ' + (x.workOrderNumber || ''));
  });
  console.log('staging katke matches:', katke.length, katke);
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
