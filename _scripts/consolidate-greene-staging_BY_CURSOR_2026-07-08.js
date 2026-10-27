#!/usr/bin/env node
'use strict';
/**
 * Greene / Greene-Hixson cleanup on staging.
 * - Audit orphan boards/greene vs greene-hixson
 * - Point time entries at canonical greene-hixson
 * - Archive orphan boards/greene (empty stub)
 *
 * Usage:
 *   node _scripts/consolidate-greene-staging_BY_CURSOR_2026-07-08.js           # dry-run
 *   node _scripts/consolidate-greene-staging_BY_CURSOR_2026-07-08.js --apply  # write
 */
const path = require('path');
const admin = require('firebase-admin');

const APPLY = process.argv.includes('--apply');
const PROJECT_ARG = (function() {
  var i = process.argv.indexOf('--project');
  return i >= 0 ? process.argv[i + 1] : 'cch-studio-staging';
})();
const KEY_BY_PROJECT = {
  'cch-studio-staging': 'cch-studio-staging-firebase-adminsdk-fbsvc-b93c6f1cf4.json',
  'cch-design-boards': 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json',
};
const keyFile = KEY_BY_PROJECT[PROJECT_ARG] || KEY_BY_PROJECT['cch-studio-staging'];
const STAGING_KEY = path.join(__dirname, '..', '_debug', 'service-account.json', keyFile);

const CANONICAL_BOARD_ID_PREFERRED = 'greene-hixson';
const CANONICAL_NAME_PREFERRED = 'Greene- Hixson';
const ORPHAN_BOARD_ID = 'greene';

function pickCanonicalBoard(boards) {
  const preferred = boards.find((b) => b.id === CANONICAL_BOARD_ID_PREFERRED);
  if (preferred) return preferred;
  const candidates = boards.filter((b) => {
    const n = norm(b.name);
    return n.includes('greene') && (n.includes('hixson') || n.includes('hixon'));
  });
  if (candidates.length === 1) return candidates[0];
  if (candidates.length > 1) {
    return candidates.sort((a, b) => String(b.name).length - String(a.name).length)[0];
  }
  return boards.find((b) => b.id === ORPHAN_BOARD_ID) || null;
}

function norm(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const GREENE_ALIASES = new Set([
  'greene',
  'greene hixson',
  'greene-hixson',
  'greene- hixson',
  'green hixon',
  'green-hixon',
  'greene hixon',
  'greene-hixon',
  'hixson',
  'hixon',
  'de anza',
  'deanza',
]);

function isGreeneAlias(project) {
  return GREENE_ALIASES.has(norm(project));
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(require(STAGING_KEY)),
    projectId: PROJECT_ARG,
  });
}
const db = admin.firestore();

(async () => {
  console.log('=== Greene cleanup', APPLY ? 'APPLY' : 'DRY-RUN', '===');
  console.log('Firebase project:', admin.app().options.projectId || '(unknown)');

  const boardsSnap = await db.collection('boards').get();
  const boards = [];
  boardsSnap.forEach((d) => {
    const x = d.data() || {};
    boards.push({ id: d.id, name: x.name || d.id, status: x.status || '', qbCustomerId: x.qbCustomerId || '' });
  });

  console.log('\n--- Greene-related boards ---');
  console.log('Total boards:', boards.length);
  boards
    .filter((b) => /greene|hixson|hixon/i.test(b.name) || b.id === ORPHAN_BOARD_ID || b.id === CANONICAL_BOARD_ID_PREFERRED)
    .forEach((b) => console.log(b.id, '|', b.name, '| status:', b.status, '| qb:', b.qbCustomerId));

  const canon = pickCanonicalBoard(boards);
  if (!canon) {
    console.error('FATAL: no Greene-Hixson board found on this project');
    process.exit(1);
  }
  const CANONICAL_BOARD_ID = canon.id;
  const CANONICAL_NAME = canon.name;
  console.log('\nCanonical board:', CANONICAL_BOARD_ID, '|', CANONICAL_NAME);

  const orphan = boards.find((b) => b.id === ORPHAN_BOARD_ID);
  if (orphan) {
    const invSnap = await db.collection('boards').doc(ORPHAN_BOARD_ID).collection('invoices').get();
    const clipSnap = await db.collection('boards').doc(ORPHAN_BOARD_ID).collection('clips').get();
    console.log('\n--- Orphan board', ORPHAN_BOARD_ID, '---');
    console.log('invoices:', invSnap.size, 'clips:', clipSnap.size);
  }

  const teSnap = await db.collection('timeEntries').get();
  const teUpdates = [];
  teSnap.forEach((d) => {
    const t = d.data() || {};
    const proj = String(t.project || '').trim();
    const pid = String(t.projectId || '').trim();
    const needs =
      pid === ORPHAN_BOARD_ID ||
      (isGreeneAlias(proj) && pid !== CANONICAL_BOARD_ID) ||
      (norm(proj) !== norm(CANONICAL_NAME) && isGreeneAlias(proj));
    if (!needs) return;
    if (pid === CANONICAL_BOARD_ID && norm(proj) === norm(CANONICAL_NAME)) return;
    teUpdates.push({
      id: d.id,
      fromProject: proj,
      fromProjectId: pid,
      toProject: CANONICAL_NAME,
      toProjectId: CANONICAL_BOARD_ID,
      date: t.date || '',
      member: t.member || '',
      invoiced: !!t.invoiced,
    });
  });

  console.log('\n--- Time entry updates planned:', teUpdates.length, '---');
  teUpdates.slice(0, 40).forEach((r) =>
    console.log(r.id, r.date, r.member, '|', r.fromProject, '/', r.fromProjectId, '→', CANONICAL_NAME)
  );
  if (teUpdates.length > 40) console.log('... and', teUpdates.length - 40, 'more');

  const archiveOrphan = orphan && orphan.status !== 'Archived';
  console.log('\n--- Archive orphan board', ORPHAN_BOARD_ID, ':', archiveOrphan ? 'YES' : 'skip (missing or already archived)');

  if (!APPLY) {
    console.log('\nDry-run complete. Re-run with --apply to write.');
    return;
  }

  let batch = db.batch();
  let n = 0;
  let committed = 0;
  for (const row of teUpdates) {
    batch.update(db.collection('timeEntries').doc(row.id), {
      project: row.toProject,
      projectId: row.toProjectId,
      updatedAt: new Date().toISOString(),
      _greeneConsolidatedAt: new Date().toISOString(),
    });
    n++;
    if (n >= 400) {
      await batch.commit();
      committed += n;
      batch = db.batch();
      n = 0;
    }
  }
  if (n) {
    await batch.commit();
    committed += n;
  }
  console.log('Updated time entries:', committed);

  if (archiveOrphan) {
    await db.collection('boards').doc(ORPHAN_BOARD_ID).update({
      status: 'Archived',
      archivedAt: new Date().toISOString(),
      archivedReason: 'Orphan Greene stub — consolidated to greene-hixson (Greene- Hixson)',
      updatedAt: new Date().toISOString(),
    });
    console.log('Archived orphan board', ORPHAN_BOARD_ID);
  }

  console.log('\nDone.');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
