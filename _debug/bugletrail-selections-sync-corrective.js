/**
 * Corrective pass for 7225 Bugletrail selections.
 * Fixes duplicate product-key matching by preferring allowed Houzz-era products.
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

function norm(value) { return String(value || '').toLowerCase().trim().replace(/\s+/g, ' ').replace(/[^\w\s-]/g, ''); }
function firstNonEmpty(obj, keys) {
  for (const k of keys) {
    const v = obj ? obj[k] : undefined;
    if (v !== undefined && v !== null && String(v).trim() !== '') return v;
  }
  return '';
}
function skuNorm(v) { return String(v || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }
function tokenSignature(v) { const w = norm(v).split(' ').filter((x) => x && x.length > 2); return w.length ? w.slice(0, 4).join(' ') : ''; }
function productName(p) { return firstNonEmpty(p, ['title', 'name', 'productName', 'itemName']); }
function productVendor(p) { return firstNonEmpty(p, ['vendor', 'manufacturer', 'brand', 'supplier', 'vendorName']); }
function itemName(item) { return firstNonEmpty(item, ['title', 'name', 'productName', 'itemName', 'description']); }
function itemVendor(item) { return firstNonEmpty(item, ['vendor', 'manufacturer', 'brand', 'supplier', 'vendorName']); }
function makeNameVendorKey(name, vendor) { const n = norm(name); const v = norm(vendor); return n && v ? `${n}__${v}` : ''; }

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
  return GENERIC_PLACEHOLDERS.has(norm(cur));
}
function isDisallowedProductSource(source) {
  const t = String(source || '').trim();
  return PROTECTED_SOURCES.has(t) || t === 'clip-sync';
}
function isHouzzishProductSource(source) {
  const t = String(source || '').trim();
  if (!t) return true;
  if (/houzz/i.test(t)) return true;
  return t === 'ffe-import' || t === 'new-houzz' || t === 'houzz-catalog-apr27' || t === 'cloud-rolling-hills';
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
function buildFieldPatch(target, product) {
  const patch = {};
  const fields = [];
  for (const f of PREVIEW_FIELDS) {
    const cur = String(target[f] || '').trim();
    const next = String(product[f] || '').trim();
    if (!next) continue;
    if (!cur) {
      patch[f] = product[f];
      fields.push({ field: f, reason: 'empty', from: cur, to: next });
      continue;
    }
    if (isClearlyOutdated(f, cur, next)) {
      patch[f] = product[f];
      fields.push({ field: f, reason: 'outdated', from: cur, to: next });
    }
  }
  return { patch, fields };
}
function scoreProductForUse(p) {
  let s = 0;
  if (p && p.houzzId) s += 5;
  if (p && isHouzzishProductSource(p.source)) s += 4;
  if (p && isDisallowedProductSource(p.source)) s -= 100;
  if (p && String(p.source || '').trim() === 'ffe-import') s += 3;
  if (p && p.vendorUrl) s += 1;
  return s;
}
function pickBest(arr) {
  if (!arr || !arr.length) return null;
  return arr.slice().sort((a, b) => scoreProductForUse(b) - scoreProductForUse(a))[0];
}

async function main() {
  const app = initializeApp(STAGING);
  const db = getFirestore(app);
  const [clipSnap, prodSnap] = await Promise.all([
    getDocs(collection(db, 'boards', BOARD_ID, 'clips')),
    getDocs(collection(db, 'products')),
  ]);

  const clips = [];
  clipSnap.forEach((d) => clips.push({ id: d.id, ...d.data() }));
  const byId = new Map();
  const byHouzzId = new Map();
  const bySku = new Map();
  const byNv = new Map();
  const byName = new Map();
  const bySig = new Map();
  prodSnap.forEach((d) => {
    const p = { id: d.id, ...d.data() };
    byId.set(d.id, p);
    const h = String(p.houzzId || '').trim();
    if (h) { if (!byHouzzId.has(h)) byHouzzId.set(h, []); byHouzzId.get(h).push(p); }
    const sku = skuNorm(firstNonEmpty(p, ['sku', 'itemSku', 'productSku']));
    if (sku) { if (!bySku.has(sku)) bySku.set(sku, []); bySku.get(sku).push(p); }
    const nv = makeNameVendorKey(productName(p), productVendor(p));
    if (nv) { if (!byNv.has(nv)) byNv.set(nv, []); byNv.get(nv).push(p); }
    const n = norm(productName(p));
    if (n) { if (!byName.has(n)) byName.set(n, []); byName.get(n).push(p); }
    const sig = tokenSignature(productName(p));
    if (sig) { if (!bySig.has(sig)) bySig.set(sig, []); bySig.get(sig).push(p); }
  });

  function match(item, linkedProduct) {
    if (linkedProduct) return { method: 'libraryProductId', product: linkedProduct };
    const h = String(item.houzzId || '').trim();
    if (h && byHouzzId.has(h)) return { method: 'houzzId', product: pickBest(byHouzzId.get(h)) };
    const sku = skuNorm(firstNonEmpty(item, ['sku', 'itemSku', 'productSku']));
    if (sku && bySku.has(sku)) return { method: 'sku', product: pickBest(bySku.get(sku)) };
    const nv = makeNameVendorKey(itemName(item), itemVendor(item));
    if (nv && byNv.has(nv)) return { method: 'name+vendor', product: pickBest(byNv.get(nv)) };
    const n = norm(itemName(item));
    if (n && byName.has(n)) return { method: 'name-only', product: pickBest(byName.get(n)) };
    const sig = tokenSignature(itemName(item));
    if (sig && bySig.has(sig)) return { method: 'name-token', product: pickBest(bySig.get(sig)) };
    return null;
  }

  const updates = [];
  const report = { clipCount: clips.length, updated: 0, skippedNoMatch: 0, skippedProtected: 0, skippedNotHouzz: 0, skippedNoFields: 0, examples: [] };
  for (const c of clips) {
    const linked = byId.get(linkedLibraryProductId(c)) || null;
    const m = match(c, linked);
    if (!m || !m.product) { report.skippedNoMatch += 1; continue; }
    if (isDisallowedProductSource(c.source) || (linked && isDisallowedProductSource(linked.source))) { report.skippedProtected += 1; continue; }
    if (!isHouzzLegacyEligible(c, linked, m.product)) { report.skippedNotHouzz += 1; continue; }
    if (isDisallowedProductSource(m.product.source) || !isHouzzishProductSource(m.product.source)) { report.skippedNotHouzz += 1; continue; }
    const built = buildFieldPatch(c, m.product);
    if (!Object.keys(built.patch).length) { report.skippedNoFields += 1; continue; }
    built.patch._libraryRefreshAt = new Date().toISOString();
    built.patch._libraryRefreshSource = 'bugletrail-selections-sync-corrective';
    built.patch._libraryRefreshMatchMethod = m.method;
    built.patch._libraryRefreshMatchedProductId = m.product.id;
    updates.push({ id: c.id, title: c.title || '', fields: built.fields, patch: built.patch });
    if (report.examples.length < 30) report.examples.push({ clipId: c.id, title: c.title || '', fields: built.fields });
  }

  const BATCH = 350;
  let written = 0;
  for (let i = 0; i < updates.length; i += BATCH) {
    const batch = writeBatch(db);
    const slice = updates.slice(i, i + BATCH);
    for (const u of slice) batch.update(doc(db, 'boards', BOARD_ID, 'clips', u.id), u.patch);
    await batch.commit();
    written += slice.length;
  }
  report.updated = written;
  report.finishedAt = new Date().toISOString();
  const out = path.join(__dirname, 'bugletrail-selections-sync-corrective-report.json');
  fs.writeFileSync(out, JSON.stringify(report, null, 2), 'utf8');
  process.stdout.write(JSON.stringify({ ...report, writtenFile: out }, null, 2));
}

main().catch((e) => { console.error('FAILED', e); process.exit(1); });

