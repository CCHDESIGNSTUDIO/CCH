#!/usr/bin/env node
'use strict';
/** DRY RUN — compare products/ vs productLibrary/ (read-only). */
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const KEY = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
const OUT_DIR = path.join(__dirname, '..', '_backup', 'products-library-compare-2026-06-02');

admin.initializeApp({ credential: admin.credential.cert(require(KEY)) });
const db = admin.firestore();

function str(v) {
  return String(v == null ? '' : v).trim();
}
function hasImg(p) {
  p = p || {};
  if (str(p.imageUrl) || str(p.image)) return true;
  var imgs = p.images;
  if (Array.isArray(imgs) && imgs.length) return true;
  return false;
}

async function loadCollection(name) {
  const map = new Map();
  let last = null;
  const batchSize = 500;
  while (true) {
    let q = db.collection(name).orderBy(admin.firestore.FieldPath.documentId()).limit(batchSize);
    if (last) q = q.startAfter(last);
    const snap = await q.get();
    if (!snap.docs.length) break;
    snap.docs.forEach((d) => {
      map.set(d.id, d.data() || {});
    });
    last = snap.docs[snap.docs.length - 1];
    if (snap.docs.length < batchSize) break;
  }
  return map;
}

(async function main() {
  console.log('Loading products/ ...');
  const products = await loadCollection('products');
  console.log('Loading productLibrary/ ...');
  const productLibrary = await loadCollection('productLibrary');

  const allIds = new Set([...products.keys(), ...productLibrary.keys()]);
  const both = [];
  const onlyProducts = [];
  const onlyLib = [];
  let titleMismatch = 0;
  let imageOnlyProducts = 0;
  let imageOnlyLib = 0;
  let imageNeither = 0;
  let imageBoth = 0;

  for (const id of allIds) {
    const p = products.get(id);
    const l = productLibrary.get(id);
    if (p && l) {
      both.push(id);
      const pt = str(p.title || p.name);
      const lt = str(l.title || l.name);
      if (pt && lt && pt.toLowerCase() !== lt.toLowerCase()) titleMismatch++;
      const pi = hasImg(p);
      const li = hasImg(l);
      if (pi && li) imageBoth++;
      else if (pi && !li) imageOnlyProducts++;
      else if (!pi && li) imageOnlyLib++;
      else imageNeither++;
    } else if (p) onlyProducts.push(id);
    else onlyLib.push(id);
  }

  const houzzInProducts = new Map();
  const houzzInLib = new Map();
  products.forEach((d, id) => {
    const h = str(d.houzzId || d.houzzProductId);
    if (h) {
      if (!houzzInProducts.has(h)) houzzInProducts.set(h, []);
      houzzInProducts.get(h).push(id);
    }
  });
  productLibrary.forEach((d, id) => {
    const h = str(d.houzzId || d.houzzProductId);
    if (h) {
      if (!houzzInLib.has(h)) houzzInLib.set(h, []);
      houzzInLib.get(h).push(id);
    }
  });
  let houzzBoth = 0;
  let houzzOnlyP = 0;
  houzzInProducts.forEach((_ids, h) => {
    if (houzzInLib.has(h)) houzzBoth++;
    else houzzOnlyP++;
  });
  let houzzOnlyL = 0;
  houzzInLib.forEach((_ids, h) => {
    if (!houzzInProducts.has(h)) houzzOnlyL++;
  });
  let dupHouzzP = 0;
  let dupHouzzL = 0;
  houzzInProducts.forEach((ids) => { if (ids.length > 1) dupHouzzP++; });
  houzzInLib.forEach((ids) => { if (ids.length > 1) dupHouzzL++; });

  const summary = {
    generatedAt: new Date().toISOString(),
    project: 'cch-design-boards',
    dryRun: true,
    counts: {
      products: products.size,
      productLibrary: productLibrary.size,
      uniqueIdsUnion: allIds.size,
      inBothCollections: both.length,
      onlyInProducts: onlyProducts.length,
      onlyInProductLibrary: onlyLib.length
    },
    pairedRows: {
      titleMismatch: titleMismatch,
      hasImage: { both: imageBoth, onlyProducts: imageOnlyProducts, onlyProductLibrary: imageOnlyLib, neither: imageNeither }
    },
    houzzId: {
      withHouzzIdProducts: houzzInProducts.size,
      withHouzzIdProductLibrary: houzzInLib.size,
      sameHouzzInBothCollections: houzzBoth,
      houzzOnlyInProducts: houzzOnlyP,
      houzzOnlyInProductLibrary: houzzOnlyL,
      duplicateHouzzWithinProducts: dupHouzzP,
      duplicateHouzzWithinProductLibrary: dupHouzzL
    },
    mergedCatalogEstimate: {
      note: 'UI merge is by Firestore doc id, not houzzId — expect up to union count before isRealProduct filter',
      unionDocIds: allIds.size
    },
    samples: {
      onlyProductsFirst20: onlyProducts.slice(0, 20).map((id) => {
        const d = products.get(id);
        return { id, title: str(d.title || d.name).slice(0, 80), hasImage: hasImg(d) };
      }),
      onlyProductLibraryFirst20: onlyLib.slice(0, 20).map((id) => {
        const d = productLibrary.get(id);
        return { id, title: str(d.title || d.name).slice(0, 80), hasImage: hasImg(d) };
      }),
      imageOnlyInProductsFirst15: both.filter((id) => hasImg(products.get(id)) && !hasImg(productLibrary.get(id))).slice(0, 15).map((id) => ({
        id, title: str((products.get(id) || {}).title).slice(0, 60)
      })),
      imageOnlyInProductLibraryFirst15: both.filter((id) => !hasImg(products.get(id)) && hasImg(productLibrary.get(id))).slice(0, 15).map((id) => ({
        id, title: str((productLibrary.get(id) || {}).title).slice(0, 60)
      }))
    }
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const jsonPath = path.join(OUT_DIR, 'COMPARE_products_vs_productLibrary_BY_CLAUDE_2026-06-02.json');
  fs.writeFileSync(jsonPath, JSON.stringify(summary, null, 2), 'utf8');

  console.log('\n=== DRY RUN: products/ vs productLibrary/ (production) ===\n');
  console.log('products/              ', summary.counts.products);
  console.log('productLibrary/        ', summary.counts.productLibrary);
  console.log('Unique ids (union)     ', summary.counts.uniqueIdsUnion);
  console.log('In BOTH collections    ', summary.counts.inBothCollections);
  console.log('ONLY in products/      ', summary.counts.onlyInProducts);
  console.log('ONLY in productLibrary/', summary.counts.onlyInProductLibrary);
  console.log('\nBy houzzId (logical product key):');
  console.log('  With houzzId in products/     ', summary.houzzId.withHouzzIdProducts);
  console.log('  With houzzId in productLibrary/', summary.houzzId.withHouzzIdProductLibrary);
  console.log('  Same houzzId in BOTH          ', summary.houzzId.sameHouzzInBothCollections);
  console.log('  Houzz only in products/       ', summary.houzzId.houzzOnlyInProducts);
  console.log('  Houzz only in productLibrary/ ', summary.houzzId.houzzOnlyInProductLibrary);
  console.log('  Dup houzzId within products/  ', summary.houzzId.duplicateHouzzWithinProducts);
  console.log('  Dup houzzId within productLibrary/', summary.houzzId.duplicateHouzzWithinProductLibrary);
  console.log('\nPaired rows (same Firestore doc id in both):');
  console.log('  Title mismatch       ', summary.pairedRows.titleMismatch);
  console.log('  Image in BOTH        ', summary.pairedRows.hasImage.both);
  console.log('  Image ONLY products/ ', summary.pairedRows.hasImage.onlyProducts);
  console.log('  Image ONLY productLibrary/', summary.pairedRows.hasImage.onlyProductLibrary);
  console.log('  Image in NEITHER     ', summary.pairedRows.hasImage.neither);
  console.log('\nReport:', jsonPath);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
