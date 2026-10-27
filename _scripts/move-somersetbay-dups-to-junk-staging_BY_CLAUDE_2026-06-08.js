'use strict';
/**
 * Move Somerset Bay DUPLICATE library rows into the Junk tab on STAGING:
 *   products/{dupId} -> products_archive/{dupId} (+ _archiveMeta), then delete products/{dupId}.
 * Keeps the canonical row. Repoints Cloud-Rolling-Hills clip/line libraryProductId dup->canonical
 * so nothing orphans. Backs up every moved doc. Fully restorable via the Junk tab.
 *
 * STAGING ONLY. Dry-run by default; --apply to write.
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
const META = new Set(['updatedAt', 'createdAt', 'owner', '_id', 'addedAt', '_houzzGalleryLinkedAt', '_categoryFixedAt', '_enrichedFromHouzzApr27']);
function meaningfulFields(p) { let n = 0; Object.keys(p || {}).forEach((k) => { if (META.has(k)) return; const v = p[k]; if (v == null || v === '' || (typeof v === 'string' && !v.trim()) || (Array.isArray(v) && !v.length)) return; n++; }); return n; }
function imgCount(o) { const s = new Set(); const add = (u) => { u = str(typeof u === 'string' ? u : (u && (u.url || u.imageUrl || u.src))); if (u) s.add(u); }; add(o.imageUrl); add(o.image); ['images', 'imageUrls', 'gallery', 'photos'].forEach((k) => { if (Array.isArray(o[k])) o[k].forEach(add); }); return s.size; }
function descriptorTitle(t) { t = str(t).toLowerCase(); if (/\broom\b/.test(t)) return true; if (/^(black forest|lack forest|ebony|vanilla bean)/.test(t)) return true; if (/\bvanilla bean\b/.test(t) && t.split(/\s+/).length <= 5) return true; return false; }
function score(p) { let s = meaningfulFields(p); if (str(p.sku)) s += 5; if (houzzIdOf(p)) s += 5; if (!descriptorTitle(p.title || p.name)) s += 20; s += imgCount(p); return s; }
function groupKey(p) { const h = houzzIdOf(p); if (h) return 'houzz:' + h; const s = str(p.sku); if (s) return 'sku:' + s.toLowerCase(); return 'tv:' + str(p.title || p.name).toLowerCase() + '|' + str(p.vendor).toLowerCase(); }

(async () => {
  console.log(DRY ? '=== DRY RUN (no writes) ===' : '=== APPLY to STAGING ===');
  // 1) Somerset Bay products on staging → dedup groups
  let docs = [];
  try { const q = await db.collection('products').where('vendor', '==', 'Somerset Bay').get(); q.forEach((d) => docs.push(Object.assign({ _id: d.id }, d.data()))); } catch (e) {}
  if (!docs.length) { const all = await db.collection('products').get(); all.forEach((d) => { const p = d.data() || {}; if (VENDOR_RE.test(str(p.vendor))) docs.push(Object.assign({ _id: d.id }, p)); }); }
  const groups = {}; docs.forEach((p) => { (groups[groupKey(p)] = groups[groupKey(p)] || []).push(p); });
  const dupToCanon = new Map(); const retireIds = [];
  Object.values(groups).forEach((rows) => { if (rows.length < 2) return; rows.sort((a, b) => score(b) - score(a) || String(a._id).localeCompare(String(b._id))); const keep = rows[0]; rows.slice(1).forEach((r) => { dupToCanon.set(r._id, { canonicalId: keep._id, dup: r }); retireIds.push(r._id); }); });

  // 2) Find RH references to the dup ids (clips + doc items) → repoint to canonical
  const repoints = [];
  const clipSnap = await db.collection('boards').doc(PROJECT).collection('clips').get();
  for (const d of clipSnap.docs) {
    const c = d.data() || {};
    const lid = str(c.libraryProductId || c.linkedLibraryProductId);
    if (dupToCanon.has(lid)) {
      const canon = dupToCanon.get(lid).canonicalId;
      repoints.push({ type: 'clip', id: d.id, from: lid, to: canon });
      if (!DRY) await d.ref.update({ libraryProductId: canon, updatedAt: '2026-06-08T00:00:00.000Z' });
    }
  }
  for (const col of ['invoices', 'proposals', 'purchaseOrders']) {
    const snap = await db.collection('boards').doc(PROJECT).collection(col).get();
    for (const d of snap.docs) {
      const data = d.data() || {}; const items = Array.isArray(data.items) ? data.items : null; if (!items) continue;
      let changed = false;
      const next = items.map((it) => { const lid = str(it && (it.libraryProductId || it.linkedLibraryProductId)); if (dupToCanon.has(lid)) { changed = true; repoints.push({ type: col, doc: d.id, from: lid, to: dupToCanon.get(lid).canonicalId }); return Object.assign({}, it, { libraryProductId: dupToCanon.get(lid).canonicalId }); } return it; });
      if (changed && !DRY) await d.ref.update({ items: next, updatedAt: '2026-06-08T00:00:00.000Z' });
    }
  }

  // 3) Move each dup → products_archive, delete from products. Back up first.
  const backups = []; const moved = [];
  for (const id of retireIds) {
    const info = dupToCanon.get(id); const data = info.dup; const clean = Object.assign({}, data); delete clean._id;
    backups.push(clean);
    moved.push({ id, title: str(data.title || data.name).slice(0, 46), sku: str(data.sku), houzzId: houzzIdOf(data), duplicateOf: info.canonicalId });
    if (!DRY) {
      const archiveDoc = Object.assign({}, clean, { _archiveMeta: { reason: 'duplicate', duplicateOf: info.canonicalId, archivedAt: '2026-06-08T00:00:00.000Z', source: 'somersetbay-dedup_BY_CLAUDE_2026-06-08' } });
      await db.collection('products_archive').doc(id).set(archiveDoc);
      await db.collection('products').doc(id).delete();
    }
  }

  const outDir = path.join(__dirname, '..', '_backup', 'somersetbay-dedup-junk-staging-2026-06-08');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, (DRY ? 'DRYRUN' : 'APPLIED') + '_manifest.json'), JSON.stringify({ dryRun: DRY, env: 'STAGING', movedToJunk: moved, repoints }, null, 2));
  if (!DRY) fs.writeFileSync(path.join(outDir, 'MOVED_DOCS_BACKUP.json'), JSON.stringify(backups, null, 2));

  console.log('Duplicates to move to Junk:', moved.length, '| references repointed:', repoints.length, '\n');
  moved.forEach((m) => console.log('  ' + (DRY ? 'would move' : 'moved') + '  ' + m.id + '  "' + m.title + '"  sku=' + m.sku + '  → keep ' + m.duplicateOf));
  if (repoints.length) { console.log('\nRepoints:'); repoints.forEach((r) => console.log('  ' + r.type + ' ' + (r.id || r.doc) + '  ' + r.from + ' → ' + r.to)); }
  console.log('\n' + (DRY ? 'WOULD move ' + moved.length + ' dups to Junk. Re-run with --apply.' : 'MOVED ' + moved.length + ' dups to Junk (products_archive). Backup + manifest in ' + outDir));
  process.exit(0);
})().catch((e) => { console.error('ERROR', e); process.exit(1); });
