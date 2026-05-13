/**
 * Find docs (invoices, POs, proposals) on board IDs that don't correspond
 * to a real board doc (i.e. parent board doc.exists === false).
 */
const path = require('path');
const admin = require('firebase-admin');
const SA = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
admin.initializeApp({ credential: admin.credential.cert(require(SA)) });
const db = admin.firestore();

(async () => {
  // Build set of valid board IDs
  const boardsSnap = await db.collection('boards').get();
  const validBoardIds = new Set(boardsSnap.docs.map(d => d.id));
  console.log('Valid board docs:', validBoardIds.size);

  for (const coll of ['invoices', 'purchaseOrders', 'proposals']) {
    console.log(`\n--- Scanning collectionGroup("${coll}") ---`);
    const cg = await db.collectionGroup(coll).get();
    console.log(`  Total docs across all boards: ${cg.size}`);
    const orphans = {};
    for (const d of cg.docs) {
      const parts = d.ref.path.split('/'); // boards/{boardId}/{coll}/{docId}
      const boardId = parts[1];
      if (!validBoardIds.has(boardId)) {
        if (!orphans[boardId]) orphans[boardId] = [];
        const x = d.data();
        orphans[boardId].push({
          docId: d.id,
          num: x.invoiceNum || x.poNum || x.proposalNum || x.number || '(none)',
          status: x.status,
          total: x.total,
          createdAt: x.createdAt,
          source: x._source || x.source
        });
      }
    }
    const phantomBoards = Object.keys(orphans);
    if (phantomBoards.length === 0) {
      console.log('  No orphans. ✓');
      continue;
    }
    console.log(`  Phantom boards with ${coll}: ${phantomBoards.length}`);
    for (const pb of phantomBoards) {
      console.log(`    boards/${pb}/  (${orphans[pb].length} docs)`);
      for (const o of orphans[pb]) {
        console.log(`      ${o.docId}  ${o.num}  ${o.status}  $${o.total}  ${o.createdAt}  src=${o.source}`);
      }
    }
  }
  process.exit(0);
})();
