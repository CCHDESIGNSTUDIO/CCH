'use strict';
/**
 * STEP 0 — Ivy cutover inventory (READ-ONLY). STAGING ONLY — never production.
 *
 * Pilot default: board shimano-maverick-cir (Maverick). Classifies every Ivy URL
 * into buckets: easy / crosswalk / clip-truth / preserved / elu / orphan / clean.
 *
 * PRESERVE rules (never crosswalk/overwrite):
 *   - imageUrl not on houzz-products/ (e.g. images/products/ hi-res, projects/ clips)
 *   - _imageLocked / _imageManual
 *   - ELU vendor + updatedAt after Phase 2A (2026-05-02)
 *   - source in manual|cch-elu|clipper|ffe-import|ffe-schedule
 *   - _imageUrlPrevApr27 differs from current imageUrl (rehosted then re-updated)
 *
 * Does NOT write Firestore. Outputs CSV + JSON under _backup/ivy-cutover-inventory-staging-2026-06-08/
 *
 * Future apply pass (separate script): use rollback field `_imageUrlPrevIvyCutover`
 * (NOT `_imageUrlPrevApr27` — preserve Phase 2B rollback tier).
 *
 * Post-apply verification (Step C): spot-check 5 high, 5 medium, all low/manual rows.
 *
 * Usage:
 *   node _scripts/ivy-cutover-inventory-staging_BY_CLAUDE_2026-06-08.js
 *   node _scripts/ivy-cutover-inventory-staging_BY_CLAUDE_2026-06-08.js --board=shimano-maverick-cir
 *   node _scripts/ivy-cutover-inventory-staging_BY_CLAUDE_2026-06-08.js --all-boards
 *   node _scripts/ivy-cutover-inventory-staging_BY_CLAUDE_2026-06-08.js --include-library
 */
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const STAGING_PROJECT = 'cch-studio-staging';
const STG_KEY = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-studio-staging-firebase-adminsdk-fbsvc-b93c6f1cf4.json');
const OUT_DIR = path.join(__dirname, '..', '_backup', 'ivy-cutover-inventory-staging-2026-06-08');
const ROLLBACK_FIELD = '_imageUrlPrevIvyCutover';
const SKIP_REASON_FIELD = '_skipReason';
const PHASE2A_CUTOFF = '2026-05-02T23:59:59.999Z';
const CURATED_SOURCES = new Set(['manual', 'cch-elu', 'clipper', 'cch-studio-clipper', 'ffe-import', 'ffe-schedule', 'ideabook-asset']);

const argv = process.argv.slice(2);
const ALL_BOARDS = argv.includes('--all-boards');
const INCLUDE_LIBRARY = argv.includes('--include-library');
const BOARD = (() => {
  const a = argv.find((x) => x.startsWith('--board='));
  if (a) return a.split('=')[1].trim();
  if (ALL_BOARDS) return null;
  return 'shimano-maverick-cir';
})();

const stgKey = require(STG_KEY);
if (stgKey.project_id !== STAGING_PROJECT) {
  console.error('FATAL: staging key project_id must be', STAGING_PROJECT, 'got', stgKey.project_id);
  process.exit(2);
}

const app = admin.initializeApp({ credential: admin.credential.cert(stgKey) }, 'stgInv');
const db = app.firestore();

const houzzIdToUrl = new Map();
const basenameToUrl = new Map();

