'use strict';
/**
 * Full Bugletrail board Ivy → houzz-products apply (STAGING ONLY).
 *
 * Scope:
 *   - boards/7225-bugletrail (+ optional 7225-bugletrail-staging): clips, invoices, POs, proposals
 *   - products/ rows tagged projectId=7225-bugletrail or project="7225 Bugletrail"
 *
 * Usage:
 *   node _scripts/ivy-cutover-apply-board-bugletrail-staging_BY_CLAUDE_2026-06-09.js --dry-run
 *   node _scripts/ivy-cutover-apply-board-bugletrail-staging_BY_CLAUDE_2026-06-09.js --apply --yes
 *   node _scripts/ivy-cutover-apply-board-bugletrail-staging_BY_CLAUDE_2026-06-09.js --apply --yes --boards=7225-bugletrail
 */
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const STAGING_PROJECT = 'cch-studio-staging';
const STG_KEY = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-studio-staging-firebase-adminsdk-fbsvc-b93c6f1cf4.json');
const OUT_DIR = path.join(__dirname, '..', '_backup', 'ivy-cutover-apply-board-bugletrail-staging-2026-06-09');
const DEFAULT_BOARDS = ['7225-bugletrail', '7225-bugletrail-staging'];
const PROJECT_ID = '7225-bugletrail';
const PROJECT_NAME = '7225 Bugletrail';
const ROLLBACK_FIELD = '_imageUrlPrevIvyCutover';
const IVY_PREFIXES = [
  'https://ivy-uploads.s3.us-west-2.amazonaws.com/',
  'http://ivy-uploads.s3.us-west-2.amazonaws.com/',
];

const argv = process.argv.slice(2);
const DRY_RUN = !argv.includes('--apply');
const YES = argv.includes('--yes');
const boardsArg = argv.find((a) => a.startsWith('--boards='));
const BOARDS = boardsArg
  ? boardsArg.split('=')[1].split(',').map((s) => s.trim()).filter(Boolean)
  : DEFAULT_BOARDS.slice();

const stgKey = require(STG_KEY);
if (stgKey.project_id !== STAGING_PROJECT) {
  console.error('FATAL: staging key project_id must be', STAGING_PROJECT);
  process.exit(2);
}

const app = admin.initializeApp({ credential: admin.credential.cert(stgKey) }, 'stgBoardApply');
const db = app.firestore();

const houzzIdToUrl = new Map();
const basenameToUrl = new Map();
const libraryById = new Map();
const stats = { library: 0, clips: 0, invoices: 0, purchaseOrders: 0, proposals: 0, skipped: 0 };

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
  if (ivy && ivy.basename && basenameToUrl.has(ivy.basename)) {
    return { proposedUrl: basenameToUrl.get(ivy.basename), matchMethod: 'filename-basename' };
  }
  return { proposedUrl: '', matchMethod: 'no-match' };
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

function processObjectUrls(obj, parentObj, ctx, changes) {
  if (!obj || lockedOrManual(obj) || lockedOrManual(parentObj)) return 0;
  let n = 0;
  collectUrls(obj).forEach(({ path: urlPath, url }) => {
    if (!isTargetIvy(url)) return;
    const match = proposeFirebaseUrl(url, ctx);
    const afterUrl = str(match.proposedUrl);
    if (!afterUrl || !isHouzzProductsUrl(afterUrl)) {
      stats.skipped++;
      return;
    }
    changes.push(Object.assign({}, ctx, {
      urlPath,
      beforeUrl: decodeUrl(url),
      afterUrl,
      matchMethod: match.matchMethod,
    }));
    if (!DRY_RUN) {
      if (!obj[ROLLBACK_FIELD] && urlPath === 'imageUrl') obj[ROLLBACK_FIELD] = decodeUrl(url);
      setUrlOnItem(obj, urlPath, afterUrl);
    }
    n++;
  });
  return n;
}

async function applyLibraryProducts(allChanges) {
  const seen = new Set();
  const queries = [
    db.collection('products').where('projectId', '==', PROJECT_ID).get(),
    db.collection('products').where('project', '==', PROJECT_NAME).get(),
  ];
  const snaps = await Promise.all(queries);
  let docCount = 0;

  for (const snap of snaps) {
    for (const doc of snap.docs) {
      if (seen.has(doc.id)) continue;
      seen.add(doc.id);
      const before = doc.data() || {};
      if (lockedOrManual(before)) continue;
      const after = JSON.parse(JSON.stringify(before));
      const changes = [];
      const ctx = {
        boardId: PROJECT_ID,
        collection: 'products',
        docId: doc.id,
        docNumber: '',
        lineIdx: '',
        title: str(before.title || before.name),
        vendor: str(before.vendor),
        libraryProductId: doc.id,
        houzzId: hz(before),
      };
      const n = processObjectUrls(after, before, ctx, changes);
      if (!n) continue;
      docCount++;
      stats.library += n;
      allChanges.push(...changes);
      if (!DRY_RUN) {
        const patch = { imageUrl: after.imageUrl, updatedAt: new Date().toISOString() };
        if (after.images) patch.images = after.images;
        if (after[ROLLBACK_FIELD]) patch[ROLLBACK_FIELD] = after[ROLLBACK_FIELD];
        await doc.ref.update(patch);
      }
    }
  }
  return docCount;
}

