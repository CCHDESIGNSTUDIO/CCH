#!/usr/bin/env node
/**
 * copy-important-boards-to-staging.js
 *
 * Copies selected production project boards → staging (Firestore + optional Storage).
 * Each board: parent doc + ALL subcollections (clips, invoices, purchaseOrders,
 * proposals, ideabooks, roomMeta, tasks, etc.).
 *
 * SAFETY:
 *   - Default is DRY-RUN (no writes).
 *   - --apply requires typing YES-STAGING (unless --yes for automation).
 *   - Staging project_id is validated from service account JSON before any write.
 *
 * Usage:
 *   node scripts/copy-important-boards-to-staging.js
 *   node scripts/copy-important-boards-to-staging.js --batch-size=5 --batch=1
 *   node scripts/copy-important-boards-to-staging.js --apply --copy-storage --batch=1
 *   node scripts/copy-important-boards-to-staging.js --boards=cloud-susan,cloud-parker
 *   node scripts/copy-important-boards-to-staging.js --list-boards
 *
 * After a real copy:
 *   node _scripts/scrub-staging.js --apply
 *
 * Keys: cch-deploy/_debug/service-account.json/*.json
 */

'use strict';

const fs = require('fs');
const path = require('path');
const readline = require('readline');
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

/**
 * Edit this list (20–30 boards). Run with --list-prod-boards to see all prod IDs.
 * Order: legacy cloud → Shimano cluster → other active residential (old + new mix).
 */
const IMPORTANT_BOARDS = [
  // —— Legacy cloud / Houzz-era (invoice dup + import testing) ——
  { id: 'cloud-susan', label: 'Cloud - Susan' },
  { id: 'cloud-parker', label: 'Cloud - Parker' },
  { id: 'cloud-rolling-hills', label: 'Cloud - Rolling Hills' },
  { id: 'cloud-huntington-beach', label: 'Cloud - Huntington Beach' },
  { id: 'cloud-mustang', label: 'Cloud - Mustang' },
  { id: '7225-bugletrail', label: '7225 Bugletrail' },
  // —— Shimano (Maverick, Westridge, Holtz Hill) ——
  { id: 'shimano-maverick-cir', label: 'Shimano - Maverick Cir' },
  { id: 'shimano-westridge-lane', label: 'Shimano - Westridge Lane' },
  { id: 'holtz-hill', label: 'Holtz Hill (Shimano)' },
  // —— Older active residential ——
  { id: 'katke-graceland-dr', label: 'Katke - Graceland Dr' },
  { id: 'polito-bvr', label: 'Polito BVR' },
  { id: 'beck-castle-rock-cir', label: 'Beck - Castle Rock Cir' },
  { id: 'greene-hixson', label: 'Greene - Hixson' },
  { id: 'hollister-ranch', label: 'Hollister Ranch' },
  { id: 'helix', label: 'Helix' },
  { id: 'bradbury-high-drive', label: 'Bradbury - High Drive' },
  { id: 'comrie-pelican-point', label: 'Comrie - Pelican Point' },
  { id: 'cannon-perdido', label: 'Cannon Perdido' },
  { id: 'borgatello-via-lara', label: 'Borgatello - Via Lara' },
  { id: 'narva-guest-house', label: 'Narva Guest House' },
  // —— Newer / recent active residential ——
  { id: 'kipp-lassetter-park-city', label: 'Kipp Lassetter - Park City' },
  { id: 'kipp-lassetter-paradise-valley', label: 'Kipp Lassetter - Paradise Valley' },
  { id: 'escalette-newport-ca', label: 'Escalette - Newport CA' },
  { id: 'finkel-santa-barbara', label: 'Finkel - Santa Barbara' },
  { id: 'james-david-custom-homes', label: 'James David Custom Homes' },
  { id: 'sargent-santa-monica', label: 'Sargent - Santa Monica' },
  { id: 'ashleigh-aitken', label: 'Ashleigh Aitken' },
  { id: 'williams-santa-clarita', label: 'Williams - Santa Clarita' },
];

