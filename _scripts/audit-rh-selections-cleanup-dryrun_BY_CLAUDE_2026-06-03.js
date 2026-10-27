#!/usr/bin/env node
'use strict';
/**
 * Rolling Hills — Selections + room-board category/image dry-run.
 * Does NOT write. Output: JSON + CSV in _backup/rh-selections-cleanup-dryrun-2026-06-03/
 *
 *   node _scripts/audit-rh-selections-cleanup-dryrun_BY_CLAUDE_2026-06-03.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const admin = require('firebase-admin');

const PID = 'cloud-rolling-hills';
const PROJ = 'Cloud - Rolling Hills';
const TAXONOMY_V = '2026-05-27';
const OUT_DIR = path.join(__dirname, '..', '_backup', 'rh-selections-cleanup-dryrun-2026-06-03');

const KEY = path.join(
  __dirname,
  '..',
  '_debug',
  'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json'
);

const catJs = fs.readFileSync(
  path.join(__dirname, '..', 'platform', 'cch-product-categories.js'),
  'utf8'
);
const catCtx = { window: {}, console };
vm.runInNewContext(catJs, catCtx);
const G = catCtx.window;

function heroUrl(x) {
  if (!x) return '';
  if (Array.isArray(x.images) && x.images.length) {
    for (const im of x.images) {
      const u = typeof im === 'string' ? im : (im && (im.url || im.imageUrl || im.src)) || '';
      if (String(u).trim()) return String(u).trim();
    }
  }
  return String(x.imageUrl || x.image || x.img || x.thumbnail || '').trim();
}

function hasImage(x) {
  const u = heroUrl(x);
  if (!u) return false;
  if (/^data:image\/svg/i.test(u)) return false;
  return true;
}

function titleImpliesLighting(title) {
  const t = String(title || '').toLowerCase();
  return /\b(chandelier|sconce|pendant|flush|semi[\s-]*flush|fan|lamp|light|shade|lantern|luminaire|fixture|sconces)\b/i.test(t);
}

function proposeCategory(cur, title, roomSet) {
  const raw = String(cur || '').trim();
  const titleHint = String(title || '').trim();
  let issue = '';
  let proposed = raw;

  if (!raw) {
    issue = 'empty_category';
    proposed = titleImpliesLighting(titleHint) ? 'Lighting' : '';
    return { issue, proposed, wouldFix: !!proposed };
  }

  if (raw === 'General' || raw === 'Uncategorized') {
    issue = 'legacy_general';
    proposed = titleImpliesLighting(titleHint) ? 'Lighting' : 'Accessories';
    return { issue, proposed, wouldFix: proposed !== raw };
  }

  if (G.cchCategoryIsInvalidStoredValue(raw)) {
    issue = 'concat_or_jammed';
    proposed = G.cchResolveSingleProductCategory(raw, titleHint);
    if (!proposed && titleImpliesLighting(titleHint)) proposed = 'Lighting';
    return { issue, proposed, wouldFix: proposed && proposed !== raw };
  }

  if (roomSet.has(raw.toLowerCase()) || G.cchStringLooksLikePhysicalRoom(raw)) {
    issue = 'room_as_category';
    proposed = titleImpliesLighting(titleHint) ? 'Lighting' : G.cchNormalizeProductCategory('', titleHint) || 'Accessories';
    return { issue, proposed, wouldFix: proposed !== raw };
  }

  if (titleImpliesLighting(titleHint) && /bedding|pillow/i.test(raw)) {
    issue = 'lighting_in_bedding';
    proposed = 'Lighting';
    return { issue, proposed, wouldFix: true };
  }

  const norm = G.cchNormalizeProductCategory(raw, titleHint);
  if (norm && norm !== raw && !G.cchCategoryIsProtected(raw)) {
    issue = 'remap_legacy';
    proposed = norm;
    return { issue, proposed, wouldFix: true };
  }

  return { issue: '', proposed: raw, wouldFix: false };
}

function escCsv(v) {
  const s = String(v == null ? '' : v).replace(/"/g, '""');
  return /[",\n\r]/.test(s) ? `"${s}"` : s;
}

function auditDoc(kind, docId, data, roomSet, fixes, samples, categoryCounts) {
  const title = String(data.title || '').trim();
  const cat = String(data.category || '').trim();
  const room = String(data.room || data.roomLocation || '').trim();
  if (cat) categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;

  const p = proposeCategory(cat, title, roomSet);
  if (p.wouldFix) {
    fixes.category.push({
      kind,
      docId,
      title: title.slice(0, 80),
      room,
      categoryBefore: cat,
      categoryAfter: p.proposed,
      issue: p.issue,
      source: String(data.source || '').trim(),
      protected: G.cchCategoryIsProtected(cat),
    });
    if (samples[p.issue] && samples[p.issue].length < 5) {
      samples[p.issue].push({ kind, docId, title, cat, proposed: p.proposed });
    }
  }

  if (!hasImage(data) && title && !/^(weight|total wattage|top to)/i.test(title)) {
    fixes.noImage.push({
      kind,
      docId,
      title: title.slice(0, 80),
      room,
      category: cat,
      source: String(data.source || '').trim(),
      houzzId: String(data.houzzId || '').trim(),
      libraryProductId: String(data.libraryProductId || data.linkedLibraryProductId || '').trim(),
    });
  }
}

async function main() {
  if (!fs.existsSync(KEY)) {
    console.error('Missing service account:', KEY);
    process.exit(1);
  }
  admin.initializeApp({ credential: admin.credential.cert(require(KEY)) });
  const db = admin.firestore();
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const boardSnap = await db.collection('boards').doc(PID).get();
  const board = boardSnap.data() || {};
  const roomSet = new Set();
  const rooms = board.rooms || board.roomList || [];
  if (Array.isArray(rooms)) {
    rooms.forEach((r) => {
      const n = typeof r === 'string' ? r : (r && (r.name || r.room)) || '';
      if (n) roomSet.add(String(n).trim().toLowerCase());
    });
  }
  const clipSnap = await db.collection('boards').doc(PID).collection('clips').get();
  clipSnap.forEach((d) => {
    const rm = String((d.data() || {}).room || '').trim();
    if (rm) roomSet.add(rm.toLowerCase());
  });

  const fixes = { category: [], noImage: [] };
  const samples = {
    concat_or_jammed: [],
    room_as_category: [],
    lighting_in_bedding: [],
    legacy_general: [],
    remap_legacy: [],
  };
  const categoryCounts = {};
  const issueCounts = {};

  clipSnap.forEach((d) => auditDoc('clip', d.id, d.data() || {}, roomSet, fixes, samples, categoryCounts));

  const prodSnap = await db.collection('products').where('projectId', '==', PID).get();
  prodSnap.forEach((d) => auditDoc('products', d.id, d.data() || {}, roomSet, fixes, samples, categoryCounts));

  try {
    const plSnap = await db.collection('productLibrary').where('projectId', '==', PID).get();
    plSnap.forEach((d) => auditDoc('productLibrary', d.id, d.data() || {}, roomSet, fixes, samples, categoryCounts));
  } catch (e) {
    const plSnap2 = await db.collection('productLibrary').where('project', '==', PROJ).get();
    plSnap2.forEach((d) => auditDoc('productLibrary', d.id, d.data() || {}, roomSet, fixes, samples, categoryCounts));
  }

  fixes.category.forEach((r) => {
    issueCounts[r.issue] = (issueCounts[r.issue] || 0) + 1;
  });

  const fixable = fixes.category.filter((r) => !r.protected);
  const protectedBlocked = fixes.category.filter((r) => r.protected);

  const distinctBadCats = {};
  fixes.category.forEach((r) => {
    distinctBadCats[r.categoryBefore] = (distinctBadCats[r.categoryBefore] || 0) + 1;
  });

  const report = {
    at: new Date().toISOString(),
    projectId: PID,
    mode: 'dry-run',
    totals: {
      clips: clipSnap.size,
      products: prodSnap.size,
      categoryFixProposed: fixes.category.length,
      categoryFixWouldApply: fixable.length,
      categoryFixBlockedProtected: protectedBlocked.length,
      noImageRows: fixes.noImage.length,
      projectRoomsKnown: roomSet.size,
    },
    issueCounts,
    topBadCategories: Object.entries(distinctBadCats)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 25)
      .map(([cat, n]) => ({ category: cat, count: n })),
    allCategoryValues: Object.entries(categoryCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 40)
      .map(([cat, n]) => ({ category: cat, count: n })),
    samples,
  };

  fs.writeFileSync(path.join(OUT_DIR, 'dryrun-report.json'), JSON.stringify(report, null, 2));
  fs.writeFileSync(
    path.join(OUT_DIR, 'category-fixes.csv'),
    [
      'kind,docId,issue,categoryBefore,categoryAfter,title,room,source,protected',
      ...fixes.category.map((r) =>
        [r.kind, r.docId, r.issue, r.categoryBefore, r.categoryAfter, r.title, r.room, r.source, r.protected].map(escCsv).join(',')
      ),
    ].join('\n')
  );
  fs.writeFileSync(
    path.join(OUT_DIR, 'no-image.csv'),
    [
      'kind,docId,title,room,category,source,houzzId,libraryProductId',
      ...fixes.noImage.map((r) =>
        [r.kind, r.docId, r.title, r.room, r.category, r.source, r.houzzId, r.libraryProductId].map(escCsv).join(',')
      ),
    ].join('\n')
  );

  console.log(JSON.stringify(report.totals, null, 2));
  console.log('issueCounts', issueCounts);
  console.log('topBadCategories', report.topBadCategories.slice(0, 12));
  console.log('\nWrote:', OUT_DIR);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
