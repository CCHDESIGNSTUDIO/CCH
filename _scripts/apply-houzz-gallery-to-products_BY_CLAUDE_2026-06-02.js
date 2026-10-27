#!/usr/bin/env node
'use strict';
/**
 * Link houzz-products/{houzzId}/1..N.jpeg Storage URLs into products/{id}.images[].
 * DRY RUN by default. Pilot: --project=7225-bugletrail --limit=20
 *
 * Usage (from cch-deploy/):
 *   node _scripts/apply-houzz-gallery-to-products_BY_CLAUDE_2026-06-02.js --dry-run --project=7225-bugletrail --limit=20
 *   node _scripts/apply-houzz-gallery-to-products_BY_CLAUDE_2026-06-02.js --apply --project=7225-bugletrail --limit=20 --yes
 *   node _scripts/apply-houzz-gallery-to-products_BY_CLAUDE_2026-06-02.js --dry-run --houzzId=50998761
 */
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const argv = process.argv.slice(2);
const DRY_RUN = !argv.includes('--apply');
const SKIP_CONFIRM = argv.includes('--yes');
const PROJECT_FILTER = (() => {
  const m = argv.find((a) => a.startsWith('--project='));
  return m ? m.split('=').slice(1).join('=').trim() : '';
})();
const HOUZZ_FILTER = (() => {
  const m = argv.find((a) => a.startsWith('--houzzId='));
  return m ? m.split('=').slice(1).join('=').trim() : '';
})();
const LIMIT = (() => {
  const m = argv.find((a) => a.startsWith('--limit='));
  return m ? Math.max(1, parseInt(m.split('=')[1], 10) || 0) : 0;
})();

const KEY = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
const BUCKET = 'cch-design-boards.firebasestorage.app';
const OUT_DIR = path.join(__dirname, '..', '_backup', 'houzz-gallery-gap-dryrun-2026-06-02');
const LINK_VERSION = '2026-06-02';

admin.initializeApp({
  credential: admin.credential.cert(require(KEY)),
  storageBucket: BUCKET,
});
const db = admin.firestore();
const bucket = admin.storage().bucket();

function str(v) {
  return String(v == null ? '' : v).trim();
}

function extractHouzzId(obj) {
  return str(obj && (obj.houzzId || obj.houzzProductId || obj.houzzProduct || obj.catalogId));
}

function firebaseDownloadUrl(objectPath, token) {
  const enc = encodeURIComponent(objectPath).replace(/%2F/g, '%2F');
  return `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${enc}?alt=media&token=${token}`;
}

function isFirebaseStorageUrl(u) {
  u = str(u).toLowerCase();
  return u.includes('firebasestorage.googleapis.com') || u.includes('.firebasestorage.app');
}

function urlReferencesHouzzFolder(url, hid) {
  const u = str(url).toLowerCase();
  const h = str(hid).toLowerCase();
  if (!u || !h) return false;
  return u.includes('houzz-products%2f' + h + '%2f') || u.includes('houzz-products/' + h + '/');
}

function countHouzzUrlsInDoc(doc, hid) {
  let n = 0;
  function consider(raw) {
    const u = str(typeof raw === 'string' ? raw : (raw && (raw.url || raw.imageUrl || raw.src)));
    if (urlReferencesHouzzFolder(u, hid)) n++;
  }
  consider(doc.imageUrl);
  consider(doc.image);
  (doc.images || []).forEach(consider);
  return n;
}

function coerceImagesLen(doc) {
  const seen = new Set();
  let n = 0;
  function add(u) {
    u = str(u).toLowerCase();
    if (!u || seen.has(u)) return;
    seen.add(u);
    n++;
  }
  add(doc.imageUrl);
  (doc.images || []).forEach((x) => add(typeof x === 'string' ? x : (x && x.url)));
  return n;
}

async function listHouzzStorageUrls(houzzId) {
  const hid = str(houzzId);
  if (!hid) return [];
  const prefix = 'houzz-products/' + hid + '/';
  const [files] = await bucket.getFiles({ prefix, maxResults: 32 });
  const imgs = files.filter((f) => /\.(jpe?g|png|webp|gif)$/i.test(f.name));
  imgs.sort((a, b) => {
    const sa = path.basename(a.name);
    const sb = path.basename(b.name);
    const na = parseInt(sa, 10);
    const nb = parseInt(sb, 10);
    if (!isNaN(na) && !isNaN(nb)) return na - nb;
    return sa.localeCompare(sb);
  });
  const urls = [];
  for (const file of imgs) {
    try {
      const [meta] = await file.getMetadata();
      let token = meta.metadata && meta.metadata.firebaseStorageDownloadTokens;
      token = token ? String(token).split(',')[0] : '';
      if (!token) continue;
      urls.push(firebaseDownloadUrl(file.name, token));
    } catch (_e) {}
  }
  return urls;
}

async function queryProductsByHouzzId(houzzId) {
  const hid = str(houzzId);
  const rows = [];
  for (const field of ['houzzId', 'houzzProductId']) {
    const snap = await db.collection('products').where(field, '==', hid).limit(12).get();
    snap.docs.forEach((d) => {
      if (!rows.some((r) => r.id === d.id)) {
        rows.push({ id: d.id, data: d.data() || {}, collection: 'products' });
      }
    });
  }
  return rows;
}

