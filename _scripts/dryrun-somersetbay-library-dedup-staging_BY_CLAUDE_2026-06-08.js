'use strict';
/**
 * DRY RUN (read-only) — dedup analysis of STAGING products/ for vendor = Somerset Bay.
 * Groups by houzzId (then SKU, then title+vendor), picks a canonical "keep" row
 * (most complete; real product title preferred over finish/room descriptors), lists the
 * duplicate rows that WOULD be retired. ZERO writes.
 */
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const KEY_DIR = path.join(__dirname, '..', '_debug', 'service-account.json');
const stgKey = require(path.join(KEY_DIR, 'cch-studio-staging-firebase-adminsdk-fbsvc-b93c6f1cf4.json'));
const stgDb = admin.initializeApp({ credential: admin.credential.cert(stgKey) }, 'stg').firestore();

const VENDOR_RE = /somerset\s*bay/i;
const str = (v) => String(v == null ? '' : v).trim();
const houzzIdOf = (o) => str(o && (o.houzzId || o.houzzProductId || o.catalogId));
const META = new Set(['updatedAt', 'createdAt', 'owner', '_id', 'addedAt', '_houzzGalleryLinkedAt', '_categoryFixedAt', '_enrichedFromHouzzApr27']);

function meaningfulFields(p) { let n = 0; Object.keys(p || {}).forEach((k) => { if (META.has(k)) return; const v = p[k]; if (v == null || v === '') return; if (typeof v === 'string' && !v.trim()) return; if (Array.isArray(v) && !v.length) return; n++; }); return n; }
function imgCount(o) { const s = new Set(); const add = (u) => { u = str(typeof u === 'string' ? u : (u && (u.url || u.imageUrl || u.src))); if (u) s.add(u); }; add(o.imageUrl); add(o.image); ['images', 'imageUrls', 'gallery', 'photos'].forEach((k) => { if (Array.isArray(o[k])) o[k].forEach(add); }); return s.size; }
function descriptorTitle(t) { t = str(t).toLowerCase(); if (/\broom\b/.test(t)) return true; if (/^(black forest|lack forest|ebony|vanilla bean)/.test(t)) return true; if (/\bvanilla bean\b/.test(t) && t.split(/\s+/).length <= 5) return true; return false; }
function score(p) { let s = meaningfulFields(p); if (str(p.sku)) s += 5; if (houzzIdOf(p)) s += 5; if (!descriptorTitle(p.title || p.name)) s += 20; s += imgCount(p); return s; }
function groupKey(p) { const h = houzzIdOf(p); if (h) return 'houzz:' + h; const s = str(p.sku); if (s) return 'sku:' + s.toLowerCase(); return 'tv:' + str(p.title || p.name).toLowerCase() + '|' + str(p.vendor).toLowerCase(); }

(async () => {
  let docs = [];
  try { const q = await stgDb.collection('products').where('vendor', '==', 'Somerset Bay').get(); q.forEach((d) => docs.push(Object.assign({ _id: d.id }, d.data()))); } catch (e) {}
  if (!docs.length) { const all = await stgDb.collection('products').get(); all.forEach((d) => { const p = d.data() || {}; if (VENDOR_RE.test(str(p.vendor))) docs.push(Object.assign({ _id: d.id }, p)); }); }

  const groups = {};
  docs.forEach((p) => { const k = groupKey(p); (groups[k] = groups[k] || []).push(p); });

  const dupGroups = [];
  let retireCount = 0;
  Object.keys(groups).forEach((k) => {
    const rows = groups[k].slice().sort((a, b) => score(b) - score(a) || String(a._id).localeCompare(String(b._id)));
    if (rows.length < 2) return;
    const keep = rows[0];
    const retire = rows.slice(1);
    retireCount += retire.length;
    dupGroups.push({
      key: k,
      keep: { id: keep._id, title: str(keep.title || keep.name).slice(0, 46), sku: str(keep.sku), score: score(keep), images: imgCount(keep) },
      retire: retire.map((r) => ({ id: r._id, title: str(r.title || r.name).slice(0, 46), sku: str(r.sku), score: score(r), images: imgCount(r), descriptorTitle: descriptorTitle(r.title || r.name) })),
    });
  });
  dupGroups.sort((a, b) => b.retire.length - a.retire.length);

  const uniqueAfter = Object.keys(groups).length;
  const report = { date: '2026-06-08', dryRun: true, env: 'STAGING', collection: 'products', vendor: 'Somerset Bay',
    totals: { rows: docs.length, uniqueProductsAfterDedup: uniqueAfter, duplicateRowsToRetire: retireCount, groupsWithDuplicates: dupGroups.length },
    groups: dupGroups };
  const outDir = path.join(__dirname, '..', '_backup', 'somersetbay-library-dedup-dryrun-2026-06-08');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'DRYRUN_somersetbay_library_dedup_BY_CLAUDE_2026-06-08.json'), JSON.stringify(report, null, 2));

  console.log('=== Somerset Bay Product Library dedup — DRY RUN (read-only) ===');
  console.log('Rows:', docs.length, '| unique products after dedup:', uniqueAfter, '| duplicate rows to retire:', retireCount, '\n');
  dupGroups.forEach((g) => {
    console.log(g.key + '  (retire ' + g.retire.length + ')');
    console.log('   KEEP   ' + g.keep.id + '  "' + g.keep.title + '"  sku=' + g.keep.sku + '  score=' + g.keep.score + '  imgs=' + g.keep.images);
    g.retire.forEach((r) => console.log('   retire ' + r.id + '  "' + r.title + '"  sku=' + r.sku + '  score=' + r.score + (r.descriptorTitle ? '  [finish/room descriptor]' : '')));
  });
  console.log('\nReport:', path.join(outDir, 'DRYRUN_somersetbay_library_dedup_BY_CLAUDE_2026-06-08.json'));
  process.exit(0);
})().catch((e) => { console.error('ERROR', e); process.exit(1); });
