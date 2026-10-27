'use strict';
/**
 * DRY RUN (read-only) — for SOMERSET BAY items in Cloud-Rolling-Hills on STAGING,
 * match each item's current images against additional photos available in
 * production Storage houzz-products/{houzzId}/*. Reports the gap. ZERO writes.
 *
 * Firestore: STAGING (items live here). Storage: PROD bucket (where Houzz photo files live).
 * Run: node _scripts/dryrun-somersetbay-rh-gallery-staging_BY_CLAUDE_2026-06-08.js
 */
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const KEY_DIR = path.join(__dirname, '..', '_debug', 'service-account.json');
const prodKey = require(path.join(KEY_DIR, 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json'));
const stgKey = require(path.join(KEY_DIR, 'cch-studio-staging-firebase-adminsdk-fbsvc-b93c6f1cf4.json'));

const prodApp = admin.initializeApp({ credential: admin.credential.cert(prodKey), storageBucket: 'cch-design-boards.firebasestorage.app' }, 'prod');
const prodBucket = prodApp.storage().bucket();
const stgApp = admin.initializeApp({ credential: admin.credential.cert(stgKey) }, 'stg');
const stgDb = stgApp.firestore();

const PROJECT = 'cloud-rolling-hills';
const VENDOR_RE = /somerset\s*bay/i;
const IMG_RE = /\.(jpe?g|png|webp|gif)$/i;
const str = (v) => String(v == null ? '' : v).trim();
const houzzIdOf = (o) => str(o && (o.houzzId || o.houzzProductId || o.catalogId));

function currentImages(o) {
  const seen = new Set();
  const add = (u) => { u = str(typeof u === 'string' ? u : (u && (u.url || u.imageUrl || u.src))); if (u && u.indexOf('data:') !== 0) seen.add(u.toLowerCase()); };
  if (!o) return [];
  add(o.imageUrl); add(o.image);
  ['images', 'imageUrls', 'gallery', 'photos'].forEach((k) => { const v = o[k]; if (Array.isArray(v)) v.forEach(add); });
  return [...seen];
}

async function storageFilesFor(hid) {
  if (!hid) return [];
  try {
    const [files] = await prodBucket.getFiles({ prefix: 'houzz-products/' + hid + '/' });
    return files.map((f) => f.name.split('/').pop()).filter((b) => IMG_RE.test(b))
      .sort((a, b) => (parseInt(a, 10) || 0) - (parseInt(b, 10) || 0) || a.localeCompare(b));
  } catch (e) { return []; }
}

(async () => {
  console.log('Reading STAGING boards/' + PROJECT + '/clips (read-only) ...');
  const snap = await stgDb.collection('boards').doc(PROJECT).collection('clips').get();
  const items = [];
  snap.forEach((d) => { const c = d.data() || {}; if (VENDOR_RE.test(str(c.vendor))) items.push(Object.assign({ _clipId: d.id }, c)); });
  console.log('Somerset Bay clips found on staging RH:', items.length, '\n');

  const rows = [];
  for (const it of items) {
    const hid = houzzIdOf(it);
    const cur = currentImages(it);
    const sf = await storageFilesFor(hid);
    rows.push({
      title: str(it.title || it.name).slice(0, 60),
      houzzId: hid || '(none)',
      room: str(it.room),
      currentImages: cur.length,
      storageImages: sf.length,
      storageSlots: sf.join(', '),
      additionalAvailable: Math.max(0, sf.length - cur.length),
      clipId: it._clipId,
    });
  }
  rows.sort((a, b) => b.additionalAvailable - a.additionalAvailable);

  const withGap = rows.filter((r) => r.additionalAvailable > 0);
  const report = {
    date: '2026-06-08', dryRun: true, source: 'STAGING Firestore items + PROD Storage files',
    project: PROJECT, vendorFilter: 'Somerset Bay', note: 'READ-ONLY. Zero writes.',
    totals: {
      somersetBayItems: rows.length,
      itemsWithAdditionalImagesAvailable: withGap.length,
      itemsWithNoHouzzId: rows.filter((r) => r.houzzId === '(none)').length,
      totalAdditionalImagesAvailable: rows.reduce((s, r) => s + r.additionalAvailable, 0),
    },
    rows,
  };
  const outDir = path.join(__dirname, '..', '_backup', 'somersetbay-rh-gallery-dryrun-2026-06-08');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'DRYRUN_somersetbay_rh_gallery_BY_CLAUDE_2026-06-08.json'), JSON.stringify(report, null, 2));

  console.log('=== DRY RUN: Somerset Bay / Rolling Hills — image gallery gap (read-only) ===');
  console.log('Somerset Bay items:', rows.length, '| with extra images available:', withGap.length, '| total extra images:', report.totals.totalAdditionalImagesAvailable, '\n');
  console.log('title                                                         | hzId       | now | strg | +add');
  rows.forEach((r) => console.log(
    r.title.padEnd(60) + ' | ' + String(r.houzzId).padEnd(10) + ' | ' +
    String(r.currentImages).padStart(3) + ' | ' + String(r.storageImages).padStart(4) + ' | ' + String(r.additionalAvailable).padStart(4)));
  console.log('\nReport:', path.join(outDir, 'DRYRUN_somersetbay_rh_gallery_BY_CLAUDE_2026-06-08.json'));
  process.exit(0);
})().catch((e) => { console.error('ERROR', e); process.exit(1); });
