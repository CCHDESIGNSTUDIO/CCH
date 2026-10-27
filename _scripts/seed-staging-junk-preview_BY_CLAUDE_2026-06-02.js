#!/usr/bin/env node
'use strict';
/** Copy prod junk samples into staging productLibrary_archive (preview only; prod unchanged). */
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const LIMIT = parseInt((process.argv.find((a) => a.startsWith('--limit=')) || '--limit=25').split('=')[1], 10) || 25;
const DRYRUN = path.join(__dirname, '..', '_backup', 'productlibrary-dryrun-prod-2026-06-01', 'dry-run-productlibrary-junk.json');
const PROD_KEY = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
const STAGING_KEY = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-studio-staging-firebase-adminsdk-fbsvc-b93c6f1cf4.json');

function initApp(name, keyPath) {
  const app = admin.initializeApp({ credential: admin.credential.cert(require(keyPath)) }, name);
  return app.firestore();
}

async function main() {
  const manifest = JSON.parse(fs.readFileSync(DRYRUN, 'utf8'));
  const ids = (manifest.junk || []).slice(0, LIMIT).map((r) => r.id).filter(Boolean);
  const prodDb = initApp('prod-copy', PROD_KEY);
  const stagingDb = initApp('staging-seed', STAGING_KEY);
  let copied = 0;
  for (const id of ids) {
    const snap = await prodDb.collection('productLibrary').doc(id).get();
    if (!snap.exists) continue;
    const data = Object.assign({}, snap.data(), {
      _archiveMeta: {
        previewSeed: true,
        seededAt: new Date().toISOString(),
        source: 'prod-productLibrary',
        script: 'seed-staging-junk-preview_BY_CLAUDE_2026-06-02.js'
      },
      archivedAt: admin.firestore.FieldValue.serverTimestamp(),
      reason: 'staging-preview-seed'
    });
    await stagingDb.collection('productLibrary_archive').doc(id).set(data, { merge: true });
    copied++;
    process.stdout.write('.');
  }
  console.log('\nCopied', copied, 'docs to staging productLibrary_archive');
  await Promise.all(admin.apps.map((a) => a.delete()));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
