'use strict';
/**
 * Bugletrail pilot APPLY — Ivy → houzz-products (STAGING ONLY).
 *
 * Default: INV-6002 on 7225-bugletrail-staging only (6 URL fields from dry-run).
 * Writes backup JSON before any Firestore update.
 *
 * Usage:
 *   node _scripts/ivy-cutover-apply-bugletrail-staging_BY_CLAUDE_2026-06-09.js --dry-run
 *   node _scripts/ivy-cutover-apply-bugletrail-staging_BY_CLAUDE_2026-06-09.js --apply --yes
 */
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const STAGING_PROJECT = 'cch-studio-staging';
const STG_KEY = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-studio-staging-firebase-adminsdk-fbsvc-b93c6f1cf4.json');
const OUT_DIR = path.join(__dirname, '..', '_backup', 'ivy-cutover-apply-bugletrail-staging-2026-06-09');
const BOARD_ID = '7225-bugletrail-staging';
const INVOICE_ID = 'h2fANEQ7XAsR8wweGxIL';
const INVOICE_NUMBER = 'INV-6002';
const ROLLBACK_FIELD = '_imageUrlPrevIvyCutover';
const IVY_PREFIXES = [
  'https://ivy-uploads.s3.us-west-2.amazonaws.com/',
  'http://ivy-uploads.s3.us-west-2.amazonaws.com/',
];

const argv = process.argv.slice(2);
const DRY_RUN = !argv.includes('--apply');
const YES = argv.includes('--yes');

const stgKey = require(STG_KEY);
if (stgKey.project_id !== STAGING_PROJECT) {
  console.error('FATAL: staging key project_id must be', STAGING_PROJECT);
  process.exit(2);
}

const app = admin.initializeApp({ credential: admin.credential.cert(stgKey) }, 'stgApply');
const db = app.firestore();

