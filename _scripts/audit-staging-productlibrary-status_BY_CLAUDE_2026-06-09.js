'use strict';
/** READ-ONLY — staging: what happened to productLibrary/ vs products/ after firmwide quarantine. */
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const KEY = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-studio-staging-firebase-adminsdk-fbsvc-b93c6f1cf4.json');
const OUT = path.join(__dirname, '..', '_backup', 'audit-staging-productlibrary-2026-06-09');

const db = admin.initializeApp({ credential: admin.credential.cert(require(KEY)) }, 'stg').firestore();
const str = (v) => String(v == null ? '' : v).trim();
const hz = (o) => str(o && (o.houzzId || o.houzzProductId || o.catalogId));
const cost = (p) => parseFloat(p.costPrice || p.unitCost || p.cost) || 0;

async function loadCol(name) {
  const map = new Map();
  let last = null;
  while (true) {
    let q = db.collection(name).orderBy(admin.firestore.FieldPath.documentId()).limit(500);
    if (last) q = q.startAfter(last);
    const snap = await q.get();
    if (!snap.docs.length) break;
    snap.docs.forEach((d) => map.set(d.id, d.data() || {}));
    last = snap.docs[snap.docs.length - 1];
    if (snap.docs.length < 500) break;
  }
  return map;
}

function groupByHz(rows) {
  const g = {};
  rows.forEach((r) => {
    const h = hz(r);
    if (!h) return;
    (g[h] = g[h] || []).push(r);
  });
  return g;
}

(async () => {
  console.log('Loading STAGING collections...\n');
  const [products, productLibrary, prodArch, libArch] = await Promise.all([
    loadCol('products'), loadCol('productLibrary'), loadCol('products_archive'), loadCol('productLibrary_archive'),
  ]);

  const prodRows = [...products.entries()].map(([id, d]) => Object.assign({ _id: id, _coll: 'products' }, d));
  const libRows = [...productLibrary.entries()].map(([id, d]) => Object.assign({ _id: id, _coll: 'productLibrary' }, d));
  const allActive = prodRows.concat(libRows);

  const hzProd = groupByHz(prodRows);
  const hzLib = groupByHz(libRows);
  const hzAll = groupByHz(allActive);

  let crossCollDupGroups = 0;
  let libOnlyInCrossGroup = 0;
  let prodOnlyInCrossGroup = 0;
  let bothInCrossGroup = 0;
  const crossSamples = [];

  Object.entries(hzAll).forEach(([h, rows]) => {
    if (rows.length < 2) return;
    const hasP = rows.some((r) => r._coll === 'products');
    const hasL = rows.some((r) => r._coll === 'productLibrary');
    if (!hasP || !hasL) return;
    crossCollDupGroups++;
    const libs = rows.filter((r) => r._coll === 'productLibrary');
    const prods = rows.filter((r) => r._coll === 'products');
    libOnlyInCrossGroup += libs.length;
    prodOnlyInCrossGroup += prods.length;
    bothInCrossGroup++;
    if (crossSamples.length < 8) {
      crossSamples.push({
        houzzId: h,
        products: prods.map((r) => ({ id: r._id, title: str(r.title || r.name).slice(0, 40), cost: cost(r) })),
        productLibrary: libs.map((r) => ({ id: r._id, title: str(r.title || r.name).slice(0, 40), cost: cost(r) })),
      });
    }
  });

  let dupWithinLib = 0;
  Object.values(hzLib).forEach((rows) => { if (rows.length > 1) dupWithinLib += rows.length - 1; });

  let hzOnlyLib = 0;
  Object.keys(hzLib).forEach((h) => { if (!hzProd[h]) hzOnlyLib++; });

  const quarantinedFromProducts = [...prodArch.values()].filter((d) =>
    d._archiveMeta && d._archiveMeta.sourceCollection === 'products').length;

  const summary = {
    generatedAt: new Date().toISOString(),
    project: 'cch-studio-staging',
    activeCounts: {
      products: products.size,
      productLibrary: productLibrary.size,
      unionDocIds: new Set([...products.keys(), ...productLibrary.keys()]).size,
      sameDocIdInBoth: [...products.keys()].filter((id) => productLibrary.has(id)).length,
    },
    archiveCounts: { products_archive: prodArch.size, productLibrary_archive: libArch.size },
    firmwideQuarantineNote: 'dedup-products-firmwide-staging only moved products/ → products_archive; productLibrary/ untouched',
    quarantinedProductsArchiveWithMeta: quarantinedFromProducts,
    houzzCrossCollection: {
      groupsWithRowsInBothCollections: crossCollDupGroups,
      extraProductLibraryRowsInThoseGroups: libOnlyInCrossGroup,
      extraProductsRowsInThoseGroups: prodOnlyInCrossGroup,
      samples: crossSamples,
    },
    productLibraryOnly: {
      houzzIdsOnlyInProductLibraryNotInActiveProducts: hzOnlyLib,
      duplicateRowsWithinProductLibraryByHouzz: dupWithinLib,
    },
    dorchester: (() => {
      const d = allActive.filter((r) => /dorchester/i.test(str(r.title || r.name)));
      return d.map((r) => ({
        coll: r._coll, id: r._id, hz: hz(r), cost: cost(r), vendor: str(r.vendor), title: str(r.title || r.name).slice(0, 50),
      }));
    })(),
  };

  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'STAGING_productLibrary_status.json'), JSON.stringify(summary, null, 2));

  console.log('=== STAGING — productLibrary/ status after firmwide quarantine ===\n');
  console.log('ACTIVE');
  console.log('  products/           ', products.size);
  console.log('  productLibrary/     ', productLibrary.size, '  ← NOT touched by firmwide quarantine');
  console.log('  union doc ids (UI)  ', summary.activeCounts.unionDocIds);
  console.log('  same id in both     ', summary.activeCounts.sameDocIdInBoth);
  console.log('\nARCHIVE (Junk)');
  console.log('  products_archive/   ', prodArch.size, ' (firmwide quarantine moved ~2980 here)');
  console.log('  productLibrary_archive/', libArch.size);
  console.log('\nCROSS-COLLECTION DUPES (same Houzz id, rows in BOTH active collections)');
  console.log('  Houzz groups        ', crossCollDupGroups);
  console.log('  productLibrary rows in those groups:', libOnlyInCrossGroup);
  console.log('  products rows in those groups:     ', prodOnlyInCrossGroup);
  console.log('\nproductLibrary/ ONLY (no matching Houzz in active products/)');
  console.log('  Houzz ids only in productLibrary/', hzOnlyLib);
  console.log('  Within-lib dup rows (by Houzz)   ', dupWithinLib);
  console.log('\nDorchester active rows:', summary.dorchester.length);
  summary.dorchester.forEach((r) => console.log(' ', r.coll.padEnd(15), r.id, 'hz', r.hz || '-', '$' + r.cost, r.title));
  console.log('\nReport:', path.join(OUT, 'STAGING_productLibrary_status.json'));
})().catch((e) => { console.error(e); process.exit(1); });