const argv = process.argv.slice(2);
const APPLY = argv.includes('--apply');
const SKIP_CONFIRM = argv.includes('--yes');
const COPY_STORAGE = argv.includes('--copy-storage') || (APPLY && !argv.includes('--no-storage'));
const LIST_PROD_BOARDS = argv.includes('--list-prod-boards');
const BATCH_SIZE = parseInt((argv.find((a) => a.startsWith('--batch-size=')) || '--batch-size=5').split('=')[1], 10) || 5;
const BATCH_NUM = parseInt((argv.find((a) => a.startsWith('--batch=')) || '--batch=1').split('=')[1], 10) || 1;
const BOARDS_OVERRIDE = (() => {
  const a = argv.find((x) => x.startsWith('--boards='));
  if (!a) return null;
  return a.split('=')[1].split(',').map((s) => s.trim()).filter(Boolean);
})();

const prodKeyJson = require(PROD_KEY);
const stagingKeyJson = require(STAGING_KEY);

if (prodKeyJson.project_id !== PROD_PROJECT) {
  console.error('FATAL: prod key project_id', prodKeyJson.project_id);
  process.exit(2);
}
if (stagingKeyJson.project_id !== STAGING_PROJECT) {
  console.error('FATAL: staging key project_id', stagingKeyJson.project_id);
  process.exit(2);
}

const prodApp = admin.initializeApp({
  credential: admin.credential.cert(prodKeyJson),
  projectId: PROD_PROJECT,
}, 'prodCopyBoards');
const stagingApp = admin.initializeApp({
  credential: admin.credential.cert(stagingKeyJson),
  projectId: STAGING_PROJECT,
}, 'stagingCopyBoards');

const prodDb = prodApp.firestore();
const stagingDb = stagingApp.firestore();
const prodBucket = prodApp.storage().bucket(PROD_BUCKET);
const stagingBucket = stagingApp.storage().bucket(STAGING_BUCKET);

const globalStats = {
  boardsPlanned: 0,
  boardsCopied: 0,
  boardsMissingOnProd: 0,
  docsRead: 0,
  docsWritten: 0,
  docsWouldWrite: 0,
  firebaseUrlsFound: 0,
  storageCopied: 0,
  storageSkippedExists: 0,
  storageErrors: 0,
  urlRewrites: 0,
};

const urlToStagingUrl = new Map();
const storageErrors = [];

function parseFirebaseStorageUrl(url) {
  const s = String(url || '').trim();
  const m = s.match(/\/b\/([^/]+)\/o\/([^?]+)/i);
  if (!m) return null;
  let objectPath = m[2];
  try { objectPath = decodeURIComponent(objectPath.replace(/\+/g, ' ')); } catch (_e) { return null; }
  return { bucket: m[1], path: objectPath, url: s };
}

function stagingDownloadUrl(objectPath, token) {
  return `https://firebasestorage.googleapis.com/v0/b/${STAGING_BUCKET}/o/${encodeURIComponent(objectPath)}?alt=media&token=${token}`;
}

function collectFirebaseUrls(value, out, paths) {
  if (value == null) return;
  if (typeof value === 'string') {
    if (value.includes('firebasestorage.googleapis.com') || value.includes('.firebasestorage.app')) {
      const p = parseFirebaseStorageUrl(value);
      if (p && (p.bucket === PROD_BUCKET || p.bucket === PROD_PROJECT + '.appspot.com')) {
        out.add(p.url);
        paths.add(p.path);
      }
    }
    return;
  }
  if (Array.isArray(value)) { value.forEach((v) => collectFirebaseUrls(v, out, paths)); return; }
  if (typeof value === 'object' && typeof value.toDate !== 'function') {
    Object.keys(value).forEach((k) => collectFirebaseUrls(value[k], out, paths));
  }
}

