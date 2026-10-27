/**
 * READ-ONLY: find Katke work orders on real + phantom boards, and any projectId mismatch.
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
const app = admin.initializeApp({ credential: admin.credential.cert(require(KEY)) }, 'probeKatkeWO');
const db = app.firestore();

function summarize(doc) {
  const d = doc.data() || {};
  return {
    id: doc.id,
    workOrderNumber: d.workOrderNumber || d.workOrder || '',
    category: d.category || '',
    room: d.room || '',
    location: d.location || '',
    projectId: d.projectId || '',
    projectName: d.projectName || d.project || '',
    hasUpdatedAt: !!d.updatedAt,
    revision: d.revision
  };
}

async function listWO(boardId) {
  const snap = await db.collection('boards').doc(boardId).collection('workOrders').get();
  return snap.docs.map(summarize);
}

(async () => {
  const boards = ['katke-graceland-dr', 'katke-graceland'];
  for (const b of boards) {
    const boardSnap = await db.collection('boards').doc(b).get();
    console.log('\n=== board', b, boardSnap.exists ? 'EXISTS' : 'MISSING', '===');
    if (boardSnap.exists) {
      const bd = boardSnap.data() || {};
      console.log('  name:', bd.name || '(no name)');
    }
    const rows = await listWO(b);
    console.log('  workOrders count:', rows.length);
    rows.forEach((r) => console.log('   -', JSON.stringify(r)));
  }

  // Collection-group scan for Katke-related WOs saved under other boards
  console.log('\n=== collectionGroup workOrders matching Katke (limit scan) ===');
  const cg = await db.collectionGroup('workOrders').get();
  const hits = [];
  cg.forEach((doc) => {
    const d = doc.data() || {};
    const blob = [
      d.projectId,
      d.projectName,
      d.project,
      doc.ref.parent.parent && doc.ref.parent.parent.id
    ]
      .map((x) => String(x || '').toLowerCase())
      .join(' ');
    if (/katke|graceland/.test(blob)) {
      hits.push({
        path: doc.ref.path,
        ...summarize(doc)
      });
    }
  });
  console.log('  matches:', hits.length);
  hits.forEach((h) => console.log('   -', JSON.stringify(h)));
  process.exit(0);
})().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
