'use strict';
/**
 * Pull Product Library images onto ALL Bugletrail clips (STAGING ONLY).
 * Matches by SKU else normalized title against products tagged 7225-bugletrail.
 *
 *   node _scripts/apply-library-images-to-clips-bugletrail-staging_BY_CLAUDE_2026-06-09.js --dry-run
 *   node _scripts/apply-library-images-to-clips-bugletrail-staging_BY_CLAUDE_2026-06-09.js --apply --yes
 */
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const STAGING_PROJECT = 'cch-studio-staging';
const STG_KEY = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-studio-staging-firebase-adminsdk-fbsvc-b93c6f1cf4.json');
const OUT_DIR = path.join(__dirname, '..', '_backup', 'clips-apply-bugletrail-staging-2026-06-09');
const BOARD_ID = '7225-bugletrail';
const PROJECT_ID = '7225-bugletrail';
const PROJECT_NAME = '7225 Bugletrail';

const argv = process.argv.slice(2);
const DRY_RUN = !argv.includes('--apply');
const YES = argv.includes('--yes');

const stgKey = require(STG_KEY);
if (stgKey.project_id !== STAGING_PROJECT) {
  console.error('FATAL: staging key project_id must be', STAGING_PROJECT);
  process.exit(2);
}

const db = admin.initializeApp({ credential: admin.credential.cert(stgKey) }, 'stgClipSync').firestore();
const str = (v) => String(v == null ? '' : v).trim();
const hz = (o) => str(o && (o.houzzId || o.houzzProductId || o.catalogId));
const nt = (s) => str(s).toLowerCase().replace(/[^a-z0-9]+/g, '');

(async () => {
  console.log('=== BUGLETRAIL CLIP SYNC FROM LIBRARY — STAGING ONLY ===');
  console.log('Mode:', DRY_RUN ? 'DRY-RUN' : 'APPLY');
  console.log('Board:', BOARD_ID);
  if (!DRY_RUN && !YES) {
    console.error('Refusing --apply without --yes');
    process.exit(2);
  }

  const bySku = {};
  const byTitle = {};
  const seen = new Set();
  const queries = [
    db.collection('products').where('projectId', '==', PROJECT_ID).get(),
    db.collection('products').where('project', '==', PROJECT_NAME).get(),
  ];
  for (const snap of await Promise.all(queries)) {
    snap.forEach((d) => {
      if (seen.has(d.id)) return;
      seen.add(d.id);
      const p = d.data() || {};
      const rec = Object.assign({ _id: d.id }, p);
      if (str(p.sku)) bySku[str(p.sku).toLowerCase()] = rec;
      byTitle[nt(p.title || p.name)] = rec;
    });
  }
  console.log('Library index:', seen.size, 'products\n');

  const cs = await db.collection('boards').doc(BOARD_ID).collection('clips').get();
  const backups = [];
  let linked = 0;
  let skipped = 0;
  let noImgLib = 0;

  for (const d of cs.docs) {
    const c = d.data() || {};
    const lib = (str(c.sku) && bySku[str(c.sku).toLowerCase()]) || byTitle[nt(c.title || c.name)];
    if (!lib) {
      skipped++;
      continue;
    }
    const imgs = Array.isArray(lib.images) && lib.images.length
      ? lib.images.slice()
      : (str(lib.imageUrl) ? [str(lib.imageUrl)] : []);
    if (!imgs.length) {
      noImgLib++;
      continue;
    }
    backups.push({
      clipId: d.id,
      title: str(c.title || c.name),
      prev: {
        imageUrl: c.imageUrl || null,
        image: c.image || null,
        images: c.images || null,
        libraryProductId: c.libraryProductId || null,
        houzzId: c.houzzId || null,
      },
      next: { imageUrl: imgs[0], libraryProductId: lib._id, houzzId: hz(lib) },
    });
    if (!DRY_RUN) {
      await d.ref.update({
        imageUrl: imgs[0],
        image: imgs[0],
        images: imgs,
        heroImageIndex: 0,
        libraryProductId: lib._id,
        houzzId: hz(lib) || c.houzzId || null,
        updatedAt: new Date().toISOString(),
      });
    }
    linked++;
    if (linked <= 5 || linked % 50 === 0) {
      console.log((DRY_RUN ? 'would link' : 'linked'), linked, '-', str(c.title || c.name).slice(0, 40));
    }
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const stamp = DRY_RUN ? 'DRYRUN' : 'APPLIED';
  const outPath = path.join(OUT_DIR, stamp + '_clips_bugletrail_backup.json');
  fs.writeFileSync(outPath, JSON.stringify({
    generatedAt: new Date().toISOString(),
    boardId: BOARD_ID,
    mode: DRY_RUN ? 'dry-run' : 'apply',
    linked,
    skipped,
    noImgLib,
    backups,
  }, null, 2));

  console.log('\nClips total:', cs.size);
  console.log(DRY_RUN ? 'Would link:' : 'Linked:', linked);
  console.log('No library match:', skipped);
  console.log('Library match but no image:', noImgLib);
  console.log('Wrote:', outPath);
  process.exit(0);
})().catch((e) => { console.error('FAILED:', e); process.exit(1); });