function rewriteValue(value) {
  if (value == null) return value;
  if (typeof value === 'string') {
    let s = value;
    urlToStagingUrl.forEach((newUrl, oldUrl) => {
      if (s.includes(oldUrl)) {
        s = s.split(oldUrl).join(newUrl);
        globalStats.urlRewrites++;
      }
    });
    if (s.includes(PROD_BUCKET)) {
      s = s.replace(new RegExp(PROD_BUCKET.replace(/\./g, '\\.'), 'g'), STAGING_BUCKET);
      globalStats.urlRewrites++;
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
  const stagingFile = stagingBucket.file(objectPath);
  const [exists] = await stagingFile.exists();
  if (exists) {
    globalStats.storageSkippedExists++;
    const [meta] = await stagingFile.getMetadata().catch(() => [{ metadata: {} }]);
    const token = meta.metadata && meta.metadata.firebaseStorageDownloadTokens;
    if (token) return stagingDownloadUrl(objectPath, String(token).split(',')[0]);
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
    globalStats.storageCopied++;
    return stagingDownloadUrl(objectPath, token);
  } catch (e) {
    globalStats.storageErrors++;
    storageErrors.push({ path: objectPath, error: e.message });
    return null;
  }
}

async function ensureStorageMap(urlSet) {
  const byPath = new Map();
  urlSet.forEach((url) => {
    const p = parseFirebaseStorageUrl(url);
    if (p) byPath.set(p.path, url);
  });
  let n = 0;
  for (const [objectPath, oldUrl] of byPath.entries()) {
    n++;
    if (n % 25 === 0) console.log(`    storage: ${n}/${byPath.size}...`);
    if (!APPLY) {
      urlToStagingUrl.set(oldUrl, stagingDownloadUrl(objectPath, 'DRY_RUN'));
      continue;
    }
    const nu = await copyStorageObject(objectPath);
    if (nu) urlToStagingUrl.set(oldUrl, nu);
  }
}

function resolveBoardList() {
  const base = BOARDS_OVERRIDE
    ? BOARDS_OVERRIDE.map((id) => ({ id, label: id }))
    : IMPORTANT_BOARDS.slice();
  const start = (BATCH_NUM - 1) * BATCH_SIZE;
  const slice = base.slice(start, start + BATCH_SIZE);
  return { all: base, batch: slice, start, batchNum: BATCH_NUM, batchSize: BATCH_SIZE };
}

async function planBoard(boardId) {
  const ref = prodDb.collection('boards').doc(boardId);
  const snap = await ref.get();
  if (!snap.exists) return { exists: false };

  const urls = new Set();
  const paths = new Set();
  collectFirebaseUrls(snap.data(), urls, paths);

  const subs = await ref.listCollections();
  const subStats = [];
  let docCount = 1;

  for (const sub of subs) {
    const ss = await sub.get();
    subStats.push({ name: sub.id, count: ss.size });
    ss.forEach((d) => {
      docCount++;
      collectFirebaseUrls(d.data(), urls, paths);
    });
  }

  return { exists: true, name: snap.data().name || boardId, subStats, docCount, urls, paths };
}

async function copyBoard(boardId, label) {
  console.log(`\n── Board: ${boardId} (${label}) ──`);
  const ref = prodDb.collection('boards').doc(boardId);
  const snap = await ref.get();
  if (!snap.exists) {
    console.log('  SKIP — not found on production');
    globalStats.boardsMissingOnProd++;
    return;
  }

  const urls = new Set();
  const paths = new Set();
  collectFirebaseUrls(snap.data(), urls, paths);

  const subs = await ref.listCollections();
  const subNames = subs.map((s) => s.id).sort();
  console.log('  Subcollections:', subNames.join(', '));

  let docCount = 0;
  for (const subName of subNames) {
    const ss = await ref.collection(subName).get();
    docCount += ss.size;
    ss.forEach((d) => collectFirebaseUrls(d.data(), urls, paths));
  }

  globalStats.firebaseUrlsFound += urls.size;
  console.log(`  Docs (excl. parent): ${docCount}  |  Firebase URLs: ${urls.size}  |  Storage files: ${paths.size}`);

  if (COPY_STORAGE && paths.size > 0) {
    console.log('  Syncing storage...');
    await ensureStorageMap(urls);
  }

  const boardData = COPY_STORAGE && urlToStagingUrl.size ? rewriteValue(snap.data()) : snap.data();
  globalStats.docsWouldWrite++;
  if (APPLY) {
    await stagingDb.collection('boards').doc(boardId).set(boardData, { merge: true });
    globalStats.docsWritten++;
    console.log('  ✓ Wrote board doc');
  } else {
    console.log('  ○ Would write board doc');
  }

  for (const subName of subNames) {
    const ss = await ref.collection(subName).get();
    let written = 0;
    for (const docSnap of ss.docs) {
      globalStats.docsRead++;
      const data = docSnap.data() || {};
      const rewritten = COPY_STORAGE && urlToStagingUrl.size ? rewriteValue(data) : data;
      globalStats.docsWouldWrite++;
      if (APPLY) {
        await stagingDb.collection('boards').doc(boardId).collection(subName).doc(docSnap.id).set(rewritten, { merge: true });
        globalStats.docsWritten++;
        written++;
      }
    }
    console.log(`  ${subName}: ${ss.size} docs${APPLY ? `, ${written} written` : ' (would write)'}`);
  }
  globalStats.boardsCopied++;
}

async function confirmApply(boards) {
  if (!APPLY) return true;
  if (SKIP_CONFIRM) return true;

  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  WARNING: You are about to WRITE to STAGING Firestore      ║');
  console.log('║  Project:', STAGING_PROJECT.padEnd(47), '║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('\nBoards in this run (' + boards.length + '):');
  boards.forEach((b) => console.log('  •', b.id, '—', b.label));
  console.log('\nStorage copy:', COPY_STORAGE ? 'YES' : 'NO');
  console.log('\nType exactly:  YES-STAGING\n');

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise((resolve) => {
    rl.question('> ', (a) => { rl.close(); resolve(a.trim()); });
  });
  if (answer !== 'YES-STAGING') {
    console.log('\nAborted — confirmation did not match.');
    return false;
  }
  console.log('\nConfirmed. Starting copy...\n');
  return true;
}

async function listProdBoards() {
  const snap = await prodDb.collection('boards').get();
  const rows = [];
  snap.forEach((d) => rows.push({ id: d.id, name: (d.data().name || '').trim() }));
  rows.sort((a, b) => a.id.localeCompare(b.id));
  console.log('\nProduction boards (' + rows.length + '):\n');
  rows.forEach((r) => console.log(' ', r.id, '|', r.name));
  const important = new Set(IMPORTANT_BOARDS.map((b) => b.id));
  const missing = IMPORTANT_BOARDS.filter((b) => !rows.some((r) => r.id === b.id));
  if (missing.length) console.log('\nIMPORTANT_BOARDS not on prod:', missing.map((b) => b.id).join(', '));
  console.log('\nConfigured important boards:', IMPORTANT_BOARDS.length);
}

(async () => {
  console.log('\n=== copy-important-boards-to-staging =========================');
  console.log('Mode:        ', APPLY ? 'APPLY (writes)' : 'DRY-RUN (plan only)');
  console.log('Storage:     ', COPY_STORAGE ? (APPLY ? 'copy files' : 'plan file count') : 'skip');
  console.log('Batch:       ', BATCH_NUM, '| size', BATCH_SIZE);
  console.log('Source:      ', PROD_PROJECT);
  console.log('Target:      ', STAGING_PROJECT);
  console.log('==============================================================\n');

  if (LIST_PROD_BOARDS) {
    await listProdBoards();
    await Promise.all([prodApp.delete(), stagingApp.delete()]);
    return;
  }

  const { all, batch, start } = resolveBoardList();
  globalStats.boardsPlanned = batch.length;

  console.log('Important boards (configured):', all.length);
  console.log('This batch:', batch.length, 'boards (index', start + 1, '–', start + batch.length, 'of', all.length, ')');
  batch.forEach((b, i) => console.log(`  ${start + i + 1}. ${b.id} — ${b.label}`));

  if (!batch.length) {
    console.log('\nNo boards in this batch. Check --batch= and --batch-size=.');
    process.exit(1);
  }

  console.log('\n--- Planning (read prod) ---');
  for (const b of batch) {
    const plan = await planBoard(b.id);
    if (!plan.exists) {
      console.log(`\n${b.id}: NOT FOUND on prod`);
      globalStats.boardsMissingOnProd++;
      continue;
    }
    console.log(`\n${b.id} (${plan.name})`);
    console.log('  docs:', plan.docCount, '| storage paths:', plan.paths.size);
    plan.subStats.forEach((s) => {
      const mark = ['invoices', 'purchaseOrders', 'clips', 'proposals'].includes(s.name) ? '★' : ' ';
      console.log(`  ${mark} ${s.name}: ${s.count}`);
    });
  }

  const ok = await confirmApply(batch);
  if (!ok) {
    await Promise.all([prodApp.delete(), stagingApp.delete()]);
    process.exit(1);
  }

  if (APPLY) {
    console.log('\n--- Copying ---');
    for (const b of batch) {
      await copyBoard(b.id, b.label);
    }
  }

  console.log('\n=== summary ===================================================');
  console.log('boards in batch:       ', globalStats.boardsPlanned);
  console.log('boards copied/missing: ', globalStats.boardsCopied, '/', globalStats.boardsMissingOnProd, 'missing');
  console.log(APPLY ? 'docs written:          ' : 'docs would write:      ', APPLY ? globalStats.docsWritten : globalStats.docsWouldWrite);
  console.log('firebase URLs seen:    ', globalStats.firebaseUrlsFound);
  if (COPY_STORAGE) {
    console.log('storage uploaded:      ', globalStats.storageCopied);
    console.log('storage skipped:       ', globalStats.storageSkippedExists);
    console.log('storage errors:        ', globalStats.storageErrors);
  }
  console.log('url rewrites:          ', globalStats.urlRewrites);

  const manifestPath = path.join(__dirname, '..', '_debug',
    `copy-important-boards-b${BATCH_NUM}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(manifestPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    apply: APPLY,
    batchNum: BATCH_NUM,
    batchSize: BATCH_SIZE,
    boards: batch.map((b) => b.id),
    copyStorage: COPY_STORAGE,
    globalStats,
    storageErrors: storageErrors.slice(0, 40),
  }, null, 2));
  console.log('manifest:', manifestPath);

  if (!APPLY) {
    console.log('\nDRY RUN done. Next steps:');
    console.log('  1) Review plan above');
    console.log('  2) node scripts/copy-important-boards-to-staging.js --apply --copy-storage --batch=' + BATCH_NUM);
    console.log('  3) node _scripts/scrub-staging.js --apply');
    if (start + BATCH_SIZE < all.length) {
      console.log('  Next batch: --batch=' + (BATCH_NUM + 1));
    }
  } else if (start + BATCH_SIZE < all.length) {
    console.log('\nNext batch: node scripts/copy-important-boards-to-staging.js --apply --copy-storage --batch=' + (BATCH_NUM + 1));
  } else {
    console.log('\nAll batches complete. Run: node _scripts/scrub-staging.js --apply');
  }

  await Promise.all([prodApp.delete(), stagingApp.delete()]);
})().catch((err) => {
  console.error('FATAL:', err && err.stack || err);
  process.exit(1);
});
