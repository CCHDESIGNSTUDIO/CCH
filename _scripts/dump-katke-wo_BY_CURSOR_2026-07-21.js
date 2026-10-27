const path = require('path');
const admin = require('firebase-admin');
const KEY = path.join(
  __dirname,
  '..',
  '_debug',
  'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json'
);
const app = admin.initializeApp({ credential: admin.credential.cert(require(KEY)) }, 'dumpKatkeWO');
const db = app.firestore();
const bucket = app.storage().bucket('cch-design-boards.firebasestorage.app');

(async () => {
  const snap = await db.collection('boards').doc('katke-graceland-dr').collection('workOrders').get();
  console.log('Firestore workOrders:', snap.size);
  for (const d of snap.docs) {
    const x = d.data() || {};
    console.log('\nDOC', d.id);
    console.log(
      JSON.stringify(
        {
          workOrderNumber: x.workOrderNumber || x.workOrder,
          category: x.category,
          room: x.room,
          location: x.location,
          projectId: x.projectId,
          projectName: x.projectName,
          revision: x.revision,
          updatedAt: x.updatedAt && x.updatedAt.toDate ? x.updatedAt.toDate().toISOString() : x.updatedAt,
          createdAt: x.createdAt && x.createdAt.toDate ? x.createdAt.toDate().toISOString() : x.createdAt,
          renderingUrl: x.renderingUrl || '',
          hasSpecs: !!x.specs,
          hasMeasurements: !!x.measurements
        },
        null,
        2
      )
    );
  }

  console.log('\nStorage under projects/katke-graceland-dr/workOrders/');
  const [files] = await bucket.getFiles({ prefix: 'projects/katke-graceland-dr/workOrders/' });
  const byId = {};
  files.forEach((f) => {
    const m = f.name.match(/workOrders\/([^/]+)\//);
    const id = m ? m[1] : '?';
    byId[id] = (byId[id] || 0) + 1;
    console.log(' ', f.name, f.metadata && f.metadata.updated);
  });
  console.log('\nStorage WO folder ids:', Object.keys(byId));
  const fsIds = new Set(snap.docs.map((d) => d.id));
  Object.keys(byId).forEach((id) => {
    if (!fsIds.has(id)) console.log('ORPHAN STORAGE (no Firestore doc):', id, byId[id], 'files');
  });
  snap.docs.forEach((d) => {
    if (!byId[d.id]) console.log('Firestore doc with no storage folder:', d.id);
  });

  console.log('\nrendering ts:', new Date(1784666420444).toISOString());
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
