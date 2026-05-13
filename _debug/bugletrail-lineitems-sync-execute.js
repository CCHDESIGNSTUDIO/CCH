/**
 * 7225 Bugletrail — invoice/PO line-item sync execute (STAGING).
 *
 * Writes only to:
 *   boards/7225-bugletrail/invoices (items[])
 *   boards/7225-bugletrail/purchaseOrders (items[])
 *
 * Safe rules mirror bugletrail-safe-sequenced-dryrun.js.
 */
const fs = require('fs');
const path = require('path');
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, writeBatch } = require('firebase/firestore');

const STAGING = {
  apiKey: 'AIzaSyBIwwo7uRij6Q0FZg-qmIS1LC8t2AjXrYo',
  authDomain: 'cch-studio-staging.firebaseapp.com',
  projectId: 'cch-studio-staging',
  storageBucket: 'cch-studio-staging.firebasestorage.app',
  messagingSenderId: '210388013080',
  appId: '1:210388013080:web:fcd520b30c0d50b149736d',
};

const BOARD_ID = '7225-bugletrail';
const PROTECTED_SOURCES = new Set(['cch-studio-clipper', 'clipper', 'manual', 'ideabook-asset']);
const PREVIEW_FIELDS = ['imageUrl', 'description', 'vendorDescription', 'dimensions', 'materials', 'finish', 'manufacturer', 'vendorUrl'];
const GENERIC_PLACEHOLDERS = new Set(['', '-', '--', 'n/a', 'na', 'none', 'unknown', 'tbd']);

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
function skuNorm(v) {
  return String(v || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}
function tokenSignature(v) {
  const words = norm(v).split(' ').map((w) => w.trim()).filter((w) => w && w.length > 2);
  if (!words.length) return '';
  return words.slice(0, 4).join(' ');
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
function isAwsExpiring(url) {
  const u = String(url || '').trim();
  if (!u) return true;
  return /ivy-(prod|uploads)\.s3/i.test(u) || (/amazonaws\.com/i.test(u) && /X-Amz-/i.test(u));
}
function isLikelyLowResLegacyClipImage(url) {
  const u = String(url || '').trim();
  if (!u) return false;
  if (/\/projects%2F[^/]+%2Fclips%2F/i.test(u) && /\.jpe?g(\?|$)/i.test(u)) return true;
  if (/houzz\.com/i.test(u) && /(w\d+-h\d+|_t\.jpg|_xs\.|_small\.|\/thumbs\/)/i.test(u)) return true;
  return false;
}
function isClearlyOutdated(field, currentValue, productValue) {
  const cur = String(currentValue || '').trim();
  const prod = String(productValue || '').trim();
  if (!prod || !cur) return false;
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
function isDisallowedProductSource(source) {
  const t = String(source || '').trim();
  if (PROTECTED_SOURCES.has(t)) return true;
  if (t === 'clip-sync') return true;
  return false;
}
function isHouzzishProductSource(source) {
  const t = String(source || '').trim();
  if (!t) return true;
  if (/houzz/i.test(t)) return true;
  if (t === 'ffe-import' || t === 'new-houzz' || t === 'houzz-catalog-apr27' || t === 'cloud-rolling-hills') return true;
  return false;
}
function linkedLibraryProductId(item) {
  return String(firstNonEmpty(item, ['libraryProductId', 'libraryId', 'productId', 'studioProductId', 'library_product_id']) || '').trim();
}
function isHouzzLegacyEligible(item, linkedProduct, matchedProduct) {
  if (isDisallowedProductSource(item.source)) return false;
  if (linkedProduct && isDisallowedProductSource(linkedProduct.source)) return false;
  const itemHouzz = String(item.houzzId || '').trim();
  if (itemHouzz) return true;
  const urlBlob = [item.clippedFromUrl, item.url, item.sourceUrl, item.productUrl].filter(Boolean).join(' ');
  if (/houzz\.com/i.test(urlBlob)) return true;
  const rowSrc = String(item.source || '').trim();
  if (rowSrc && isHouzzishProductSource(rowSrc)) return true;
  const lib = linkedProduct;
  if (lib && String(lib.houzzId || '').trim() && !isDisallowedProductSource(lib.source) && isHouzzishProductSource(lib.source)) return true;
  const m = matchedProduct;
  if (m && String(m.houzzId || '').trim() && !isDisallowedProductSource(m.source) && isHouzzishProductSource(m.source)) return true;
  return false;
}
function buildFieldPatch(item, product) {
  const patch = {};
  const preview = [];
  for (const f of PREVIEW_FIELDS) {
    const cur = String(item[f] || '').trim();
    const next = String(product[f] || '').trim();
    if (!next) continue;
    if (!cur) {
      patch[f] = product[f];
      preview.push({ field: f, reason: 'empty', from: cur, to: next });
      continue;
    }
    if (isClearlyOutdated(f, cur, next)) {
      patch[f] = product[f];
      preview.push({ field: f, reason: 'outdated', from: cur, to: next });
    }
  }
  return { patch, preview };
}
function matchItemToProduct(item, linkedProduct, byHouzzId, bySku, byNameVendor, byNameOnly, byTokenSig) {
  if (linkedProduct) return { method: 'libraryProductId', product: linkedProduct, keyUsed: linkedProduct.id };
  const houzzId = String(item.houzzId || '').trim();
  if (houzzId && byHouzzId.has(houzzId)) return { method: 'houzzId', product: byHouzzId.get(houzzId), keyUsed: houzzId };
  const sku = skuNorm(firstNonEmpty(item, ['sku', 'itemSku', 'productSku']));
  if (sku && bySku.has(sku)) return { method: 'sku', product: bySku.get(sku), keyUsed: sku };
  const nvKey = makeNameVendorKey(itemName(item), itemVendor(item));
  if (nvKey && byNameVendor.has(nvKey)) return { method: 'name+vendor', product: byNameVendor.get(nvKey), keyUsed: nvKey };
  const nOnly = norm(itemName(item));
  if (nOnly && byNameOnly.has(nOnly)) return { method: 'name-only', product: byNameOnly.get(nOnly), keyUsed: nOnly };
  const sig = tokenSignature(itemName(item));
  if (sig && byTokenSig.has(sig)) return { method: 'name-token', product: byTokenSig.get(sig), keyUsed: sig };
  return null;
}

async function main() {
  const app = initializeApp(STAGING);
  const db = getFirestore(app);

  const report = {
    script: 'bugletrail-lineitems-sync-execute.js',
    environment: 'staging',
    boardId: BOARD_ID,
    startedAt: new Date().toISOString(),
    invoiceDocsScanned: 0,
    poDocsScanned: 0,
    invoiceLinesScanned: 0,
    poLinesScanned: 0,
    invoiceLinesUpdated: 0,
    poLinesUpdated: 0,
    skipped: {
      noMatch: 0,
      protected: 0,
      notHouzzLegacy: 0,
      noFieldChanges: 0,
      nonHouzzLibrarySource: 0,
    },
    matchMethods: {
      libraryProductId: 0,
      houzzId: 0,
      sku: 0,
      nameVendor: 0,
      nameOnly: 0,
      nameToken: 0,
    },
    invoiceExamples: [],
    poExamples: [],
  };

  const [invSnap, poSnap, productsSnap] = await Promise.all([
    getDocs(collection(db, 'boards', BOARD_ID, 'invoices')),
    getDocs(collection(db, 'boards', BOARD_ID, 'purchaseOrders')),
    getDocs(collection(db, 'products')),
  ]);

  const invoices = [];
  invSnap.forEach((d) => invoices.push({ id: d.id, ...d.data() }));
  const pos = [];
  poSnap.forEach((d) => pos.push({ id: d.id, ...d.data() }));
  report.invoiceDocsScanned = invoices.length;
  report.poDocsScanned = pos.length;

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
    const nv = makeNameVendorKey(productName(p), productVendor(p));
    if (nv && !byNameVendor.has(nv)) byNameVendor.set(nv, p);
    const n = norm(productName(p));
    if (n && !byNameOnly.has(n)) byNameOnly.set(n, p);
    const sig = tokenSignature(productName(p));
    if (sig && !byTokenSig.has(sig)) byTokenSig.set(sig, p);
  });

  const invoiceUpdates = [];
  for (const inv of invoices) {
    const items = Array.isArray(inv.items) ? inv.items : [];
    report.invoiceLinesScanned += items.length;
    let changed = false;
    const nextItems = items.map((item, i) => {
      const linkedProduct = byProductId.get(linkedLibraryProductId(item)) || null;
      const match = matchItemToProduct(item, linkedProduct, byHouzzId, bySku, byNameVendor, byNameOnly, byTokenSig);
      if (!match) {
        report.skipped.noMatch += 1;
        return item;
      }
      if (match.method === 'libraryProductId') report.matchMethods.libraryProductId += 1;
      else if (match.method === 'houzzId') report.matchMethods.houzzId += 1;
      else if (match.method === 'sku') report.matchMethods.sku += 1;
      else if (match.method === 'name+vendor') report.matchMethods.nameVendor += 1;
      else if (match.method === 'name-token') report.matchMethods.nameToken += 1;
      else report.matchMethods.nameOnly += 1;

      if (isDisallowedProductSource(item.source) || (linkedProduct && isDisallowedProductSource(linkedProduct.source))) {
        report.skipped.protected += 1;
        return item;
      }
      if (!isHouzzLegacyEligible(item, linkedProduct, match.product)) {
        report.skipped.notHouzzLegacy += 1;
        return item;
      }
      if (isDisallowedProductSource(match.product.source) || !isHouzzishProductSource(match.product.source)) {
        report.skipped.nonHouzzLibrarySource += 1;
        return item;
      }
      const built = buildFieldPatch(item, match.product);
      if (!Object.keys(built.patch).length) {
        report.skipped.noFieldChanges += 1;
        return item;
      }
      changed = true;
      report.invoiceLinesUpdated += 1;
      if (report.invoiceExamples.length < 20) {
        report.invoiceExamples.push({
          invoiceId: inv.id,
          invoiceNum: String(firstNonEmpty(inv, ['invoiceNum', 'invoiceNumber', 'number']) || ''),
          lineIndex: i,
          title: String(itemName(item) || ''),
          fields: built.preview,
        });
      }
      return {
        ...item,
        ...built.patch,
        _libraryRefreshAt: new Date().toISOString(),
        _libraryRefreshSource: 'bugletrail-lineitems-sync-execute',
        _libraryRefreshMatchMethod: match.method,
        _libraryRefreshMatchedProductId: match.product.id,
      };
    });

    if (changed) {
      invoiceUpdates.push({ docId: inv.id, items: nextItems });
    }
  }

  const poUpdates = [];
  for (const po of pos) {
    const items = Array.isArray(po.items) ? po.items : [];
    report.poLinesScanned += items.length;
    let changed = false;
    const nextItems = items.map((item, i) => {
      const linkedProduct = byProductId.get(linkedLibraryProductId(item)) || null;
      const match = matchItemToProduct(item, linkedProduct, byHouzzId, bySku, byNameVendor, byNameOnly, byTokenSig);
      if (!match) {
        report.skipped.noMatch += 1;
        return item;
      }
      if (match.method === 'libraryProductId') report.matchMethods.libraryProductId += 1;
      else if (match.method === 'houzzId') report.matchMethods.houzzId += 1;
      else if (match.method === 'sku') report.matchMethods.sku += 1;
      else if (match.method === 'name+vendor') report.matchMethods.nameVendor += 1;
      else if (match.method === 'name-token') report.matchMethods.nameToken += 1;
      else report.matchMethods.nameOnly += 1;

      if (isDisallowedProductSource(item.source) || (linkedProduct && isDisallowedProductSource(linkedProduct.source))) {
        report.skipped.protected += 1;
        return item;
      }
      if (!isHouzzLegacyEligible(item, linkedProduct, match.product)) {
        report.skipped.notHouzzLegacy += 1;
        return item;
      }
      if (isDisallowedProductSource(match.product.source) || !isHouzzishProductSource(match.product.source)) {
        report.skipped.nonHouzzLibrarySource += 1;
        return item;
      }
      const built = buildFieldPatch(item, match.product);
      if (!Object.keys(built.patch).length) {
        report.skipped.noFieldChanges += 1;
        return item;
      }
      changed = true;
      report.poLinesUpdated += 1;
      if (report.poExamples.length < 20) {
        report.poExamples.push({
          poId: po.id,
          poNum: String(firstNonEmpty(po, ['poNumber', 'purchaseOrderNumber', 'number']) || ''),
          lineIndex: i,
          title: String(itemName(item) || ''),
          fields: built.preview,
        });
      }
      return {
        ...item,
        ...built.patch,
        _libraryRefreshAt: new Date().toISOString(),
        _libraryRefreshSource: 'bugletrail-lineitems-sync-execute',
        _libraryRefreshMatchMethod: match.method,
        _libraryRefreshMatchedProductId: match.product.id,
      };
    });

    if (changed) {
      poUpdates.push({ docId: po.id, items: nextItems });
    }
  }

  const writes = [...invoiceUpdates.map((x) => ({ col: 'invoices', ...x })), ...poUpdates.map((x) => ({ col: 'purchaseOrders', ...x }))];
  const BATCH_SIZE = 300;
  let committed = 0;
  for (let i = 0; i < writes.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    const slice = writes.slice(i, i + BATCH_SIZE);
    for (const w of slice) {
      batch.update(doc(db, 'boards', BOARD_ID, w.col, w.docId), { items: w.items });
    }
    await batch.commit();
    committed += slice.length;
  }

  report.invoiceDocsUpdated = invoiceUpdates.length;
  report.poDocsUpdated = poUpdates.length;
  report.totalDocsUpdated = committed;
  report.finishedAt = new Date().toISOString();

  const outPath = path.join(__dirname, 'bugletrail-lineitems-sync-execute-report.json');
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');
  process.stdout.write(JSON.stringify({ ...report, writtenFile: outPath }, null, 2));
}

main().catch((err) => {
  console.error('EXECUTE_FAILED', err);
  process.exit(1);
});