function pickCanonicalProduct(rows) {
  if (!rows.length) return null;
  rows.sort((a, b) => {
    const ca = countHouzzUrlsInDoc(a.data, extractHouzzId(a.data));
    const cb = countHouzzUrlsInDoc(b.data, extractHouzzId(b.data));
    if (cb !== ca) return cb - ca;
    const ta = str(a.data.updatedAt || a.data.createdAt);
    const tb = str(b.data.updatedAt || b.data.createdAt);
    return tb.localeCompare(ta);
  });
  return rows[0];
}

async function resolveProjectId(projectArg) {
  const arg = str(projectArg);
  if (!arg) return '';
  const direct = await db.collection('boards').doc(arg).get();
  if (direct.exists) return direct.id;
  const snap = await db.collection('boards').limit(500).get();
  const argLow = arg.toLowerCase().replace(/-/g, ' ');
  let hit = '';
  snap.docs.forEach((d) => {
    if (hit) return;
    const name = str((d.data() || {}).name).toLowerCase();
    const id = d.id.toLowerCase();
    if (id === arg.toLowerCase()) { hit = d.id; return; }
    if (name.indexOf('7225') >= 0 && name.indexOf('bugle') >= 0 && (argLow.indexOf('bugle') >= 0 || argLow.indexOf('7225') >= 0)) {
      hit = d.id;
    }
  });
  return hit;
}

