'use strict';
/**
 * Bugletrail pilot — apply Ivy → houzz-products on Product Library keepers (STAGING ONLY).
 *
 * Targets 3 Kravet products linked from INV-6002 pilot.
 *
 * Usage:
 *   node _scripts/ivy-cutover-apply-library-bugletrail-staging_BY_CLAUDE_2026-06-09.js --dry-run
 *   node _scripts/ivy-cutover-apply-library-bugletrail-staging_BY_CLAUDE_2026-06-09.js --apply --yes
 */
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const STAGING_PROJECT = 'cch-studio-staging';
const STG_KEY = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-studio-staging-firebase-adminsdk-fbsvc-b93c6f1cf4.json');
const OUT_DIR = path.join(__dirname, '..', '_backup', 'ivy-cutover-apply-library-bugletrail-staging-2026-06-09');
const ROLLBACK_FIELD = '_imageUrlPrevIvyCutover';
const IVY_PREFIXES = [
  'https://ivy-uploads.s3.us-west-2.amazonaws.com/',
  'http://ivy-uploads.s3.us-west-2.amazonaws.com/',
];

const TARGET_IDS = [
  '11p3CdBTC7bWSWDf3U1B',
  '0Yunvqw9mRNORhB20IRK',
  '4ijo238KKVfTKyL8phNv',
];

const argv = process.argv.slice(2);
const DRY_RUN = !argv.includes('--apply');
const YES = argv.includes('--yes');

const stgKey = require(STG_KEY);
if (stgKey.project_id !== STAGING_PROJECT) {
  console.error('FATAL: staging key project_id must be', STAGING_PROJECT);
  process.exit(2);
}

const app = admin.initializeApp({ credential: admin.credential.cert(stgKey) }, 'stgLibApply');
const db = app.firestore();

const houzzIdToUrl = new Map();

function str(v) { return String(v == null ? '' : v).trim(); }
function hz(o) { return str(o && (o.houzzId || o.houzzProductId || o.catalogId)); }
function decodeUrl(u) {
  u = str(u);
  if (!u) return '';
  try { return decodeURIComponent(u.replace(/&amp;/g, '&')); } catch (_e) { return u.replace(/&amp;/g, '&'); }
}
function isTargetIvy(url) {
  const u = decodeUrl(url);
  return IVY_PREFIXES.some((p) => u.startsWith(p));
}
function isFirebase(u) {
  u = str(u);
  return /firebasestorage\.googleapis|\.firebasestorage\.app|storage\.googleapis\.com/i.test(u);
}
function isHouzzProductsUrl(u) {
  return /houzz-products%2F|houzz-products\//i.test(decodeUrl(u));
}

function loadManifests() {
  const files = [
    path.join(__dirname, '..', '_debug', 'phase2a-upload-manifest.json'),
    path.join(__dirname, '..', '_debug', 'phase4a-upload-manifest.json'),
    path.join(__dirname, '..', '_debug', 'phase2a-extended-manifest.json'),
  ];
  for (const fp of files) {
    if (!fs.existsSync(fp)) continue;
    const data = JSON.parse(fs.readFileSync(fp, 'utf8'));
    for (const r of data.results || data.uploads || []) {
      if (r.status && r.status !== 'ok') continue;
      const hid = str(r.houzzId || r.sourceId);
      const url = str(r.downloadUrl);
      if (!hid || !url || !isFirebase(url) || !isHouzzProductsUrl(url)) continue;
      const slot = parseInt(r.slot, 10) || 99;
      const prev = houzzIdToUrl.get(hid);
      if (!prev || slot < prev.slot) houzzIdToUrl.set(hid, { url, slot });
    }
  }
}

function collectUrlFields(p) {
  const out = [];
  if (!p) return out;
  ['imageUrl', 'image', 'thumbnail'].forEach((k) => { if (p[k]) out.push({ path: k, url: str(p[k]) }); });
  if (Array.isArray(p.images)) {
    p.images.forEach((u, i) => {
      if (typeof u === 'string') out.push({ path: 'images[' + i + ']', url: str(u) });
      else if (u && u.url) out.push({ path: 'images[' + i + '].url', url: str(u.url) });
    });
  }
  return out;
}

