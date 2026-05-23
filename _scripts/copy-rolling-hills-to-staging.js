#!/usr/bin/env node
/**
 * copy-rolling-hills-to-staging.js
 *
 * Focused prod → staging copy for one project board (default: cloud-rolling-hills)
 * so staging invoice/image testing uses real line items + Firebase Storage files.
 *
 *   1. Firestore: board doc + all subcollections (or --subcollections=…)
 *   2. Storage: every prod Firebase download URL found in copied docs is
 *      downloaded from prod bucket and re-uploaded to staging bucket; URLs
 *      in written docs are rewritten to staging.
 *
 * Does NOT copy: full prod database, Auth, other boards, Ivy/Houzz URLs.
 *
 * Usage:
 *   node _scripts/copy-rolling-hills-to-staging.js
 *   node _scripts/copy-rolling-hills-to-staging.js --apply
 *   node _scripts/copy-rolling-hills-to-staging.js --apply --copy-storage
 *   node _scripts/copy-rolling-hills-to-staging.js --board=cloud-rolling-hills
 *   node _scripts/copy-rolling-hills-to-staging.js --invoice-match=12902
 *
 * After --apply, run: node _scripts/scrub-staging.js --apply
 *
 * Auth: service account JSON in _debug/service-account.json/ (prod + staging).
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const admin = require('firebase-admin');

const PROD_KEY = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
const STAGING_KEY = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-studio-staging-firebase-adminsdk-fbsvc-b93c6f1cf4.json');

const PROD_PROJECT = 'cch-design-boards';
const STAGING_PROJECT = 'cch-studio-staging';
const PROD_BUCKET = 'cch-design-boards.firebasestorage.app';
const STAGING_BUCKET = 'cch-studio-staging.firebasestorage.app';
const DEFAULT_BOARD = 'cloud-rolling-hills';

const argv = process.argv.slice(2);
const APPLY = argv.includes('--apply');
const COPY_STORAGE = argv.includes('--copy-storage') || (APPLY && !argv.includes('--no-storage'));
const BOARD_ID = (argv.find((a) => a.startsWith('--board=')) || `--board=${DEFAULT_BOARD}`).split('=')[1];
const INVOICE_MATCH = (() => {
  const a = argv.find((x) => x.startsWith('--invoice-match='));
  return a ? a.split('=')[1].trim() : '';
})();
const SUBCOL_FILTER = (() => {
  const a = argv.find((x) => x.startsWith('--subcollections='));
  return a ? a.split('=')[1].split(',').map((s) => s.trim()).filter(Boolean) : null;
})();

const prodKeyJson = require(PROD_KEY);
const stagingKeyJson = require(STAGING_KEY);

if (prodKeyJson.project_id !== PROD_PROJECT) {
  console.error('FATAL: prod key project_id', prodKeyJson.project_id, 'expected', PROD_PROJECT);
  process.exit(2);
}
if (stagingKeyJson.project_id !== STAGING_PROJECT) {
  console.error('FATAL: staging key project_id', stagingKeyJson.project_id, 'expected', STAGING_PROJECT);
  process.exit(2);
}

const prodApp = admin.initializeApp({
  credential: admin.credential.cert(prodKeyJson),
  projectId: PROD_PROJECT,
}, 'prodCopyRh');
const stagingApp = admin.initializeApp({
  credential: admin.credential.cert(stagingKeyJson),
  projectId: STAGING_PROJECT,
}, 'stagingCopyRh');

const prodDb = prodApp.firestore();
const stagingDb = stagingApp.firestore();
const prodBucket = prodApp.storage().bucket(PROD_BUCKET);
const stagingBucket = stagingApp.storage().bucket(STAGING_BUCKET);

const stats = {
  subcollections: [],
  docsRead: 0,
  docsWouldWrite: 0,
  docsWritten: 0,
  docsSkippedInvoiceFilter: 0,
  firebaseUrlsFound: 0,
  storagePathsUnique: 0,
  storageCopied: 0,
  storageSkippedExists: 0,
  storageErrors: 0,
  urlRewrites: 0,
};

const storagePathSeen = new Set();
const urlToStagingUrl = new Map();
const storageErrors = [];

function parseFirebaseStorageUrl(url) {
  const s = String(url || '').trim();
  if (!s) return null;
  const m = s.match(/\/b\/([^/]+)\/o\/([^?]+)/i);
  if (!m) return null;
  const bucket = m[1];
  let objectPath = m[2];
  try {
    objectPath = decodeURIComponent(objectPath.replace(/\+/g, ' '));
  } catch (_e) {
    return null;
  }
  return { bucket, path: objectPath, url: s };
}

function stagingDownloadUrl(objectPath, token) {
  const enc = encodeURIComponent(objectPath).replace(/%2F/g, '%2F');
  return `https://firebasestorage.googleapis.com/v0/b/${STAGING_BUCKET}/o/${enc}?alt=media&token=${token}`;
}

function collectFirebaseUrls(value, out) {
  if (value == null) return;
  if (typeof value === 'string') {
    if (value.includes('firebasestorage.googleapis.com') || value.includes('.firebasestorage.app')) {
      const p = parseFirebaseStorageUrl(value);
      if (p && (p.bucket === PROD_BUCKET || p.bucket === PROD_PROJECT + '.appspot.com')) {
        out.add(p.url);
        storagePathSeen.add(p.path);
      }
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((v) => collectFirebaseUrls(v, out));
    return;
  }
  if (typeof value === 'object' && typeof value.toDate !== 'function') {
    Object.keys(value).forEach((k) => collectFirebaseUrls(value[k], out));
  }
}

function rewriteValue(value) {
  if (value == null) return value;
  if (typeof value === 'string') {
    let s = value;
    urlToStagingUrl.forEach((newUrl, oldUrl) => {
      if (s.includes(oldUrl)) {
        s = s.split(oldUrl).join(newUrl);
        stats.urlRewrites++;
      }
    });
    if (s.includes(PROD_BUCKET)) {
      s = s.replace(new RegExp(PROD_BUCKET.replace(/\./g, '\\.'), 'g'), STAGING_BUCKET);
      stats.urlRewrites++;
    }
    return s;
  }
  if (Array.isArray(value)) return value.map(rewriteValue);
  if (typeof value === 'object' && typeof value.toDate !== 'function') {
    const o = {};
    Object.keys(value).forEach((k) => { o[k] = rewriteValue(value[k]); });
    return o;
  }
  return value;
}

async function copyStorageObject(objectPath) {
  if (!COPY_STORAGE) return null;
  if (!APPLY) return '(dry-run)';

  const stagingFile = stagingBucket.file(objectPath);
  const [exists] = await stagingFile.exists();
  if (exists) {
    stats.storageSkippedExists++;
    try {
      const [meta] = await stagingFile.getMetadata();
      const token = meta.metadata && meta.metadata.firebaseStorageDownloadTokens;
      if (token) {
        const tok = String(token).split(',')[0];
        return stagingDownloadUrl(objectPath, tok);
      }
    } catch (_e) { /* fall through to re-upload */ }
  }

  try {
    const [buf] = await prodBucket.file(objectPath).download();
    const token = randomUUID();
    await stagingFile.save(buf, {
      metadata: {
        contentType: 'image/jpeg',
        metadata: { firebaseStorageDownloadTokens: token, copiedFrom: 'prod:' + objectPath },
      },
    });
    stats.storageCopied++;
    return stagingDownloadUrl(objectPath, token);
  } catch (e) {
    stats.storageErrors++;
    storageErrors.push({ path: objectPath, error: e.message });
    return null;
  }
}

