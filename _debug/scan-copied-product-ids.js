#!/usr/bin/env node
/** Scan prod products/productLibrary for doc ids or fields starting with "copied" */
'use strict';
const path = require('path');
const admin = require('firebase-admin');
const key = path.join(__dirname, 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
admin.initializeApp({ credential: admin.credential.cert(require(key)) });
const db = admin.firestore();

function scanColl(name) {
  return db.collection(name).get().then((snap) => {
    const idPrefix = [];
    const titlePrefix = [];
    const skuPrefix = [];
    const fieldHits = [];
    snap.forEach((d) => {
      const id = d.id;
      const p = d.data() || {};
      if (/^copied/i.test(id)) idPrefix.push({ id, title: p.title, houzzId: p.houzzId, libraryProductId: p.libraryProductId });
      if (/^copied/i.test(String(p.title || ''))) titlePrefix.push({ id, title: p.title });
      if (/^copied/i.test(String(p.sku || p.lineCode || ''))) skuPrefix.push({ id, sku: p.sku, lineCode: p.lineCode, title: p.title });
      ['studioProductId', 'lineCode', 'itemCode', 'libraryProductId', 'sourceProductId', 'copiedFromId'].forEach((f) => {
        const v = String(p[f] || '').trim();
        if (/^copied/i.test(v)) fieldHits.push({ id, field: f, value: v, title: p.title });
      });
    });
    console.log('\n===', name, 'total', snap.size, '===');
    console.log('  doc id starts with copied:', idPrefix.length);
    idPrefix.slice(0, 15).forEach((x) => console.log('   ', JSON.stringify(x)));
    console.log('  title starts with copied:', titlePrefix.length);
    titlePrefix.slice(0, 10).forEach((x) => console.log('   ', JSON.stringify(x)));
    console.log('  sku/lineCode starts with copied:', skuPrefix.length);
    skuPrefix.slice(0, 10).forEach((x) => console.log('   ', JSON.stringify(x)));
    console.log('  field value starts with copied:', fieldHits.length);
    fieldHits.slice(0, 15).forEach((x) => console.log('   ', JSON.stringify(x)));
    return { idPrefix, titlePrefix, skuPrefix, fieldHits };
  });
}

(async () => {
  const a = await scanColl('products');
  const b = await scanColl('productLibrary');
  console.log('\n=== SUMMARY ===');
  console.log('products copied-id:', a.idPrefix.length);
  console.log('productLibrary copied-id:', b.idPrefix.length);
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
