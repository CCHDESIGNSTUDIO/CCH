'use strict';
/** READ-ONLY — How many Dorchester rows would quarantine move on staging today? */
const path = require('path');
const admin = require('firebase-admin');

const STG_KEY = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-studio-staging-firebase-adminsdk-fbsvc-b93c6f1cf4.json');
const db = admin.initializeApp({ credential: admin.credential.cert(require(STG_KEY)) }, 'dor').firestore();

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
function isDorchesterScope(p, mode) {
  const h = hz(p);
  const t = str(p.title || p.name).toLowerCase();
  if (mode === '54119735') return h === '54119735';
  if (mode === 'both-houzz') return h === '54119735' || h === '33494541';
  return h === '54119735' || h === '33494541' || /dorchester/.test(t);
}

async function runScope(label, mode) {
  const snap = await db.collection('products').get();
  const rows = [];
  snap.forEach((d) => {
    const p = Object.assign({ _id: d.id }, d.data() || {});
    if (isDorchesterScope(p, mode)) rows.push(p);
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
        cost: cost(r),
        duplicateOf: keep._id,
        keeperCost: cost(keep),
      });
    });
  });

  const archSnap = await db.collection('products_archive').get();
  let alreadyJunk = 0;
  archSnap.forEach((d) => {
    const p = Object.assign({ _id: d.id }, d.data() || {});
    if (isDorchesterScope(p, mode)) alreadyJunk++;
  });

  console.log('\n=== ' + label + ' ===');
  console.log('Active products/ rows in scope:', rows.length);
  console.log('Already in Junk (products_archive):', alreadyJunk);
  Object.keys(groups).sort().forEach((k) => console.log('  ' + k + ': ' + groups[k].length + ' active'));
  console.log('Would move to archive NOW:', wouldMove.length);
  wouldMove.forEach((r) => console.log('  → ' + r.id + ' | hz ' + r.houzzId + ' | $' + r.cost + ' | "' + r.title + '" → keeper ' + r.duplicateOf + ' ($' + r.keeperCost + ')'));
  keepers.forEach((k) => {
    const r = k.row;
    console.log('  KEEP ' + r._id + ' | ' + k.key + ' | $' + cost(r) + ' | "' + str(r.title || r.name).slice(0, 50) + '"');
  });
  return { wouldMove: wouldMove.length, active: rows.length, junk: alreadyJunk };
}

(async () => {
  console.log('DRY RUN — Dorchester-only quarantine scope on STAGING (same score rules as firm-wide script)');
  await runScope('Swing arm only (houzz 54119735)', '54119735');
  await runScope('Both Dorchester Houzz ids (54119735 + 33494541)', 'both-houzz');
  await runScope('Title search "dorchester" + both Houzz ids', 'title');
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
