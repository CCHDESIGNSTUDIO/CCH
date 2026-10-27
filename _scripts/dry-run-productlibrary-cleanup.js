#!/usr/bin/env node
'use strict';
/**
 * DRY RUN ONLY — Product Library junk scan (no Firestore writes).
 *
 * Junk rule (Grok baseline):
 *   no Houzz id AND (missing title OR missing vendor OR missing image)
 *
 * For quarantine + archive apply, use:
 *   _scripts/cleanup-productlibrary-duplicates_BY_CLAUDE_2026-06-01.js --apply --backup
 *
 * Usage (from cch-deploy/):
 *   node _scripts/dry-run-productlibrary-cleanup.js
 *   node _scripts/dry-run-productlibrary-cleanup.js --staging
 *   node _scripts/dry-run-productlibrary-cleanup.js --csv
 */
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const STAGING = process.argv.includes('--staging');
const WRITE_CSV = process.argv.includes('--csv');

const PROD_KEY = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
const STAGING_KEY = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-studio-staging-firebase-adminsdk-fbsvc-b93c6f1cf4.json');
const KEY_PATH = STAGING ? STAGING_KEY : PROD_KEY;

function str(v) {
  return String(v == null ? '' : v).trim();
}

function isJunk(data) {
  const hasHouzz = !!(str(data.houzzId || data.houzzProductId || data.houzz_id || data.catalogId));
  const hasTitle = str(data.title || data.name).length > 3;
  const hasVendor = !!(str(data.vendor || data.brand || data.manufacturer));
  const hasImage = !!(str(data.imageUrl || data.image) ||
    (Array.isArray(data.images) && data.images.length > 0));
  return !hasHouzz && (!hasTitle || !hasVendor || !hasImage);
}

async function dryRunCleanup() {
  if (!fs.existsSync(KEY_PATH)) {
    console.error('Missing service account:', KEY_PATH);
    process.exit(2);
  }
  const keyJson = require(KEY_PATH);
  admin.initializeApp({ credential: admin.credential.cert(keyJson) });

  const db = admin.firestore();
  const projectId = keyJson.project_id || '(unknown)';

  console.log('DRY RUN — Product Library Cleanup');
  console.log('Project:', projectId, STAGING ? '(staging)' : '(production)');
  console.log('This will NOT change any data.\n');

  const snapshot = await db.collection('productLibrary').get();
  let total = 0;
  let junkCount = 0;
  const junkRows = [];

  console.log('Scanning productLibrary…\n');

  for (const doc of snapshot.docs) {
    const data = doc.data() || {};
    total++;
    if (!isJunk(data)) continue;
    junkCount++;
    const row = {
      id: doc.id,
      title: str(data.title || data.name) || 'NO TITLE',
      vendor: str(data.vendor || data.brand || data.manufacturer) || 'None',
      project: str(data.project || data.projectId) || '',
      fieldCount: Object.keys(data).length
    };
    junkRows.push(row);
    if (junkCount <= 80) {
      console.log('JUNK →', row.id, '| Title:', JSON.stringify(row.title),
        '| Vendor:', row.vendor, '| Project:', row.project || '(none)');
    }
  }
  if (junkCount > 80) {
    console.log('… and', junkCount - 80, 'more (see report file)');
  }

  const backupDir = path.join(__dirname, '..', '_backup',
    'productlibrary-dryrun-' + (STAGING ? 'staging' : 'prod') + '-2026-06-01');
  fs.mkdirSync(backupDir, { recursive: true });
  const reportPath = path.join(backupDir, 'dry-run-productlibrary-junk.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    at: new Date().toISOString(),
    projectId,
    total,
    junkCount,
    archiveTarget: 'productLibrary_archive',
    junk: junkRows
  }, null, 2));

  if (WRITE_CSV) {
    const csvPath = path.join(backupDir, 'dry-run-productlibrary-junk_BY_CLAUDE_2026-06-01.csv');
    const lines = ['id,title,vendor,project,fieldCount'];
    junkRows.forEach((r) => {
      lines.push([
        r.id,
        '"' + String(r.title).replace(/"/g, '""') + '"',
        '"' + String(r.vendor).replace(/"/g, '""') + '"',
        '"' + String(r.project).replace(/"/g, '""') + '"',
        r.fieldCount
      ].join(','));
    });
    fs.writeFileSync(csvPath, lines.join('\n'));
    console.log('CSV:', csvPath);
  }

  console.log('\n=== DRY RUN SUMMARY ===');
  console.log('Total products scanned:', total);
  console.log('Junk / duplicates to move:', junkCount);
  console.log('Would be moved to: productLibrary_archive (+ products_archive via apply script)');
  console.log('Report:', reportPath);
  console.log('\nIf this looks good:');
  console.log('  node _scripts/cleanup-productlibrary-duplicates_BY_CLAUDE_2026-06-01.js --staging --apply --backup');
  console.log('  then production with --apply --backup after review');
}

dryRunCleanup().catch((e) => {
  console.error(e);
  process.exit(1);
});
