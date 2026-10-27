'use strict';
/**
 * Bugletrail pilot — Ivy → houzz-products dry-run (STAGING ONLY, no writes).
 *
 * Rules:
 *   - Only URLs whose host is ivy-uploads.s3.us-west-2.amazonaws.com
 *   - Skip docs/rows with _imageLocked or _imageManual = true
 *   - Proposed URL must be Firebase houzz-products/ from Phase 2A manifests
 *
 * Usage:
 *   node _scripts/ivy-cutover-dryrun-bugletrail-staging_BY_CLAUDE_2026-06-09.js
 */
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const STAGING_PROJECT = 'cch-studio-staging';
const STG_KEY = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-studio-staging-firebase-adminsdk-fbsvc-b93c6f1cf4.json');
const OUT_DIR = path.join(__dirname, '..', '_backup', 'ivy-cutover-dryrun-bugletrail-staging-2026-06-09');
const BOARDS = ['7225-bugletrail', '7225-bugletrail-staging'];
const IVY_PREFIXES = [
  'https://ivy-uploads.s3.us-west-2.amazonaws.com/',
  'http://ivy-uploads.s3.us-west-2.amazonaws.com/',
];

const stgKey = require(STG_KEY);
if (stgKey.project_id !== STAGING_PROJECT) {
  console.error('FATAL: staging key project_id must be', STAGING_PROJECT);
  process.exit(2);
}

const app = admin.initializeApp({ credential: admin.credential.cert(stgKey) }, 'stgDry');
const db = app.firestore();

const houzzIdToUrl = new Map();
const basenameToUrl = new Map();
const libraryById = new Map();
const rows = [];

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
function csvEsc(v) {
  if (v == null) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function parseIvyUrl(url) {
  url = decodeUrl(url);
  const m = url.match(/ivy-uploads[^/]*\/[^/]+\/(?:productImage|image)\/(\d+)\/([^?]+)/i);
  if (!m) return null;
  return { ivyId: m[1], filePart: m[2], basename: path.basename(m[2]).toLowerCase() };
}
function lockedOrManual(obj) {
  if (!obj) return { locked: false, manual: false };
  return { locked: obj._imageLocked === true, manual: obj._imageManual === true };
}
function collectUrls(obj) {
  const out = [];
  if (!obj) return out;
  ['imageUrl', 'image', 'thumbnail'].forEach((k) => { if (obj[k]) out.push({ path: k, url: str(obj[k]) }); });
  if (Array.isArray(obj.images)) {
    obj.images.forEach((u, i) => {
      if (typeof u === 'string') out.push({ path: 'images[' + i + ']', url: str(u) });
      else if (u && u.url) out.push({ path: 'images[' + i + '].url', url: str(u.url) });
    });
  }
  return out.filter((x) => x.url);
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
      const sp = str(r.storagePath);
      if (sp) {
        const base = path.basename(sp).toLowerCase();
        if (base && !basenameToUrl.has(base)) basenameToUrl.set(base, url);
      }
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
      return { proposedUrl: libUrl, proposedHouzzId: hz(lib), matchMethod: 'libraryProductId-firebase-keeper', confidence: 'high' };
    }
    const mHid = hz(lib) || hid;
    if (mHid && houzzIdToUrl.has(mHid)) {
      return { proposedUrl: houzzIdToUrl.get(mHid).url, proposedHouzzId: mHid, matchMethod: 'libraryProductId+houzzId-manifest', confidence: 'medium' };
    }
  }

  if (hid && houzzIdToUrl.has(hid)) {
    return { proposedUrl: houzzIdToUrl.get(hid).url, proposedHouzzId: hid, matchMethod: 'houzzId-manifest', confidence: 'medium' };
  }

  if (ivy) {
    if (ivy.ivyId && houzzIdToUrl.has(ivy.ivyId)) {
      return { proposedUrl: houzzIdToUrl.get(ivy.ivyId).url, proposedHouzzId: ivy.ivyId, matchMethod: 'ivy-productImage-id-manifest', confidence: 'medium' };
    }
    if (ivy.basename && basenameToUrl.has(ivy.basename)) {
      return { proposedUrl: basenameToUrl.get(ivy.basename), proposedHouzzId: hid || ivy.ivyId, matchMethod: 'filename-basename', confidence: 'low' };
    }
    const stem = ivy.filePart.toLowerCase().replace(/\.[a-z0-9]+$/i, '').slice(0, 10);
    for (const [k, url] of basenameToUrl.entries()) {
      if (k.includes(stem) || stem.includes(k.slice(0, 8))) {
        return { proposedUrl: url, proposedHouzzId: hid || ivy.ivyId, matchMethod: 'filename-fuzzy', confidence: 'low' };
      }
    }
  }

  return { proposedUrl: '', proposedHouzzId: hid, matchMethod: 'no-match', confidence: 'manual' };
}