const houzzIdToUrl = new Map();
const libraryById = new Map();

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
function parseIvyUrl(url) {
  url = decodeUrl(url);
  const m = url.match(/ivy-uploads[^/]*\/[^/]+\/(?:productImage|image)\/(\d+)\/([^?]+)/i);
  if (!m) return null;
  return { ivyId: m[1], filePart: m[2], basename: path.basename(m[2]).toLowerCase() };
}
function lockedOrManual(obj) {
  if (!obj) return false;
  return obj._imageLocked === true || obj._imageManual === true;
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

function proposeFirebaseUrl(ivyUrl, ctx) {
  const ivy = parseIvyUrl(ivyUrl);
  const lid = str(ctx.libraryProductId);
  const lib = lid ? libraryById.get(lid) : null;
  const hid = hz(ctx) || hz(lib) || (ivy && ivy.ivyId) || '';

  if (lid && lib) {
    const libUrl = str(lib.imageUrl);
    if (isFirebase(libUrl) && isHouzzProductsUrl(libUrl) && !isTargetIvy(libUrl)) {
      return { proposedUrl: libUrl, matchMethod: 'libraryProductId-firebase-keeper' };
    }
    const mHid = hz(lib) || hid;
    if (mHid && houzzIdToUrl.has(mHid)) {
      return { proposedUrl: houzzIdToUrl.get(mHid).url, matchMethod: 'libraryProductId+houzzId-manifest' };
    }
  }
  if (hid && houzzIdToUrl.has(hid)) {
    return { proposedUrl: houzzIdToUrl.get(hid).url, matchMethod: 'houzzId-manifest' };
  }
  if (ivy && ivy.ivyId && houzzIdToUrl.has(ivy.ivyId)) {
    return { proposedUrl: houzzIdToUrl.get(ivy.ivyId).url, matchMethod: 'ivy-productImage-id-manifest' };
  }
  return { proposedUrl: '', matchMethod: 'no-match' };
}

function setUrlOnItem(item, urlPath, newUrl) {
  if (urlPath === 'imageUrl') item.imageUrl = newUrl;
  else if (urlPath === 'image') item.image = newUrl;
  else if (urlPath === 'thumbnail') item.thumbnail = newUrl;
  else if (urlPath.startsWith('images[')) {
    const m = urlPath.match(/^images\[(\d+)\](?:\.url)?$/);
    if (!m) return false;
    const i = parseInt(m[1], 10);
    if (!Array.isArray(item.images)) item.images = [];
    const cur = item.images[i];
    if (typeof cur === 'string') item.images[i] = newUrl;
    else if (cur && typeof cur === 'object') item.images[i] = Object.assign({}, cur, { url: newUrl });
    else item.images[i] = newUrl;
  } else return false;
  return true;
}

function getUrlFromItem(item, urlPath) {
  if (urlPath === 'imageUrl') return str(item.imageUrl);
  if (urlPath === 'image') return str(item.image);
  if (urlPath === 'thumbnail') return str(item.thumbnail);
  const m = urlPath.match(/^images\[(\d+)\](?:\.url)?$/);
  if (m) {
    const cur = (item.images || [])[parseInt(m[1], 10)];
    if (typeof cur === 'string') return str(cur);
    if (cur && cur.url) return str(cur.url);
  }
  return '';
}

(async () => {
  console.log('=== BUGLETRAIL IVY APPLY — STAGING ONLY ===');
  console.log('Mode:', DRY_RUN ? 'DRY-RUN' : 'APPLY');
  console.log('Board:', BOARD_ID, 'Invoice:', INVOICE_NUMBER, INVOICE_ID);
  if (!DRY_RUN && !YES) {
    console.error('Refusing --apply without --yes');
    process.exit(2);
  }

  loadManifests();
  const ps = await db.collection('products').get();
  ps.forEach((d) => libraryById.set(d.id, Object.assign({ _id: d.id }, d.data() || {})));
  const pl = await db.collection('productLibrary').get();
  pl.forEach((d) => {
    if (!libraryById.has(d.id)) libraryById.set(d.id, Object.assign({ _id: d.id }, d.data() || {}));
  });

  const ref = db.collection('boards').doc(BOARD_ID).collection('invoices').doc(INVOICE_ID);
  const snap = await ref.get();
  if (!snap.exists) {
    console.error('Invoice not found:', INVOICE_ID);
    process.exit(1);
  }

  const data = snap.data() || {};
  const items = Array.isArray(data.items) ? JSON.parse(JSON.stringify(data.items)) : [];
  const changes = [];

  items.forEach((item, lineIdx) => {
    if (!item || lockedOrManual(item) || lockedOrManual(data)) return;
    const ctx = {
      lineIdx,
      title: str(item.title || item.name),
      vendor: str(item.vendor),
      libraryProductId: str(item.libraryProductId || item.linkedLibraryProductId),
      houzzId: hz(item),
    };
    const paths = ['imageUrl', 'image', 'thumbnail'];
    if (Array.isArray(item.images)) {
      item.images.forEach((_u, i) => paths.push('images[' + i + ']'));
    }
    for (const urlPath of paths) {
      const beforeUrl = getUrlFromItem(item, urlPath);
      if (!isTargetIvy(beforeUrl)) continue;
      const match = proposeFirebaseUrl(beforeUrl, ctx);
      const afterUrl = str(match.proposedUrl);
      if (!afterUrl || !isHouzzProductsUrl(afterUrl)) continue;
      changes.push({
        lineIdx,
        urlPath,
        title: ctx.title,
        vendor: ctx.vendor,
        libraryProductId: ctx.libraryProductId,
        beforeUrl: decodeUrl(beforeUrl),
        afterUrl,
        matchMethod: match.matchMethod,
      });
      if (!DRY_RUN) {
        if (!item[ROLLBACK_FIELD]) item[ROLLBACK_FIELD] = decodeUrl(beforeUrl);
        setUrlOnItem(item, urlPath, afterUrl);
      }
    }
  });

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const backup = {
    generatedAt: new Date().toISOString(),
    project: STAGING_PROJECT,
    boardId: BOARD_ID,
    invoiceId: INVOICE_ID,
    invoiceNumber: INVOICE_NUMBER,
    mode: DRY_RUN ? 'dry-run' : 'apply',
    rollbackField: ROLLBACK_FIELD,
    beforeDoc: data,
    plannedChanges: changes,
  };
  const backupPath = path.join(OUT_DIR, (DRY_RUN ? 'PRE_APPLY_' : 'APPLIED_') + INVOICE_NUMBER + '_backup.json');
  fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));

  console.log('Planned changes:', changes.length);
  changes.forEach((c) => {
    console.log('  line', c.lineIdx, c.urlPath, '-', c.title);
    console.log('    before:', c.beforeUrl.slice(0, 90) + '...');
    console.log('    after: ', c.afterUrl.slice(0, 90) + '...');
  });

  if (!DRY_RUN && changes.length) {
    await ref.update({ items, updatedAt: new Date().toISOString() });
    console.log('\nAPPLIED', changes.length, 'URL field(s) to', INVOICE_NUMBER);
  } else if (DRY_RUN) {
    console.log('\nDRY-RUN complete — no Firestore writes');
  }

  const manifestPath = path.join(OUT_DIR, (DRY_RUN ? 'DRYRUN_' : 'APPLIED_') + 'MANIFEST.json');
  fs.writeFileSync(manifestPath, JSON.stringify({ changes, backupPath }, null, 2));
  console.log('Wrote:', backupPath);
  console.log('Wrote:', manifestPath);
  process.exit(0);
})().catch((e) => { console.error('FAILED:', e); process.exit(1); });
