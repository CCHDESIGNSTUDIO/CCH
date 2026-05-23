#!/usr/bin/env node
/**
 * rewrite-image-urls.js
 *
 * Rewrites ivy-uploads.s3… imageUrl values to permanent Firebase Storage URLs
 * under houzz-products/ in Firebase Storage.
 *
 * Legacy projects: images were uploaded to houzz-products/ on clips during tracker
 * import, but invoice/proposal lines still point at expiring ivy-uploads.s3 URLs.
 * This script reconnects them (clip canonical URL first, then houzzId/manifest).
 *
 * Ivy /image/262813654/ IDs are usually NOT Houzz catalog folder names; matching
 * uses board clips, houzzId fields, manifests, and Storage listing — not filename
 * alone unless --build-filename-index is used (slow).
 *
 * Usage:
 *   node scripts/rewrite-image-urls.js
 *   node scripts/rewrite-image-urls.js --apply --yes
 *   node scripts/rewrite-image-urls.js --boards=cloud-susan,cloud-rolling-hills
 *   node scripts/rewrite-image-urls.js --all-boards
 *   node scripts/rewrite-image-urls.js --include-products
 *     (also rewrite products + productLibrary — large; use after board test)
 *
 * Default: dry-run, boards cloud-rolling-hills + cloud-susan, board subcollections only.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const admin = require('firebase-admin');

const PROD_KEY = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
const PROD_PROJECT = 'cch-design-boards';
const BUCKET = 'cch-design-boards.firebasestorage.app';

const DEFAULT_BOARDS = ['cloud-rolling-hills', 'cloud-susan'];
const BOARD_SUBCOLS = ['clips', 'invoices', 'proposals', 'purchaseOrders'];
const ROOT_COLLECTIONS = ['products', 'productLibrary'];

const argv = process.argv.slice(2);
const DRY_RUN = !argv.includes('--apply');
const SKIP_CONFIRM = argv.includes('--yes');
const ALL_BOARDS = argv.includes('--all-boards');
const INCLUDE_PRODUCTS = argv.includes('--include-products');
const BOARDS = (() => {
  const a = argv.find((x) => x.startsWith('--boards='));
  if (a) return a.split('=')[1].split(',').map((s) => s.trim()).filter(Boolean);
  if (ALL_BOARDS) return null;
  return DEFAULT_BOARDS.slice();
})();

const prodKeyJson = require(PROD_KEY);
if (prodKeyJson.project_id !== PROD_PROJECT) {
  console.error('FATAL: expected prod project', PROD_PROJECT, 'got', prodKeyJson.project_id);
  process.exit(2);
}

const app = admin.initializeApp({
  credential: admin.credential.cert(prodKeyJson),
  projectId: PROD_PROJECT,
});
const db = app.firestore();
const bucket = app.storage().bucket(BUCKET);

const stats = {
  docsScanned: 0,
  ivyUrlsFound: 0,
  alreadyFirebase: 0,
  fixedWould: 0,
  fixedApplied: 0,
  noMatch: 0,
  noStorage: 0,
  docsUpdated: 0,
  viaClipCanonical: 0,
  viaHouzzId: 0,
  viaFilename: 0,
  imagesArraysCollapsed: 0,
  bySource: {},
  byBoard: {},
  samples: { fixed: [], noMatch: [] },
};

const houzzIdToUrl = new Map();
const houzzIdStorageChecked = new Map();
const titleVendorToHouzzId = new Map();
const boardClipFirebaseByTitle = new Map();
const basenameToStorageUrl = new Map();

const IMAGE_KEYS = new Set([
  'imageUrl', 'image', 'thumbnail', 'img', 'heroImageUrl', 'clientPortalHeroUrl',
]);

function normKey(s) {
  return String(s || '').toLowerCase().trim().replace(/\s+/g, ' ');
}

function tvKey(title, vendor) {
  return normKey(title) + '|' + normKey(vendor);
}

function isIvyUrl(u) {
  u = String(u || '').replace(/&amp;/g, '&');
  return /ivy-uploads/i.test(u);
}

function isFirebaseUrl(u) {
  return /firebasestorage\.googleapis|\.firebasestorage\.app/i.test(String(u || ''));
}

function decodeUrl(u) {
  return String(u || '').replace(/&amp;/g, '&').replace(/&#38;/g, '&').trim();
}

function firebaseDownloadUrl(objectPath, token) {
  const enc = encodeURIComponent(objectPath).replace(/%2F/g, '%2F');
  return `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${enc}?alt=media&token=${token}`;
}

function bump(bucket, key, n) {
  if (!bucket[key]) bucket[key] = 0;
  bucket[key] += n || 1;
}

function parseIvyUrl(url) {
  url = decodeUrl(url);
  const m = url.match(/ivy-uploads[^/]*\/[^/]+\/image\/(\d+)\/([^?]+)/i);
  if (!m) return null;
  const filePart = m[2];
  return {
    ivyImageId: m[1],
    filePart,
    basename: path.basename(filePart).toLowerCase(),
  };
}

function loadManifestFiles() {
  const files = [
    path.join(__dirname, '..', '_debug', 'phase2a-upload-manifest.json'),
    path.join(__dirname, '..', '_debug', 'phase4a-upload-manifest.json'),
    path.join(__dirname, '..', '_debug', 'phase2a-extended-manifest.json'),
  ];
  let loaded = 0;
  for (const fp of files) {
    if (!fs.existsSync(fp)) continue;
    const data = JSON.parse(fs.readFileSync(fp, 'utf8'));
    const rows = data.results || data.uploads || [];
    for (const r of rows) {
      if (r.status && r.status !== 'ok') continue;
      const hid = String(r.houzzId || r.sourceId || '').trim();
      const url = String(r.downloadUrl || '').trim();
      if (!hid || !url || !isFirebaseUrl(url)) continue;
      const slot = parseInt(r.slot, 10) || 99;
      const prev = houzzIdToUrl.get(hid);
      if (!prev || slot < prev.slot) {
        houzzIdToUrl.set(hid, { url, slot, storagePath: r.storagePath || '' });
      }
      const sp = String(r.storagePath || '').trim();
      if (sp) {
        const base = path.basename(sp).toLowerCase();
        if (base && !basenameToStorageUrl.has(base)) {
          basenameToStorageUrl.set(base, url);
        }
      }
    }
    loaded += rows.length;
  }
  console.log('Manifest index:', houzzIdToUrl.size, 'houzzIds from', loaded, 'manifest rows');
  console.log('Filename index (manifest basenames):', basenameToStorageUrl.size);
}

function pickBestClipEntry(bm, title, vendor) {
  if (!bm || !title) return null;
  const wantT = normKey(title);
  const wantV = normKey(vendor || '');
  let best = null;
  let bestScore = -1;
  bm.forEach((entry, key) => {
    if (!key.endsWith('|') && key.indexOf('|') >= 0) return;
    const parts = key.split('|');
    const ct = parts[0] || '';
    if (!ct) return;
    let score = 0;
    if (ct === wantT) score += 100;
    else if (wantT.length >= 4 && (ct.indexOf(wantT) >= 0 || wantT.indexOf(ct) >= 0)) score += 40;
    else return;
    if (entry.firebaseUrl) score += 50;
    if (wantV && parts[1] && parts[1] === wantV) score += 20;
    if (score > bestScore) { bestScore = score; best = entry; }
  });
  if (best) return best;
  return bm.get(tvKey(title, vendor)) || bm.get(wantT + '|') || null;
}

function registerTitleLookup(title, vendor, houzzId) {
  const hid = String(houzzId || '').trim();
  if (!hid) return;
  const k = tvKey(title, vendor);
  if (!titleVendorToHouzzId.has(k)) titleVendorToHouzzId.set(k, hid);
  const kt = normKey(title);
  if (kt && kt.length >= 3 && !titleVendorToHouzzId.has(kt + '|')) {
    titleVendorToHouzzId.set(kt + '|', hid);
  }
}

function extractHouzzId(obj) {
  if (!obj || typeof obj !== 'object') return '';
  return String(
    obj.houzzId || obj.houzzProductId || obj.houzzProduct || obj.catalogId || ''
  ).trim();
}

async function pickStorageUrlForHouzzId(houzzId) {
  const hid = String(houzzId || '').trim();
  if (!hid) return null;
  if (houzzIdToUrl.has(hid)) return houzzIdToUrl.get(hid).url;

  if (houzzIdStorageChecked.has(hid)) return houzzIdStorageChecked.get(hid);

  const prefix = `houzz-products/${hid}/`;
  const [files] = await bucket.getFiles({ prefix, maxResults: 32 });
  if (!files.length) {
    houzzIdStorageChecked.set(hid, null);
    return null;
  }
  files.sort((a, b) => {
    const sa = path.basename(a.name);
    const sb = path.basename(b.name);
    const na = parseInt(sa, 10);
    const nb = parseInt(sb, 10);
    if (!isNaN(na) && !isNaN(nb)) return na - nb;
    return sa.localeCompare(sb);
  });
  const file = files[0];
  try {
    const [meta] = await file.getMetadata();
    let token = meta.metadata && meta.metadata.firebaseStorageDownloadTokens;
    token = token ? String(token).split(',')[0] : '';
    if (!token) {
      houzzIdStorageChecked.set(hid, null);
      return null;
    }
    const url = firebaseDownloadUrl(file.name, token);
    houzzIdToUrl.set(hid, { url, slot: 1, storagePath: file.name });
    houzzIdStorageChecked.set(hid, url);
    return url;
  } catch (e) {
    houzzIdStorageChecked.set(hid, null);
    return null;
  }
}

async function resolveFirebaseUrl(ivyUrl, ctx) {
  const obj = ctx.obj || {};
  ivyUrl = decodeUrl(ivyUrl);

  if (ctx.boardId && ctx.title) {
    const bm = boardClipFirebaseByTitle.get(ctx.boardId);
    const clip = bm ? pickBestClipEntry(bm, ctx.title, ctx.vendor || '') : null;
    if (clip && clip.firebaseUrl) {
      return { url: clip.firebaseUrl, via: 'board-clip-canonical', houzzId: clip.houzzId };
    }
    if (clip && clip.houzzId) {
      const url = await pickStorageUrlForHouzzId(clip.houzzId);
      if (url) return { url, via: 'board-clip-houzzId/' + clip.houzzId, houzzId: clip.houzzId };
    }
  }

  let hid = extractHouzzId(obj);
  if (!hid && ctx.title) {
    hid = titleVendorToHouzzId.get(tvKey(ctx.title, ctx.vendor || ''))
      || titleVendorToHouzzId.get(normKey(ctx.title) + '|')
      || '';
  }

  if (hid) {
    const url = await pickStorageUrlForHouzzId(hid);
    if (url) return { url, via: 'houzz-products/' + hid, houzzId: hid };
  }

  const ivy = parseIvyUrl(ivyUrl);
  if (ivy) {
    const urlByIvyFolder = await pickStorageUrlForHouzzId(ivy.ivyImageId);
    if (urlByIvyFolder) {
      return { url: urlByIvyFolder, via: 'ivy-imageId-as-folder/' + ivy.ivyImageId };
    }
    if (ivy.basename && basenameToStorageUrl.has(ivy.basename)) {
      return { url: basenameToStorageUrl.get(ivy.basename), via: 'filename-match/' + ivy.basename };
    }
  }

  return null;
}

async function indexBoardClips(boardId) {
  const snap = await db.collection('boards').doc(boardId).collection('clips').get();
  const m = new Map();
  snap.forEach((d) => {
    const c = d.data() || {};
    const title = c.title || c.name || '';
    const vendor = c.vendor || '';
    const hid = extractHouzzId(c);
    const img = decodeUrl(c.imageUrl || c.image || '');
    const entry = {
      clipId: d.id,
      houzzId: hid,
      firebaseUrl: isFirebaseUrl(img) ? img : '',
    };
    if (hid) registerTitleLookup(title, vendor, hid);
    const k = tvKey(title, vendor);
    const existing = m.get(k);
    if (!existing || (entry.firebaseUrl && !existing.firebaseUrl)) m.set(k, entry);
    const kt = normKey(title) + '|';
    if (!m.has(kt) || (entry.firebaseUrl && !m.get(kt).firebaseUrl)) m.set(kt, entry);
  });
  boardClipFirebaseByTitle.set(boardId, m);
  const fb = [...m.values()].filter((e) => e.firebaseUrl).length;
  console.log('  Indexed clips:', snap.size, '| with firebase image:', fb);
}

async function indexProducts() {
  for (const col of ROOT_COLLECTIONS) {
    const snap = await db.collection(col).get();
    snap.forEach((d) => {
      const p = d.data() || {};
      registerTitleLookup(p.title || p.name, p.vendor, extractHouzzId(p));
    });
    console.log('Indexed', col + ':', snap.size);
  }
}

function walkValue(value, ctx, changes) {
  if (value == null) return value;
  if (typeof value === 'string') {
    if (!isIvyUrl(value)) return value;
    stats.ivyUrlsFound++;
    bump(stats.bySource, ctx.source || 'unknown');
    if (ctx.boardId) bump(stats.byBoard, ctx.boardId);
    changes.push({ path: ctx.path, oldUrl: value, ctx: { ...ctx } });
    return value;
  }
  if (Array.isArray(value)) {
    let arr = value;
    let changed = false;
    for (let i = 0; i < arr.length; i++) {
      const v = arr[i];
      if (typeof v === 'string' && isIvyUrl(v)) {
        stats.ivyUrlsFound++;
        bump(stats.bySource, ctx.source || 'unknown');
        changes.push({ path: ctx.path + '[' + i + ']', oldUrl: v, ctx: { ...ctx } });
      } else if (v && typeof v === 'object') {
        const inner = walkObject(v, Object.assign({}, ctx, { path: ctx.path + '[' + i + ']' }), changes);
        if (inner !== v) { arr = arr.slice(); arr[i] = inner; changed = true; }
      }
    }
    return changed ? arr : value;
  }
  if (typeof value === 'object' && typeof value.toDate !== 'function') {
    return walkObject(value, ctx, changes);
  }
  return value;
}

function walkObject(obj, ctx, changes) {
  let out = obj;
  let touched = false;
  for (const key of Object.keys(obj)) {
    const nextPath = ctx.path ? ctx.path + '.' + key : key;
    const childCtx = Object.assign({}, ctx, { path: nextPath });
    if (key === 'items' && Array.isArray(obj.items)) {
      let items = obj.items;
      let itemsChanged = false;
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (!it || typeof it !== 'object') continue;
        const itemCtx = Object.assign({}, ctx, {
          path: nextPath + '[' + i + ']',
          obj: it,
          title: it.title || it.name || '',
          vendor: it.vendor || '',
        });
        const chBefore = changes.length;
        const newItem = walkObject(it, itemCtx, changes);
        if (newItem !== it) {
          if (!itemsChanged) { items = items.slice(); itemsChanged = true; }
          items[i] = newItem;
        }
        if (changes.length > chBefore) {
          for (let c = chBefore; c < changes.length; c++) {
            changes[c].ctx = Object.assign({}, changes[c].ctx, {
              title: it.title,
              vendor: it.vendor,
              obj: it,
            });
          }
        }
      }
      if (itemsChanged) {
        if (!touched) { out = Object.assign({}, obj); touched = true; }
        out.items = items;
      }
      continue;
    }
    const val = obj[key];
    if (typeof val === 'string' && (IMAGE_KEYS.has(key) || isIvyUrl(val))) {
      if (isIvyUrl(val)) {
        stats.ivyUrlsFound++;
        bump(stats.bySource, ctx.source || 'unknown');
        if (ctx.boardId) bump(stats.byBoard, ctx.boardId);
        changes.push({
          path: nextPath,
          oldUrl: val,
          ctx: Object.assign({}, ctx, { obj }),
        });
      }
      continue;
    }
    const newVal = walkValue(val, childCtx, changes);
    if (newVal !== val) {
      if (!touched) { out = Object.assign({}, obj); touched = true; }
      out[key] = newVal;
    }
  }
  return touched ? out : obj;
}

async function applyChanges(changes) {
  for (const ch of changes) {
    if (isFirebaseUrl(ch.oldUrl)) {
      stats.alreadyFirebase++;
      continue;
    }
    const resolved = await resolveFirebaseUrl(ch.oldUrl, ch.ctx);
    if (!resolved || !resolved.url) {
      if (extractHouzzId(ch.ctx.obj || {}) || ch.ctx.title) stats.noStorage++;
      else stats.noMatch++;
      if (stats.samples.noMatch.length < 12) {
        stats.samples.noMatch.push({
          path: ch.path,
          title: ch.ctx.title,
          ivy: ch.oldUrl.slice(0, 80),
        });
      }
      continue;
    }
    ch.newUrl = resolved.url;
    ch.via = resolved.via;
    ch.houzzIdResolved = resolved.houzzId || '';
    stats.fixedWould++;
    if (resolved.via && resolved.via.indexOf('board-clip') === 0) stats.viaClipCanonical++;
    else if (resolved.via && resolved.via.indexOf('filename') >= 0) stats.viaFilename++;
    else stats.viaHouzzId++;
    if (stats.samples.fixed.length < 15) {
      stats.samples.fixed.push({
        board: ch.ctx.boardId,
        source: ch.ctx.source,
        title: ch.ctx.title,
        via: ch.via,
        old: ch.oldUrl.slice(0, 70),
        new: ch.newUrl.slice(0, 70),
      });
    }
  }
}

function setAtPath(root, dotPath, newVal) {
  const parts = dotPath.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean);
  let cur = root;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    const nextIsIndex = /^\d+$/.test(parts[i + 1]);
    if (/^\d+$/.test(p)) {
      cur = cur[parseInt(p, 10)];
    } else {
      if (cur[p] === undefined) return root;
      cur = cur[p];
    }
  }
  const last = parts[parts.length - 1];
  if (/^\d+$/.test(last)) cur[parseInt(last, 10)] = newVal;
  else cur[last] = newVal;
  return root;
}

async function processDoc(ref, data, meta) {
  stats.docsScanned++;
  const changes = [];
  walkObject(data, {
    path: '',
    boardId: meta.boardId,
    source: meta.source,
    obj: data,
  }, changes);
  if (!changes.length) return;

  await applyChanges(changes);
  const applicable = changes.filter((c) => c.newUrl);
  if (!applicable.length) return;

  let newData = JSON.parse(JSON.stringify(data));
  for (const ch of applicable) {
    setAtPath(newData, ch.path, ch.newUrl);
    if (/^items\[\d+\]\.imageUrl$/.test(ch.path) && ch.newUrl) {
      const m = ch.path.match(/^items\[(\d+)\]\.imageUrl$/);
      if (m) {
        const idx = parseInt(m[1], 10);
        if (newData.items && newData.items[idx]) {
          const it = newData.items[idx];
          const oldImgs = it.images;
          if (Array.isArray(oldImgs) && oldImgs.length > 1) {
            it.images = [ch.newUrl];
            stats.imagesArraysCollapsed++;
          } else if (Array.isArray(oldImgs) && oldImgs.length === 1 && oldImgs[0] !== ch.newUrl) {
            it.images = [ch.newUrl];
            stats.imagesArraysCollapsed++;
          } else if (!oldImgs || !oldImgs.length) {
            it.images = [ch.newUrl];
          }
          const hidFromClip = ch.houzzIdResolved || extractHouzzId(ch.ctx.obj || {});
          if (hidFromClip && !it.houzzId) it.houzzId = hidFromClip;
        }
      }
    }
  }

  if (DRY_RUN) return;

  await ref.set(newData, { merge: true });
  stats.docsUpdated++;
  stats.fixedApplied += applicable.length;
}

async function scanBoard(boardId) {
  console.log('\n▶ Board:', boardId);
  await indexBoardClips(boardId);

  for (const sub of BOARD_SUBCOLS) {
    const snap = await db.collection('boards').doc(boardId).collection(sub).get();
    console.log('  ', sub + ':', snap.size, 'docs');
    for (const doc of snap.docs) {
      await processDoc(doc.ref, doc.data() || {}, {
        boardId,
        source: 'boards/' + boardId + '/' + sub,
      });
    }
  }
}

async function scanRootCollection(col) {
  console.log('\n▶ Collection:', col);
  const snap = await db.collection(col).get();
  console.log('   docs:', snap.size);
  for (const doc of snap.docs) {
    await processDoc(doc.ref, doc.data() || {}, { source: col });
  }
}

async function confirmApply() {
  if (DRY_RUN || SKIP_CONFIRM) return true;
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║  APPLY will PATCH production Firestore (' + PROD_PROJECT + ')      ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('Boards:', BOARDS ? BOARDS.join(', ') : 'ALL');
  console.log('Type YES-PROD-REWRITE to continue:\n');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ans = await new Promise((r) => rl.question('> ', (a) => { rl.close(); r(a.trim()); }));
  return ans === 'YES-PROD-REWRITE';
}

(async () => {
  console.log('\n=== rewrite-image-urls (ivy → houzz-products Firebase) =========');
  console.log('Mode:   ', DRY_RUN ? 'DRY-RUN' : 'APPLY');
  console.log('Boards: ', BOARDS ? BOARDS.join(', ') : 'ALL production boards');
  console.log('Bucket: ', BUCKET);
  console.log('===============================================================\n');

  loadManifestFiles();
  await indexProducts();

  if (!(await confirmApply())) {
    await app.delete();
    process.exit(1);
  }

  if (BOARDS) {
    for (const b of BOARDS) await scanBoard(b);
  } else {
    const boardsSnap = await db.collection('boards').get();
    for (const d of boardsSnap.docs) await scanBoard(d.id);
  }

  if (INCLUDE_PRODUCTS || !BOARDS) {
    for (const col of ROOT_COLLECTIONS) await scanRootCollection(col);
  } else {
    console.log('\n(Skipping products/productLibrary — pass --include-products to rewrite catalog)');
  }

  console.log('\n=== summary ===================================================');
  console.log('docs scanned:      ', stats.docsScanned);
  console.log('ivy URLs found:    ', stats.ivyUrlsFound);
  console.log('already firebase:  ', stats.alreadyFirebase);
  console.log(DRY_RUN ? 'would fix:         ' : 'URLs fixed:        ', DRY_RUN ? stats.fixedWould : stats.fixedApplied);
  console.log('  via board clip (legacy reconnect):', stats.viaClipCanonical);
  console.log('  via houzzId / storage:          ', stats.viaHouzzId);
  console.log('  via filename index:             ', stats.viaFilename);
  console.log('  images[] collapsed to one URL:  ', stats.imagesArraysCollapsed);
  console.log('no houzz/storage:  ', stats.noMatch + stats.noStorage);
  if (!DRY_RUN) console.log('docs updated:      ', stats.docsUpdated);
  console.log('\nBy board:', stats.byBoard);
  console.log('\nBy source:', stats.bySource);

  if (stats.samples.fixed.length) {
    console.log('\nSample fixes:');
    stats.samples.fixed.forEach((s) => {
      console.log(' ', s.board || '-', s.source, '|', s.title || '(no title)');
      console.log('    via:', s.via);
      console.log('    old:', s.old);
      console.log('    new:', s.new);
    });
  }
  if (stats.samples.noMatch.length) {
    console.log('\nSample unmatched:');
    stats.samples.noMatch.forEach((s) => {
      console.log(' ', s.path, s.title, s.ivy);
    });
  }

  const manifestOut = path.join(__dirname, '..', '_debug',
    'rewrite-image-urls-' + (DRY_RUN ? 'dryrun-' : 'apply-') + Date.now() + '.json');
  fs.writeFileSync(manifestOut, JSON.stringify({ dryRun: DRY_RUN, boards: BOARDS, stats }, null, 2));
  console.log('\nmanifest:', manifestOut);

  if (DRY_RUN) {
    console.log('\nDry run complete. To apply:');
    console.log('  node scripts/rewrite-image-urls.js --apply');
  }

  await app.delete();
})().catch((err) => {
  console.error('FATAL:', err && err.stack || err);
  process.exit(1);
});
