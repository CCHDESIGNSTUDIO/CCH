#!/usr/bin/env node
'use strict';
/**
 * DRY RUN — Storage houzz-products/{houzzId}/* vs Firestore imageUrl / images[].
 * Finds rows where multiple photos exist in Storage but Firestore only has one (or none).
 *
 * Usage (from cch-deploy/):
 *   node _scripts/dry-run-houzz-gallery-gap_BY_CLAUDE_2026-06-02.js
 *   node _scripts/dry-run-houzz-gallery-gap_BY_CLAUDE_2026-06-02.js --csv
 */
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const WRITE_CSV = process.argv.includes('--csv');
const KEY = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
const OUT_DIR = path.join(__dirname, '..', '_backup', 'houzz-gallery-gap-dryrun-2026-06-02');
const BUCKET = 'cch-design-boards.firebasestorage.app';

admin.initializeApp({
  credential: admin.credential.cert(require(KEY)),
  storageBucket: BUCKET,
});
const db = admin.firestore();
const bucket = admin.storage().bucket();

function str(v) {
  return String(v == null ? '' : v).trim();
}

function extractHouzzId(obj) {
  return str(obj && (obj.houzzId || obj.houzzProductId || obj.houzzProduct || obj.catalogId));
}

function urlReferencesHouzzFolder(url, hid) {
  const u = str(url).toLowerCase();
  const h = str(hid);
  if (!u || !h) return false;
  return u.includes(`houzz-products%2f${h.toLowerCase()}%2f`) ||
    u.includes(`houzz-products/${h}/`) ||
    u.includes(`houzz-products%2F${h}%2F`);
}

function collectFirestoreUrlsForHouzz(doc, hid) {
  const urls = new Set();
  const slots = new Set();
  function consider(raw) {
    const u = str(typeof raw === 'string' ? raw : (raw && (raw.url || raw.imageUrl || raw.src)));
    if (!u || !urlReferencesHouzzFolder(u, hid)) return;
    urls.add(u);
    const m = u.match(/%2f(\d+)\.(jpe?g|png|webp|gif)/i) || u.match(/\/(\d+)\.(jpe?g|png|webp|gif)/i);
    if (m) slots.add(m[1]);
  }
  if (!doc) return { urls, slots, urlCount: 0, slotCount: 0 };
  consider(doc.imageUrl);
  consider(doc.image);
  const arrKeys = ['images', 'imageUrls', 'gallery', 'photos', 'photoUrls', 'productPhotos'];
  arrKeys.forEach((k) => {
    const v = doc[k];
    if (Array.isArray(v)) v.forEach(consider);
    else if (v && typeof v === 'object') Object.values(v).forEach(consider);
  });
  return { urls, slots, urlCount: urls.size, slotCount: slots.size };
}

function coerceImagesCount(doc) {
  if (!doc) return 0;
  let n = 0;
  const seen = new Set();
  function add(u) {
    u = str(u).toLowerCase();
    if (!u || seen.has(u)) return;
    seen.add(u);
    n++;
  }
  add(doc.imageUrl);
  add(doc.image);
  ['images', 'imageUrls', 'gallery', 'photos'].forEach((k) => {
    const v = doc[k];
    if (!Array.isArray(v)) return;
    v.forEach((x) => add(typeof x === 'string' ? x : (x && (x.url || x.imageUrl || x.src))));
  });
  return n;
}

async function loadCollection(name) {
  const map = new Map();
  let last = null;
  while (true) {
    let q = db.collection(name).orderBy(admin.firestore.FieldPath.documentId()).limit(500);
    if (last) q = q.startAfter(last);
    const snap = await q.get();
    if (!snap.docs.length) break;
    snap.docs.forEach((d) => {
      map.set(d.id, Object.assign({ id: d.id, _collection: name }, d.data() || {}));
    });
    last = snap.docs[snap.docs.length - 1];
    if (snap.docs.length < 500) break;
  }
  return map;
}

