#!/usr/bin/env node
'use strict';
/** Restore productLibrary_archive + products_archive from junk purge backup. */
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const APPLY = process.argv.includes('--apply');
const BACKUP = path.join(__dirname, '..', '_backup', 'junk-purge-2026-07-06', 'junk-library-before-purge.json');
const KEY = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
const BATCH = 400;

admin.initializeApp({ credential: admin.credential.cert(require(KEY)) });
const db = admin.firestore();

function isClipJunkRow(data) {
  data = data || {};
  if (data._fromClip === true) return true;
  var src = String(data.source || '').toLowerCase();
  return src === 'clipper' || src === 'cch-studio-clipper' || src.indexOf('clipper') >= 0;
}

async function restoreCol(colName, docs) {
  var ids = Object.keys(docs || {});
  console.log('Restore', colName + ':', ids.length);
  if (!APPLY) return ids.length;
  var n = 0;
  for (var i = 0; i < ids.length; i += BATCH) {
    var batch = db.batch();
    ids.slice(i, i + BATCH).forEach(function(id) {
      batch.set(db.collection(colName).doc(id), docs[id], { merge: false });
    });
    await batch.commit();
    n += Math.min(BATCH, ids.length - i);
    process.stdout.write('  restored ' + n + ' / ' + ids.length + '\r');
  }
  if (ids.length) process.stdout.write('\n');
  return ids.length;
}

(async function() {
  console.log('=== Restore Junk Library from backup ===');
  console.log('Mode:', APPLY ? 'APPLY' : 'DRY RUN');
  if (!fs.existsSync(BACKUP)) throw new Error('Backup missing: ' + BACKUP);
  var payload = JSON.parse(fs.readFileSync(BACKUP, 'utf8'));
  var lib = payload.collections.productLibrary_archive || {};
  var prod = payload.collections.products_archive || {};
  var clipLib = Object.values(lib).filter(isClipJunkRow).length;
  var clipProd = Object.values(prod).filter(isClipJunkRow).length;
  console.log('Backup rows: productLibrary_archive', Object.keys(lib).length, '(clip-sourced', clipLib + ')');
  console.log('Backup rows: products_archive', Object.keys(prod).length, '(clip-sourced', clipProd + ')');
  await restoreCol('productLibrary_archive', lib);
  await restoreCol('products_archive', prod);
  if (APPLY) {
    for (var c of ['productLibrary_archive', 'products_archive']) {
      var cnt = await db.collection(c).count().get();
      console.log('Verify', c + ':', cnt.data().count);
    }
  }
  console.log(APPLY ? 'Restore complete.' : 'Dry run — pass --apply to restore.');
})().catch(function(e) { console.error(e); process.exit(1); });
