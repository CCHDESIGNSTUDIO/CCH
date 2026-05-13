/**
 * 7225 Bugletrail — SAFE sequenced dry-run (staging, read-only).
 *
 * Rules (per Grok / Cynthia):
 * - NEVER update targets tied to protected sources: cch-studio-clipper, clipper, manual,
 *   ideabook-asset (and same on linked /products doc).
 * - Only rows that are Houzz-legacy eligible (houzzId, Houzz URL clip, Houzz-ish product source,
 *   or matched library product is Houzz-backed and not protected).
 * - Sequence reporting: clips → invoices/POs → room entries (dry-run order matches execution order).
 * - Match: houzzId, then name+vendor, then name-only (same normalization as bugletrail-houzz-dryrun).
 * - Fill-empty-or-outdated fields only (see PREVIEW_FIELDS + imageUrl rules).
 *
 * NO WRITES.
 *
 * Usage (from cch-deploy):
 *   set NODE_PATH=_debug/node_modules   (or pass via env)
 *   node _debug/bugletrail-safe-sequenced-dryrun.js > _debug/bugletrail-safe-sequenced-dryrun.json
 */
const fs = require('fs');
const path = require('path');
const { initializeApp } = require('firebase/app');
const {
  getFirestore,
  collection,
  getDocs,
  doc,
  getDoc,
} = require('firebase/firestore');

const STAGING = {
  apiKey: 'AIzaSyBIwwo7uRij6Q0FZg-qmIS1LC8t2AjXrYo',
  authDomain: 'cch-studio-staging.firebaseapp.com',
  projectId: 'cch-studio-staging',
  storageBucket: 'cch-studio-staging.firebasestorage.app',
  messagingSenderId: '210388013080',
  appId: '1:210388013080:web:fcd520b30c0d50b149736d',
};

const BOARD_ID = '7225-bugletrail';
const PROTECTED_SOURCES = new Set([
  'cch-studio-clipper',
  'clipper',
  'manual',
  'ideabook-asset',
]);

const PREVIEW_FIELDS = [
  'imageUrl',
  'description',
  'vendorDescription',
  'dimensions',
  'materials',
  'finish',
  'manufacturer',
  'vendorUrl',
];

const GENERIC_PLACEHOLDERS = new Set([
  '',
  '-',
  '--',
  'n/a',
  'na',
  'none',
  'unknown',
  'tbd',
]);

function norm(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s-]/g, '');
}

function firstNonEmpty(obj, keys) {
  for (const k of keys) {
    const v = obj ? obj[k] : undefined;
    if (v !== undefined && v !== null && String(v).trim() !== '') return v;
  }
  return '';
}

function isAwsExpiring(url) {
  const u = String(url || '').trim();
  if (!u) return true;
  return /ivy-(prod|uploads)\.s3/i.test(u) || (/amazonaws\.com/i.test(u) && /X-Amz-/i.test(u));
}

function isLikelyLowResLegacyClipImage(url) {
  const u = String(url || '').trim();
  if (!u) return false;
  // Legacy per-clip captures commonly stored under projects/*/clips/*.jpeg and are often low-res.
  if (/\/projects%2F[^/]+%2Fclips%2F/i.test(u) && /\.jpe?g(\?|$)/i.test(u)) return true;
  // Older Houzz thumb patterns (small variants) are treated as outdated for image refresh.
  if (/houzz\.com/i.test(u) && /(w\d+-h\d+|_t\.jpg|_xs\.|_small\.|\/thumbs\/)/i.test(u)) return true;
  return false;
}

function isClearlyOutdated(field, currentValue, productValue) {
  const cur = String(currentValue || '').trim();
  const prod = String(productValue || '').trim();
  if (!prod) return false;
  if (!cur) return false;

  if (field === 'imageUrl') {
    if (cur === prod) return false;
    if (isAwsExpiring(cur)) return true;
    if (isLikelyLowResLegacyClipImage(cur)) return true;
    return false;
  }

  const curNorm = norm(cur);
  if (GENERIC_PLACEHOLDERS.has(curNorm)) return true;
  return false;
}

function productName(p) {
  return firstNonEmpty(p, ['title', 'name', 'productName', 'itemName']);
}

function productVendor(p) {
  return firstNonEmpty(p, ['vendor', 'manufacturer', 'brand', 'supplier', 'vendorName']);
}

function itemName(item) {
  return firstNonEmpty(item, ['title', 'name', 'productName', 'itemName', 'description']);
}