async function listHouzzStorageFolders() {
  const byHid = new Map();
  let pageToken;
  let totalFiles = 0;
  process.stdout.write('Listing Storage houzz-products/ ...');
  do {
    const opts = { prefix: 'houzz-products/', maxResults: 1000 };
    if (pageToken) opts.pageToken = pageToken;
    const [files, , apiResponse] = await bucket.getFiles(opts);
    for (const file of files) {
      const parts = file.name.split('/');
      if (parts.length < 3) continue;
      const hid = parts[1];
      if (!/^\d{4,}$/.test(hid)) continue;
      const base = parts[parts.length - 1];
      if (!/\.(jpe?g|png|webp|gif)$/i.test(base)) continue;
      if (!byHid.has(hid)) byHid.set(hid, []);
      byHid.get(hid).push(base);
      totalFiles++;
    }
    pageToken = apiResponse && apiResponse.nextPageToken;
    process.stdout.write('.');
  } while (pageToken);
  console.log(' done (' + totalFiles + ' image files, ' + byHid.size + ' houzzIds)');
  byHid.forEach((files, hid) => {
    files.sort((a, b) => {
      const na = parseInt(a, 10);
      const nb = parseInt(b, 10);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      return a.localeCompare(b);
    });
  });
  return { byHid, totalFiles };
}

function buildHouzzDocIndex(products, productLibrary) {
  const byHouzz = new Map();
  function ingest(row) {
    const hid = extractHouzzId(row);
    if (!hid || !/^\d{4,}$/.test(hid)) return;
    if (!byHouzz.has(hid)) byHouzz.set(hid, []);
    byHouzz.get(hid).push(row);
  }
  products.forEach(ingest);
  productLibrary.forEach(ingest);
  return byHouzz;
}

function pickBestDoc(rows, hid) {
  if (!rows || !rows.length) return null;
  let best = rows[0];
  let bestScore = -1;
  rows.forEach((r) => {
    const fs = collectFirestoreUrlsForHouzz(r, hid);
    let score = fs.urlCount * 10 + coerceImagesCount(r);
    if (r._collection === 'products') score += 2;
    if (score > bestScore) { bestScore = score; best = r; }
  });
  return best;
}

