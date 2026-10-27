'use strict';
/**
 * Firm-wide Product Library dedup — STAGING products/ only.
 *
 * Step 1 of merge order: identify duplicates by houzzId → SKU → title+vendor.
 *
 * QUARANTINE workflow (Junk Library review — Cynthia reviews in the UI):
 *   Duplicates move to products_archive → browse Product Library → 🗑️ Junk Library.
 *   Each row gets _archiveMeta.duplicateOf (proposed keeper id).
 *   Doc/clip libraryProductId links are LEFT INTACT until you approve a separate finalize pass.
 *   No keeper field merges during quarantine — compare keeper vs junk in the UI first.
 *
 * STAGING ONLY.
 *
 * Usage:
 *   node _scripts/dedup-products-firmwide-staging_BY_CLAUDE_2026-06-09.js
 *   node _scripts/dedup-products-firmwide-staging_BY_CLAUDE_2026-06-09.js --quarantine
 *   node _scripts/dedup-products-firmwide-staging_BY_CLAUDE_2026-06-09.js --quarantine --limit=100
 *
 * Never touches cloud-rolling-hills (Cynthia-fixed doc links). Skips the 7 formerly-linked dup ids.
 * Optional: --skip-linked skips any dup that still has libraryProductId refs anywhere.
 *
 * After Junk review, a separate finalize script (not yet run) will repoint doc links and merge
 * keeper fields — only when you explicitly request that step.
 */
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const QUARANTINE = process.argv.includes('--quarantine') || process.argv.includes('--apply');
const DRY = !QUARANTINE;
const SKIP_LINKED = process.argv.includes('--skip-linked');

/** Boards never scanned or modified (user-fixed — do not touch). */
const EXCLUDE_BOARDS = new Set(['cloud-rolling-hills']);

