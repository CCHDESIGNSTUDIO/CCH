#!/usr/bin/env node
'use strict';
/** Restore invoice-linked mirror BC6qPSRQ3Wh6CCDtuiFi from products_archive → products. */
const path = require('path');
const admin = require('firebase-admin');

const APPLY = process.argv.includes('--apply');
const PRODUCT_ID = 'BC6qPSRQ3Wh6CCDtuiFi';
const KEY = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');

admin.initializeApp({ credential: admin.credential.cert(require(KEY)) });
const db = admin.firestore();

async function restoreOne(productId) {
  var libSnap = await db.collection('productLibrary_archive').doc(productId).get();
  var prodSnap = await db.collection('products_archive').doc(productId).get();
  if (!libSnap.exists && !prodSnap.exists) {
    console.log('Not in junk archive:', productId);
    return false;
  }
  if (prodSnap.exists) {
    var pd = prodSnap.data() || {};
    console.log('products_archive row:', {
      id: productId,
      title: pd.title,
      cost: pd.cost,
      qty: pd.qty,
      sku: pd.sku,
      source: pd.source,
      sourceClipId: pd.sourceClipId,
      projectId: pd.projectId
    });
  }
  if (!APPLY) return true;

  var restoredAt = new Date().toISOString();
  if (libSnap.exists) {
    var data = libSnap.data() || {};
    delete data._archiveMeta;
    delete data._quarantineLocked;
    delete data._quarantineLockedAt;
    data.restoredFromJunkAt = restoredAt;
    data.updatedAt = restoredAt;
    data.productLifecycle = 'active';
    data.libraryItemKind = 'product';
    await db.collection('productLibrary').doc(productId).set(data, { merge: false });
    await db.collection('productLibrary_archive').doc(productId).delete();
  }
  if (prodSnap.exists) {
    var row = prodSnap.data() || {};
    delete row._archiveMeta;
    delete row._quarantineLocked;
    delete row._quarantineLockedAt;
    row.restoredFromJunkAt = restoredAt;
    row.updatedAt = restoredAt;
    row.productLifecycle = 'active';
    row.libraryItemKind = 'product';
    await db.collection('products').doc(productId).set(row, { merge: true });
    await db.collection('products_archive').doc(productId).delete();
  }
  console.log('Restored:', productId);
  return true;
}

(async function() {
  console.log('=== Restore mirror', PRODUCT_ID, '===');
  console.log('Mode:', APPLY ? 'APPLY' : 'DRY RUN');
  var ok = await restoreOne(PRODUCT_ID);
  if (!ok) process.exit(1);
  if (!APPLY) console.log('Dry run OK — pass --apply to restore.');
})().catch(function(e) { console.error(e); process.exit(1); });