async function buildStorageUrlMap(firebaseUrls) {
  const byPath = new Map();
  firebaseUrls.forEach((url) => {
    const p = parseFirebaseStorageUrl(url);
    if (p) byPath.set(p.path, url);
  });

  stats.storagePathsUnique = byPath.size;
  console.log('\nStorage objects to sync:', byPath.size);

  for (const [objectPath, oldUrl] of byPath.entries()) {
    const newUrl = await copyStorageObject(objectPath);
    if (newUrl && newUrl !== '(dry-run)') urlToStagingUrl.set(oldUrl, newUrl);
    else if (!APPLY) urlToStagingUrl.set(oldUrl, `https://firebasestorage.googleapis.com/v0/b/${STAGING_BUCKET}/o/${encodeURIComponent(objectPath)}?alt=media&token=DRY_RUN`);
  }
}

function invoiceMatchesFilter(data) {
  if (!INVOICE_MATCH) return true;
  const n = String(data.invoiceNum || data.number || data.id || '').toUpperCase();
  return n.includes(INVOICE_MATCH.toUpperCase());
}

async function copySubcollection(subName) {
  const prodCol = prodDb.collection('boards').doc(BOARD_ID).collection(subName);
  const stagingCol = stagingDb.collection('boards').doc(BOARD_ID).collection(subName);
  const snap = await prodCol.get();
  let written = 0;
  let skipped = 0;

  for (const docSnap of snap.docs) {
    stats.docsRead++;
    const data = docSnap.data() || {};
    if (subName === 'invoices' && !invoiceMatchesFilter(data)) {
      stats.docsSkippedInvoiceFilter++;
      skipped++;
      continue;
    }
    const rewritten = COPY_STORAGE && urlToStagingUrl.size ? rewriteValue(data) : data;
    stats.docsWouldWrite++;
    if (APPLY) {
      await stagingCol.doc(docSnap.id).set(rewritten, { merge: true });
      stats.docsWritten++;
      written++;
    }
  }
  return { subName, total: snap.size, written, skipped };
}

