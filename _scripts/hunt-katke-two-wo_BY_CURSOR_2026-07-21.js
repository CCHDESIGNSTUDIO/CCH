/**
 * READ-ONLY hunt for ~2 missing Katke work orders: activity, files, proposals, Storage, archives.
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
const app = admin.initializeApp({ credential: admin.credential.cert(require(KEY)) }, 'huntKatke2');
const db = app.firestore();

async function safeGet(label, fn) {
  try {
    return await fn();
  } catch (e) {
    console.log('[skip]', label, e.message);
    return null;
  }
}

(async () => {
  const boardId = 'katke-graceland-dr';
  const boardRef = db.collection('boards').doc(boardId);

  // Subcollections on Katke board
  console.log('=== Katke board subcollections (list) ===');
  const cols = await boardRef.listCollections();
  for (const c of cols) {
    const snap = await c.limit(3).get();
    const countSnap = await c.count().get().catch(() => null);
    const n = countSnap ? countSnap.data().count : snap.size + (snap.size === 3 ? '+' : '');
    console.log(' ', c.id, 'count~', n);
  }

  // Activity mentioning work order
  console.log('\n=== activity / project activity ===');
  for (const coll of ['activity', 'projectNotes', 'notes']) {
    await safeGet(coll, async () => {
      const snap = await boardRef.collection(coll).get();
      let hits = 0;
      snap.forEach((d) => {
        const s = JSON.stringify(d.data() || {}).toLowerCase();
        if (/work\s*order|builder|kat-w|workorder/.test(s)) {
          hits++;
          console.log(' ', coll, d.id, s.slice(0, 220));
        }
      });
      console.log(' ', coll, 'total', snap.size, 'hits', hits);
    });
  }

  // Top-level activity
  await safeGet('top activity', async () => {
    const snap = await db.collection('activity').where('projectId', '==', boardId).limit(100).get();
    console.log(' top activity for katke:', snap.size);
    snap.forEach((d) => {
      const s = JSON.stringify(d.data() || {}).toLowerCase();
      if (/work|builder|order/.test(s)) console.log('  ', d.id, s.slice(0, 200));
    });
  });

  // Files & docs
  await safeGet('files', async () => {
    const snap = await boardRef.collection('files').get();
    console.log('\n=== files', snap.size, '===');
    snap.forEach((d) => {
      const x = d.data() || {};
      const name = String(x.name || x.title || x.fileName || x.path || '');
      if (/work|order|wo\b|builder|drap|window|shade|roman/i.test(name) || /work|order/i.test(JSON.stringify(x))) {
        console.log(' ', d.id, name, x.url || x.downloadUrl || '');
      }
    });
  });

  // clientDocuments
  await safeGet('clientDocuments', async () => {
    const snap = await boardRef.collection('clientDocuments').get();
    console.log('\n=== clientDocuments', snap.size, '===');
    snap.forEach((d) => {
      const x = d.data() || {};
      const blob = JSON.stringify(x).toLowerCase();
      if (/work\s*order|builder/.test(blob)) console.log(' ', d.id, (x.title || x.name || '').slice(0, 80));
    });
  });

  // Proposal/invoice/PO lines mentioning workOrder
  for (const coll of ['proposals', 'invoices', 'purchaseOrders']) {
    await safeGet(coll, async () => {
      const snap = await boardRef.collection(coll).get();
      let hits = 0;
      snap.forEach((d) => {
        const x = d.data() || {};
        const items = Array.isArray(x.items) ? x.items : [];
        items.forEach((it, i) => {
          const blob = JSON.stringify(it || {}).toLowerCase();
          if (/workorder|work.?order|builder-workorder|kat-w/.test(blob)) {
            hits++;
            console.log(' ', coll, d.id, 'line', i, it.title || it.description || '', it.workOrderNumber || it.source || '');
          }
        });
      });
      console.log(coll, 'docs', snap.size, 'line hits', hits);
    });
  }

  // Any doc with workOrderNumber KAT or project Katke
  console.log('\n=== firm-wide workOrders with KAT or empty project ===');
  const cg = await db.collectionGroup('workOrders').get();
  cg.forEach((d) => {
    const x = d.data() || {};
    const wo = String(x.workOrderNumber || x.workOrder || '');
    if (/^KAT/i.test(wo) || /katke/i.test(String(x.projectName || x.project || ''))) {
      console.log(' FOUND', d.ref.path, wo);
    }
  });
  console.log('firm-wide WO count still', cg.size);

  // Storage broader
  try {
    const bucket = app.storage().bucket('cch-design-boards.appspot.com');
    const prefixes = ['projects/katke', 'boards/katke', 'library/'];
    for (const p of ['projects/katke-graceland-dr/', 'projects/katke-graceland-dr/workOrders/', 'workOrders/']) {
      const [files] = await bucket.getFiles({ prefix: p, maxResults: 20 });
      console.log('storage', p, files.length);
    }
  } catch (e) {
    console.log('storage appspot', e.message);
    try {
      const bucket2 = app.storage().bucket('cch-design-boards.firebasestorage.app');
      const [files] = await bucket2.getFiles({ prefix: 'projects/', maxResults: 5000 });
      const hits = files.filter((f) => /katke/i.test(f.name));
      console.log('storage firebasestorage.app projects/*katke*:', hits.length);
      hits.slice(0, 30).forEach((f) => console.log(' ', f.name));
      const woFiles = files.filter((f) => /workorder|work-order|work_order/i.test(f.name));
      console.log('any workorder path under projects/:', woFiles.length);
      woFiles.slice(0, 40).forEach((f) => console.log(' ', f.name));
    } catch (e2) {
      console.log('storage2', e2.message);
    }
  }

  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
