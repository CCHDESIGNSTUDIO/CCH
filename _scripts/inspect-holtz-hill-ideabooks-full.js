#!/usr/bin/env node
/**
 * Read-only: locate Holtz Hill inspiration data across Firestore shapes.
 *
 * Run from repo (requires prod service account JSON next to other scripts):
 *   node _scripts/inspect-holtz-hill-ideabooks-full.js
 *
 * Looks for:
 *   - boards/holtz-hill/ideabooks/* (current Studio)
 *   - top-level ideabooks where projectId == holtz-hill (legacy)
 *   - ideabooks on any board with movedFrom* / name mentioning Holtz (heuristic)
 */
const path = require('path');
const admin = require('firebase-admin');
const SA = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');

const HOLTZ_ID = 'holtz-hill';

function summarizeIdeabookDoc(id, data) {
  const x = data || {};
  const imgs = Array.isArray(x.images) ? x.images.length : 0;
  const cols = x.columns;
  let colSummary = '';
  if (Array.isArray(cols)) colSummary = 'array len=' + cols.length;
  else if (cols && typeof cols === 'object') colSummary = 'object keys=' + Object.keys(cols).length;
  else colSummary = String(typeof cols);
  const secs = Array.isArray(x.sections) ? x.sections.length : null;
  return {
    id,
    name: x.name || x.title || '(unnamed)',
    images: imgs,
    columns: colSummary,
    sectionsArray: secs,
    hiddenInNav: !!x.hiddenInNav,
    type: x.type || x.boardType || '',
    order: x.order,
    movedFrom: x.movedFrom || x.movedFromProjectId || '',
    movedAt: x.movedAt || '',
    source: x.source || '',
    updatedAt: x.updatedAt || x.updated_at || '',
  };
}

(async () => {
  admin.initializeApp({ credential: admin.credential.cert(require(SA)) });
  const db = admin.firestore();

  console.log('=== boards/' + HOLTZ_ID + '/ideabooks (canonical) ===\n');
  const sub = await db.collection('boards').doc(HOLTZ_ID).collection('ideabooks').get();
  console.log('count:', sub.size);
  const rows = [];
  sub.forEach((d) => {
    rows.push(summarizeIdeabookDoc(d.id, d.data()));
  });
  rows.sort((a, b) => (b.images || 0) - (a.images || 0));
  rows.forEach((r) => {
    console.log(JSON.stringify(r, null, 2));
  });

  console.log('\n=== top-level collection ideabooks where projectId == ' + HOLTZ_ID + ' ===\n');
  try {
    const top = await db.collection('ideabooks').where('projectId', '==', HOLTZ_ID).get();
    console.log('count:', top.size);
    top.forEach((d) => {
      console.log(JSON.stringify(summarizeIdeabookDoc(d.id, d.data()), null, 2));
    });
  } catch (e) {
    console.warn('top-level ideabooks query failed:', e.message || e);
  }

  console.log('\n=== Heuristic: collectionGroup("ideabooks") with movedFrom* containing "holtz" (limit 50) ===\n');
  try {
    const cg = await db.collectionGroup('ideabooks').where('movedFromProjectId', '==', HOLTZ_ID).limit(50).get();
    console.log('movedFromProjectId==' + HOLTZ_ID + ' count:', cg.size);
    cg.forEach((d) => console.log(d.ref.path, JSON.stringify(summarizeIdeabookDoc(d.id, d.data()), null, 2)));
  } catch (e) {
    console.warn('collectionGroup movedFromProjectId:', e.message || e);
  }

  console.log('\n=== Tip: if sections were Niice "columns" inside ONE doc, open that doc in Console and inspect `columns` + `images`. ===');
  console.log('=== If old sections were separate docs that were deleted, use Firestore PITR / backup — not recoverable from git. ===\n');

  process.exit(0);
})();