function str(v) { return String(v == null ? '' : v).trim(); }
function hz(o) { return str(o && (o.houzzId || o.houzzProductId || o.catalogId)); }
function csvEsc(v) {
  if (v == null) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function isIvy(u) { return /ivy-uploads/i.test(str(u)); }
function isFirebase(u) {
  u = str(u);
  return /firebasestorage\.googleapis|\.firebasestorage\.app|storage\.googleapis\.com/i.test(u);
}
function decodeUrl(u) {
  u = str(u);
  if (!u) return '';
  try { return decodeURIComponent(u.replace(/&amp;/g, '&')); } catch (_e) { return u.replace(/&amp;/g, '&'); }
}
function parseIvyUrl(url) {
  url = decodeUrl(url);
  const m = url.match(/ivy-uploads[^/]*\/[^/]+\/(?:productImage|image)\/(\d+)\/([^?]+)/i);
  if (!m) return null;
  return { ivyId: m[1], filePart: m[2], basename: path.basename(m[2]).toLowerCase(), pattern: url.includes('/productImage/') ? 'productImage' : 'image' };
}

function storagePathKind(url) {
  const u = decodeUrl(url).toLowerCase();
  if (!u) return 'empty';
  if (/houzz-products\//.test(u)) return 'houzz-products';
  if (/images\/products\//.test(u)) return 'images/products';
  if (/projects\//.test(u)) return 'projects/clips';
  if (isIvy(u)) return 'ivy';
  return 'other';
}

function isEluProduct(p, docId) {
  const v = str(p && p.vendor).toLowerCase();
  const id = str(docId).toLowerCase();
  return /^elu\b|elu atelier|elu ranch|early lights|earlylights/.test(v) || id.includes('__elu');
}

/** Returns skip reason string if product must NOT be crosswalk-overwritten, else null. */
function checkPreserveProduct(p, docId) {
  if (!p) return null;
  const url = str(p.imageUrl);
  const kind = storagePathKind(url);
  if (p._imageLocked === true) return 'image_locked';
  if (p._imageManual === true) return 'image_manual';
  const prev = str(p._imageUrlPrevApr27);
  if (prev && url && decodeUrl(prev).split('?')[0] !== decodeUrl(url).split('?')[0]) {
    return 'image-rehosted-then-updated';
  }
  if (url && kind !== 'houzz-products' && kind !== 'ivy' && kind !== 'empty') {
    return 'manual-image-path';
  }
  if (Array.isArray(p.images)) {
    for (const u of p.images) {
      const iu = typeof u === 'string' ? u : (u && u.url);
      if (storagePathKind(iu) === 'images/products') {
        if (kind === 'ivy' || kind === 'houzz-products') return 'manual-gallery-hi-res';
      }
    }
  }
  const src = str(p.source || p.dataSource || p.origin || '').toLowerCase();
  if (url && CURATED_SOURCES.has(src) && kind !== 'houzz-products' && kind !== 'ivy') {
    return 'elu-curated-source';
  }
  if (isEluProduct(p, docId)) {
    const updated = str(p.updatedAt || p._imagesRehostedAt);
    if (updated && updated > PHASE2A_CUTOFF && kind !== 'houzz-products' && url) {
      return 'elu-updated-after-phase2a';
    }
    if (kind === 'houzz-products' && hz(p)) {
      return 'elu-houzz-products-review';
    }
  }
  return null;
}

function preservedMatch(p, docId, currentUrl) {
  const reason = checkPreserveProduct(p, docId);
  if (!reason) return null;
  if (reason === 'elu-houzz-products-review' && isIvy(currentUrl)) {
    return null;
  }
  return {
    bucket: 'preserved',
    confidence: 'n/a',
    matchMethod: 'preserve-skip',
    proposedUrl: str(p && p.imageUrl) || '',
    proposedHouzzId: hz(p),
    skipReason: reason,
    note: 'Do not crosswalk — manual/curated image must be kept (' + reason + ')',
  };
}

function isEluLine(ctx) {
  return isEluProduct({ vendor: ctx.vendor }, ctx.libraryDocId || '') || isEluProduct({ vendor: ctx.vendor, title: ctx.title }, '');
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
      if (!hid || !url || !isFirebase(url)) continue;
      const slot = parseInt(r.slot, 10) || 99;
      const prev = houzzIdToUrl.get(hid);
      if (!prev || slot < prev.slot) houzzIdToUrl.set(hid, { url, slot });
      const sp = str(r.storagePath);
      if (sp) {
        const base = path.basename(sp).toLowerCase();
        if (base && !basenameToUrl.has(base)) basenameToUrl.set(base, url);
      }
      const lf = str(r.localFile).toLowerCase();
      if (lf) {
        const tokenM = path.basename(lf).match(/^\d+__(.+)\.[a-z0-9]+$/i);
        const token = tokenM ? tokenM[1].toLowerCase() : path.basename(lf).toLowerCase();
        if (token.length >= 6 && !basenameToUrl.has(token.slice(0, 12))) {
          basenameToUrl.set(token.slice(0, 12), url);
        }
      }
    }
  }
}

function lookupLibrary(id) {
  if (!id) return null;
  return libraryById.get(id) || null;
}

function proposeMatch(ivyUrl, ctx) {
  const ivy = parseIvyUrl(ivyUrl);
  const lid = str(ctx.libraryProductId || ctx.linkedLibraryProductId);
  const hid = hz(ctx) || (ivy && ivy.pattern === 'productImage' ? ivy.ivyId : '');

  const lib = lookupLibrary(lid);
  if (lib) {
    const preserved = preservedMatch(lib, lib._id, ivyUrl);
    if (preserved) return preserved;
  }

  if (isEluLine(ctx) && !hid && !lid) {
    return { bucket: 'elu-post-pass', confidence: 'manual', matchMethod: 'elu-no-houzz', proposedUrl: '', proposedHouzzId: '', skipReason: 'elu-no-houzz-crosswalk', note: 'ELU without houzzId/link — separate pass' };
  }

  if (lid && lib) {
    const libUrl = str(lib.imageUrl);
    if (isFirebase(libUrl) && !isIvy(libUrl)) {
      return { bucket: 'easy', confidence: 'high', matchMethod: 'libraryProductId', proposedUrl: libUrl, proposedHouzzId: hz(lib), note: 'Swap from linked library keeper' };
    }
    if (isIvy(libUrl)) {
      const mHid = hz(lib) || hid;
      if (mHid && houzzIdToUrl.has(mHid)) {
        if (isEluProduct(lib, lib._id)) {
          return { bucket: 'elu-houzz-review', confidence: 'manual', matchMethod: 'elu-ivy-to-houzz-products', proposedUrl: houzzIdToUrl.get(mHid).url, proposedHouzzId: mHid, skipReason: 'elu-houzz-products-review', note: 'ELU + houzzId manifest match — verify not blurry before apply' };
        }
        return { bucket: 'crosswalk', confidence: 'medium', matchMethod: 'libraryProductId+houzzId-manifest', proposedUrl: houzzIdToUrl.get(mHid).url, proposedHouzzId: mHid, skipReason: '', note: 'Library link ok but library imageUrl still Ivy — use manifest' };
      }
    }
  }

  if (hid && houzzIdToUrl.has(hid)) {
    if (isEluLine(ctx)) {
      return { bucket: 'elu-houzz-review', confidence: 'manual', matchMethod: 'elu-houzzId-manifest', proposedUrl: houzzIdToUrl.get(hid).url, proposedHouzzId: hid, skipReason: 'elu-houzz-products-review', note: 'ELU houzzId → houzz-products — verify hero quality' };
    }
    return { bucket: 'crosswalk', confidence: 'medium', matchMethod: 'houzzId-manifest', proposedUrl: houzzIdToUrl.get(hid).url, proposedHouzzId: hid, skipReason: '', note: '' };
  }

  if (ivy) {
    if (ivy.pattern === 'productImage' && houzzIdToUrl.has(ivy.ivyId)) {
      return { bucket: 'crosswalk', confidence: 'medium', matchMethod: 'ivy-productImage-id-manifest', proposedUrl: houzzIdToUrl.get(ivy.ivyId).url, proposedHouzzId: ivy.ivyId, note: '' };
    }
    if (ivy.basename && basenameToUrl.has(ivy.basename)) {
      return { bucket: 'crosswalk', confidence: 'low', matchMethod: 'filename-basename', proposedUrl: basenameToUrl.get(ivy.basename), proposedHouzzId: hid || ivy.ivyId, note: 'Filename match — verify hero slot' };
    }
    const stem = ivy.filePart.toLowerCase().replace(/\.[a-z0-9]+$/i, '').slice(0, 10);
    for (const [k, url] of basenameToUrl.entries()) {
      if (k.includes(stem) || stem.includes(k.slice(0, 8))) {
        return { bucket: 'crosswalk', confidence: 'low', matchMethod: 'filename-fuzzy', proposedUrl: url, proposedHouzzId: hid || ivy.ivyId, note: 'Fuzzy filename — manual verify' };
      }
    }
  }

  if (ctx.clipSourced || ctx.clipSourceTruth) {
    return { bucket: 'clip-truth', confidence: 'manual', matchMethod: 'clip-sourced', proposedUrl: '', proposedHouzzId: hid, note: 'Fix clip first; line inherits clip truth' };
  }

  if (lid || hid || str(ctx.title).length >= 3) {
    return { bucket: 'orphan', confidence: 'manual', matchMethod: 'no-match', proposedUrl: '', proposedHouzzId: hid, note: 'Needs title/vendor crosswalk or Claude source table' };
  }

  return { bucket: 'orphan', confidence: 'manual', matchMethod: 'no-match', proposedUrl: '', proposedHouzzId: '', note: 'No link fields' };
}

const libraryById = new Map();
const rows = [];
const bucketCounts = {};
const confidenceCounts = {};

function bump(map, key) { map[key] = (map[key] || 0) + 1; }

function record(entry) {
  rows.push(entry);
  bump(bucketCounts, entry.bucket);
  bump(confidenceCounts, entry.confidence);
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
      source: str(item.source || item.dataSource || ''),
      clipSourced: !!(str(item.clipId || item.sourceClipId)),
      clipSourceTruth: item._clipSourceTruth === true,
    };
    ctx.houzzId = hz(item);
    collectUrls(item).forEach(({ path: urlPath, url }) => {
      if (!isIvy(url)) {
        if (isFirebase(url)) {
          record(Object.assign({}, ctx, { urlPath, ivyUrl: url, hostClass: 'firebase', bucket: 'already-clean', confidence: 'high', matchMethod: 'stored-firebase', proposedUrl: url, proposedHouzzId: ctx.houzzId, note: '' }));
        }
        return;
      }
      const m = proposeMatch(url, ctx);
      record(Object.assign({}, ctx, {
        urlPath,
        ivyUrl: url,
        hostClass: 'ivy',
        bucket: m.bucket,
        confidence: m.confidence,
        matchMethod: m.matchMethod,
        proposedUrl: m.proposedUrl,
        proposedHouzzId: m.proposedHouzzId,
        skipReason: m.skipReason || '',
        note: m.note,
        ivyPattern: (parseIvyUrl(url) || {}).pattern || '',
      }));
    });
  });
}

