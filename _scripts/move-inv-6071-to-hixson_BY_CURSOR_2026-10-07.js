#!/usr/bin/env node
'use strict';
/**
 * Move INV-6071 off orphan boards/greene onto greene-hixson.
 *   node _scripts\move-inv-6071-to-hixson_BY_CURSOR_2026-10-07.js
 *   node _scripts\move-inv-6071-to-hixson_BY_CURSOR_2026-10-07.js --apply
 */
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const KEY = path.join(__dirname, '..', '_debug', 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
const app = admin.initializeApp({ credential: admin.credential.cert(require(KEY)) }, 'wo288move');
const db = app.firestore();
const APPLY = process.argv.indexOf('--apply') >= 0;
const FROM = 'greene';
const TO = 'greene-hixson';
const INV_ID = 'ocunvriheudtqkG3LDs5';

(async () => {
  const fromBoard = await db.collection('boards').doc(FROM).get();
  const toBoard = await db.collection('boards').doc(TO).get();
  const invSnap = await db.collection('boards').doc(FROM).collection('invoices').doc(INV_ID).get();
  if (!invSnap.exists) {
    console.error('Invoice not on', FROM, INV_ID);
    process.exit(1);
  }
  const destSnap = await db.collection('boards').doc(TO).collection('invoices').doc(INV_ID).get();
  const destByNum = await db.collection('boards').doc(TO).collection('invoices').where('invoiceNum', '==', 'INV-6071').limit(3).get();
  const fromData = fromBoard.data() || {};
  const toData = toBoard.data() || {};
  const inv = invSnap.data() || {};
  console.log('FROM board', FROM, 'name', fromData.name, 'client', fromData.clientName || '(empty)', 'addr', fromData.projectAddress || '(empty)', 'status', fromData.status || '');
  console.log('TO board', TO, 'name', toData.name, 'client', toData.clientName, 'company', toData.clientCompany, 'addr', JSON.stringify(toData.projectAddress || ''));
  console.log('INV', inv.invoiceNum, 'total', inv.total, 'clientName', inv.clientName, 'projectId', inv.projectId, 'items', (inv.items || []).length);
  console.log('dest same id exists', destSnap.exists, 'dest INV-6071 count', destByNum.size);

  const te = await db.collection('timeEntries').where('invoiceNumber', '==', 'INV-6071').get();
  console.log('timeEntries invoiceNumber INV-6071', te.size);
  te.forEach((d) => {
    const x = d.data() || {};
    console.log(' TE', d.id, 'project', x.project, 'projectId', x.projectId, 'invoiceId', x.invoiceId);
  });

  const next = Object.assign({}, inv, {
    projectId: TO,
    projectName: toData.name || 'Greene- Hixson',
    clientName: toData.clientName || 'Hixon Metal Finishing',
    clientCompany: toData.clientCompany || toData.clientName || 'Hixon Metal Finishing',
    projectAddress: toData.projectAddress || '',
    clientAddress: toData.clientAddress || toData.billingAddress || '',
    updatedAt: new Date().toISOString(),
    _wo288MovedFrom: FROM,
    _wo288MovedAt: new Date().toISOString()
  });

  const backupDir = path.join(__dirname, '..', '_backup', 'wo288-inv-6071-' + new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19));
  fs.mkdirSync(backupDir, { recursive: true });
  fs.writeFileSync(path.join(backupDir, 'invoice-before.json'), JSON.stringify(inv, null, 2));
  fs.writeFileSync(path.join(backupDir, 'from-board.json'), JSON.stringify({ id: FROM, data: fromData }, null, 2));
  console.log('Backup', backupDir);

  if (!APPLY) {
    console.log('DRY RUN — pass --apply to copy onto greene-hixson, retarget time rows, delete stub invoice, archive boards/greene');
    process.exit(0);
  }
  if (destSnap.exists) {
    console.error('Refusing: invoice id already on greene-hixson');
    process.exit(1);
  }
  if (destByNum.size) {
    console.error('Refusing: INV-6071 number already on greene-hixson');
    process.exit(1);
  }

  await db.collection('boards').doc(TO).collection('invoices').doc(INV_ID).set(next);
  const batch = db.batch();
  te.forEach((d) => {
    batch.update(d.ref, {
      projectId: TO,
      project: toData.name || 'Greene- Hixson',
      invoiceProjectId: TO,
      invoiceId: INV_ID,
      updatedAt: new Date().toISOString()
    });
  });
  await batch.commit();
  await db.collection('boards').doc(FROM).collection('invoices').doc(INV_ID).delete();
  await db.collection('boards').doc(FROM).update({
    status: 'Archived',
    archivedAt: new Date().toISOString(),
    archivedReason: 'Orphan Greene stub — INV-6071 moved to greene-hixson (WO-288)',
    updatedAt: new Date().toISOString()
  });
  console.log('APPLIED INV-6071 now on greene-hixson. Time rows', te.size, 'Archived boards/greene');
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
