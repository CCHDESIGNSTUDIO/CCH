#!/usr/bin/env node
/**
 * snapshot-prod-to-staging.js
 *
 * Copies the Firestore contents of production (`cch-design-boards`) into
 * staging (`cch-studio-staging`) so staging behaves like a real mirror of
 * prod. Designed to be re-runnable: re-running will overwrite (PATCH) docs
 * that already exist on staging, so any drift gets re-aligned.
 *
 * After running this, ALWAYS run `scrub-staging.js --apply` to replace
 * real client PII with test values. Without the scrub, staging holds
 * unscrubbed client data and the staging URL becomes a privacy risk
 * the moment it leaks.
 *
 * Usage:
 *   node _scripts/snapshot-prod-to-staging.js                 # dry-run (default)
 *   node _scripts/snapshot-prod-to-staging.js --apply         # actually write
 *   node _scripts/snapshot-prod-to-staging.js --apply \
 *        --collections=clients,vendors                        # scope to those root collections
 *   node _scripts/snapshot-prod-to-staging.js --apply --max-depth=3
 *                                                             # limit subcollection recursion
 *
 * Auth:
 *   - PROD read: firebase-admin with the prod service account key.
 *   - STAGING write: firebase-admin with the staging service account key.
 *
 * Skipped by default (override with --include-system if you really need them):
 *   - Top-level collection `admin` (contains backfill manifests, not user data).
 *   - Documents whose ID begins with `_` (internal markers).
 *
 * Does NOT touch:
 *   - Firebase Auth users (a separate Admin SDK call would be needed).
 *   - Firebase Storage objects (image URLs are stored as strings; the
 *     URLs will still point at production storage until a parallel
 *     Storage sync is built).
 *   - Cloud Functions configs.
 *
 * Safety:
 *   - Refuses to run unless the staging admin SDK is initialized against
 *     `cch-studio-staging`. If a misconfigured key points at production,
 *     the script aborts before writing anything.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

// ---------------------------------------------------------------------------
// Config

const PROD_KEY = path.join(
  __dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json'
);

const STAGING_KEY = path.join(
  __dirname, '..', '_debug', 'service-account.json',
  'cch-studio-staging-firebase-adminsdk-fbsvc-b93c6f1cf4.json'
);

const PROD_PROJECT     = 'cch-design-boards';
const STAGING_PROJECT  = 'cch-studio-staging';

const argv = process.argv.slice(2);
const APPLY            = argv.includes('--apply');
const INCLUDE_SYSTEM   = argv.includes('--include-system');
const MAX_DEPTH        = parseInt(
  (argv.find(a => a.startsWith('--max-depth=')) || '--max-depth=10').split('=')[1], 10
);
const COLLECTION_FILTER = (() => {
  const arg = argv.find(a => a.startsWith('--collections='));
  if (!arg) return null;
  return arg.split('=')[1].split(',').map(s => s.trim()).filter(Boolean);
})();

// ---------------------------------------------------------------------------
// Init both admin SDKs as separate named apps so they don't collide

const prodApp = admin.initializeApp({
  credential: admin.credential.cert(require(PROD_KEY))
}, 'prodApp');

const stagingApp = admin.initializeApp({
  credential: admin.credential.cert(require(STAGING_KEY))
}, 'stagingApp');

const prodDb    = prodApp.firestore();
const stagingDb = stagingApp.firestore();

// ---------------------------------------------------------------------------
// Hard safety check: the staging key MUST point at the staging project.

if (stagingApp.options.projectId !== STAGING_PROJECT) {
  console.error('');
  console.error('FATAL: staging admin SDK is initialized against project');
  console.error('       "' + stagingApp.options.projectId + '"');
  console.error('       Expected: "' + STAGING_PROJECT + '"');
  console.error('       Aborting before any writes.');
  console.error('');
  process.exit(2);
}
if (prodApp.options.projectId !== PROD_PROJECT) {
  console.error('');
  console.error('FATAL: prod admin SDK is initialized against project');
  console.error('       "' + prodApp.options.projectId + '"');
  console.error('       Expected: "' + PROD_PROJECT + '"');
  console.error('       Aborting.');
  console.error('');
  process.exit(2);
}

// ---------------------------------------------------------------------------
// Counters

const stats = {
  collectionsScanned: 0,
  docsRead: 0,
  docsWritten: 0,
  docsSkipped: 0,
  errors: 0
};

const writeErrors = [];

// ---------------------------------------------------------------------------
// Helpers

function shouldSkipDocId(id) {
  if (!id) return true;
  if (!INCLUDE_SYSTEM && id.startsWith('_')) return true;
  return false;
}

function shouldSkipRootCollection(name) {
  if (COLLECTION_FILTER && !COLLECTION_FILTER.includes(name)) return true;
  if (!INCLUDE_SYSTEM && name === 'admin') return true;
  return false;
}

async function copyDoc(prodDocSnap, stagingDocRef, depth) {
  if (shouldSkipDocId(prodDocSnap.id)) {
    stats.docsSkipped++;
    return;
  }
  stats.docsRead++;
  const data = prodDocSnap.data() || {};
  if (APPLY) {
    try {
      await stagingDocRef.set(data, { merge: true });
      stats.docsWritten++;
    } catch (e) {
      stats.errors++;
      writeErrors.push({ path: stagingDocRef.path, error: e.message });
    }
  } else {
    stats.docsWritten++; // counted as "would-write" in dry-run
  }

  if (depth >= MAX_DEPTH) return;

  // Recurse into subcollections
  const subs = await prodDocSnap.ref.listCollections();
  for (const sub of subs) {
    await copyCollection(sub, stagingDocRef.collection(sub.id), depth + 1);
  }
}

async function copyCollection(prodColRef, stagingColRef, depth) {
  stats.collectionsScanned++;
  const snap = await prodColRef.get();
  for (const docSnap of snap.docs) {
    await copyDoc(docSnap, stagingColRef.doc(docSnap.id), depth);
  }
}

// ---------------------------------------------------------------------------
// Main

(async () => {
  console.log('');
  console.log('=== snapshot-prod-to-staging =================================');
  console.log('Mode:               ', APPLY ? 'APPLY (will write to staging)' : 'DRY-RUN (no writes)');
  console.log('Source (read):      ', PROD_PROJECT);
  console.log('Target (write):     ', STAGING_PROJECT);
  console.log('Max recursion depth:', MAX_DEPTH);
  console.log('Include system docs:', INCLUDE_SYSTEM);
  if (COLLECTION_FILTER) console.log('Collections filter: ', COLLECTION_FILTER.join(', '));
  console.log('==============================================================');
  console.log('');

  const rootCols = await prodDb.listCollections();

  for (const col of rootCols) {
    if (shouldSkipRootCollection(col.id)) {
      console.log('skip root collection:', col.id);
      continue;
    }
    console.log('copying root collection:', col.id);
    await copyCollection(col, stagingDb.collection(col.id), 1);
  }

  console.log('');
  console.log('=== summary =================================================');
  console.log('collections scanned:', stats.collectionsScanned);
  console.log('docs read from prod:', stats.docsRead);
  console.log(APPLY ? 'docs written to staging:' : 'docs that would be written:', stats.docsWritten);
  console.log('docs skipped:       ', stats.docsSkipped);
  console.log('errors:             ', stats.errors);
  if (writeErrors.length) {
    console.log('');
    console.log('--- first 10 errors ---');
    writeErrors.slice(0, 10).forEach(e => console.log(' ', e.path, '::', e.error));
  }
  console.log('==============================================================');

  // Write a manifest so future runs can diff
  const manifestDir = path.join(__dirname, '..', '_debug');
  if (!fs.existsSync(manifestDir)) fs.mkdirSync(manifestDir, { recursive: true });
  const manifestPath = path.join(
    manifestDir,
    'snapshot-prod-to-staging-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json'
  );
  fs.writeFileSync(manifestPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    apply: APPLY,
    includeSystem: INCLUDE_SYSTEM,
    maxDepth: MAX_DEPTH,
    collectionFilter: COLLECTION_FILTER,
    stats,
    errorsSample: writeErrors.slice(0, 50)
  }, null, 2));
  console.log('manifest:           ', manifestPath);
  console.log('');

  if (!APPLY) {
    console.log('This was a DRY RUN. To actually copy, re-run with --apply.');
  } else {
    console.log('NEXT STEP: run scrub-staging.js --apply to replace real');
    console.log('client PII with test values before sharing the staging URL.');
  }

  // Disposed
  await Promise.all([prodApp.delete(), stagingApp.delete()]);
})().catch(err => {
  console.error('FATAL:', err && err.stack || err);
  process.exit(1);
});
