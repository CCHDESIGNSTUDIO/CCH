'use strict';
/** READ-ONLY — firmwide products/ duplicate quarantine dry-run on PRODUCTION. */
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const PROD_KEY = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
const OUT_DIR = path.join(__dirname, '..', '_backup', 'products-firmwide-dedup-production-2026-06-09');

const SKIP_PRODUCT_IDS = new Set([
  'jmGM3Bxr3Rm0un4Wy2Ms', 'gDA8VpouKWcpn4eedUl0', 'YFjIJkyK9mQSKqnvomzq',
  'VYf6TtpBbOTjym5cDTvN', 'RyB9EuFW0GGcFxrtc0xb', '6MQ7JeFsfkeaM6GXDMTE',
  'glacier_hand_blown_pendant___elu',
]);

const db = admin.initializeApp({ credential: admin.credential.cert(require(PROD_KEY)) }, 'prod-firm').firestore();
const str = (v) => String(v == null ? '' : v).trim();
const hz = (o) => str(o && (o.houzzId || o.houzzProductId || o.catalogId));
const META = new Set(['updatedAt', 'createdAt', 'owner', '_id', 'addedAt', '_houzzGalleryLinkedAt', '_categoryFixedAt', '_enrichedFromHouzzApr27', '_archiveMeta']);

function meaningfulFields(p) {
  let n = 0;
  Object.keys(p || {}).forEach((k) => {
    if (META.has(k)) return;
    const v = p[k];
    if (v == null || v === '' || (typeof v === 'string' && !v.trim()) || (Array.isArray(v) && !v.length)) return;
    n++;
  });
  return n;
}
function imgCount(o) {
  const s = new Set();
  const add = (u) => { u = str(typeof u === 'string' ? u : (u && (u.url || u.imageUrl || u.src))); if (u) s.add(u); };
  add(o.imageUrl); add(o.image);
  ['images', 'imageUrls', 'gallery', 'photos'].forEach((k) => { if (Array.isArray(o[k])) o[k].forEach(add); });
  return s.size;
}
function descriptorTitle(t) {
  t = str(t).toLowerCase();
  return /\broom\b/.test(t) || /^(black forest|lack forest|ebony|vanilla bean)/.test(t);
}
function score(p) {
  let s = meaningfulFields(p);
  if (str(p.sku)) s += 5;
  if (hz(p)) s += 5;
  if (!descriptorTitle(p.title || p.name)) s += 20;
  if (parseFloat(p.costPrice || p.unitCost || p.cost) > 0) s += 10;
  if (parseFloat(p.sellPrice || p.price || p.clientPrice) > 0) s += 5;
  return s + imgCount(p) * 2;
}
function groupKey(p) {
  const h = hz(p);
  if (h) return 'houzz:' + h;
  const sk = str(p.sku);
  if (sk) return 'sku:' + sk.toLowerCase();
  return 'tv:' + str(p.title || p.name).toLowerCase() + '|' + str(p.vendor).toLowerCase();
}

(async () => {
  const [prodSnap, archSnap, libArchSnap] = await Promise.all([
    db.collection('products').get(),
    db.collection('products_archive').get(),
    db.collection('productLibrary_archive').get(),
  ]);
  const docs = [];
  prodSnap.forEach((d) => docs.push(Object.assign({ _id: d.id }, d.data() || {})));
  const groups = {};
  docs.forEach((p) => { (groups[groupKey(p)] = groups[groupKey(p)] || []).push(p); });

  const retireList = [];
  const groupReport = [];
  Object.entries(groups).forEach(([k, rows]) => {
    if (rows.length < 2) return;
    rows.sort((a, b) => score(b) - score(a) || String(a._id).localeCompare(String(b._id)));
    rows.slice(1).forEach((r) => retireList.push(r));
    groupReport.push({ key: k, keep: rows[0]._id, retireCount: rows.length - 1 });
  });
  groupReport.sort((a, b) => b.retireCount - a.retireCount);

  const eligible = retireList.filter((r) => !SKIP_PRODUCT_IDS.has(r._id));
  const skipped = retireList.length - eligible.length;

  const summary = {
    dryRun: true,
    env: 'PRODUCTION',
    project: 'cch-design-boards',
    generatedAt: new Date().toISOString(),
    archiveCounts: { products_archive: archSnap.size, productLibrary_archive: libArchSnap.size },
    totals: {
      productsBefore: docs.length,
      duplicateGroups: groupReport.length,
      duplicatesToQuarantine: retireList.length,
      eligibleAfterExclusions: eligible.length,
      skippedRHFixed: skipped,
    },
    topDuplicateGroups: groupReport.slice(0, 20),
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, 'DRYRUN_firmwide_products_dedup.json'), JSON.stringify(summary, null, 2));

  console.log('PRODUCTION firmwide dry-run (products/ only, same rules as staging script)');
  console.log('active products/:', docs.length);
  console.log('products_archive/ (Junk):', archSnap.size);
  console.log('productLibrary_archive/ (Junk):', libArchSnap.size);
  console.log('duplicate groups:', groupReport.length);
  console.log('rows that would move to Junk:', retireList.length);
  console.log('eligible (excl. 7 RH-fixed):', eligible.length);
  console.log('skipped RH-fixed:', skipped);
  console.log('\nReport:', path.join(OUT_DIR, 'DRYRUN_firmwide_products_dedup.json'));
})().catch((e) => { console.error(e); process.exit(1); });
