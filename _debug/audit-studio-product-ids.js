#!/usr/bin/env node
/** Read-only: where Studio product IDs live (productLibrary + products + holtz clips) */
const path = require('path');
const admin = require('firebase-admin');
const KEY = path.join(__dirname, 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
admin.initializeApp({ credential: admin.credential.cert(require(KEY)) });
const db = admin.firestore();

function countFields(docs) {
  const fc = {};
  const populated = {};
  docs.forEach((d) => {
    Object.keys(d).forEach((k) => {
      fc[k] = (fc[k] || 0) + 1;
      const v = d[k];
      if (v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && !v.length)) {
        populated[k] = (populated[k] || 0) + 1;
      }
    });
  });
  return { fc, populated, n: docs.length };
}

function sampleWith(docs, pred, n) {
  return docs.filter(pred).slice(0, n);
}

(async () => {
  const pl = [];
  const snapPL = await db.collection('productLibrary').limit(8000).get();
  snapPL.forEach((d) => pl.push({ _id: d.id, ...d.data() }));

  const prods = [];
  const snapP = await db.collection('products').limit(8000).get();
  snapP.forEach((d) => prods.push({ _id: d.id, ...d.data() }));

  for (const [label, docs] of [
    ['productLibrary', pl],
    ['products', prods],
  ]) {
    const { populated, n } = countFields(docs);
    console.log('\n===', label, 'docs:', n, '===');
    const idFields = Object.keys(populated).filter((k) =>
      /lineCode|line_code|studioProduct|libraryProduct|houzz|sku|itemCode|productId|catalog/i.test(k),
    );
    idFields.sort((a, b) => populated[b] - populated[a]);
    idFields.forEach((k) => console.log(' ', k + ':', populated[k]));

    const lSku = docs.filter((d) => /^L\d+$/i.test(String(d.sku || d.lineCode || d.itemCode || '').trim()));
    console.log('  L#### in sku/lineCode/itemCode:', lSku.length);
    if (lSku[0]) {
      console.log('  sample:', {
        _id: lSku[0]._id,
        title: lSku[0].title,
        sku: lSku[0].sku,
        lineCode: lSku[0].lineCode,
        houzzId: lSku[0].houzzId,
        libraryProductId: lSku[0].libraryProductId,
      });
    }
  }

  const holtz = await db.collection('boards').doc('holtz-hill').collection('clips').get();
  let clipLib = 0;
  let clipHouzz = 0;
  let clipSkuL = 0;
  let clipAnyId = 0;
  holtz.forEach((d) => {
    const x = d.data();
    const has =
      String(x.libraryProductId || x.linkedLibraryProductId || '').trim() ||
      String(x.houzzId || '').trim() ||
      /^L\d+$/i.test(String(x.sku || x.lineCode || x.itemCode || '').trim());
    if (x.libraryProductId || x.linkedLibraryProductId) clipLib++;
    if (x.houzzId) clipHouzz++;
    if (/^L\d+$/i.test(String(x.sku || x.lineCode || x.itemCode || '').trim())) clipSkuL++;
    if (has) clipAnyId++;
  });
  console.log('\n=== holtz-hill clips', holtz.size, '===');
  console.log('  libraryProductId:', clipLib);
  console.log('  houzzId:', clipHouzz);
  console.log('  L#### sku/lineCode:', clipSkuL);
  console.log('  any of above:', clipAnyId);

  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
