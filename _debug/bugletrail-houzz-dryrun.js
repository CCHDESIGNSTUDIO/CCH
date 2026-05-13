/**
 * 7225 Bugletrail targeted dry-run (STAGING ONLY, READ-ONLY).
 *
 * Goals:
 * - Verify board + invoices + purchase orders exist in staging.
 * - Match Bugletrail-used products to /products with:
 *   1) houzzId (primary)
 *   2) exact normalized name + vendor (fallback)
 * - Preview "fill-empty-or-outdated" updates (NO WRITES):
 *   - clips / board selections
 *   - invoice items[] line items
 *   - purchase order items[] line items
 *   - room-related entries (existing docs only)
 */
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

function isClearlyOutdated(field, currentValue, productValue) {
  const cur = String(currentValue || '').trim();
  const prod = String(productValue || '').trim();
  if (!prod) return false;
  if (!cur) return false;

  if (field === 'imageUrl') {
    return isAwsExpiring(cur) && cur !== prod;
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

function toSerializableId(v) {
  if (v === undefined || v === null) return '';
  return String(v);
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

function matchItemToProduct(item, byHouzzId, byNameVendor) {
  const houzzId = String(item.houzzId || '').trim();
  if (houzzId && byHouzzId.has(houzzId)) {
    return { method: 'houzzId', product: byHouzzId.get(houzzId), keyUsed: houzzId };
  }
  const key = makeNameVendorKey(itemName(item), itemVendor(item));
  if (key && byNameVendor.has(key)) {
    return { method: 'name+vendor', product: byNameVendor.get(key), keyUsed: key };
  }
  return null;
}

async function fetchSubcollectionDocs(db, boardId, sub) {
  const snap = await getDocs(collection(db, 'boards', boardId, sub));
  const docs = [];
  snap.forEach((d) => docs.push({ id: d.id, ...d.data() }));
  return docs;
}

async function main() {
  const app = initializeApp(STAGING);
  const db = getFirestore(app);

  const report = {
    timestamp: new Date().toISOString(),
    environment: 'staging',
    boardId: BOARD_ID,
    presence: {},
    matchingSummary: {
      totalCandidateItems: 0,
      matchedByHouzzId: 0,
      matchedByNameVendor: 0,
      unmatched: 0,
    },
    affectedDocs: {
      clips: [],
      invoices: [],
      purchaseOrders: [],
      roomEntries: [],
    },
    noDuplicateCreation: {
      confirmed: true,
      reason: 'Dry-run only reads existing docs; update preview targets existing doc IDs and item indexes only.',
    },
  };

  const boardRef = doc(db, 'boards', BOARD_ID);
  const boardSnap = await getDoc(boardRef);
  report.presence.boardExists = boardSnap.exists();
  report.presence.boardName = boardSnap.exists()
    ? firstNonEmpty(boardSnap.data(), ['name', 'title'])
    : '';

  if (!boardSnap.exists()) {
    console.log(JSON.stringify(report, null, 2));
    process.exit(0);
  }

  const [clips, invoices, purchaseOrders, proposals] = await Promise.all([
    fetchSubcollectionDocs(db, BOARD_ID, 'clips'),
    fetchSubcollectionDocs(db, BOARD_ID, 'invoices'),
    fetchSubcollectionDocs(db, BOARD_ID, 'purchaseOrders'),
    fetchSubcollectionDocs(db, BOARD_ID, 'proposals'),
  ]);

  // Probe common room-related subcollections (read-only).
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

  // Build /products lookup indexes.
  const productsSnap = await getDocs(collection(db, 'products'));
  const byHouzzId = new Map();
  const byNameVendor = new Map();

  productsSnap.forEach((d) => {
    const p = { id: d.id, ...d.data() };
    const houzzId = String(p.houzzId || '').trim();
    if (houzzId && !byHouzzId.has(houzzId)) byHouzzId.set(houzzId, p);
    const nvKey = makeNameVendorKey(productName(p), productVendor(p));
    if (nvKey && !byNameVendor.has(nvKey)) byNameVendor.set(nvKey, p);
  });

  function processTargetItem({
    sourceType,
    docId,
    docLabel,
    item,
    itemIndex,
    roomContext = '',
  }) {
    report.matchingSummary.totalCandidateItems += 1;
    const match = matchItemToProduct(item, byHouzzId, byNameVendor);
    if (!match) {
      report.matchingSummary.unmatched += 1;
      return;
    }
    if (match.method === 'houzzId') report.matchingSummary.matchedByHouzzId += 1;
    else report.matchingSummary.matchedByNameVendor += 1;

    const changes = buildFieldPatchPreview(item, match.product);
    if (changes.length === 0) return;

    const payload = {
      docId,
      docLabel,
      itemIndex,
      itemName: itemName(item),
      itemVendor: itemVendor(item),
      matchMethod: match.method,
      matchKey: match.keyUsed,
      matchedProductId: match.product.id,
      matchedProductName: productName(match.product),
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

  // Clips / board selections.
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

  // Invoice items[].
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

  // Purchase order items[].
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

  // Room-related entries (if present), supporting docs with either item-level fields
  // or items[] arrays.
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

  // Roll up affected document IDs for concise reporting.
  report.presence.affectedInvoiceDocIds = [...new Set(report.affectedDocs.invoices.map((x) => x.docId))];
  report.presence.affectedPurchaseOrderDocIds = [...new Set(report.affectedDocs.purchaseOrders.map((x) => x.docId))];
  report.presence.affectedClipDocIds = [...new Set(report.affectedDocs.clips.map((x) => x.docId))];
  report.presence.affectedRoomEntryDocIds = [...new Set(report.affectedDocs.roomEntries.map((x) => x.docId))];

  // Helpful sample set of matched products used on this board.
  const usedProducts = [
    ...report.affectedDocs.clips,
    ...report.affectedDocs.invoices,
    ...report.affectedDocs.purchaseOrders,
    ...report.affectedDocs.roomEntries,
  ].map((x) => ({
    matchedProductId: x.matchedProductId,
    matchedProductName: x.matchedProductName,
    matchMethod: x.matchMethod,
    itemName: x.itemName,
    itemVendor: x.itemVendor,
  }));
  const dedupUsed = new Map();
  for (const u of usedProducts) {
    const k = `${u.matchedProductId}__${u.itemName}__${u.itemVendor}`;
    if (!dedupUsed.has(k)) dedupUsed.set(k, u);
  }
  report.productsUsedSample = [...dedupUsed.values()].slice(0, 50);

  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}

main().catch((err) => {
  console.error('DRY_RUN_FAILED', err);
  process.exit(1);
});
