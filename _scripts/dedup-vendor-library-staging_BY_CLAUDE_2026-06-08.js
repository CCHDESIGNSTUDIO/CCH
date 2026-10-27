'use strict';
/**
 * Vendor-parameterized Product Library dedup (STAGING products/). Groups by houzzId
 * (fallback SKU, then title), keeper = most images → meaningful-field-count → doc id.
 * Dups → products_archive (Junk) with _archiveMeta.duplicateOf, deleted from products.
 * Backs up every moved doc. STAGING ONLY. Dry-run unless --apply.
 *   node _scripts/dedup-vendor-library-staging_BY_CLAUDE_2026-06-08.js --vendor="Jonathan Browning"
 */
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const DRY = !process.argv.includes('--apply');
const vArg = (process.argv.find((a) => a.startsWith('--vendor=')) || '').split('=').slice(1).join('=').replace(/^"|"$/g, '').trim();
if (!vArg) { console.error('Pass --vendor="Name"'); process.exit(1); }
const stgKey = require(path.join(__dirname, '..', '_debug', 'service-account.json', 'cch-studio-staging-firebase-adminsdk-fbsvc-b93c6f1cf4.json'));
const db = admin.initializeApp({ credential: admin.credential.cert(stgKey) }, 'stg').firestore();
const str = (v) => String(v == null ? '' : v).trim();
const hz = (o) => str(o && (o.houzzId || o.houzzProductId || o.catalogId));
const META = new Set(['updatedAt', 'createdAt', 'owner', '_id', 'addedAt', '_houzzGalleryLinkedAt', '_categoryFixedAt']);
function fields(p) { let n = 0; Object.keys(p || {}).forEach((k) => { if (META.has(k)) return; const v = p[k]; if (v == null || v === '' || (typeof v === 'string' && !v.trim()) || (Array.isArray(v) && !v.length)) return; n++; }); return n; }
function imgs(o) { const s = new Set(); const add = (u) => { u = str(typeof u === 'string' ? u : (u && (u.url || u.imageUrl || u.src))); if (u) s.add(u); }; add(o.imageUrl); add(o.image); ['images', 'imageUrls', 'gallery', 'photos'].forEach((k) => { if (Array.isArray(o[k])) o[k].forEach(add); }); return s.size; }
function gkey(p) { const h = hz(p); if (h) return 'houzz:' + h; const s = str(p.sku); if (s) return 'sku:' + s.toLowerCase(); return 't:' + str(p.title || p.name).toLowerCase(); }

(async () => {
  console.log((DRY ? 'DRY RUN' : 'APPLY') + ' — library dedup — vendor="' + vArg + '" (STAGING)\n');
  const re = new RegExp(vArg.replace(/[^a-z0-9]+/gi, '\\s*'), 'i');
  const snap = await db.collection('products').get();
  const docs = []; snap.forEach((d) => { const p = d.data() || {}; if (re.test(str(p.vendor))) docs.push(Object.assign({ _id: d.id }, p)); });
  const groups = {}; docs.forEach((p) => { (groups[gkey(p)] = groups[gkey(p)] || []).push(p); });
  const removeToKeep = new Map(); const keepers = []; const removeList = [];
  Object.entries(groups).forEach(([k, rows]) => { if (rows.length < 2) { keepers.push({ k, keep: rows[0] }); return; } rows.sort((a, b) => imgs(b) - imgs(a) || fields(b) - fields(a) || String(a._id).localeCompare(String(b._id))); keepers.push({ k, keep: rows[0] }); rows.slice(1).forEach((r) => { removeToKeep.set(r._id, rows[0]); removeList.push(r); }); });

  const backups = [];
  for (const r of removeList) { const clean = Object.assign({}, r); delete clean._id; backups.push(clean);
    if (!DRY) { await db.collection('products_archive').doc(r._id).set(Object.assign({}, clean, { _archiveMeta: { reason: 'duplicate', duplicateOf: removeToKeep.get(r._id)._id, archivedAt: '2026-06-08T00:00:00.000Z', source: 'vendor-dedup_BY_CLAUDE_2026-06-08' } }));
      await db.collection('products').doc(r._id).delete(); } }

  const outDir = path.join(__dirname, '..', '_backup', 'vendor-library-dedup-staging-2026-06-08'); fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, (DRY ? 'DRYRUN' : 'APPLIED') + '_' + vArg.replace(/[^a-z0-9]+/gi, '_') + '.json'), JSON.stringify({ dryRun: DRY, vendor: vArg, keep: keepers.map((g) => ({ id: g.keep._id, title: str(g.keep.title || g.keep.name), imgs: imgs(g.keep) })), removed: removeList.map((r) => ({ id: r._id, title: str(r.title || r.name), keepId: removeToKeep.get(r._id)._id })) }, null, 2));
  if (!DRY) fs.writeFileSync(path.join(outDir, 'BACKUP_' + vArg.replace(/[^a-z0-9]+/gi, '_') + '.json'), JSON.stringify(backups, null, 2));
  console.log('products:', docs.length, '| unique:', Object.keys(groups).length, '| dups ' + (DRY ? 'to remove' : 'removed') + ':', removeList.length, '\n');
  keepers.forEach((g) => console.log('  KEEP   "' + str(g.keep.title || g.keep.name).slice(0, 44).padEnd(44) + '"  imgs=' + imgs(g.keep) + '  hz=' + (hz(g.keep) || '-')));
  console.log('');
  removeList.forEach((r) => console.log('  ' + (DRY ? 'would remove' : 'removed') + '  "' + str(r.title || r.name).slice(0, 44) + '"  → keep "' + str(removeToKeep.get(r._id).title || removeToKeep.get(r._id).name).slice(0, 30) + '"'));
  console.log('\n' + (DRY ? 'Re-run with --apply to move dups to Junk.' : 'Moved ' + removeList.length + ' dups to products_archive (Junk).'));
  process.exit(0);
})().catch((e) => { console.error('ERROR', e); process.exit(1); });