function addRow(entry) {
  rows.push(entry);
}

function evaluateUrl(ctx, urlPath, url, rowObj, parentObj) {
  const beforeUrl = decodeUrl(url);
  const base = {
    boardId: ctx.boardId,
    collection: ctx.collection,
    docId: ctx.docId,
    docNumber: ctx.docNumber,
    lineIdx: ctx.lineIdx,
    urlPath,
    title: ctx.title,
    vendor: ctx.vendor,
    libraryProductId: ctx.libraryProductId,
    houzzId: ctx.houzzId,
    beforeUrl,
  };

  if (!isTargetIvy(beforeUrl)) {
    if (/ivy-uploads/i.test(beforeUrl)) {
      addRow(Object.assign({}, base, {
        wouldUpdate: 'no',
        skipReason: 'ivy-host-not-in-scope',
        afterUrl: '',
        matchMethod: '',
        confidence: '',
        note: 'Ivy URL uses non-pilot host (e.g. s3-us-west-2 hyphen variant)',
      }));
    }
    return;
  }

  const rowFlags = lockedOrManual(rowObj);
  const parentFlags = lockedOrManual(parentObj);
  if (rowFlags.locked || parentFlags.locked) {
    addRow(Object.assign({}, base, {
      wouldUpdate: 'no',
      skipReason: 'image_locked',
      afterUrl: '',
      matchMethod: '',
      confidence: '',
      note: '_imageLocked=true on row or parent doc',
    }));
    return;
  }
  if (rowFlags.manual || parentFlags.manual) {
    addRow(Object.assign({}, base, {
      wouldUpdate: 'no',
      skipReason: 'image_manual',
      afterUrl: '',
      matchMethod: '',
      confidence: '',
      note: '_imageManual=true on row or parent doc',
    }));
    return;
  }

  const match = proposeFirebaseUrl(beforeUrl, ctx);
  const afterUrl = str(match.proposedUrl);
  if (!afterUrl || !isHouzzProductsUrl(afterUrl)) {
    addRow(Object.assign({}, base, {
      wouldUpdate: 'no',
      skipReason: afterUrl ? 'proposed-not-houzz-products' : 'no-firebase-match',
      afterUrl,
      matchMethod: match.matchMethod,
      confidence: match.confidence,
      note: afterUrl ? 'Match found but not houzz-products path' : 'No manifest crosswalk for this Ivy URL',
    }));
    return;
  }

  addRow(Object.assign({}, base, {
    wouldUpdate: 'yes',
    skipReason: '',
    afterUrl,
    matchMethod: match.matchMethod,
    confidence: match.confidence,
    note: '',
  }));
}

async function scanDocItems(boardId, collection, docSnap) {
  const data = docSnap.data() || {};
  const items = Array.isArray(data.items) ? data.items : [];
  items.forEach((item, idx) => {
    if (!item) return;
    const ctx = {
      boardId,
      collection,
      docId: docSnap.id,
      docNumber: str(data.number || data.invoiceNumber || data.poNumber || data.proposalNumber),
      lineIdx: idx,
      title: str(item.title || item.name),
      vendor: str(item.vendor),
      libraryProductId: str(item.libraryProductId || item.linkedLibraryProductId),
      houzzId: hz(item),
    };
    collectUrls(item).forEach(({ path: urlPath, url }) => {
      evaluateUrl(ctx, urlPath, url, item, data);
    });
  });
}

