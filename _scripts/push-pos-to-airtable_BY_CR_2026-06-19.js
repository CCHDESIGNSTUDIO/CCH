'use strict';
/**
 * CCH Studio -> Airtable PO push (CLI wrapper).
 * Core logic: functions/lib/airtable-po-push.js
 *
 * Usage:
 *   set AIRTABLE_PAT=pat_xxx
 *   node _scripts/push-pos-to-airtable_BY_CR_2026-06-19.js --project=<boardId> [--env=staging|prod] [--po=<poId>] [--scope=po|project|firm] [--limit=N] [--dry-run]
 */

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const { pushPOsToAirtable } = require(path.join(__dirname, '..', 'functions', 'lib', 'airtable-po-push.js'));

function resolvePat() {
  if (process.env.AIRTABLE_PAT) return process.env.AIRTABLE_PAT.trim();
  const candidates = [
    path.join(process.cwd(), 'airtable-pat.env'),
    path.join(__dirname, '..', 'airtable-pat.env'),
  ];
  for (const f of candidates) {
    try {
      if (!fs.existsSync(f)) continue;
      const raw = fs.readFileSync(f, 'utf8').trim();
      const m = raw.match(/AIRTABLE_PAT\s*=\s*(.+)/);
      return (m ? m[1] : raw).trim().replace(/^["']|["']$/g, '');
    } catch (_e) {}
  }
  return '';
}

const ARGV = process.argv.slice(2);
const arg = (name) => {
  const hit = ARGV.find((a) => a === '--' + name || a.startsWith('--' + name + '='));
  if (!hit) return undefined;
  const eq = hit.indexOf('=');
  return eq < 0 ? true : hit.slice(eq + 1);
};

const PROJECT_ID = arg('project');
const ONLY_PO = arg('po');
const LIMIT = parseInt(arg('limit'), 10) || 0;
const DRY = !!arg('dry-run');
const ENV = String(arg('env') || 'staging').toLowerCase();
const SCOPE_ARG = String(arg('scope') || '').toLowerCase();
const PAT = resolvePat();

const FIRE_ENVS = {
  staging: { key: 'cch-studio-staging-firebase-adminsdk-fbsvc-b93c6f1cf4.json', bucket: 'cch-studio-staging.firebasestorage.app' },
  prod: { key: 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json', bucket: 'cch-design-boards.firebasestorage.app' },
};

const scope = SCOPE_ARG || (ONLY_PO ? 'po' : 'project');

if (scope !== 'firm' && !PROJECT_ID) {
  console.error('ERROR: --project=<boardId> is required unless --scope=firm.');
  process.exit(1);
}
if (!FIRE_ENVS[ENV]) {
  console.error('ERROR: --env must be "staging" or "prod" (got "' + ENV + '").');
  process.exit(1);
}
if (!DRY && !PAT) {
  console.error('ERROR: AIRTABLE_PAT required (env var or airtable-pat.env file), or use --dry-run.');
  process.exit(1);
}

const KEY = require(path.join(__dirname, '..', '_debug', 'service-account.json', FIRE_ENVS[ENV].key));
const app = admin.initializeApp({ credential: admin.credential.cert(KEY), storageBucket: FIRE_ENVS[ENV].bucket }, 'CCH_' + ENV.toUpperCase());
const db = app.firestore();

(async () => {
  console.log((DRY ? '[DRY RUN] ' : '') + 'Read env: ' + ENV.toUpperCase() + ' | scope: ' + scope +
    (PROJECT_ID ? ' | project "' + PROJECT_ID + '"' : '') +
    (ONLY_PO ? ' | po ' + ONLY_PO : ''));

  const result = await pushPOsToAirtable({
    db,
    storage: app.storage(),
    pat: PAT,
    scope: scope,
    projectId: PROJECT_ID,
    poId: ONLY_PO,
    dryRun: DRY,
  });

  console.log('\n' + (DRY ? '[DRY RUN] ' : '') + 'Done. POs: ' + result.pos +
    ' | lines: ' + result.lines +
    ' | images attached: ' + result.imagesAttached +
    ' | images skipped: ' + result.imagesSkipped);
  process.exit(0);
})().catch((e) => {
  console.error('FATAL', e.message || e);
  process.exit(1);
});