async function applyBoardCollection(boardId, collection, allChanges) {
  const snap = await db.collection('boards').doc(boardId).collection(collection).get();
  let docUpdates = 0;

  for (const doc of snap.docs) {
    const data = doc.data() || {};
    if (collection === 'clips') {
      const after = JSON.parse(JSON.stringify(data));
      const changes = [];
      const ctx = {
        boardId,
        collection,
        docId: doc.id,
        docNumber: '',
        lineIdx: '',
        title: str(data.title || data.name),
        vendor: str(data.vendor),
        libraryProductId: str(data.libraryProductId || data.linkedLibraryProductId),
        houzzId: hz(data),
      };
      const n = processObjectUrls(after, data, ctx, changes);
      if (!n) continue;
      docUpdates++;
      stats[collection] += n;
      allChanges.push(...changes);
      if (!DRY_RUN) {
        const patch = { imageUrl: after.imageUrl, updatedAt: new Date().toISOString() };
        if (after.image) patch.image = after.image;
        if (after.images) patch.images = after.images;
        if (after[ROLLBACK_FIELD]) patch[ROLLBACK_FIELD] = after[ROLLBACK_FIELD];
        await doc.ref.update(patch);
      }
      continue;
    }

    const items = Array.isArray(data.items) ? JSON.parse(JSON.stringify(data.items)) : [];
    const changes = [];
    let docN = 0;
    items.forEach((item, lineIdx) => {
      if (!item) return;
      const ctx = {
        boardId,
        collection,
        docId: doc.id,
        docNumber: str(data.number || data.invoiceNumber || data.poNumber || data.proposalNumber),
        lineIdx,
        title: str(item.title || item.name),
        vendor: str(item.vendor),
        libraryProductId: str(item.libraryProductId || item.linkedLibraryProductId),
        houzzId: hz(item),
      };
      docN += processObjectUrls(item, data, ctx, changes);
    });
    if (!docN) continue;
    docUpdates++;
    stats[collection] += docN;
    allChanges.push(...changes);
    if (!DRY_RUN) {
      await doc.ref.update({ items, updatedAt: new Date().toISOString() });
    }
  }
  return docUpdates;
}

(async () => {
  console.log('=== FULL BUGLETRAIL BOARD IVY APPLY — STAGING ONLY ===');
  console.log('Mode:', DRY_RUN ? 'DRY-RUN' : 'APPLY');
  console.log('Boards:', BOARDS.join(', '));
  console.log('Library scope: projectId=' + PROJECT_ID + ' OR project="' + PROJECT_NAME + '"');
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

  const allChanges = [];
  const libDocs = await applyLibraryProducts(allChanges);
  console.log('\nLibrary products with Ivy swaps:', libDocs, '(' + stats.library + ' URL fields)');

  for (const boardId of BOARDS) {
    const boardSnap = await db.collection('boards').doc(boardId).get();
    if (!boardSnap.exists) {
      console.warn('Board not found, skipping:', boardId);
      continue;
    }
    console.log('\nBoard:', boardId);
    for (const sub of ['clips', 'invoices', 'purchaseOrders', 'proposals']) {
      const n = await applyBoardCollection(boardId, sub, allChanges);
      console.log(' ', sub + ':', n, 'docs,', stats[sub], 'URL fields total');
    }
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const stamp = DRY_RUN ? 'DRYRUN' : 'APPLIED';
  const manifestPath = path.join(OUT_DIR, stamp + '_BOARD_MANIFEST.json');
  fs.writeFileSync(manifestPath, JSON.stringify({
    generatedAt: new Date().toISOString(),
    project: STAGING_PROJECT,
    boards: BOARDS,
    mode: DRY_RUN ? 'dry-run' : 'apply',
    stats,
    totalChanges: allChanges.length,
    changes: allChanges,
  }, null, 2));

  console.log('\n--- TOTALS ---');
  console.log('URL field changes:', allChanges.length);
  console.log('Skipped (no manifest match):', stats.skipped);
  console.log('By collection:', JSON.stringify({
    products: stats.library,
    clips: stats.clips,
    invoices: stats.invoices,
    purchaseOrders: stats.purchaseOrders,
    proposals: stats.proposals,
  }));
  console.log('Wrote:', manifestPath);
  if (DRY_RUN) console.log('\nDRY-RUN complete — no Firestore writes');
  else console.log('\nAPPLY complete');
  process.exit(0);
})().catch((e) => { console.error('FAILED:', e); process.exit(1); });
