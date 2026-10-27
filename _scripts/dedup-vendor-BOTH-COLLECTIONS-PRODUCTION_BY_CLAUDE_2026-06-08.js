'use strict';
/**
 * PRODUCTION cross-collection dedup for one vendor. The Product Library screen loads BOTH
 * products/ AND legacy productLibrary/ (index.html:51435-51436), so dups must be collapsed across
 * both. Groups by houzzId (fallback sku, then title) across BOTH collections; keeper preference:
 *   (1) lives in products/ (canonical, CLAUDE.md Rule 2)  (2) real product-noun title
 *   (3) most images  (4) most fields  (5) doc id
 * Every non-keeper is archived to its OWN archive collection (products_archive / productLibrary_archive)
 * with _archiveMeta.duplicateOf, then deleted from its live collection. productLibrary/ itself is NOT
 * deleted and NO new rows are written to it. Backs up every moved doc. Dry-run unless --apply.
 * *** PRODUCTION DATA — Cynthia typed GO required for --apply. ***
 *   node _scripts/dedup-vendor-BOTH-COLLECTIONS-PRODUCTION_BY_CLAUDE_2026-06-08.js --vendor="Somerset Bay"
 *   node _scripts/dedup-vendor-BOTH-COLLECTIONS-PRODUCTION_BY_CLAUDE_2026-06-08.js --vendor="Somerset Bay" --apply
 */
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const DRY = !process.argv.includes('--apply');
const vArg = (process.argv.find((a) => a.startsWith('--vendor=')) || '').split('=').slice(1).join('=').replace(/^"|"$/g, '').trim();
if (!vArg) { console.error('Pass --vendor="Name"'); process.exit(1); }
const PROD_KEY = require(path.join(__dirname, '..', '_debug', 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json'));
const db = admin.initializeApp({ credential: admin.credential.cert(PROD_KEY) }, 'PROD').firestore();
const str = (v) => String(v == null ? '' : v).trim();
const hz = (o) => str(o && (o.houzzId || o.houzzProductId || o.catalogId));
const META = new Set(['updatedAt', 'createdAt', 'owner', '_id', '_coll', 'addedAt', '_houzzGalleryLinkedAt', '_categoryFixedAt']);
function fields(p) { let n = 0; Object.keys(p || {}).forEach((k) => { if (META.has(k)) return; const v = p[k]; if (v == null || v === '' || (typeof v === 'string' && !v.trim()) || (Array.isArray(v) && !v.length)) return; n++; }); return n; }
function imgs(o) { const s = new Set(); const add = (u) => { u = str(typeof u === 'string' ? u : (u && (u.url || u.imageUrl || u.src))); if (u) s.add(u); }; add(o.imageUrl); add(o.image); ['images', 'imageUrls', 'gallery', 'photos'].forEach((k) => { if (Array.isArray(o[k])) o[k].forEach(add); }); return s.size; }
function gkey(p) { const h = hz(p); if (h) return 'houzz:' + h; const s = str(p.sku); if (s) return 'sku:' + s.toLowerCase(); return 't:' + str(p.title || p.name).toLowerCase(); }
function realTitle(t) { return /\b(chest|cabinet|table|pendant|chandelier|sconce|nightstand|console|bed|bookshelf|bookcase|stool|bureau|cocktail|lantern|mirror|lamp|dresser|desk|chair|sofa|ottoman|bench|rug|drum|flush|mount|case|shade|drop|stand|pull|knob|barstool|armoire|credenza|vanity|hutch|étagère|etagere|sectional|settee|pouf|tray|entertainment|bar)\b/i.test(str(t)); }
const archOf = (coll) => coll + '_archive';

(async () => {
  console.log('*** ' + (DRY ? 'DRY RUN (read-only)' : 'APPLY — PRODUCTION WRITE') + ' *** cross-collection dedup — vendor="' + vArg + '" — project cch-design-boards\n');
  const re = new RegExp(vArg.replace(/[^a-z0-9]+/gi, '\\s*'), 'i');
  const docs = [];
  for (const coll of ['products', 'productLibrary']) {
    const snap = await db.collection(coll).get();
    snap.forEach((d) => { const p = d.data() || {}; if (re.test(str(p.vendor))) docs.push(Object.assign({ _id: d.id, _coll: coll }, p)); });
  }
  const groups = {}; docs.forEach((p) => { (groups[gkey(p)] = groups[gkey(p)] || []).push(p); });
  const cmp = (a, b) =>
    ((a._coll === 'products' ? 1 : 0) - 0 === 1 && b._coll !== 'products' ? -1 : 0) ||
    ((b._coll === 'products' ? 1 : 0) - (a._coll === 'products' ? 1 : 0)) ||
    ((realTitle(b.title || b.name) ? 1 : 0) - (realTitle(a.title || a.name) ? 1 : 0)) ||
    (imgs(b) - imgs(a)) || (fields(b) - fields(a)) || String(a._id).localeCompare(String(b._id));
  const keepers = []; const removeList = []; const removeToKeep = new Map();
  Object.entries(groups).forEach(([k, rows]) => { rows.sort(cmp); keepers.push(rows[0]); rows.slice(1).forEach((r) => { removeToKeep.set(r._coll + '/' + r._id, rows[0]); removeList.push(r); }); });

  const backups = [];
  for (const r of removeList) { const clean = Object.assign({}, r); delete clean._id; delete clean._coll; backups.push(Object.assign({ _coll: r._coll, _id: r._id }, clean));
    if (!DRY) { const keep = removeToKeep.get(r._coll + '/' + r._id);
      await db.collection(archOf(r._coll)).doc(r._id).set(Object.assign({}, clean, { _archiveMeta: { reason: 'duplicate', duplicateOf: keep._id, duplicateOfColl: keep._coll, archivedAt: '2026-06-08T00:00:00.000Z', source: 'vendor-dedup-BOTH-PROD_BY_CLAUDE_2026-06-08' } }));
      await db.collection(r._coll).doc(r._id).delete(); } }

  const remainP = keepers.filter((k) => k._coll === 'products').length;
  const remainL = keepers.filter((k) => k._coll === 'productLibrary').length;
  const outDir = path.join(__dirname, '..', '_backup', 'PRODUCTION-vendor-dedup-BOTH-2026-06-08'); fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, (DRY ? 'DRYRUN' : 'APPLIED') + '_' + vArg.replace(/[^a-z0-9]+/gi, '_') + '.json'), JSON.stringify({ dryRun: DRY, project: 'cch-design-boards', vendor: vArg, totalScanned: docs.length, uniqueRemaining: keepers.length, remainInProducts: remainP, remainInProductLibrary: remainL, keep: keepers.map((k) => ({ coll: k._coll, id: k._id, title: str(k.title || k.name), imgs: imgs(k), hz: hz(k) })), removed: removeList.map((r) => ({ coll: r._coll, id: r._id, title: str(r.title || r.name), keepColl: removeToKeep.get(r._coll + '/' + r._id)._coll, keepId: removeToKeep.get(r._coll + '/' + r._id)._id })) }, null, 2));
  if (!DRY) fs.writeFileSync(path.join(outDir, 'BACKUP_' + vArg.replace(/[^a-z0-9]+/gi, '_') + '.json'), JSON.stringify(backups, null, 2));

  console.log('SCANNED:', docs.length, '(products + productLibrary) | unique remaining:', keepers.length, '→ products/:', remainP, ' productLibrary/:', remainL, '| dups ' + (DRY ? 'to move' : 'moved') + ':', removeList.length, '\n');
  console.log('KEEP (canonical per houzzId):');
  keepers.forEach((k) => console.log('  [' + k._coll.padEnd(14) + '] "' + str(k.title || k.name).slice(0, 40).padEnd(40) + '"  imgs=' + imgs(k) + '  hz=' + (hz(k) || '-')));
  console.log('\n' + (DRY ? 'WOULD JUNK' : 'JUNKED') + ':');
  removeList.forEach((r) => { const keep = removeToKeep.get(r._coll + '/' + r._id); console.log('  [' + r._coll.padEnd(14) + '] "' + str(r.title || r.name).slice(0, 40).padEnd(40) + '"  → keep [' + keep._coll + '] "' + str(keep.title || keep.name).slice(0, 24) + '"'); });
  console.log('\n' + (DRY ? 'DRY RUN — nothing written to Firestore. Cynthia typed GO required to --apply.' : 'Moved ' + removeList.length + ' dups to *_archive (Junk). Backup saved. ' + outDir));
  process.exit(0);
})().catch((e) => { console.error('ERROR', e); process.exit(1); });
