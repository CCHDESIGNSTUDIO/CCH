/**
 * READ-ONLY comparison: staging vs production Product Library.
 * Purpose: find products that exist on STAGING but are MISSING from PRODUCTION's active
 * catalog (the items the June 4 quarantine likely removed), and report how many are
 * recoverable from prod's *_archive vs truly gone.
 *
 * SAFETY: This script ONLY reads (.get()). It performs ZERO writes to either database.
 * Run:  node _scripts/compare-staging-vs-prod-library_BY_CLAUDE_2026-06-07.js
 */
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const KEY_DIR = path.join(__dirname, '..', '_debug', 'service-account.json');
const prodKey = require(path.join(KEY_DIR, 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json'));
const stagingKey = require(path.join(KEY_DIR, 'cch-studio-staging-firebase-adminsdk-fbsvc-b93c6f1cf4.json'));

const prodApp = admin.initializeApp({ credential: admin.credential.cert(prodKey) }, 'prod');
const stagingApp = admin.initializeApp({ credential: admin.credential.cert(stagingKey) }, 'staging');
const prodDb = prodApp.firestore();
const stagingDb = stagingApp.firestore();

async function readColl(db, name) {
  const map = new Map();
  const snap = await db.collection(name).get();
  snap.forEach((d) => map.set(d.id, d.data() || {}));
  return map;
}

function row(id, data, inArchive) {
  return {
    id,
    title: data.title || data.name || '',
    vendor: data.vendor || data.manufacturer || '',
    sku: data.sku || '',
    houzzId: String(data.houzzId || data.houzzProductId || data.catalogId || ''),
    productCode: String(data.productCode || ''),
    inProdArchive: inArchive,
  };
}

function diff(stgMap, prodActive, prodArchive) {
  const missing = [];
  for (const [id, data] of stgMap) {
    if (!prodActive.has(id)) missing.push(row(id, data, prodArchive.has(id)));
  }
  return missing;
}

function summarize(missing) {
  return {
    total: missing.length,
    recoverableFromProdArchive: missing.filter((m) => m.inProdArchive).length,
    trulyGone: missing.filter((m) => !m.inProdArchive).length,
    vendorElu: missing.filter((m) => /elu/i.test(m.vendor)).length,
    noHouzzId: missing.filter((m) => !m.houzzId).length,
    noProductCode: missing.filter((m) => !m.productCode).length,
  };
}

(async () => {
  console.log('Reading PRODUCTION (read-only)...');
  const prodProducts = await readColl(prodDb, 'products');
  const prodLibrary = await readColl(prodDb, 'productLibrary');
  const prodProductsArchive = await readColl(prodDb, 'products_archive');
  const prodLibraryArchive = await readColl(prodDb, 'productLibrary_archive');

  console.log('Reading STAGING (read-only)...');
  const stgProducts = await readColl(stagingDb, 'products');
  const stgLibrary = await readColl(stagingDb, 'productLibrary');

  const missingProducts = diff(stgProducts, prodProducts, prodProductsArchive);
  const missingLibrary = diff(stgLibrary, prodLibrary, prodLibraryArchive);

  const report = {
    date: '2026-06-07',
    note: 'READ-ONLY compare. ZERO writes to either database.',
    counts: {
      prod: {
        products: prodProducts.size,
        productLibrary: prodLibrary.size,
        products_archive: prodProductsArchive.size,
        productLibrary_archive: prodLibraryArchive.size,
      },
      staging: { products: stgProducts.size, productLibrary: stgLibrary.size },
    },
    productsMissingFromProdActive: summarize(missingProducts),
    libraryMissingFromProdActive: summarize(missingLibrary),
    sampleMissingProducts: missingProducts.slice(0, 50),
    sampleMissingLibrary: missingLibrary.slice(0, 50),
    fullMissingProducts: missingProducts,
    fullMissingLibrary: missingLibrary,
  };

  const outDir = path.join(__dirname, '..', '_backup', 'compare-staging-vs-prod-2026-06-07');
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, 'COMPARE_staging_vs_prod_library_BY_CLAUDE_2026-06-07.json');
  fs.writeFileSync(outFile, JSON.stringify(report, null, 2));

  console.log('\n===== READ-ONLY COMPARE: staging vs production =====');
  console.log('PROD    products:', prodProducts.size, '| productLibrary:', prodLibrary.size,
    '| products_archive:', prodProductsArchive.size, '| productLibrary_archive:', prodLibraryArchive.size);
  console.log('STAGING products:', stgProducts.size, '| productLibrary:', stgLibrary.size);
  console.log('\nproducts/ on staging but MISSING from prod active:', JSON.stringify(summarize(missingProducts)));
  console.log('productLibrary/ on staging but MISSING from prod active:', JSON.stringify(summarize(missingLibrary)));
  console.log('\nFull report:', outFile);
  process.exit(0);
})().catch((e) => { console.error('ERROR', e); process.exit(1); });
