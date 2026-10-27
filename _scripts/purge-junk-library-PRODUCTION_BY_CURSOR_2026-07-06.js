#!/usr/bin/env node
'use strict';
/**
 * Permanently delete ALL rows in Junk Library (quarantine) on production.
 *
 * Collections emptied:
 *   productLibrary_archive/
 *   products_archive/
 *
 * Active catalog (productLibrary/, products/) is NOT touched.
 *
 * Usage (from cch-deploy/):
 *   node _scripts/purge-junk-library-PRODUCTION_BY_CURSOR_2026-07-06.js
 *   node _scripts/purge-junk-library-PRODUCTION_BY_CURSOR_2026-07-06.js --apply --backup
 */
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const argv = process.argv.slice(2);
const APPLY = argv.includes('--apply');
const BACKUP = argv.includes('--backup') || APPLY;

const KEY = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
const COLLECTIONS = ['productLibrary_archive', 'products_archive'];
const BATCH_SIZE = 400;
const TAG = 'purge-junk-library-PRODUCTION_BY_CURSOR_2026-07-06.js';

admin.initializeApp({ credential: admin.credential.cert(require(KEY)) });
const db = admin.firestore();

async function loadCollection(colName) {
  const snap = await db.collection(colName).get();
  const rows = [];
  snap.forEach(function(doc) {
    rows.push({ id: doc.id, data: doc.data() });
  });
  return rows;
}

async function deleteIds(colName, ids) {
  var deleted = 0;
  for (var i = 0; i < ids.length; i += BATCH_SIZE) {
    var batch = db.batch();
    var chunk = ids.slice(i, i + BATCH_SIZE);
    chunk.forEach(function(id) {
      batch.delete(db.collection(colName).doc(id));
    });
    await batch.commit();
    deleted += chunk.length;
    process.stdout.write('  ' + colName + ': deleted ' + deleted + ' / ' + ids.length + '\r');
  }
  if (ids.length) process.stdout.write('\n');
  return deleted;
}

(async function main() {
  console.log('=== Purge Junk Library (production) ===');
  console.log('Mode:', APPLY ? 'APPLY (destructive)' : 'DRY RUN');
  console.log('Script:', TAG);
  console.log('');

  var summary = {};
  var backupPayload = { purgedAt: new Date().toISOString(), script: TAG, collections: {} };

  for (var ci = 0; ci < COLLECTIONS.length; ci++) {
    var col = COLLECTIONS[ci];
    var rows = await loadCollection(col);
    summary[col] = rows.length;
    backupPayload.collections[col] = {};
    rows.forEach(function(r) {
      backupPayload.collections[col][r.id] = r.data;
    });
    console.log(col + ':', rows.length, 'docs');
  }

  var total = Object.values(summary).reduce(function(a, b) { return a + b; }, 0);
  console.log('Total junk docs:', total);

  if (BACKUP) {
    var backupDir = path.join(__dirname, '..', '_backup', 'junk-purge-2026-07-06');
    fs.mkdirSync(backupDir, { recursive: true });
    var backupPath = path.join(backupDir, 'junk-library-before-purge.json');
    fs.writeFileSync(backupPath, JSON.stringify(backupPayload, null, 2));
    console.log('Backup written:', backupPath);
  }

  if (!APPLY) {
    console.log('\nDry run only — pass --apply --backup to delete.');
    process.exit(0);
  }

  if (total === 0) {
    console.log('Nothing to delete.');
    process.exit(0);
  }

  console.log('\nDeleting...');
  var deletedTotal = 0;
  for (var cj = 0; cj < COLLECTIONS.length; cj++) {
    var col2 = COLLECTIONS[cj];
    var ids = Object.keys(backupPayload.collections[col2] || {});
    var n = await deleteIds(col2, ids);
    deletedTotal += n;
  }

  console.log('\nVerify counts:');
  for (var ck = 0; ck < COLLECTIONS.length; ck++) {
    var col3 = COLLECTIONS[ck];
    var cnt = await db.collection(col3).count().get();
    console.log(' ', col3 + ':', cnt.data().count);
  }

  var journalPath = path.join(__dirname, '..', '_backup', 'junk-purge-2026-07-06', 'PURGE_JOURNAL.txt');
  fs.writeFileSync(journalPath, [
    'Junk Library purge — production',
    'Date: ' + new Date().toISOString(),
    'Script: ' + TAG,
    'Deleted: ' + JSON.stringify(summary),
    'Total: ' + deletedTotal,
  ].join('\n'));
  console.log('Journal:', journalPath);
  console.log('\nDone. Deleted', deletedTotal, 'junk docs.');
})().catch(function(err) {
  console.error(err);
  process.exit(1);
});