function csvEscape(v) {
  const s = String(v == null ? '' : v);
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

(async function main() {
  const [products, productLibrary, storage] = await Promise.all([
    loadCollection('products'),
    loadCollection('productLibrary'),
    listHouzzStorageFolders(),
  ]);
  const byHouzz = buildHouzzDocIndex(products, productLibrary);
  const { byHid: storageByHid, totalFiles } = storage;

  const multiStorage = [];
  storageByHid.forEach((files, hid) => {
    if (files.length >= 2) multiStorage.push({ hid, storageFileCount: files.length, storageFiles: files });
  });

  const gaps = [];
  let noFirestore = 0;
  let oneUrlOnly = 0;
  let partialGallery = 0;
  let fullLinked = 0;
  let storageSingleOnly = 0;

  storageByHid.forEach((files, hid) => {
    if (files.length < 2) { storageSingleOnly++; return; }
    const docs = byHouzz.get(hid) || [];
    if (!docs.length) {
      noFirestore++;
      gaps.push({
        houzzId: hid,
        category: 'storage_only_no_firestore',
        storageFileCount: files.length,
        storageSlots: files.join(', '),
        firestoreDocCount: 0,
        firestoreHouzzUrlCount: 0,
        firestoreTotalImageCount: 0,
        gap: files.length,
        sampleTitle: '',
        sampleDocId: '',
        sampleCollection: '',
      });
      return;
    }
    const best = pickBestDoc(docs, hid);
    const fsH = collectFirestoreUrlsForHouzz(best, hid);
    const totalImg = coerceImagesCount(best);
    const gap = files.length - fsH.urlCount;
    let category;
    if (fsH.urlCount <= 1 && files.length >= 2) {
      category = 'underlinked_one_or_zero_urls';
      oneUrlOnly++;
    } else if (fsH.urlCount < files.length) {
      category = 'partial_gallery';
      partialGallery++;
    } else {
      category = 'fully_linked';
      fullLinked++;
    }
    if (category !== 'fully_linked') {
      gaps.push({
        houzzId: hid,
        category,
        storageFileCount: files.length,
        storageSlots: files.join(', '),
        firestoreDocCount: docs.length,
        firestoreHouzzUrlCount: fsH.urlCount,
        firestoreTotalImageCount: totalImg,
        gap,
        sampleTitle: str(best.title || best.name).slice(0, 100),
        sampleDocId: best.id,
        sampleCollection: best._collection,
        duplicateDocIds: docs.length > 1 ? docs.map((d) => d.id + '@' + d._collection).join('; ') : '',
      });
    }
  });

  gaps.sort((a, b) => b.gap - a.gap || b.storageFileCount - a.storageFileCount);

  const firestoreWithHouzz = byHouzz.size;
  let firestoreMultiDoc = 0;
  byHouzz.forEach((rows) => { if (rows.length > 1) firestoreMultiDoc++; });

  const summary = {
    generatedAt: new Date().toISOString(),
    project: 'cch-design-boards',
    dryRun: true,
    storage: {
      totalImageFiles: totalFiles,
      uniqueHouzzFolders: storageByHid.size,
      foldersWith2PlusImages: multiStorage.length,
      foldersWithOnly1Image: storageSingleOnly,
    },
    firestore: {
      productsRows: products.size,
      productLibraryRows: productLibrary.size,
      uniqueHouzzIdsInEitherCollection: firestoreWithHouzz,
      houzzIdsWithMultipleFirestoreDocs: firestoreMultiDoc,
    },
    gaps: {
      underlinkedTotal: gaps.length,
      storageMultiNoFirestoreRow: noFirestore,
      storageMultiOneOrZeroHouzzUrls: oneUrlOnly,
      storageMultiPartialGallery: partialGallery,
      storageMultiFullyLinked: fullLinked,
      estimatedOrphanStorageUrls: gaps.reduce((s, g) => s + Math.max(0, g.gap), 0),
    },
    samples: {
      top20ByGap: gaps.slice(0, 20),
    },
    rows: gaps,
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const jsonPath = path.join(OUT_DIR, 'HOUZZ_GALLERY_GAP_DRYRUN_BY_CLAUDE_2026-06-02.json');
  fs.writeFileSync(jsonPath, JSON.stringify(summary, null, 2), 'utf8');

  let csvPath = '';
  if (WRITE_CSV || true) {
    csvPath = path.join(OUT_DIR, 'HOUZZ_GALLERY_GAP_DRYRUN_BY_CLAUDE_2026-06-02.csv');
    const header = [
      'houzzId', 'category', 'storageFileCount', 'storageSlots',
      'firestoreDocCount', 'firestoreHouzzUrlCount', 'firestoreTotalImageCount', 'gap',
      'sampleTitle', 'sampleDocId', 'sampleCollection', 'duplicateDocIds'
    ];
    const lines = [header.join(',')];
    gaps.forEach((g) => {
      lines.push(header.map((h) => csvEscape(g[h])).join(','));
    });
    fs.writeFileSync(csvPath, lines.join('\n'), 'utf8');
  }

  console.log('\n=== DRY RUN: Houzz Storage gallery vs Firestore (read-only) ===\n');
  console.log('Storage houzz-products/');
  console.log('  Total image files:           ', totalFiles);
  console.log('  Unique houzzId folders:      ', storageByHid.size);
  console.log('  Folders with 2+ images:      ', multiStorage.length);
  console.log('');
  console.log('Firestore (products + productLibrary)');
  console.log('  Unique houzzIds:             ', firestoreWithHouzz);
  console.log('  Same houzzId, multiple docs: ', firestoreMultiDoc);
  console.log('');
  console.log('Gaps (Storage has 2+ photos but Firestore missing some):');
  console.log('  Total gap cases:             ', gaps.length);
  console.log('  Storage only (no houzzId row):', noFirestore);
  console.log('  Has row, ≤1 houzz URL linked:', oneUrlOnly);
  console.log('  Partial (some slots linked): ', partialGallery);
  console.log('  Fully linked (OK):           ', fullLinked);
  console.log('  Est. orphan Storage slots:   ', summary.gaps.estimatedOrphanStorageUrls);
  console.log('\nJSON:', jsonPath);
  console.log('CSV: ', csvPath);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