(async () => {
  console.log('\n=== copy-rolling-hills-to-staging ============================');
  console.log('Mode:          ', APPLY ? 'APPLY' : 'DRY-RUN');
  console.log('Board:         ', BOARD_ID);
  console.log('Copy storage:  ', COPY_STORAGE ? (APPLY ? 'yes (upload)' : 'yes (plan only)') : 'no');
  console.log('Invoice filter:', INVOICE_MATCH || '(all invoices on board)');
  console.log('Prod → Staging: ', PROD_PROJECT, '→', STAGING_PROJECT);
  console.log('============================================================\n');

  const boardRef = prodDb.collection('boards').doc(BOARD_ID);
  const boardSnap = await boardRef.get();
  if (!boardSnap.exists) {
    console.error('Board not found on prod:', BOARD_ID);
    process.exit(1);
  }

  const allUrls = new Set();
  collectFirebaseUrls(boardSnap.data(), allUrls);

  const subs = await boardRef.listCollections();
  const subNames = subs.map((s) => s.id).filter((id) => !SUBCOL_FILTER || SUBCOL_FILTER.includes(id));
  console.log('Subcollections:', subNames.join(', '));

  const pendingDocs = [];
  for (const subName of subNames) {
    const snap = await boardRef.collection(subName).get();
    snap.forEach((d) => {
      if (subName === 'invoices' && !invoiceMatchesFilter(d.data())) return;
      pendingDocs.push({ subName, id: d.id, data: d.data() });
      collectFirebaseUrls(d.data(), allUrls);
    });
  }

  stats.firebaseUrlsFound = allUrls.size;
  console.log('Docs to copy:  ', pendingDocs.length + 1, '(+ board doc)');
  console.log('Firebase URLs: ', allUrls.size);
  console.log('Storage paths: ', storagePathSeen.size);

  if (COPY_STORAGE && storagePathSeen.size > 0) {
    await buildStorageUrlMap(allUrls);
  }

  const boardData = COPY_STORAGE && urlToStagingUrl.size
    ? rewriteValue(boardSnap.data())
    : boardSnap.data();

  stats.docsWouldWrite++;
  if (APPLY) {
    await stagingDb.collection('boards').doc(BOARD_ID).set(boardData, { merge: true });
    stats.docsWritten++;
    console.log('\nWrote board doc:', BOARD_ID);
  } else {
    console.log('\nWould write board doc:', BOARD_ID);
  }

  for (const subName of subNames) {
    const r = await copySubcollection(subName);
    stats.subcollections.push(r);
    console.log(
      `  ${r.subName}: ${r.total} prod docs, ${APPLY ? r.written + ' written' : r.total - r.skipped + ' would write'}, ${r.skipped} skipped (invoice filter)`
    );
  }

  console.log('\n=== summary =================================================');
  console.log('firebase URLs in docs: ', stats.firebaseUrlsFound);
  console.log('unique storage paths:  ', stats.storagePathsUnique);
  if (COPY_STORAGE) {
    console.log(APPLY ? 'storage uploaded:      ' : 'storage would upload:  ', stats.storageCopied || stats.storagePathsUnique);
    console.log('storage skipped (exist):', stats.storageSkippedExists);
    console.log('storage errors:        ', stats.storageErrors);
  }
  console.log(APPLY ? 'docs written:          ' : 'docs would write:      ', APPLY ? stats.docsWritten : stats.docsWouldWrite);
  console.log('invoice filter skipped:', stats.docsSkippedInvoiceFilter);
  console.log('url string rewrites:   ', stats.urlRewrites);
  if (storageErrors.length) {
    console.log('\nFirst storage errors:');
    storageErrors.slice(0, 8).forEach((e) => console.log(' ', e.path, '::', e.error));
  }

  const manifestPath = path.join(__dirname, '..', '_debug',
    `copy-rh-staging-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(manifestPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    apply: APPLY,
    boardId: BOARD_ID,
    invoiceMatch: INVOICE_MATCH,
    copyStorage: COPY_STORAGE,
    stats,
    storageErrors: storageErrors.slice(0, 30),
  }, null, 2));
  console.log('manifest:', manifestPath);

  if (!APPLY) {
    console.log('\nDRY RUN complete. To copy for real:');
    console.log('  node _scripts/copy-rolling-hills-to-staging.js --apply --copy-storage');
    console.log('Then scrub PII:');
    console.log('  node _scripts/scrub-staging.js --apply');
  } else {
    console.log('\nDone. NEXT: node _scripts/scrub-staging.js --apply');
    console.log('Then hard-refresh https://cch-platform-staging.web.app and open IN-12902.');
  }

  await Promise.all([prodApp.delete(), stagingApp.delete()]);
})().catch((err) => {
  console.error('FATAL:', err && err.stack || err);
  process.exit(1);
});
