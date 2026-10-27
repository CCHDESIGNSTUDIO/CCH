'use strict';
/** READ-ONLY — Dorchester-only quarantine dry-run on PRODUCTION. */
const path = require('path');
const admin = require('firebase-admin');

const PROD_KEY = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
const db = admin.initializeApp({ credential: admin.credential.cert(require(PROD_KEY)) }, 'prod-dor').firestore();

const SKIP = new Set([
  'jmGM3Bxr3Rm0un4Wy2Ms', 'gDA8VpouKWcpn4eedUl0', 'YFjIJkyK9mQSKqnvomzq',
  'VYf6TtpBbOTjym5cDTvN', 'RyB9EuFW0GGcFxrtc0xb', '6MQ7JeFsfkeaM6GXDMTE',
  'glacier_hand_blown_pendant___elu',
]);
const META = new Set(['updatedAt', 'createdAt', 'owner', '_id', 'addedAt', '_houzzGalleryLinkedAt', '_categoryFixedAt', '_enrichedFromHouzzApr27', '_archiveMeta']);

const str = (v) => String(v == null ? '' : v).trim();
const hz = (o) => str(o && (o.houzzId || o.houzzProductId || o.catalogId));
const cost = (p) => parseFloat(p.costPrice || p.unitCost || p.cost) || 0;

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
  if (cost(p) > 0) s += 10;
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
function inScope(p, mode) {
  const h = hz(p);
  const t = str(p.title || p.name).toLowerCase();
  if (mode === '54119735') return h === '54119735';
  if (mode === 'both-houzz') return h === '54119735' || h === '33494541';
  return h === '54119735' || h === '33494541' || /dorchester/.test(t);
}

async function dryRun(label, mode) {
  const snap = await db.collection('products').get();
  const rows = [];
  snap.forEach((d) => {
    const p = Object.assign({ _id: d.id }, d.data() || {});
    if (inScope(p, mode)) rows.push(p);
  });

  const groups = {};
  rows.forEach((p) => { (groups[groupKey(p)] = groups[groupKey(p)] || []).push(p); });

  const wouldMove = [];
  const keepers = [];

  Object.entries(groups).forEach(([k, g]) => {
    if (g.length < 2) {
      if (g.length === 1) keepers.push({ key: k, row: g[0] });
      return;
    }
    g.sort((a, b) => score(b) - score(a) || String(a._id).localeCompare(String(b._id)));
    const keep = g[0];
    keepers.push({ key: k, row: keep });
    g.slice(1).forEach((r) => {
      if (SKIP.has(r._id)) return;
      wouldMove.push({
        key: k,
        id: r._id,
        title: str(r.title || r.name).slice(0, 55),
        houzzId: hz(r),
        vendor: str(r.vendor).slice(0, 20),
        cost: cost(r),
        duplicateOf: keep._id,
        keeperTitle: str(keep.title || keep.name).slice(0, 50),
        keeperCost: cost(keep),
      });
    });
  });

  const archSnap = await db.collection('products_archive').get();
  let junk = 0;
  archSnap.forEach((d) => {
    const p = Object.assign({ _id: d.id }, d.data() || {});
    if (inScope(p, mode)) junk++;
  });

  console.log('\n=== ' + label + ' ===');
  console.log('PRODUCTION active products/ in scope:', rows.length);
  console.log('Already in products_archive:', junk);
  Object.keys(groups).sort().forEach((k) => console.log('  ' + k + ': ' + groups[k].length + ' active duplicate group members'));
  console.log('Would move to Junk (archive) if --quarantine ran now:', wouldMove.length);
  wouldMove.forEach((r) => {
    console.log('  → ' + r.id + ' | hz ' + r.houzzId + ' | ' + r.vendor + ' | trade $' + r.cost + ' | "' + r.title + '"');
    console.log('      keeper: ' + r.duplicateOf + ' ($' + r.keeperCost + ') "' + r.keeperTitle + '"');
  });
  keepers.forEach(({ key, row }) => {
    console.log('  KEEP ' + row._id + ' | ' + key + ' | $' + cost(row) + ' | ' + str(row.vendor).slice(0, 18) + ' | "' + str(row.title || row.name).slice(0, 45) + '"');
  });
  return wouldMove.length;
}

(async () => {
  console.log('DRY RUN ONLY — PRODUCTION (cch-design-boards) — Dorchester quarantine scope');
  console.log('Same score/keeper rules as dedup-products-firmwide-staging script (NOT highest-price rule).');
  const a = await dryRun('Swing arm only — houzz 54119735', '54119735');
  const b = await dryRun('Both Dorchester Houzz ids — 54119735 + 33494541', 'both-houzz');
  const c = await dryRun('Product Library search "dorchester" (title or either Houzz id)', 'title');
  console.log('\n=== TOTALS ===');
  console.log('54119735 only → move', a);
  console.log('Both Houzz ids → move', b);
  console.log('Title/houzz dorchester scope → move', c);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