(async () => {
  console.log('=== BUGLETRAIL IVY CUTOVER DRY-RUN — STAGING ONLY ===');
  console.log('Boards:', BOARDS.join(', '));
  console.log('Ivy host filter: ivy-uploads.s3.us-west-2.amazonaws.com only');
  console.log('Writes: NONE\n');

  loadManifests();
  console.log('Manifest houzz-products index:', houzzIdToUrl.size, 'houzzIds\n');

  const ps = await db.collection('products').get();
  ps.forEach((d) => libraryById.set(d.id, Object.assign({ _id: d.id }, d.data() || {})));
  const pl = await db.collection('productLibrary').get();
  pl.forEach((d) => {
    if (!libraryById.has(d.id)) libraryById.set(d.id, Object.assign({ _id: d.id }, d.data() || {}));
  });
  console.log('Library index:', libraryById.size, 'docs\n');

  for (const boardId of BOARDS) {
    const boardSnap = await db.collection('boards').doc(boardId).get();
    if (!boardSnap.exists) {
      console.warn('Board not found, skipping:', boardId);
      continue;
    }

    const clips = await db.collection('boards').doc(boardId).collection('clips').get();
    clips.forEach((d) => {
      const c = d.data() || {};
      const ctx = {
        boardId,
        collection: 'clips',
        docId: d.id,
        docNumber: '',
        lineIdx: '',
        title: str(c.title || c.name),
        vendor: str(c.vendor),
        libraryProductId: str(c.libraryProductId || c.linkedLibraryProductId),
        houzzId: hz(c),
      };
      collectUrls(c).forEach(({ path: urlPath, url }) => {
        evaluateUrl(ctx, urlPath, url, c, c);
      });
    });

    for (const sub of ['invoices', 'proposals', 'purchaseOrders']) {
      const snap = await db.collection('boards').doc(boardId).collection(sub).get();
      for (const doc of snap.docs) await scanDocItems(boardId, sub, doc);
    }
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const header = [
    'wouldUpdate', 'boardId', 'collection', 'docId', 'docNumber', 'lineIdx', 'urlPath',
    'title', 'vendor', 'libraryProductId', 'houzzId',
    'beforeUrl', 'afterUrl', 'matchMethod', 'confidence', 'skipReason', 'note',
  ];
  const csvLines = [header.join(',')];
  rows.forEach((r) => csvLines.push(header.map((h) => csvEsc(r[h])).join(',')));
  const manifestPath = path.join(OUT_DIR, 'PILOT_MANIFEST.csv');
  fs.writeFileSync(manifestPath, csvLines.join('\n'));

  const ivyRows = rows.filter((r) => isTargetIvy(r.beforeUrl));
  const wouldUpdate = rows.filter((r) => r.wouldUpdate === 'yes');
  const skipped = ivyRows.filter((r) => r.wouldUpdate !== 'yes');

  const summary = {
    generatedAt: new Date().toISOString(),
    project: STAGING_PROJECT,
    boards: BOARDS,
    readOnly: true,
    ivyHostFilter: 'ivy-uploads.s3.us-west-2.amazonaws.com',
    manifestHouzzIds: houzzIdToUrl.size,
    totalManifestRows: rows.length,
    ivyUrlRows: ivyRows.length,
    wouldUpdate: wouldUpdate.length,
    skipped: skipped.length,
    skipReasons: skipped.reduce((acc, r) => {
      const k = r.skipReason || 'unknown';
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {}),
    byCollection: wouldUpdate.reduce((acc, r) => {
      acc[r.collection] = (acc[r.collection] || 0) + 1;
      return acc;
    }, {}),
    byBoard: wouldUpdate.reduce((acc, r) => {
      acc[r.boardId] = (acc[r.boardId] || 0) + 1;
      return acc;
    }, {}),
    samplesWouldUpdate: wouldUpdate.slice(0, 8),
    samplesSkipped: skipped.slice(0, 8),
  };
  const summaryPath = path.join(OUT_DIR, 'PILOT_SUMMARY.json');
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

  console.log('--- PILOT RESULTS ---');
  console.log('Ivy URL rows (in-scope host):', summary.ivyUrlRows);
  console.log('Would update:', summary.wouldUpdate);
  console.log('Skipped:', summary.skipped);
  console.log('Skip reasons:', JSON.stringify(summary.skipReasons));
  console.log('Would update by collection:', JSON.stringify(summary.byCollection));
  console.log('\nWrote:', manifestPath);
  console.log('Wrote:', summaryPath);
  process.exit(0);
})().catch((e) => { console.error('FAILED:', e); process.exit(1); });