/** Dup ids from RH audit — user corrected links; never quarantine these. */
const SKIP_PRODUCT_IDS = new Set([
  'jmGM3Bxr3Rm0un4Wy2Ms', 'gDA8VpouKWcpn4eedUl0', 'YFjIJkyK9mQSKqnvomzq',
  'VYf6TtpBbOTjym5cDTvN', 'RyB9EuFW0GGcFxrtc0xb', '6MQ7JeFsfkeaM6GXDMTE',
  'glacier_hand_blown_pendant___elu',
]);
const LIMIT = (() => {
  const a = process.argv.find((x) => x.startsWith('--limit='));
  if (!a) return 0;
  const n = parseInt(a.split('=')[1], 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
})();

const STAGING_PROJECT = 'cch-studio-staging';
const STG_KEY = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-studio-staging-firebase-adminsdk-fbsvc-b93c6f1cf4.json');
const OUT_DIR = path.join(__dirname, '..', '_backup', 'products-firmwide-dedup-staging-2026-06-09');
const SCRIPT_TAG = 'dedup-products-firmwide-staging_BY_CLAUDE_2026-06-09.js';

const stgKey = require(STG_KEY);
if (stgKey.project_id !== STAGING_PROJECT) {
  console.error('FATAL: staging key project_id must be', STAGING_PROJECT);
  process.exit(2);
}

const db = admin.initializeApp({ credential: admin.credential.cert(stgKey) }, 'stgDedup').firestore();

const str = (v) => String(v == null ? '' : v).trim();
const hz = (o) => str(o && (o.houzzId || o.houzzProductId || o.catalogId));
const META = new Set([
  'updatedAt', 'createdAt', 'owner', '_id', 'addedAt',
  '_houzzGalleryLinkedAt', '_categoryFixedAt', '_enrichedFromHouzzApr27',
  '_archiveMeta', '_imageUrlPrevIvyCutover', '_imageUrlPrevApr27',
]);

function meaningfulFields(p) {
  let n = 0;
  Object.keys(p || {}).forEach((k) => {
    if (META.has(k)) return;
    const v = p[k];
    if (v == null || v === '' || (typeof v === 'string' && !v.trim()) || (Array.isArray(v) && !v.length)) return;
    n++;
  });
  return n;
}

function imgCount(o) {
  const s = new Set();
  const add = (u) => {
    u = str(typeof u === 'string' ? u : (u && (u.url || u.imageUrl || u.src)));
    if (u) s.add(u);
  };
  add(o.imageUrl);
  add(o.image);
  ['images', 'imageUrls', 'gallery', 'photos'].forEach((k) => {
    if (Array.isArray(o[k])) o[k].forEach(add);
  });
  return s.size;
}

function hasCost(p) {
  return parseFloat(p.costPrice || p.unitCost || p.cost) > 0;
}

function hasSell(p) {
  return parseFloat(p.sellPrice || p.price || p.clientPrice) > 0;
}

function descriptorTitle(t) {
  t = str(t).toLowerCase();
  if (/\broom\b/.test(t)) return true;
  if (/^(black forest|lack forest|ebony|vanilla bean)/.test(t)) return true;
  return false;
}

function score(p) {
  let s = meaningfulFields(p);
  if (str(p.sku)) s += 5;
  if (hz(p)) s += 5;
  if (!descriptorTitle(p.title || p.name)) s += 20;
  if (hasCost(p)) s += 10;
  if (hasSell(p)) s += 5;
  s += imgCount(p) * 2;
  return s;
}

function groupKey(p) {
  const h = hz(p);
  if (h) return 'houzz:' + h;
  const sk = str(p.sku);
  if (sk) return 'sku:' + sk.toLowerCase();
  return 'tv:' + str(p.title || p.name).toLowerCase() + '|' + str(p.vendor).toLowerCase();
}

function libIdsOnRow(row) {
  const ids = [];
  [row.libraryProductId, row.linkedLibraryProductId, row.libraryId, row._libDocId].forEach((v) => {
    const s = str(v);
    if (s) ids.push(s);
  });
  return ids;
}

(async () => {
  console.log('*** ' + (DRY ? 'DRY RUN (read-only)' : 'QUARANTINE — move duplicates to Junk Library') + ' ***');
  console.log('Review in Studio: Product Library → 🗑️ Junk Library\n');

  const snap = await db.collection('products').get();
  const docs = [];
  snap.forEach((d) => docs.push(Object.assign({ _id: d.id }, d.data() || {})));

  const groups = {};
  docs.forEach((p) => {
    (groups[groupKey(p)] = groups[groupKey(p)] || []).push(p);
  });

  const dupToCanon = new Map();
  const retireList = [];
  const groupReport = [];

  Object.entries(groups).forEach(([k, rows]) => {
    if (rows.length < 2) return;
    rows.sort((a, b) => score(b) - score(a) || String(a._id).localeCompare(String(b._id)));
    const keep = rows[0];
    rows.slice(1).forEach((r) => {
      dupToCanon.set(r._id, {
        canonicalId: keep._id,
        keeperTitle: str(keep.title || keep.name),
        dup: r,
        groupKey: k,
      });
      retireList.push(r);
    });
    groupReport.push({
      key: k,
      keep: { id: keep._id, title: str(keep.title || keep.name).slice(0, 50), score: score(keep), imgs: imgCount(keep) },
      retireCount: rows.length - 1,
    });
  });

  groupReport.sort((a, b) => b.retireCount - a.retireCount);

  const skippedExplicit = retireList.filter((r) => SKIP_PRODUCT_IDS.has(r._id));
  let eligible = retireList.filter((r) => !SKIP_PRODUCT_IDS.has(r._id));

  // Informational only — links are NOT changed during quarantine (per Junk Library UX).
  const pendingLinks = [];
  const linkedDupIds = new Set();
  const boardsSnap = await db.collection('boards').get();
  for (const boardDoc of boardsSnap.docs) {
    const boardId = boardDoc.id;
    if (EXCLUDE_BOARDS.has(boardId)) continue;
    const clipSnap = await db.collection('boards').doc(boardId).collection('clips').get();
    for (const d of clipSnap.docs) {
      libIdsOnRow(d.data() || {}).forEach((lid) => {
        if (!dupToCanon.has(lid) || SKIP_PRODUCT_IDS.has(lid)) return;
        linkedDupIds.add(lid);
        pendingLinks.push({
          boardId, type: 'clip', id: d.id, junkId: lid,
          proposedKeeper: dupToCanon.get(lid).canonicalId,
        });
      });
    }
    for (const col of ['invoices', 'proposals', 'purchaseOrders']) {
      const docSnap = await db.collection('boards').doc(boardId).collection(col).get();
      for (const d of docSnap.docs) {
        const items = Array.isArray((d.data() || {}).items) ? d.data().items : [];
        items.forEach((it, idx) => {
          libIdsOnRow(it).forEach((lid) => {
            if (!dupToCanon.has(lid) || SKIP_PRODUCT_IDS.has(lid)) return;
            linkedDupIds.add(lid);
            pendingLinks.push({
              boardId, type: col, doc: d.id, lineIndex: idx, junkId: lid,
              proposedKeeper: dupToCanon.get(lid).canonicalId,
            });
          });
        });
      }
    }
  }

  const skippedLinked = [];
  if (SKIP_LINKED) {
    eligible = eligible.filter((r) => {
      if (linkedDupIds.has(r._id)) {
        skippedLinked.push(r._id);
        return false;
      }
      return true;
    });
  }

  const toProcess = LIMIT ? eligible.slice(0, LIMIT) : eligible;

  const ts = new Date().toISOString();
  const backups = [];
  const quarantined = [];

  for (const r of toProcess) {
    const info = dupToCanon.get(r._id);
    const clean = Object.assign({}, r);
    delete clean._id;
    backups.push(clean);
    quarantined.push({
      id: r._id,
      title: str(r.title || r.name).slice(0, 50),
      houzzId: hz(r),
      duplicateOf: info.canonicalId,
      keeperTitle: info.keeperTitle,
      groupKey: info.groupKey,
    });

    if (!DRY) {
      const archivePayload = Object.assign({}, clean, {
        productLifecycle: 'junk',
        libraryItemKind: 'junk',
        _quarantineLocked: true,
        _quarantineLockedAt: ts,
        _archiveMeta: {
          reason: 'duplicate',
          duplicateOf: info.canonicalId,
          keeperTitle: info.keeperTitle,
          groupKey: info.groupKey,
          houzzId: hz(r),
          archivedAt: ts,
          archivedBy: SCRIPT_TAG,
          sourceCollection: 'products',
          junkLibrary: true,
        },
      });
      await db.collection('products_archive').doc(r._id).set(archivePayload, { merge: false });
      await db.collection('products').doc(r._id).delete();
    }
  }

  const byType = { houzz: 0, sku: 0, tv: 0 };
  retireList.forEach((r) => {
    const k = dupToCanon.get(r._id).groupKey;
    if (k.startsWith('houzz:')) byType.houzz++;
    else if (k.startsWith('sku:')) byType.sku++;
    else byType.tv++;
  });

  const summary = {
    dryRun: DRY,
    mode: DRY ? 'dry-run' : 'quarantine-to-junk',
    env: 'STAGING',
    project: STAGING_PROJECT,
    reviewInUi: 'Product Library → Junk Library (products_archive)',
    generatedAt: ts,
    exclusions: {
      boardsNeverTouched: [...EXCLUDE_BOARDS],
      skipProductIds: [...SKIP_PRODUCT_IDS],
      skippedExplicitCount: skippedExplicit.length,
      skippedLinkedCount: skippedLinked.length,
      skipLinkedFlag: SKIP_LINKED,
    },
    totals: {
      productsBefore: docs.length,
      uniqueGroups: Object.keys(groups).length,
      duplicateGroups: groupReport.length,
      duplicatesToQuarantine: retireList.length,
      eligibleAfterExclusions: eligible.length,
      processedThisRun: toProcess.length,
      uniqueAfterQuarantine: Object.keys(groups).length,
      pendingDocLinksNotChanged: pendingLinks.length,
      byGroupType: byType,
      rowsWithoutHouzzId: docs.filter((p) => !hz(p)).length,
    },
    topDuplicateGroups: groupReport.slice(0, 30),
    quarantined,
    pendingDocLinks: pendingLinks.slice(0, 200),
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const tag = DRY ? 'DRYRUN' : 'QUARANTINED';
  fs.writeFileSync(path.join(OUT_DIR, tag + '_firmwide_products_dedup.json'), JSON.stringify(summary, null, 2));
  if (!DRY) {
    fs.writeFileSync(path.join(OUT_DIR, 'BACKUP_quarantined_duplicates.json'), JSON.stringify(backups, null, 2));
  }

  console.log('products before:', docs.length);
  console.log('unique product groups:', Object.keys(groups).length);
  console.log('duplicate groups:', groupReport.length);
  console.log('duplicates total:', retireList.length, '| eligible (excl. RH-fixed 7):', eligible.length, LIMIT ? '| this run: ' + toProcess.length : '');
  console.log('excluded boards (never touched):', [...EXCLUDE_BOARDS].join(', '));
  console.log('skipped RH-fixed product ids:', skippedExplicit.length);
  if (SKIP_LINKED) console.log('skipped still-linked dups:', skippedLinked.length);
  console.log('  by type — houzzId:', byType.houzz, '| sku:', byType.sku, '| title+vendor:', byType.tv);
  console.log('doc/clip links outside excluded boards (left unchanged):', pendingLinks.length);
  console.log('\nReport:', path.join(OUT_DIR, tag + '_firmwide_products_dedup.json'));

  if (DRY) {
    console.log('\nRe-run with --quarantine to move duplicates into Junk Library for your review.');
    console.log('Optional: --limit=100 to quarantine in batches.');
  } else {
    console.log('\nQuarantined', quarantined.length, 'rows → products_archive.');
    console.log('Open staging → Product Library → 🗑️ Junk Library to review.');
    console.log('Use Restore on any row that should stay active. Doc links unchanged until finalize.');
  }
  process.exit(0);
})().catch((e) => {
  console.error('ERROR', e);
  process.exit(1);
});
