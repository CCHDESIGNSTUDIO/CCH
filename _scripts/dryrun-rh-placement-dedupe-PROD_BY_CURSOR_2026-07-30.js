'use strict';
/**
 * RH placement cleanup — DRY-RUN ONLY (no Firestore writes).
 * Lists: duplicate item+room tiles, roomed product-library mismatches, orphan-blank junk.
 *
 * Usage:
 *   node _scripts/dryrun-rh-placement-dedupe-PROD_BY_CURSOR_2026-07-30.js
 *
 * Writes report JSON under Docs/. Cindy typed GO required before any apply script.
 */
const path = require('path');
const fs = require('fs');
const admin = require('firebase-admin');

const KEY = path.join(
  __dirname,
  '..',
  '_debug',
  'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json'
);
if (!fs.existsSync(KEY)) {
  console.error('Missing prod service account key at', KEY);
  process.exit(1);
}

const PID = 'cloud-rolling-hills';
const db = admin.initializeApp({ credential: admin.credential.cert(require(KEY)) }, 'rhPlacementDry').firestore();
const str = (v) => String(v == null ? '' : v).trim();

function productRoomKey(c) {
  const room = str(c.room).toLowerCase();
  if (!room) return '';
  const lib = str(c.libraryProductId || c.libraryId);
  if (lib) return 'lib:' + lib + '|' + room;
  const t = str(c.title).toLowerCase();
  const v = str(c.vendor).toLowerCase();
  if (!t) return '';
  return 'tv:' + t + '|' + v + '|' + room;
}

function isLikelyJunkBlank(c) {
  const title = str(c.title);
  if (!title) return true;
  if (title.length < 3) return true;
  if (/^[\d.\s"x×\-]+$/i.test(title)) return true;
  if (/^(weight|dims?|dimensions?)\b/i.test(title)) return true;
  return false;
}

(async function main() {
  const clipsSnap = await db.collection('boards').doc(PID).collection('clips').get();
  const clips = [];
  clipsSnap.forEach((d) => clips.push(Object.assign({ id: d.id }, d.data() || {})));

  const byKey = Object.create(null);
  const roomed = [];
  const blank = [];
  clips.forEach((c) => {
    const room = str(c.room);
    if (!room) {
      blank.push(c);
      return;
    }
    roomed.push(c);
    const k = productRoomKey(c);
    if (!k) return;
    if (!byKey[k]) byKey[k] = [];
    byKey[k].push(c);
  });

  const duplicateGroups = [];
  Object.keys(byKey).forEach((k) => {
    if (byKey[k].length > 1) {
      duplicateGroups.push({
        key: k,
        count: byKey[k].length,
        clips: byKey[k].map((c) => ({
          id: c.id,
          title: str(c.title),
          vendor: str(c.vendor),
          room: str(c.room),
          source: str(c.source),
          libraryProductId: str(c.libraryProductId || c.libraryId),
          manual: c._manualPlacement === true,
          createdFromDoc: !!c._createdFromDocAt,
          unassignedFrom: str(c._roomUnassignedFrom)
        }))
      });
    }
  });

  const orphanBlankJunk = blank
    .filter(isLikelyJunkBlank)
    .map((c) => ({
      id: c.id,
      title: str(c.title),
      vendor: str(c.vendor),
      source: str(c.source),
      category: str(c.category)
    }));

  // Product library rows with a room set (often Houzz leftover) — report only
  const productsSnap = await db.collection('products').where('projectId', '==', PID).limit(5000).get().catch(() => null);
  let roomedProducts = [];
  if (productsSnap) {
    productsSnap.forEach((d) => {
      const p = d.data() || {};
      if (str(p.room)) {
        roomedProducts.push({
          id: d.id,
          title: str(p.title),
          room: str(p.room),
          vendor: str(p.vendor)
        });
      }
    });
  } else {
    // Fallback: scan board-linked products field if used
    roomedProducts = [{ note: 'products.projectId query unavailable — skipped catalog room scan' }];
  }

  const report = {
    projectId: PID,
    generatedAt: new Date().toISOString(),
    dryRun: true,
    totals: {
      clips: clips.length,
      roomedClips: roomed.length,
      blankClips: blank.length,
      duplicateGroups: duplicateGroups.length,
      duplicateExtraTiles: duplicateGroups.reduce((s, g) => s + (g.count - 1), 0),
      orphanBlankJunk: orphanBlankJunk.length,
      roomedProductRecords: Array.isArray(roomedProducts) ? roomedProducts.length : 0
    },
    duplicateGroups: duplicateGroups.sort((a, b) => b.count - a.count),
    orphanBlankJunk: orphanBlankJunk.slice(0, 200),
    roomedProductRecordsSample: Array.isArray(roomedProducts) ? roomedProducts.slice(0, 200) : roomedProducts,
    nextSteps: [
      'Review this report with Cindy.',
      'Apply script (not written yet) only after typed GO — keep keeper tile per group (prefer manual / doc-linked / richest image).',
      'Do not turn on durable _cchDocLineClipEnsureApply until staging placement sync is verified.'
    ]
  };

  const outPath = path.join(
    __dirname,
    '..',
    'Docs',
    'RH_PLACEMENT_DEDUPE_DRYRUN_BY_CURSOR_2026-07-30.json'
  );
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report.totals, null, 2));
  console.log('Wrote', outPath);
  console.log('Duplicate groups:', report.totals.duplicateGroups, '· extra tiles:', report.totals.duplicateExtraTiles);
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