function houzzFromImageUrl(u) {
  u = str(u);
  const m = u.match(/houzz-products%2[fF](\d+)%2[fF]/i) || u.match(/houzz-products\/(\d+)\//i);
  return m ? m[1] : '';
}

async function houzzIdsForProject(projectId) {
  const set = new Set();
  const pid = str(projectId);
  if (!pid) return set;

  const libIds = [];
  const skus = new Set();

  function scanLines(items) {
    (items || []).forEach((it) => {
      const h = extractHouzzId(it);
      if (h && /^\d{4,}$/.test(h)) set.add(h);
      const fromUrl = houzzFromImageUrl(it.imageUrl || it.image);
      if (fromUrl) set.add(fromUrl);
      const lid = str(it.libraryProductId || it.linkedLibraryProductId);
      if (lid) libIds.push(lid);
    });
  }

  const clips = await db.collection('boards').doc(pid).collection('clips').get();
  clips.forEach((d) => {
    const data = d.data() || {};
    const h = extractHouzzId(data);
    if (h && /^\d{4,}$/.test(h)) set.add(h);
    const fromUrl = houzzFromImageUrl(data.imageUrl || data.image);
    if (fromUrl) set.add(fromUrl);
    const lid = str(data.libraryProductId || data.linkedLibraryProductId);
    if (lid) libIds.push(lid);
    const sku = str(data.sku);
    if (sku) skus.add(sku);
  });

  for (const col of ['invoices', 'proposals', 'purchaseOrders']) {
    const snap = await db.collection('boards').doc(pid).collection(col).get();
    snap.docs.forEach((doc) => {
      scanLines((doc.data() || {}).items || (doc.data() || {}).lineItems || []);
    });
  }

  for (const lid of libIds) {
    for (const col of ['products', 'productLibrary']) {
      try {
        const snap = await db.collection(col).doc(lid).get();
        if (snap.exists) {
          const h = extractHouzzId(snap.data());
          if (h && /^\d{4,}$/.test(h)) set.add(h);
        }
      } catch (_e) {}
    }
  }

  try {
    const projProd = await db.collection('products').where('projectId', '==', pid).get();
    projProd.forEach((d) => {
      const h = extractHouzzId(d.data());
      if (h && /^\d{4,}$/.test(h)) set.add(h);
    });
  } catch (_e) {}

  for (const sku of skus) {
    try {
      const snap = await db.collection('products').where('sku', '==', sku).limit(4).get();
      snap.forEach((d) => {
        const h = extractHouzzId(d.data());
        if (h && /^\d{4,}$/.test(h)) set.add(h);
      });
    } catch (_e) {}
  }

  return set;
}

async function loadGapUnderlinkedHouzzIds() {
  const csvPath = path.join(OUT_DIR, 'HOUZZ_GALLERY_GAP_DRYRUN_BY_CLAUDE_2026-06-02.csv');
  if (!fs.existsSync(csvPath)) return [];
  const text = fs.readFileSync(csvPath, 'utf8');
  return text.split(/\r?\n/).slice(1).filter(Boolean).map((line) => {
    const parts = line.split(',');
    return { hid: parts[0], cat: parts[1] };
  }).filter((r) => r.cat === 'underlinked_one_or_zero_urls' && /^\d+$/.test(r.hid)).map((r) => r.hid);
}

function buildPatch(doc, urls, hid) {
  const now = new Date().toISOString();
  const patch = {
    houzzId: hid,
    images: urls,
    heroImageIndex: 0,
    updatedAt: now,
    _houzzGalleryLinkedAt: now,
    _houzzGalleryLinkVersion: LINK_VERSION,
  };
  const curUrl = str(doc.imageUrl || doc.image);
  if (!curUrl || urlReferencesHouzzFolder(curUrl, hid) || !isFirebaseStorageUrl(curUrl)) {
    patch.imageUrl = urls[0];
    patch.image = urls[0];
  }
  return patch;
}

function shouldSkipDoc(doc, urls) {
  if (!doc) return 'missing';
  if (doc._imageLocked === true) return 'image_locked';
  const hid = extractHouzzId(doc);
  const linked = str(doc._houzzGalleryLinkedAt);
  const houzzCount = countHouzzUrlsInDoc(doc, hid);
  if (linked && houzzCount >= urls.length && urls.length >= 2) return 'already_linked';
  if (urls.length < 2) return 'storage_single';
  return '';
}

(async function main() {
  console.log(DRY_RUN ? '=== DRY RUN ===' : '=== APPLY ===');
  console.log('Project filter:', PROJECT_FILTER || '(none)');
  console.log('Houzz filter:', HOUZZ_FILTER || '(none)');
  console.log('Limit:', LIMIT || '(none)');

  let houzzIds = [];
  if (HOUZZ_FILTER) {
    houzzIds = [HOUZZ_FILTER];
  } else if (PROJECT_FILTER) {
    const resolvedPid = await resolveProjectId(PROJECT_FILTER);
    if (!resolvedPid) {
      console.error('Could not resolve project:', PROJECT_FILTER);
      process.exit(1);
    }
    console.log('Resolved project id:', resolvedPid);
    houzzIds = [...await houzzIdsForProject(resolvedPid)];
    console.log('Houzz ids from project', PROJECT_FILTER + ':', houzzIds.length);
  } else {
    houzzIds = await loadGapUnderlinkedHouzzIds();
    console.log('Houzz ids from gap CSV (underlinked):', houzzIds.length);
  }

  if (LIMIT > 0) houzzIds = houzzIds.slice(0, LIMIT);

  const manifest = [];
  let wouldApply = 0;
  let applied = 0;

  for (const hid of houzzIds) {
    const urls = await listHouzzStorageUrls(hid);
    if (urls.length < 2) {
      manifest.push({ houzzId: hid, action: 'skip', reason: 'storage_lt_2', storageCount: urls.length });
      continue;
    }

    const rows = await queryProductsByHouzzId(hid);
    const canon = pickCanonicalProduct(rows);
    if (!canon) {
      manifest.push({ houzzId: hid, action: 'skip', reason: 'needs_catalog_row', storageCount: urls.length });
      continue;
    }

    const skip = shouldSkipDoc(canon.data, urls);
    if (skip) {
      manifest.push({
        houzzId: hid,
        action: 'skip',
        reason: skip,
        productId: canon.id,
        title: str(canon.data.title || canon.data.name).slice(0, 80),
        storageCount: urls.length,
        currentHouzzUrlCount: countHouzzUrlsInDoc(canon.data, hid),
        currentImagesCount: coerceImagesLen(canon.data),
        duplicateDocIds: rows.length > 1 ? rows.map((r) => r.id).join(';') : '',
      });
      continue;
    }

    const patch = buildPatch(canon.data, urls, hid);
    manifest.push({
      houzzId: hid,
      action: DRY_RUN ? 'would_apply' : 'applied',
      productId: canon.id,
      title: str(canon.data.title || canon.data.name).slice(0, 80),
      storageCount: urls.length,
      currentHouzzUrlCount: countHouzzUrlsInDoc(canon.data, hid),
      currentImagesCount: coerceImagesLen(canon.data),
      newImagesCount: urls.length,
      duplicateDocIds: rows.length > 1 ? rows.map((r) => r.id).join(';') : '',
      imageUrl: patch.imageUrl || '(unchanged)',
    });
    wouldApply++;

    if (!DRY_RUN) {
      await db.collection('products').doc(canon.id).set(patch, { merge: true });
      const libSnap = await db.collection('productLibrary').doc(canon.id).get();
      if (libSnap.exists) {
        await db.collection('productLibrary').doc(canon.id).set(patch, { merge: true });
      }
      applied++;
    }
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const manifestPath = path.join(OUT_DIR, 'APPLY_MANIFEST_BY_CLAUDE_' + ts + '.csv');
  const header = ['houzzId', 'action', 'reason', 'productId', 'title', 'storageCount', 'currentHouzzUrlCount', 'currentImagesCount', 'newImagesCount', 'duplicateDocIds', 'imageUrl'];
  const csvLines = [header.join(',')];
  manifest.forEach((m) => {
    csvLines.push(header.map((h) => {
      const v = m[h] == null ? '' : String(m[h]);
      return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
    }).join(','));
  });
  fs.writeFileSync(manifestPath, csvLines.join('\n'), 'utf8');

  console.log('\nProcessed:', houzzIds.length);
  console.log(DRY_RUN ? 'Would apply:' : 'Applied:', DRY_RUN ? wouldApply : applied);
  console.log('Manifest:', manifestPath);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