function setUrlOnProduct(p, urlPath, newUrl) {
  if (urlPath === 'imageUrl') p.imageUrl = newUrl;
  else if (urlPath === 'image') p.image = newUrl;
  else if (urlPath === 'thumbnail') p.thumbnail = newUrl;
  else if (urlPath.startsWith('images[')) {
    const m = urlPath.match(/^images\[(\d+)\](?:\.url)?$/);
    if (!m) return false;
    const i = parseInt(m[1], 10);
    if (!Array.isArray(p.images)) p.images = [];
    const cur = p.images[i];
    if (typeof cur === 'string') p.images[i] = newUrl;
    else if (cur && typeof cur === 'object') p.images[i] = Object.assign({}, cur, { url: newUrl });
    else p.images[i] = newUrl;
  } else return false;
  return true;
}

(async () => {
  console.log('=== LIBRARY IVY APPLY — BUGLETRAIL 3 PRODUCTS — STAGING ONLY ===');
  console.log('Mode:', DRY_RUN ? 'DRY-RUN' : 'APPLY');
  console.log('Targets:', TARGET_IDS.join(', '));
  if (!DRY_RUN && !YES) {
    console.error('Refusing --apply without --yes');
    process.exit(2);
  }

  loadManifests();
  const changes = [];
  const backups = [];

  for (const docId of TARGET_IDS) {
    const ref = db.collection('products').doc(docId);
    const snap = await ref.get();
    if (!snap.exists) {
      console.warn('SKIP missing doc:', docId);
      continue;
    }
    const before = snap.data() || {};
    backups.push({ docId, before: JSON.parse(JSON.stringify(before)) });

    if (before._imageLocked === true || before._imageManual === true) {
      console.warn('SKIP locked/manual:', docId, before.title || before.name);
      continue;
    }

    const hid = hz(before);
    const proposed = hid && houzzIdToUrl.has(hid) ? houzzIdToUrl.get(hid).url : '';
    if (!proposed || !isHouzzProductsUrl(proposed)) {
      console.warn('SKIP no manifest match for houzzId', hid, 'doc', docId);
      continue;
    }

    const after = JSON.parse(JSON.stringify(before));
    let docChanges = 0;

    collectUrlFields(after).forEach(({ path: urlPath, url }) => {
      if (!isTargetIvy(url)) return;
      const beforeUrl = decodeUrl(url);
      changes.push({
        docId,
        collection: 'products',
        title: str(before.title || before.name),
        vendor: str(before.vendor),
        houzzId: hid,
        urlPath,
        beforeUrl,
        afterUrl: proposed,
        matchMethod: 'houzzId-manifest',
      });
      docChanges++;
      if (!DRY_RUN) {
        if (!after[ROLLBACK_FIELD] && urlPath === 'imageUrl') after[ROLLBACK_FIELD] = beforeUrl;
        setUrlOnProduct(after, urlPath, proposed);
      }
    });

    if (!docChanges) {
      console.log('No in-scope Ivy fields on', docId, '-', str(before.title || before.name));
      continue;
    }

    if (!DRY_RUN) {
      const patch = {
        imageUrl: after.imageUrl,
        updatedAt: new Date().toISOString(),
      };
      if (after.images) patch.images = after.images;
      if (after[ROLLBACK_FIELD]) patch[ROLLBACK_FIELD] = after[ROLLBACK_FIELD];
      await ref.update(patch);
      console.log('APPLIED', docChanges, 'field(s) on', docId);
    } else {
      console.log('WOULD APPLY', docChanges, 'field(s) on', docId, '-', str(before.title || before.name));
    }
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const stamp = DRY_RUN ? 'PRE_APPLY' : 'APPLIED';
  const backupPath = path.join(OUT_DIR, stamp + '_library_3products_backup.json');
  fs.writeFileSync(backupPath, JSON.stringify({
    generatedAt: new Date().toISOString(),
    project: STAGING_PROJECT,
    mode: DRY_RUN ? 'dry-run' : 'apply',
    rollbackField: ROLLBACK_FIELD,
    backups,
    changes,
  }, null, 2));

  console.log('\nTotal URL field changes:', changes.length);
  changes.forEach((c) => {
    console.log(' ', c.docId, c.urlPath, '-', c.title);
  });
  console.log('Wrote:', backupPath);
  if (DRY_RUN) console.log('\nDRY-RUN complete — no Firestore writes');
  else console.log('\nLibrary apply complete');
  process.exit(0);
})().catch((e) => { console.error('FAILED:', e); process.exit(1); });
