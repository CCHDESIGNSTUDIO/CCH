#!/usr/bin/env node
'use strict';
/**
 * Delete ONLY clipper / studio-clip rows from Junk Library (quarantine).
 * Keeps duplicate-review and other non-clip junk in archive.
 *
 *   node _scripts/purge-clip-junk-library-PRODUCTION_BY_CURSOR_2026-07-06.js
 *   node _scripts/purge-clip-junk-library-PRODUCTION_BY_CURSOR_2026-07-06.js --apply --backup
 */
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const APPLY = process.argv.includes('--apply');
const BACKUP = process.argv.includes('--backup') || APPLY;
const KEY = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
const COLS = ['productLibrary_archive', 'products_archive'];
const BATCH = 400;

admin.initializeApp({ credential: admin.credential.cert(require(KEY)) });
const db = admin.firestore();

function isClipJunkRow(data) {
  data = data || {};
  if (data._fromClip === true) return true;
  var src = String(data.source || '').toLowerCase();
  return src === 'clipper' || src === 'cch-studio-clipper' || src.indexOf('clipper') >= 0;
}

async function loadClipJunkIds(colName) {
  var snap = await db.collection(colName).get();
  var hits = [];
  snap.forEach(function(doc) {
    if (isClipJunkRow(doc.data())) hits.push({ id: doc.id, data: doc.data() });
  });
  return hits;
}

async function deleteIds(colName, ids) {
  var n = 0;
  for (var i = 0; i < ids.length; i += BATCH) {
    var batch = db.batch();
    ids.slice(i, i + BATCH).forEach(function(id) {
      batch.delete(db.collection(colName).doc(id));
    });
    await batch.commit();
    n += Math.min(BATCH, ids.length - i);
    process.stdout.write('  deleted ' + n + ' / ' + ids.length + '\r');
  }
  if (ids.length) process.stdout.write('\n');
  return ids.length;
}

(async function() {
  console.log('=== Purge STUDIO CLIP rows from Junk Library only ===');
  console.log('Mode:', APPLY ? 'APPLY' : 'DRY RUN');
  var backup = { purgedAt: new Date().toISOString(), collections: {} };
  var summary = {};
  for (var ci = 0; ci < COLS.length; ci++) {
    var col = COLS[ci];
    var hits = await loadClipJunkIds(col);
    summary[col] = hits.length;
    backup.collections[col] = {};
    hits.forEach(function(h) { backup.collections[col][h.id] = h.data; });
    console.log(col + ':', hits.length, 'clip-sourced junk rows (of collection scan)');
  }
  var total = Object.values(summary).reduce(function(a, b) { return a + b; }, 0);
  console.log('Total clip junk to delete:', total);
  if (BACKUP && total) {
    var dir = path.join(__dirname, '..', '_backup', 'clip-junk-purge-2026-07-06');
    fs.mkdirSync(dir, { recursive: true });
    var p = path.join(dir, 'clip-junk-only-before-purge.json');
    fs.writeFileSync(p, JSON.stringify(backup, null, 2));
    console.log('Backup:', p);
  }
  if (!APPLY || !total) {
    console.log(APPLY ? 'Nothing to delete.' : 'Dry run — pass --apply --backup to delete clip junk only.');
    process.exit(0);
  }
  for (var cj = 0; cj < COLS.length; cj++) {
    var col2 = COLS[cj];
    var ids = Object.keys(backup.collections[col2] || {});
    if (ids.length) {
      console.log('Deleting', col2 + '...');
      await deleteIds(col2, ids);
    }
  }
  for (var ck = 0; ck < COLS.length; ck++) {
    var cnt = await db.collection(COLS[ck]).count().get();
    console.log('Verify', COLS[ck] + ':', cnt.data().count);
  }
  console.log('Done.');
})().catch(function(e) { console.error(e); process.exit(1); });
