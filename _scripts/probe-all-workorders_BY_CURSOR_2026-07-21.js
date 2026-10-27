/**
 * READ-ONLY: inventory all workOrders + Storage paths that look like Katke WOs.
 */
const path = require('path');
const admin = require('firebase-admin');
const KEY = path.join(
  __dirname,
  '..',
  '_debug',
  'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json'
);
const app = admin.initializeApp({ credential: admin.credential.cert(require(KEY)) }, 'probeAllWO');
const db = app.firestore();
const bucket = app.storage().bucket('cch-design-boards.firebasestorage.app');

(async () => {
  const cg = await db.collectionGroup('workOrders').get();
  console.log('Total workOrders docs firm-wide:', cg.size);
  const byBoard = {};
  cg.forEach((doc) => {
    const boardId = doc.ref.parent.parent ? doc.ref.parent.parent.id : '?';
    const d = doc.data() || {};
    if (!byBoard[boardId]) byBoard[boardId] = [];
    byBoard[boardId].push({
      id: doc.id,
      wo: d.workOrderNumber || d.workOrder || '',
      cat: d.category || '',
      room: d.room || '',
      projectId: d.projectId || '',
      projectName: d.projectName || d.project || '',
      hasUpdatedAt: !!d.updatedAt
    });
  });
  const boards = Object.keys(byBoard).sort();
  console.log('Boards with workOrders:', boards.length);
  for (const b of boards) {
    console.log('\n' + b + ' (' + byBoard[b].length + ')');
    byBoard[b].slice(0, 30).forEach((r) => console.log('  ', JSON.stringify(r)));
    if (byBoard[b].length > 30) console.log('  ... +' + (byBoard[b].length - 30) + ' more');
  }

  console.log('\n=== Storage prefix scan (projects/ + katke) ===');
  const prefixes = [
    'projects/katke-graceland-dr/workOrders/',
    'projects/katke-graceland/workOrders/',
    'projects/katke-graceland-dr/',
    'boards/katke-graceland-dr/workOrders/'
  ];
  for (const p of prefixes) {
    try {
      const [files] = await bucket.getFiles({ prefix: p, maxResults: 50 });
      console.log(p, '→', files.length, 'file(s)');
      files.slice(0, 15).forEach((f) => console.log('  ', f.name));
    } catch (e) {
      console.log(p, 'ERROR', e.message);
    }
  }

  // Broader storage search
  try {
    const [files] = await bucket.getFiles({ prefix: 'projects/', maxResults: 2000 });
    const katke = files.filter((f) => /katke|graceland/i.test(f.name) && /workorder/i.test(f.name));
    console.log('\nprojects/* matching katke+workorder:', katke.length);
    katke.slice(0, 40).forEach((f) => console.log('  ', f.name));
  } catch (e) {
    console.log('broad storage scan ERROR', e.message);
  }

  process.exit(0);
})().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
