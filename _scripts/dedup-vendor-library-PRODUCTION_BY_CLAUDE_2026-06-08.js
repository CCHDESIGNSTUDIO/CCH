'use strict';
/**
 * PRODUCTION Product Library dedup (cch-design-boards products/). Groups by houzzId (fallback SKU,
 * then title); keeper = most images → meaningful-field-count → doc id. Dups (incl. finish/room-named
 * strays sharing a houzzId) → products_archive (Junk tab) with _archiveMeta.duplicateOf, deleted from
 * products. Backs up every moved doc. Dry-run unless --apply. *** PRODUCTION — Cynthia GO required. ***
 *   node _scripts/dedup-vendor-library-PRODUCTION_BY_CLAUDE_2026-06-08.js --vendor="Somerset Bay"
 *   node _scripts/dedup-vendor-library-PRODUCTION_BY_CLAUDE_2026-06-08.js --vendor="Somerset Bay" --apply
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
const META = new Set(['updatedAt', 'createdAt', 'owner', '_id', 'addedAt', '_houzzGalleryLinkedAt', '_categoryFixedAt']);
function fields(p) { let n = 0; Object.keys(p || {}).forEach((k) => { if (META.has(k)) return; const v = p[k]; if (v == null || v === '' || (typeof v === 'string' && !v.trim()) || (Array.isArray(v) && !v.length)) return; n++; }); return n; }
function imgs(o) { const s = new Set(); const add = (u) => { u = str(typeof u === 'string' ? u : (u && (u.url || u.imageUrl || u.src))); if (u) s.add(u); }; add(o.imageUrl); add(o.image); ['images', 'imageUrls', 'gallery', 'photos'].forEach((k) => { if (Array.isArray(o[k])) o[k].forEach(add); }); return s.size; }
function gkey(p) { const h = hz(p); if (h) return 'houzz:' + h; const s = str(p.sku); if (s) return 'sku:' + s.toLowerCase(); return 't:' + str(p.title || p.name).toLowerCase(); }
// Prefer the REAL product title (has a furniture/lighting noun) over a finish/color/room descriptor.
function realTitle(t) { return /\b(chest|cabinet|table|pendant|chandelier|sconce|nightstand|console|bed|bookshelf|bookcase|stool|bureau|cocktail|lantern|mirror|lamp|dresser|desk|chair|sofa|ottoman|bench|rug|drum|flush|mount|case|shade|drop|stand|pull|knob|barstool|armoire|credenza|vanity|hutch|étagère|etagere|sectional|settee|pouf|tray)\b/i.test(str(t)); }

(async () => {
  console.log('*** ' + (DRY ? 'DRY RUN (read-only)' : 'APPLY — PRODUCTION WRITE') + ' *** library dedup — vendor="' + vArg + '" — project cch-design-boards\n');
  const re = new RegExp(vArg.replace(/[^a-z0-9]+/gi, '\\s*'), 'i');
  const snap = await db.collection('products').get();
  const docs = []; snap.forEach((d) => { const p = d.data() || {}; if (re.test(str(p.vendor))) docs.push(Object.assign({ _id: d.id }, p)); });
  const groups = {}; docs.forEach((p) => { (groups[gkey(p)] = groups[gkey(p)] || []).push(p); });
  const removeToKeep = new Map(); const keepers = []; const removeList = [];
  Object.entries(groups).forEach(([k, rows]) => { if (rows.length < 2) { keepers.push(rows[0]); return; } rows.sort((a, b) => ((realTitle(b.title || b.name) ? 1 : 0) - (realTitle(a.title || a.name) ? 1 : 0)) || imgs(b) - imgs(a) || fields(b) - fields(a) || String(a._id).localeCompare(String(b._id))); keepers.push(rows[0]); rows.slice(1).forEach((r) => { removeToKeep.set(r._id, rows[0]); removeList.push(r); }); });

  const backups = [];
  for (const r of removeList) { const clean = Object.assign({}, r); delete clean._id; backups.push(clean);
    if (!DRY) { await db.collection('products_archive').doc(r._id).set(Object.assign({}, clean, { _archiveMeta: { reason: 'duplicate', duplicateOf: removeToKeep.get(r._id)._id, archivedAt: '2026-06-08T00:00:00.000Z', source: 'vendor-dedup-PROD_BY_CLAUDE_2026-06-08' } }));
      await db.collection('products').doc(r._id).delete(); } }

  const outDir = path.join(__dirname, '..', '_backup', 'PRODUCTION-vendor-dedup-2026-06-08'); fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, (DRY ? 'DRYRUN' : 'APPLIED') + '_' + vArg.replace(/[^a-z0-9]+/gi, '_') + '.json'), JSON.stringify({ dryRun: DRY, project: 'cch-design-boards', vendor: vArg, keep: keepers.map((k) => ({ id: k._id, title: str(k.title || k.name), imgs: imgs(k), hz: hz(k) })), removed: removeList.map((r) => ({ id: r._id, title: str(r.title || r.name), keepId: removeToKeep.get(r._id)._id })) }, null, 2));
  if (!DRY) fs.writeFileSync(path.join(outDir, 'BACKUP_' + vArg.replace(/[^a-z0-9]+/gi, '_') + '.json'), JSON.stringify(backups, null, 2));
  console.log('PRODUCTS:', docs.length, '| unique (would remain):', Object.keys(groups).length, '| dups ' + (DRY ? 'to move to Junk' : 'moved to Junk') + ':', removeList.length, '\n');
  keepers.forEach((k) => console.log('  KEEP   "' + str(k.title || k.name).slice(0, 44).padEnd(44) + '"  imgs=' + imgs(k) + '  hz=' + (hz(k) || '-')));
  console.log('');
  removeList.forEach((r) => console.log('  ' + (DRY ? 'would junk' : 'junked') + '  "' + str(r.title || r.name).slice(0, 44) + '"  → keep "' + str(removeToKeep.get(r._id).title || removeToKeep.get(r._id).name).slice(0, 28) + '"'));
  console.log('\n' + (DRY ? 'DRY RUN — nothing written. Cynthia GO required to --apply.' : 'Moved ' + removeList.length + ' dups to products_archive (Junk). Backup saved.'));
  process.exit(0);
})().catch((e) => { console.error('ERROR', e); process.exit(1); });