function itemVendor(item) {
  return firstNonEmpty(item, ['vendor', 'manufacturer', 'brand', 'supplier', 'vendorName']);
}

function makeNameVendorKey(name, vendor) {
  const n = norm(name);
  const v = norm(vendor);
  if (!n || !v) return '';
  return `${n}__${v}`;
}

function skuNorm(v) {
  return String(v || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function tokenSignature(v) {
  const words = norm(v)
    .split(' ')
    .map((w) => w.trim())
    .filter((w) => w && w.length > 2);
  if (!words.length) return '';
  return words.slice(0, 4).join(' ');
}

function toSerializableId(v) {
  if (v === undefined || v === null) return '';
  return String(v);
}

/** Clipper / non-Houzz library pathways — never treat as Houzz legacy for refresh */
function isDisallowedProductSource(source) {
  const t = String(source || '').trim();
  if (PROTECTED_SOURCES.has(t)) return true;
  if (t === 'clip-sync') return true;
  return false;
}

/** Houzz-era catalog / import tags on /products (empty allowed when paired with houzzId at caller) */
function isHouzzishProductSource(source) {
  const t = String(source || '').trim();
  if (!t) return true;
  if (/houzz/i.test(t)) return true;
  if (t === 'ffe-import' || t === 'new-houzz' || t === 'houzz-catalog-apr27') return true;
  if (t === 'cloud-rolling-hills') return true;
  return false;
}

/** Linked library id on clips / some line items */
function linkedLibraryProductId(item) {
  return String(
    firstNonEmpty(item, [
      'libraryProductId',
      'libraryId',
      'productId',
      'studioProductId',
      'library_product_id',
    ]) || ''
  ).trim();
}

/**
 * Row may receive Houzz-library refresh data.
 * matchedProduct: /products doc matched by houzzId / name+vendor / name (catalog row in Studio).
 * linkedProduct: /products doc from libraryProductId on the row (if any).
 */
function isHouzzLegacyEligible(item, linkedProduct, matchedProduct) {
  if (isDisallowedProductSource(item.source)) return false;
  if (linkedProduct && isDisallowedProductSource(linkedProduct.source)) return false;

  const itemHouzz = String(item.houzzId || '').trim();
  if (itemHouzz) return true;

  const urlBlob = [item.clippedFromUrl, item.url, item.sourceUrl, item.productUrl]
    .filter(Boolean)
    .join(' ');
  if (/houzz\.com/i.test(urlBlob)) return true;
  // Row-level source: must be an explicit Houzz-era tag (not "anything with houzz substring" alone)
  const rowSrc = String(item.source || '').trim();
  if (rowSrc && isHouzzishProductSource(rowSrc)) return true;

  const lib = linkedProduct;
  if (
    lib &&
    String(lib.houzzId || '').trim() &&
    !isDisallowedProductSource(lib.source) &&
    isHouzzishProductSource(lib.source)
  ) {
    return true;
  }

  const m = matchedProduct;
  if (
    m &&
    String(m.houzzId || '').trim() &&
    !isDisallowedProductSource(m.source) &&
    isHouzzishProductSource(m.source)
  ) {
    return true;
  }

  return false;
}

function buildFieldPatchPreview(target, matchedProduct) {
  const changes = [];
  for (const f of PREVIEW_FIELDS) {
    const cur = String(target[f] || '').trim();
    const next = String(matchedProduct[f] || '').trim();
    if (!next) continue;
    if (!cur) {
      changes.push({ field: f, reason: 'empty', from: cur, to: next });
      continue;
    }
    if (isClearlyOutdated(f, cur, next)) {
      changes.push({ field: f, reason: 'outdated', from: cur, to: next });
    }
  }
  return changes;
}

function matchItemToProduct(item, linkedProduct, byHouzzId, bySku, byNameVendor, byNameOnly, byTokenSig) {
  if (linkedProduct) {
    return { method: 'libraryProductId', product: linkedProduct, keyUsed: linkedProduct.id };
  }
  const houzzId = String(item.houzzId || '').trim();
  if (houzzId && byHouzzId.has(houzzId)) {
    return { method: 'houzzId', product: byHouzzId.get(houzzId), keyUsed: houzzId };
  }
  const sku = skuNorm(firstNonEmpty(item, ['sku', 'itemSku', 'productSku']));
  if (sku && bySku.has(sku)) {
    return { method: 'sku', product: bySku.get(sku), keyUsed: sku };
  }
  const nvKey = makeNameVendorKey(itemName(item), itemVendor(item));
  if (nvKey && byNameVendor.has(nvKey)) {
    return { method: 'name+vendor', product: byNameVendor.get(nvKey), keyUsed: nvKey };
  }
  const nOnly = norm(itemName(item));
  if (nOnly && byNameOnly.has(nOnly)) {
    return { method: 'name-only', product: byNameOnly.get(nOnly), keyUsed: nOnly };
  }
  const sig = tokenSignature(itemName(item));
  if (sig && byTokenSig.has(sig)) {
    return { method: 'name-token', product: byTokenSig.get(sig), keyUsed: sig };
  }
  return null;
}

async function fetchSubcollectionDocs(db, boardId, sub) {
  const snap = await getDocs(collection(db, 'boards', boardId, sub));
  const docs = [];
  snap.forEach((d) => docs.push({ id: d.id, ...d.data() }));
  return docs;
}

function pickDasoMauraExamples(rows) {
  const re = /daso|maura|bowl|vase/i;
  return rows.filter((r) => re.test(`${r.itemName || ''} ${r.itemVendor || ''} ${r.matchedProductName || ''}`));
}

async function main() {
  const app = initializeApp(STAGING);
  const db = getFirestore(app);

  const safetyStats = {
    skippedProtectedSource: 0,
    skippedNotHouzzLegacy: 0,
    skippedNoMatch: 0,
    skippedNoFieldChanges: 0,
    appliedPreviews: 0,
  };

  const report = {
    script: 'bugletrail-safe-sequenced-dryrun.js',
    timestamp: new Date().toISOString(),
    environment: 'staging',
    boardId: BOARD_ID,
    rules: {
      protectedSources: [...PROTECTED_SOURCES],
      alsoDisallowedProductSources: ['clip-sync'],
      houzzLibrarySourceAllowlist: 'blank, *houzz*, ffe-import, new-houzz, houzz-catalog-apr27, cloud-rolling-hills',
      houzzLegacyEligibility: 'See isHouzzLegacyEligible() + isHouzzishProductSource() in script.',
      sequence: ['clips', 'invoices', 'purchaseOrders', 'roomEntries'],
    },
    safetyStats,
    matchingSummary: {
      totalCandidateItems: 0,
      matchedByLibraryProductId: 0,
      matchedByHouzzId: 0,
      matchedBySku: 0,
      matchedByNameVendor: 0,
      matchedByNameOnly: 0,
      matchedByNameToken: 0,
      unmatched: 0,
    },
    affectedDocs: {
      clips: [],
      invoices: [],
      purchaseOrders: [],
      roomEntries: [],
    },
    examplesDasoMaura: [],
    examplesImageUpdates: [],
    presence: {},
    noWrites: true,
  };

  const boardRef = doc(db, 'boards', BOARD_ID);
  const boardSnap = await getDoc(boardRef);
  report.presence.boardExists = boardSnap.exists();
  report.presence.boardName = boardSnap.exists()
    ? firstNonEmpty(boardSnap.data(), ['name', 'title'])
    : '';

  if (!boardSnap.exists()) {
    process.stdout.write(JSON.stringify(report, null, 2));
    process.exit(0);
  }

  const [clips, invoices, purchaseOrders, proposals] = await Promise.all([
    fetchSubcollectionDocs(db, BOARD_ID, 'clips'),
    fetchSubcollectionDocs(db, BOARD_ID, 'invoices'),
    fetchSubcollectionDocs(db, BOARD_ID, 'purchaseOrders'),
    fetchSubcollectionDocs(db, BOARD_ID, 'proposals'),
  ]);

  const roomSubNames = ['rooms', 'roomBoards', 'roomBoardEntries', 'selectionsByRoom'];
  const roomCollections = [];
  for (const sub of roomSubNames) {
    const docs = await fetchSubcollectionDocs(db, BOARD_ID, sub);
    if (docs.length > 0) roomCollections.push({ subcollection: sub, docs });
  }

  report.presence.invoicesCount = invoices.length;
  report.presence.purchaseOrdersCount = purchaseOrders.length;
  report.presence.proposalsCount = proposals.length;
  report.presence.clipsCount = clips.length;
  report.presence.roomCollectionsFound = roomCollections.map((x) => ({
    subcollection: x.subcollection,
    count: x.docs.length,
  }));

  const productsSnap = await getDocs(collection(db, 'products'));
  const byHouzzId = new Map();
  const bySku = new Map();
  const byNameVendor = new Map();
  const byNameOnly = new Map();
  const byTokenSig = new Map();
  const byProductId = new Map();

  productsSnap.forEach((d) => {
    const p = { id: d.id, ...d.data() };
    byProductId.set(d.id, p);
    const houzzId = String(p.houzzId || '').trim();
    if (houzzId && !byHouzzId.has(houzzId)) byHouzzId.set(houzzId, p);
    const sku = skuNorm(firstNonEmpty(p, ['sku', 'itemSku', 'productSku']));
    if (sku && !bySku.has(sku)) bySku.set(sku, p);
    const nvKey = makeNameVendorKey(productName(p), productVendor(p));
    if (nvKey && !byNameVendor.has(nvKey)) byNameVendor.set(nvKey, p);
    const nKey = norm(productName(p));
    if (nKey && !byNameOnly.has(nKey)) byNameOnly.set(nKey, p);
    const sig = tokenSignature(productName(p));
    if (sig && !byTokenSig.has(sig)) byTokenSig.set(sig, p);
  });

  function resolveLinkedProduct(item) {
    const pid = linkedLibraryProductId(item);
    if (!pid) return null;
    return byProductId.get(pid) || null;
  }

  function processTargetItem({
    sourceType,
    docId,
    docLabel,
    item,
    itemIndex,
    roomContext = '',
  }) {
    report.matchingSummary.totalCandidateItems += 1;
    const linkedProduct = resolveLinkedProduct(item);
    const match = matchItemToProduct(item, linkedProduct, byHouzzId, bySku, byNameVendor, byNameOnly, byTokenSig);
    if (!match) {
      report.matchingSummary.unmatched += 1;
      safetyStats.skippedNoMatch += 1;
      return;
    }
    if (match.method === 'libraryProductId') report.matchingSummary.matchedByLibraryProductId += 1;
    else if (match.method === 'houzzId') report.matchingSummary.matchedByHouzzId += 1;
    else if (match.method === 'sku') report.matchingSummary.matchedBySku += 1;
    else if (match.method === 'name+vendor') report.matchingSummary.matchedByNameVendor += 1;
    else if (match.method === 'name-token') report.matchingSummary.matchedByNameToken += 1;
    else report.matchingSummary.matchedByNameOnly += 1;

    if (isDisallowedProductSource(item.source) || (linkedProduct && isDisallowedProductSource(linkedProduct.source))) {
      safetyStats.skippedProtectedSource += 1;
      return;
    }

    if (!isHouzzLegacyEligible(item, linkedProduct, match.product)) {
      safetyStats.skippedNotHouzzLegacy += 1;
      return;
    }

    // Source-of-truth row in /products must be Houzz-era, never clip-sync / manual / ideabook.
    const mp = match.product;
    if (isDisallowedProductSource(mp.source) || !isHouzzishProductSource(mp.source)) {
      safetyStats.skippedNotHouzzLegacy += 1;
      return;
    }

    const changes = buildFieldPatchPreview(item, match.product);
    if (changes.length === 0) {
      safetyStats.skippedNoFieldChanges += 1;
      return;
    }

    safetyStats.appliedPreviews += 1;

    const payload = {
      docId,
      docLabel,
      itemIndex,
      itemName: itemName(item),
      itemVendor: itemVendor(item),
      itemSource: String(item.source || ''),
      linkedLibraryProductId: linkedLibraryProductId(item) || '',
      linkedProductSource: linkedProduct ? String(linkedProduct.source || '') : '',
      matchMethod: match.method,
      matchKey: match.keyUsed,
      matchedProductId: match.product.id,
      matchedProductName: productName(match.product),
      matchedProductSource: String(match.product.source || ''),
      matchedProductHouzzId: String(match.product.houzzId || ''),
      fieldsToUpdate: changes,
    };

    if (sourceType === 'clips') {
      payload.clipId = docId;
      payload.roomContext = roomContext || firstNonEmpty(item, ['roomName', 'room']);
      report.affectedDocs.clips.push(payload);
    } else if (sourceType === 'invoices') {
      report.affectedDocs.invoices.push(payload);
    } else if (sourceType === 'purchaseOrders') {
      report.affectedDocs.purchaseOrders.push(payload);
    } else if (sourceType === 'roomEntries') {
      payload.roomContext = roomContext;
      report.affectedDocs.roomEntries.push(payload);
    }
  }

  for (const clip of clips) {
    processTargetItem({
      sourceType: 'clips',
      docId: clip.id,
      docLabel: firstNonEmpty(clip, ['title', 'name', 'productName']) || clip.id,
      item: clip,
      itemIndex: 0,
      roomContext: firstNonEmpty(clip, ['roomName', 'room']),
    });
  }

  for (const inv of invoices) {
    const items = Array.isArray(inv.items) ? inv.items : [];
    const invNum = toSerializableId(firstNonEmpty(inv, ['invoiceNum', 'invoiceNumber']));
    for (let i = 0; i < items.length; i += 1) {
      processTargetItem({
        sourceType: 'invoices',
        docId: inv.id,
        docLabel: invNum || inv.id,
        item: items[i] || {},
        itemIndex: i,
      });
    }
  }

  for (const po of purchaseOrders) {
    const items = Array.isArray(po.items) ? po.items : [];
    const poNum = toSerializableId(firstNonEmpty(po, ['poNumber', 'purchaseOrderNumber', 'number']));
    for (let i = 0; i < items.length; i += 1) {
      processTargetItem({
        sourceType: 'purchaseOrders',
        docId: po.id,
        docLabel: poNum || po.id,
        item: items[i] || {},
        itemIndex: i,
      });
    }
  }

  for (const rc of roomCollections) {
    for (const rd of rc.docs) {
      const roomName = firstNonEmpty(rd, ['roomName', 'name', 'title']) || rd.id;
      const hasItemShape =
        firstNonEmpty(rd, ['title', 'productName', 'name', 'houzzId', 'vendor', 'manufacturer']) !== '';
      if (hasItemShape) {
        processTargetItem({
          sourceType: 'roomEntries',
          docId: rd.id,
          docLabel: `${rc.subcollection}:${rd.id}`,
          item: rd,
          itemIndex: 0,
          roomContext: `${rc.subcollection}/${roomName}`,
        });
      }
      const embeddedItems = Array.isArray(rd.items) ? rd.items : [];
      for (let i = 0; i < embeddedItems.length; i += 1) {
        processTargetItem({
          sourceType: 'roomEntries',
          docId: rd.id,
          docLabel: `${rc.subcollection}:${rd.id}`,
          item: embeddedItems[i] || {},
          itemIndex: i,
          roomContext: `${rc.subcollection}/${roomName}`,
        });
      }
    }
  }

  report.presence.affectedInvoiceDocIds = [...new Set(report.affectedDocs.invoices.map((x) => x.docId))];
  report.presence.affectedPurchaseOrderDocIds = [...new Set(report.affectedDocs.purchaseOrders.map((x) => x.docId))];
  report.presence.affectedClipDocIds = [...new Set(report.affectedDocs.clips.map((x) => x.docId))];
  report.presence.affectedRoomEntryDocIds = [...new Set(report.affectedDocs.roomEntries.map((x) => x.docId))];

  report.summary = {
    clipSelectionRowsWouldUpdate: report.affectedDocs.clips.length,
    invoiceLineRowsWouldUpdate: report.affectedDocs.invoices.length,
    purchaseOrderLineRowsWouldUpdate: report.affectedDocs.purchaseOrders.length,
    roomEntryRowsWouldUpdate: report.affectedDocs.roomEntries.length,
    invoiceDocsTouched: report.presence.affectedInvoiceDocIds.length,
    purchaseOrderDocsTouched: report.presence.affectedPurchaseOrderDocIds.length,
    clipDocsTouched: report.presence.affectedClipDocIds.length,
    roomEntryDocsTouched: report.presence.affectedRoomEntryDocIds.length,
  };

  const allRows = [
    ...report.affectedDocs.clips,
    ...report.affectedDocs.invoices,
    ...report.affectedDocs.purchaseOrders,
    ...report.affectedDocs.roomEntries,
  ];
  report.examplesDasoMaura = pickDasoMauraExamples(allRows).slice(0, 25);
  report.examplesImageUpdates = allRows
    .filter((r) => Array.isArray(r.fieldsToUpdate) && r.fieldsToUpdate.some((f) => f.field === 'imageUrl'))
    .slice(0, 25);

  const outPath = path.join(__dirname, 'bugletrail-safe-sequenced-dryrun.json');
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');
  report.writtenFile = outPath;

  process.stdout.write(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error('DRY_RUN_FAILED', err);
  process.exit(1);
});
