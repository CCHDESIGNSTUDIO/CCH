/**
 * Copy Katke Graceland Builder workOrders: production → staging
 * so print-layout fixes can be tested with Vanessa's real WOs.
 *
 * Usage:
 *   node _scripts/copy-katke-wos-prod-to-staging_BY_CURSOR_2026-07-24.js
 *   node _scripts/copy-katke-wos-prod-to-staging_BY_CURSOR_2026-07-24.js --apply
 */
'use strict';
const path = require('path');
const admin = require('firebase-admin');

const APPLY = process.argv.includes('--apply');
const BOARD_ID = 'katke-graceland-dr';
const PROD_KEY = path.join(
  __dirname,
  '..',
  '_debug',
  'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json'
);
const STG_KEY = path.join(
  __dirname,
  '..',
  '_debug',
  'service-account.json',
  'cch-studio-staging-firebase-adminsdk-fbsvc-b93c6f1cf4.json'
);

admin.initializeApp({ credential: admin.credential.cert(require(PROD_KEY)) }, 'katkeProd');
admin.initializeApp({ credential: admin.credential.cert(require(STG_KEY)) }, 'katkeStg');
const prodDb = admin.app('katkeProd').firestore();
const stgDb = admin.app('katkeStg').firestore();

function stripUndefined(obj) {
  return JSON.parse(JSON.stringify(obj));
}

(async () => {
  const prodBoard = await prodDb.collection('boards').doc(BOARD_ID).get();
  if (!prodBoard.exists) {
    console.error('Prod board missing', BOARD_ID);
    process.exit(1);
  }
  const boardData = stripUndefined(prodBoard.data() || {});
  const woSnap = await prodDb.collection('boards').doc(BOARD_ID).collection('workOrders').get();
  console.log('Prod board:', boardData.name || BOARD_ID);
  console.log('Prod WOs:', woSnap.size, '| APPLY', APPLY);

  const stgBoard = await stgDb.collection('boards').doc(BOARD_ID).get();
  if (!stgBoard.exists) {
    console.log(APPLY ? 'CREATE' : 'WOULD CREATE', 'staging board', BOARD_ID);
    if (APPLY) {
      await stgDb
        .collection('boards')
        .doc(BOARD_ID)
        .set(
          Object.assign({}, boardData, {
            _copiedFromProductionAt: admin.firestore.FieldValue.serverTimestamp(),
            _copiedFromProductionBy: 'Cursor Raul Builder 2026-07-24'
          }),
          { merge: true }
        );
    }
  } else {
    console.log('Staging board exists — leave board doc; overwrite workOrders');
  }

  let n = 0;
  for (const doc of woSnap.docs) {
    const raw = doc.data() || {};
    const payload = stripUndefined(raw);
    payload._copiedFromProductionAt = new Date().toISOString();
    payload._copiedFromProductionBy = 'Cursor Raul Builder 2026-07-24';
    payload.updatedAt = admin.firestore.FieldValue.serverTimestamp();
    console.log(
      (APPLY ? 'UPSERT' : 'WOULD'),
      payload.workOrderNumber || doc.id,
      payload.category || '',
      '|',
      String(payload.location || '').slice(0, 28),
      '|',
      String(payload.room || '').slice(0, 24),
      '|',
      String((payload.specs && payload.specs.piece) || '').slice(0, 20)
    );
    if (APPLY) {
      await stgDb.collection('boards').doc(BOARD_ID).collection('workOrders').doc(doc.id).set(payload, { merge: false });
    }
    n++;
  }
  console.log('Done.', n, 'work orders');
  console.log('https://cch-platform-staging.web.app/builder/?projectId=' + BOARD_ID);
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
