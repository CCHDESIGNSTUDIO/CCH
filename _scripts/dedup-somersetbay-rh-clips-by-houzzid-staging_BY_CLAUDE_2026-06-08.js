'use strict';
/**
 * Dedup Somerset Bay CLIPS in Cloud-Rolling-Hills (STAGING) — grouped by HOUZZID (the corrected
 * key; the platform's title+vendor dedup misses these strays). Keeper = most images, tiebreak by
 * a faithful copy of the platform's _clipCompletenessScore (index.html:52943). Strays → clips_archive
 * (Junk), repoint RH doc-line clipId refs to keeper, back up every removed clip.
 * STAGING ONLY. Dry-run by default; --apply to write.
 */
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const DRY = !process.argv.includes('--apply');
const stgKey = require(path.join(__dirname, '..', '_debug', 'service-account.json', 'cch-studio-staging-firebase-adminsdk-fbsvc-b93c6f1cf4.json'));
const db = admin.initializeApp({ credential: admin.credential.cert(stgKey) }, 'stg').firestore();
const PROJECT = 'cloud-rolling-hills';
const VENDOR_RE = /somerset\s*bay/i;
const str = (v) => String(v == null ? '' : v).trim();
const hz = (o) => str(o && (o.houzzId || o.houzzProductId || o.catalogId));

// faithful copy of platform _clipCompletenessScore (index.html:52943)
function clipHasImage(c) { return !!(c.imageUrl || c.image || (Array.isArray(c.images) && c.images.length)); }
function clipHasPricing(c) { return [c.cost, c.costPrice, c.unitCost, c.clientPrice, c.sellPrice, c.unitSellingPrice, c.totalSelling].some((v) => parseFloat(v) > 0); }
function completeness(c) { let s = 0; if (clipHasImage(c)) s += 4; if (str(c.room)) s += 3; if (clipHasPricing(c)) s += 3; if (str(c.description)) s += 1; if (str(c.sku)) s += 1; if (str(c.productUrl || c.url)) s += 1; return s; }
function imgCount(o) { const set = new Set(); const add = (u) => { u = str(typeof u === 'string' ? u : (u && (u.url || u.imageUrl || u.src))); if (u) set.add(u); }; add(o.imageUrl); add(o.image); ['images', 'imageUrls', 'gallery', 'photos'].forEach((k) => { if (Array.isArray(o[k])) o[k].forEach(add); }); return set.size; }

(async () => {
  console.log(DRY ? '=== DRY RUN (no writes) ===' : '=== APPLY to STAGING ===');
  const snap = await db.collection('boards').doc(PROJECT).collection('clips').get();
  const all = []; snap.forEach((d) => all.push(Object.assign({ _id: d.id }, d.data() || {})));
  // target houzzIds = those that have at least one Somerset Bay clip
  const targetHids = new Set(); all.forEach((c) => { if (VENDOR_RE.test(str(c.vendor)) && hz(c)) targetHids.add(hz(c)); });
  // group ALL clips (any vendor) sharing a target houzzId → catches blank-vendor strays
  const sb = all.filter((c) => hz(c) && targetHids.has(hz(c)));
  const groups = {}; sb.forEach((c) => { (groups[hz(c)] = groups[hz(c)] || []).push(c); });

  const removeToKeep = new Map(); const keepers = []; const removeList = [];
  Object.entries(groups).forEach(([k, rows]) => {
    rows.sort((a, b) => imgCount(b) - imgCount(a) || completeness(b) - completeness(a) || String(a._id).localeCompare(String(b._id)));
    const keep = rows[0]; keepers.push({ key: k, keep });
    rows.slice(1).forEach((r) => { removeToKeep.set(r._id, keep); removeList.push(r); });
  });

  const repoints = [];
  for (const col of ['invoices', 'proposals', 'purchaseOrders']) {
    const ds = await db.collection('boards').doc(PROJECT).collection(col).get();
    for (const d of ds.docs) {
      const data = d.data() || {}; const items = Array.isArray(data.items) ? data.items : null; if (!items) continue; let changed = false;
      const next = items.map((it) => { const cid = str(it && (it.clipId || it.sourceClipId)); if (removeToKeep.has(cid)) { changed = true; repoints.push({ col, doc: d.id, fromClip: cid, toClip: removeToKeep.get(cid)._id }); return Object.assign({}, it, { clipId: removeToKeep.get(cid)._id }); } return it; });
      if (changed && !DRY) await d.ref.update({ items: next, updatedAt: '2026-06-08T00:00:00.000Z' });
    }
  }

  const backups = [];
  for (const r of removeList) { const clean = Object.assign({}, r); delete clean._id; backups.push(Object.assign({ _clipId: r._id }, clean));
    if (!DRY) { await db.collection('boards').doc(PROJECT).collection('clips_archive').doc(r._id).set(Object.assign({}, clean, { _archiveMeta: { reason: 'stray-clip (import junk / dup, same houzzId)', keeperClipId: removeToKeep.get(r._id)._id, archivedAt: '2026-06-08T00:00:00.000Z', source: 'somersetbay-clip-dedup_BY_CLAUDE_2026-06-08' } }));
      await db.collection('boards').doc(PROJECT).collection('clips').doc(r._id).delete(); } }

  const outDir = path.join(__dirname, '..', '_backup', 'somersetbay-rh-clip-dedup-staging-2026-06-08');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, (DRY ? 'DRYRUN' : 'APPLIED') + '_manifest.json'), JSON.stringify({ dryRun: DRY, env: 'STAGING', groupedBy: 'houzzId', keeperRule: 'most images, then platform _clipCompletenessScore', keepers: keepers.map((g) => ({ houzzId: g.key, keepClip: g.keep._id, title: str(g.keep.title || g.keep.name), imgs: imgCount(g.keep), score: completeness(g.keep) })), removed: removeList.map((r) => ({ clipId: r._id, title: str(r.title || r.name), houzzId: hz(r), imgs: imgCount(r), score: completeness(r), keepClip: removeToKeep.get(r._id)._id })), repoints }, null, 2));
  if (!DRY) fs.writeFileSync(path.join(outDir, 'REMOVED_CLIPS_BACKUP.json'), JSON.stringify(backups, null, 2));

  console.log('Somerset Bay RH clips:', sb.length, '| houzzId groups:', Object.keys(groups).length, '| KEEP:', keepers.length, '| REMOVE strays:', removeList.length, '| doc repoints:', repoints.length, '\n');
  keepers.forEach((g) => console.log('  KEEP   hz=' + g.key.padEnd(10) + ' "' + str(g.keep.title || g.keep.name) + '"  imgs=' + imgCount(g.keep) + '  score=' + completeness(g.keep)));
  console.log('');
  removeList.forEach((r) => console.log('  ' + (DRY ? 'would remove' : 'removed') + '  "' + str(r.title || r.name) + '"  hz=' + hz(r) + '  imgs=' + imgCount(r) + '  score=' + completeness(r) + '  → keep "' + str(removeToKeep.get(r._id).title || removeToKeep.get(r._id).name) + '"'));
  console.log('\n' + (DRY ? 'WOULD remove ' + removeList.length + ' stray clips. Re-run with --apply.' : 'REMOVED ' + removeList.length + ' stray clips to clips_archive. Backup in ' + outDir));
  process.exit(0);
})().catch((e) => { console.error('ERROR', e); process.exit(1); });
