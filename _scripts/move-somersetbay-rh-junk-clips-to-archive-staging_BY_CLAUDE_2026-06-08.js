'use strict';
/**
 * Remove non-main-product Somerset Bay CLIPS from Cloud-Rolling-Hills room board (STAGING):
 * group by houzzId, keep the canonical real-product clip, archive the rest (room/finish-named
 * import junk + exact dups) to clips_archive, repoint RH doc-line clipId refs → canonical clip.
 * Backs up every removed clip. STAGING ONLY. Dry-run by default; --apply to write.
 */
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const DRY = !process.argv.includes('--apply');
const KEY_DIR = path.join(__dirname, '..', '_debug', 'service-account.json');
const stgKey = require(path.join(KEY_DIR, 'cch-studio-staging-firebase-adminsdk-fbsvc-b93c6f1cf4.json'));
const db = admin.initializeApp({ credential: admin.credential.cert(stgKey) }, 'stg').firestore();

const PROJECT = 'cloud-rolling-hills';
const VENDOR_RE = /somerset\s*bay/i;
const str = (v) => String(v == null ? '' : v).trim();
const houzzIdOf = (o) => str(o && (o.houzzId || o.houzzProductId || o.catalogId));
function imgCount(o) { const s = new Set(); const add = (u) => { u = str(typeof u === 'string' ? u : (u && (u.url || u.imageUrl || u.src))); if (u) s.add(u); }; add(o.imageUrl); add(o.image); ['images', 'imageUrls', 'gallery', 'photos'].forEach((k) => { if (Array.isArray(o[k])) o[k].forEach(add); }); return s.size; }
function isDescriptor(t) { t = str(t).toLowerCase(); if (/\broom\b/.test(t)) return true; if (/^(black forest|lack forest|ebony|vanilla bean)/.test(t)) return true; if (/\bvanilla bean\b/.test(t) && t.split(/\s+/).length <= 5) return true; return false; }
function score(c) { let s = 0; if (!isDescriptor(c.title || c.name)) s += 100; if (str(c.libraryProductId || c.linkedLibraryProductId)) s += 10; if (str(c.sku)) s += 5; s += imgCount(c); s += str(c.title || c.name).length > 6 ? 2 : 0; return s; }

(async () => {
  console.log(DRY ? '=== DRY RUN (no writes) ===' : '=== APPLY to STAGING ===');
  const snap = await db.collection('boards').doc(PROJECT).collection('clips').get();
  const sb = []; snap.forEach((d) => { const c = d.data() || {}; if (VENDOR_RE.test(str(c.vendor))) sb.push(Object.assign({ _id: d.id }, c)); });
  const groups = {}; sb.forEach((c) => { const h = houzzIdOf(c) || ('t:' + str(c.title || c.name).toLowerCase()); (groups[h] = groups[h] || []).push(c); });

  const remove = []; const keepById = {}; const removeToCanon = new Map();
  Object.values(groups).forEach((rows) => {
    rows.sort((a, b) => score(b) - score(a) || String(a._id).localeCompare(String(b._id)));
    const keep = rows[0]; keepById[keep._id] = keep;
    rows.slice(1).forEach((r) => { remove.push(r); removeToCanon.set(r._id, keep); });
  });

  // repoint RH doc-line clipId refs (junk clip -> canonical clip)
  const repoints = [];
  for (const col of ['invoices', 'proposals', 'purchaseOrders']) {
    const ds = await db.collection('boards').doc(PROJECT).collection(col).get();
    for (const d of ds.docs) {
      const data = d.data() || {}; const items = Array.isArray(data.items) ? data.items : null; if (!items) continue;
      let changed = false;
      const next = items.map((it) => { const cid = str(it && (it.clipId || it.sourceClipId)); if (removeToCanon.has(cid)) { changed = true; const canon = removeToCanon.get(cid); repoints.push({ col, doc: d.id, fromClip: cid, toClip: canon._id }); return Object.assign({}, it, { clipId: canon._id }); } return it; });
      if (changed && !DRY) await d.ref.update({ items: next, updatedAt: '2026-06-08T00:00:00.000Z' });
    }
  }

  const backups = [];
  for (const c of remove) {
    const clean = Object.assign({}, c); delete clean._id;
    backups.push(Object.assign({ _clipId: c._id }, clean));
    if (!DRY) {
      await db.collection('boards').doc(PROJECT).collection('clips_archive').doc(c._id).set(Object.assign({}, clean, { _archiveMeta: { reason: 'not-main-product (import junk / dup)', canonicalClipId: removeToCanon.get(c._id)._id, archivedAt: '2026-06-08T00:00:00.000Z', source: 'somersetbay-clip-dedup_BY_CLAUDE_2026-06-08' } }));
      await db.collection('boards').doc(PROJECT).collection('clips').doc(c._id).delete();
    }
  }

  const outDir = path.join(__dirname, '..', '_backup', 'somersetbay-rh-junk-clips-staging-2026-06-08');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, (DRY ? 'DRYRUN' : 'APPLIED') + '_manifest.json'), JSON.stringify({ dryRun: DRY, env: 'STAGING', removed: remove.map((r) => ({ clipId: r._id, title: str(r.title || r.name), houzzId: houzzIdOf(r), keepClip: removeToCanon.get(r._id)._id, keepTitle: str(removeToCanon.get(r._id).title) })), repoints, kept: Object.values(keepById).map((k) => ({ clipId: k._id, title: str(k.title || k.name) })) }, null, 2));
  if (!DRY) fs.writeFileSync(path.join(outDir, 'REMOVED_CLIPS_BACKUP.json'), JSON.stringify(backups, null, 2));

  console.log('Somerset Bay RH clips:', sb.length, '| KEEP (main product):', Object.keys(keepById).length, '| REMOVE (not main):', remove.length, '| doc repoints:', repoints.length, '\n');
  Object.values(keepById).forEach((k) => console.log('  KEEP    "' + str(k.title || k.name) + '"  hz=' + houzzIdOf(k)));
  console.log('');
  remove.forEach((r) => console.log('  ' + (DRY ? 'would remove' : 'removed') + '  "' + str(r.title || r.name) + '"  hz=' + houzzIdOf(r) + '  → keep "' + str(removeToCanon.get(r._id).title) + '"'));
  console.log('\n' + (DRY ? 'WOULD remove ' + remove.length + ' clips. Re-run with --apply.' : 'REMOVED ' + remove.length + ' clips to clips_archive. Backup in ' + outDir));
  process.exit(0);
})().catch((e) => { console.error('ERROR', e); process.exit(1); });
