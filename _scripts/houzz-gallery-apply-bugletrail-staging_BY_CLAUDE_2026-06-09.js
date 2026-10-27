'use strict';
/**
 * Bugletrail pilot — link houzz-products gallery into products.images[] (STAGING ONLY).
 *
 * Targets 2 hardware keepers with 2 Storage slots (SUAVE has 1 only — skipped).
 *
 * Usage:
 *   node _scripts/houzz-gallery-apply-bugletrail-staging_BY_CLAUDE_2026-06-09.js --dry-run
 *   node _scripts/houzz-gallery-apply-bugletrail-staging_BY_CLAUDE_2026-06-09.js --apply --yes
 */
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const STAGING_PROJECT = 'cch-studio-staging';
const STG_KEY = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-studio-staging-firebase-adminsdk-fbsvc-b93c6f1cf4.json');
const OUT_DIR = path.join(__dirname, '..', '_backup', 'houzz-gallery-apply-bugletrail-staging-2026-06-09');
const LINK_VERSION = '2026-06-09-bugletrail-pilot';

const TARGETS = [
  { docId: '11p3CdBTC7bWSWDf3U1B', houzzId: '33491303', title: 'HDW20338 bracket' },
  { docId: '0Yunvqw9mRNORhB20IRK', houzzId: '33491409', title: 'HDW20230 iron rod' },
];

const argv = process.argv.slice(2);
const DRY_RUN = !argv.includes('--apply');
const YES = argv.includes('--yes');

const stgKey = require(STG_KEY);
if (stgKey.project_id !== STAGING_PROJECT) {
  console.error('FATAL: staging key project_id must be', STAGING_PROJECT);
  process.exit(2);
}

const app = admin.initializeApp({ credential: admin.credential.cert(stgKey) }, 'stgGallery');
const db = app.firestore();

const houzzIdToUrls = new Map();

function str(v) { return String(v == null ? '' : v).trim(); }
function isHouzzProductsUrl(u) {
  return /houzz-products%2F|houzz-products\//i.test(str(u));
}

function loadManifests() {
  const files = [
    path.join(__dirname, '..', '_debug', 'phase2a-upload-manifest.json'),
    path.join(__dirname, '..', '_debug', 'phase2a-extended-manifest.json'),
    path.join(__dirname, '..', '_debug', 'phase4a-upload-manifest.json'),
  ];
  for (const fp of files) {
    if (!fs.existsSync(fp)) continue;
    const data = JSON.parse(fs.readFileSync(fp, 'utf8'));
    for (const r of data.results || data.uploads || []) {
      if (r.status && r.status !== 'ok') continue;
      const hid = str(r.houzzId || r.sourceId);
      const url = str(r.downloadUrl);
      const slot = parseInt(r.slot, 10) || 99;
      if (!hid || !url || !isHouzzProductsUrl(url)) continue;
      if (!houzzIdToUrls.has(hid)) houzzIdToUrls.set(hid, []);
      houzzIdToUrls.get(hid).push({ slot, url });
    }
  }
  for (const [hid, slots] of houzzIdToUrls.entries()) {
    const seen = new Set();
    const sorted = slots.sort((a, b) => a.slot - b.slot).filter((s) => {
      const k = s.url.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    houzzIdToUrls.set(hid, sorted.map((s) => s.url));
  }
}

function shouldSkip(doc, urls) {
  if (!doc) return 'missing';
  if (doc._imageLocked === true || doc._imageManual === true) return 'image_locked_or_manual';
  const images = Array.isArray(doc.images) ? doc.images : [];
  const linked = images.filter((u) => isHouzzProductsUrl(typeof u === 'string' ? u : (u && u.url))).length;
  if (linked >= urls.length && urls.length >= 2) return 'already_linked';
  if (urls.length < 2) return 'storage_single';
  return '';
}

function buildPatch(doc, urls, houzzId) {
  const now = new Date().toISOString();
  const patch = {
    houzzId: houzzId,
    images: urls,
    heroImageIndex: 0,
    updatedAt: now,
    _houzzGalleryLinkedAt: now,
    _houzzGalleryLinkVersion: LINK_VERSION,
  };
  const cur = str(doc.imageUrl || doc.image);
  if (!cur || !isHouzzProductsUrl(cur)) {
    patch.imageUrl = urls[0];
    patch.image = urls[0];
  }
  return patch;
}

(async () => {
  console.log('=== BUGLETRAIL GALLERY APPLY — STAGING ONLY ===');
  console.log('Mode:', DRY_RUN ? 'DRY-RUN' : 'APPLY');
  if (!DRY_RUN && !YES) {
    console.error('Refusing --apply without --yes');
    process.exit(2);
  }

  loadManifests();
  const changes = [];
  const backups = [];

  for (const t of TARGETS) {
    const urls = houzzIdToUrls.get(t.houzzId) || [];
    const ref = db.collection('products').doc(t.docId);
    const snap = await ref.get();
    if (!snap.exists) {
      changes.push({ docId: t.docId, action: 'skip', reason: 'doc_missing' });
      continue;
    }
    const before = snap.data() || {};
    backups.push({ docId: t.docId, before: JSON.parse(JSON.stringify(before)) });

    const skip = shouldSkip(before, urls);
    if (skip) {
      changes.push({
        docId: t.docId,
        houzzId: t.houzzId,
        title: t.title,
        action: 'skip',
        reason: skip,
        manifestUrlCount: urls.length,
        currentImagesCount: (before.images || []).length,
      });
      continue;
    }

    const patch = buildPatch(before, urls, t.houzzId);
    changes.push({
      docId: t.docId,
      houzzId: t.houzzId,
      title: t.title,
      action: DRY_RUN ? 'would_apply' : 'applied',
      manifestUrlCount: urls.length,
      beforeImageUrl: str(before.imageUrl).slice(0, 100),
      beforeImagesCount: (before.images || []).length,
      newImages: urls,
      patch,
    });

    if (!DRY_RUN) {
      await ref.set(patch, { merge: true });
    }
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const stamp = DRY_RUN ? 'DRYRUN' : 'APPLIED';
  const outPath = path.join(OUT_DIR, stamp + '_gallery_bugletrail_2hardware.json');
  fs.writeFileSync(outPath, JSON.stringify({
    generatedAt: new Date().toISOString(),
    project: STAGING_PROJECT,
    mode: DRY_RUN ? 'dry-run' : 'apply',
    targets: TARGETS,
    skippedSuave: { docId: '4ijo238KKVfTKyL8phNv', houzzId: '33490416', reason: 'only_1_manifest_slot' },
    backups,
    changes,
  }, null, 2));

  console.log('\nResults:');
  changes.forEach((c) => {
    console.log(' ', c.docId, c.action || 'skip', c.reason || '', c.manifestUrlCount != null ? 'urls=' + c.manifestUrlCount : '');
    if (c.newImages) c.newImages.forEach((u, i) => console.log('    [' + i + ']', u.slice(0, 95) + '...'));
  });
  console.log('\nWrote:', outPath);
  if (DRY_RUN) console.log('DRY-RUN — no Firestore writes');
  else console.log('APPLY complete — hard refresh Product Library and open Edit on hardware rows');
  process.exit(0);
})().catch((e) => { console.error('FAILED:', e); process.exit(1); });
