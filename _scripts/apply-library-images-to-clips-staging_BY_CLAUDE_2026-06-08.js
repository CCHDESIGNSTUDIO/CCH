'use strict';
/**
 * Pull Product Library images onto project CLIPS (so Selections/room board show them).
 * Matches each vendor clip to its library product by SKU (else normalized title), copies
 * imageUrl/image/images/heroImageIndex + links libraryProductId + houzzId. Backs up each clip.
 * STAGING ONLY. Dry-run unless --apply.
 *   node _scripts/apply-library-images-to-clips-staging_BY_CLAUDE_2026-06-08.js --project=shimano-maverick-cir --vendor="Jonathan Browning" --apply
 */
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const DRY = !process.argv.includes('--apply');
const arg = (k) => { const m = process.argv.find((a) => a.startsWith('--' + k + '=')); return m ? m.split('=').slice(1).join('=').replace(/^"|"$/g, '').trim() : ''; };
const PROJECT = arg('project'); const VEND = arg('vendor');
if (!PROJECT || !VEND) { console.error('Pass --project= and --vendor='); process.exit(1); }
const stgKey = require(path.join(__dirname, '..', '_debug', 'service-account.json', 'cch-studio-staging-firebase-adminsdk-fbsvc-b93c6f1cf4.json'));
const db = admin.initializeApp({ credential: admin.credential.cert(stgKey) }, 'stg').firestore();
const str = (v) => String(v == null ? '' : v).trim();
const hz = (o) => str(o && (o.houzzId || o.houzzProductId || o.catalogId));
const nt = (s) => str(s).toLowerCase().replace(/[^a-z0-9]+/g, '');
const re = new RegExp(VEND.replace(/[^a-z0-9]+/gi, '\\s*'), 'i');

(async () => {
  console.log((DRY ? 'DRY RUN' : 'APPLY') + ' — library images → clips — project=' + PROJECT + ' vendor="' + VEND + '"\n');
  // library index by sku + title
  const ps = await db.collection('products').get();
  const bySku = {}, byTitle = {};
  ps.forEach((d) => { const p = d.data() || {}; if (!re.test(str(p.vendor))) return; const rec = Object.assign({ _id: d.id }, p); if (str(p.sku)) bySku[str(p.sku).toLowerCase()] = rec; byTitle[nt(p.title || p.name)] = rec; });
  // clips
  const cs = await db.collection('boards').doc(PROJECT).collection('clips').get();
  const backups = []; let n = 0, miss = 0;
  for (const d of cs.docs) {
    const c = d.data() || {}; if (!re.test(str(c.vendor))) continue;
    const lib = (str(c.sku) && bySku[str(c.sku).toLowerCase()]) || byTitle[nt(c.title || c.name)];
    if (!lib) { console.log('  NO MATCH  "' + str(c.title || c.name) + '"  sku=' + str(c.sku)); miss++; continue; }
    const imgs = Array.isArray(lib.images) && lib.images.length ? lib.images.slice() : (str(lib.imageUrl) ? [str(lib.imageUrl)] : []);
    if (!imgs.length) { console.log('  lib has no imgs  "' + str(c.title || c.name) + '"'); continue; }
    backups.push({ clipId: d.id, prev: { imageUrl: c.imageUrl || null, image: c.image || null, images: c.images || null, libraryProductId: c.libraryProductId || null, houzzId: c.houzzId || null } });
    if (!DRY) await d.ref.update({ imageUrl: imgs[0], image: imgs[0], images: imgs, heroImageIndex: 0, libraryProductId: lib._id, houzzId: hz(lib) || c.houzzId || null, updatedAt: '2026-06-08T00:00:00.000Z' });
    n++;
    console.log('  ' + (DRY ? 'would link' : 'linked') + '  "' + str(c.title || c.name).slice(0, 34).padEnd(34) + '"  ← lib ' + lib._id + '  (' + imgs.length + ' imgs)');
  }
  const outDir = path.join(__dirname, '..', '_backup', 'clips-apply-from-library-staging-2026-06-08'); fs.mkdirSync(outDir, { recursive: true });
  if (!DRY) fs.writeFileSync(path.join(outDir, 'BACKUP_' + PROJECT + '_' + VEND.replace(/[^a-z0-9]+/gi, '_') + '.json'), JSON.stringify(backups, null, 2));
  console.log('\n' + (DRY ? 'WOULD link ' + n : 'LINKED ' + n) + ' clips to library images' + (miss ? ' (' + miss + ' no match)' : '') + '. ' + (DRY ? 'Add --apply.' : 'Backup saved. Hard-refresh staging.'));
  process.exit(0);
})().catch((e) => { console.error('ERROR', e); process.exit(1); });