(async () => {
  console.log('=== IVY CUTOVER INVENTORY — STAGING ONLY ===');
  console.log('Project:', STAGING_PROJECT);
  console.log('Board scope:', ALL_BOARDS ? 'ALL BOARDS' : BOARD);
  console.log('Rollback field for future apply:', ROLLBACK_FIELD);
  console.log('(Production cch-design-boards is NEVER touched by this script.)\n');

  loadManifests();
  console.log('Manifest index:', houzzIdToUrl.size, 'houzzIds,', basenameToUrl.size, 'basename keys\n');

  if (INCLUDE_LIBRARY || ALL_BOARDS) {
    for (const coll of ['products', 'productLibrary']) {
      const snap = await db.collection(coll).get();
      snap.forEach((d) => {
        const p = d.data() || {};
        libraryById.set(d.id, Object.assign({ _id: d.id, _coll: coll }, p));
        if (!INCLUDE_LIBRARY) return;
        const ctx = {
          boardId: '',
          collection: coll,
          docId: d.id,
          docNumber: '',
          lineIdx: '',
          title: str(p.title || p.name),
          vendor: str(p.vendor),
          libraryProductId: d.id,
          houzzId: hz(p),
          source: str(p.source || p.dataSource || ''),
          clipSourced: false,
          clipSourceTruth: false,
        };
        collectUrls(p).forEach(({ path: urlPath, url }) => {
          if (!isIvy(url)) return;
          const m = proposeMatch(url, ctx);
          record(Object.assign({}, ctx, { urlPath, ivyUrl: url, hostClass: 'ivy', bucket: m.bucket, confidence: m.confidence, matchMethod: m.matchMethod, proposedUrl: m.proposedUrl, proposedHouzzId: m.proposedHouzzId, skipReason: m.skipReason || '', note: m.note }));
        });
      });
    }
    console.log('Library docs indexed:', libraryById.size);
  } else {
    const ps = await db.collection('products').get();
    ps.forEach((d) => libraryById.set(d.id, Object.assign({ _id: d.id }, d.data() || {})));
    const pl = await db.collection('productLibrary').get();
    pl.forEach((d) => { if (!libraryById.has(d.id)) libraryById.set(d.id, Object.assign({ _id: d.id, _coll: 'productLibrary' }, d.data() || {})); });
    console.log('Library index (for link lookup):', libraryById.size);
  }

  let boardIds = [];
  if (ALL_BOARDS) {
    const bs = await db.collection('boards').get();
    bs.forEach((d) => boardIds.push(d.id));
  } else {
    boardIds = [BOARD];
  }

  for (const boardId of boardIds) {
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
        source: str(c.source || c.dataSource || ''),
        clipSourced: true,
        clipSourceTruth: c._clipSourceTruth === true,
        projectId: str(c.projectId || boardId),
      };
      collectUrls(c).forEach(({ path: urlPath, url }) => {
        if (!isIvy(url)) {
          if (isFirebase(url)) record(Object.assign({}, ctx, { urlPath, ivyUrl: url, hostClass: 'firebase', bucket: 'already-clean', confidence: 'high', matchMethod: 'stored-firebase', proposedUrl: url, proposedHouzzId: ctx.houzzId, note: '' }));
          return;
        }
        const m = proposeMatch(url, ctx);
        record(Object.assign({}, ctx, { urlPath, ivyUrl: url, hostClass: 'ivy', bucket: m.bucket, confidence: m.confidence, matchMethod: m.matchMethod, proposedUrl: m.proposedUrl, proposedHouzzId: m.proposedHouzzId, skipReason: m.skipReason || '', note: m.note }));
      });
    });

    for (const sub of ['invoices', 'proposals', 'purchaseOrders']) {
      const snap = await db.collection('boards').doc(boardId).collection(sub).get();
      for (const doc of snap.docs) await scanDocItems(boardId, sub, doc);
    }
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const header = ['boardId', 'collection', 'docId', 'docNumber', 'lineIdx', 'urlPath', 'title', 'vendor', 'libraryProductId', 'houzzId', 'hostClass', 'ivyUrl', 'bucket', 'confidence', 'matchMethod', 'proposedUrl', 'proposedHouzzId', 'skipReason', 'note'];
  const csvLines = [header.join(',')];
  rows.forEach((r) => {
    csvLines.push(header.map((h) => csvEsc(r[h])).join(','));
  });
  fs.writeFileSync(path.join(OUT_DIR, 'INVENTORY_rows.csv'), csvLines.join('\n'));

  const summary = {
    generatedAt: new Date().toISOString(),
    project: STAGING_PROJECT,
    boardScope: ALL_BOARDS ? 'all' : BOARD,
    readOnly: true,
    rollbackFieldForApply: ROLLBACK_FIELD,
    skipReasonFieldForApply: SKIP_REASON_FIELD,
    preserveRules: [
      'imageUrl path not houzz-products/ (images/products/, projects/, etc.)',
      '_imageLocked or _imageManual',
      'ELU vendor + updatedAt after 2026-05-02 + non-houzz-products hero',
      'source in manual|cch-elu|clipper|ffe-import|ffe-schedule',
      '_imageUrlPrevApr27 differs from current imageUrl',
    ],
    manifestHouzzIds: houzzIdToUrl.size,
    totalRows: rows.length,
    ivyRows: rows.filter((r) => r.hostClass === 'ivy').length,
    bucketCounts,
    confidenceCounts,
    eluPostPass: rows.filter((r) => r.bucket === 'elu-post-pass').length,
    preserved: rows.filter((r) => r.bucket === 'preserved').length,
    eluHouzzReview: rows.filter((r) => r.bucket === 'elu-houzz-review').length,
    verificationChecklist: {
      afterApply: [
        'Spot-check 5 high-confidence rows — hero correct',
        'Spot-check 5 medium-confidence rows — hero + gallery',
        'Manual review all low + manual confidence rows',
        'Confirm _imageUrlPrevApr27 untouched; new rollback in _imageUrlPrevIvyCutover only',
        'Confirm preserved bucket unchanged (ELU hi-res, images/products/, _imageLocked)',
      ],
    },
    samples: {
      high: rows.filter((r) => r.confidence === 'high' && r.hostClass === 'ivy').slice(0, 5),
      medium: rows.filter((r) => r.confidence === 'medium' && r.hostClass === 'ivy').slice(0, 5),
      manual: rows.filter((r) => r.confidence === 'manual' && r.hostClass === 'ivy').slice(0, 10),
    },
  };
  fs.writeFileSync(path.join(OUT_DIR, 'INVENTORY_summary.json'), JSON.stringify(summary, null, 2));

  console.log('\n--- SUMMARY ---');
  console.log('Total URL rows:', summary.totalRows);
  console.log('Ivy URL rows:', summary.ivyRows);
  console.log('Buckets:', JSON.stringify(bucketCounts, null, 2));
  console.log('Confidence:', JSON.stringify(confidenceCounts, null, 2));
  console.log('ELU post-pass flagged:', summary.eluPostPass);
  console.log('Preserved (do not crosswalk):', summary.preserved);
  console.log('ELU houzz-products review:', summary.eluHouzzReview);
  console.log('\nWrote:', path.join(OUT_DIR, 'INVENTORY_rows.csv'));
  console.log('Wrote:', path.join(OUT_DIR, 'INVENTORY_summary.json'));
  process.exit(0);
})().catch((e) => { console.error('FAILED:', e); process.exit(1); });
