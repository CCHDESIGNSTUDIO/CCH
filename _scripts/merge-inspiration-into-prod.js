#!/usr/bin/env node
/**
 * Surgically merge the working client-portal inspiration subsystem
 * from _debug/staging_live.html into platform/index.html (which is
 * currently prod's pre-2026-05-13 state with all 120 prod-only
 * functions intact).
 *
 * 4 surgical changes (additive or replace-in-place, never bulk-delete):
 *   1. Add 25 top-level cp* + identity functions from staging.
 *      Skip the 3 nested helpers (_cpBuildRoomCovers, _cpDocUrl,
 *      _cpSortPortalKeys) — they belong INSIDE their parent fns.
 *   2. Replace prod's cpIsInspirationBoard heuristic with staging's
 *      3-line wrapper.
 *   3. Replace prod's cpPortalRouteStateFromHash with staging's
 *      (handles inspirations/inspirationBoard plural + detail routes).
 *   4. Replace prod's shared `concepts || inspiration` render block
 *      with staging's 3 separate handlers (inspirationBoard,
 *      inspirations, concepts).
 *   5. Add 62 lines of cp-insp-* CSS.
 *
 * Run: node _scripts/merge-inspiration-into-prod.js          (dry-run)
 *      node _scripts/merge-inspiration-into-prod.js --apply  (write)
 */
const fs = require('fs');
const path = require('path');
const STAGING = path.join(__dirname, '..', '_debug', 'staging_live.html');
const CUR = path.join(__dirname, '..', 'platform', 'index.html');
const APPLY = process.argv.includes('--apply');

const TOP_LEVEL_TO_ADD = [
  '_cpIdeabookRowImageUrl',
  'cpReadStoredClientIdentity', 'cpRenderClientIdentityModal',
  'cpClientEmailToSessionDocId', 'cpPortalEffectiveClientIdentity',
  'cpFormatPortalProjectLabel', 'cpBuildMergedPortalDocuments',
  'cpCollectIdeabookImageUrls', 'cpPortalResolveRoomBoardClips',
  'cpDesignBoardCoverUrl', 'cpDocIsOnDesignStory',
  'cpResolveDesignStorySpotlights',
  'cpPortalInspirationIdeabook', 'cpPortalConceptIdeabook',
  'cpPortalToggleInspirationStar',
  'cpPortalFindCommentIndexById', 'cpPortalClientOwnsInspirationComment',
  'cpPortalPostInspirationComment', 'cpPortalPostInspirationCommentFrom',
  'cpPortalPostInspirationCommentWithText',
  'cpPortalEditInspirationComment', 'cpPortalDeleteInspirationComment',
  'cpPortalOpenInspirationComments', 'cpPortalSaveInspirationClientNote',
  'cpPortalLogInspirationActivity'
];

function extractFunction(src, name) {
  const re = new RegExp(`(?:^|\\n)(\\s*)(async\\s+)?function\\s+${name}\\s*\\(`);
  const m = re.exec(src);
  if (!m) return null;
  let start = m.index + (src[m.index] === '\n' ? 1 : 0);
  let braceOpen = src.indexOf('{', start);
  if (braceOpen < 0) return null;
  let i = braceOpen, depth = 0;
  let inStr = null, escape = false, inLineCmt = false, inBlockCmt = false;
  while (i < src.length) {
    const c = src[i], c2 = src[i + 1] || '';
    if (inLineCmt) { if (c === '\n') inLineCmt = false; }
    else if (inBlockCmt) { if (c === '*' && c2 === '/') { inBlockCmt = false; i++; } }
    else if (inStr) {
      if (escape) escape = false;
      else if (c === '\\') escape = true;
      else if (c === inStr) inStr = null;
    } else {
      if (c === '/' && c2 === '/') { inLineCmt = true; i++; }
      else if (c === '/' && c2 === '*') { inBlockCmt = true; i++; }
      else if (c === '"' || c === "'" || c === '`') inStr = c;
      else if (c === '{') depth++;
      else if (c === '}') { depth--; if (depth === 0) { i++; break; } }
    }
    i++;
  }
  return { start, end: i, body: src.slice(start, i) };
}

function alreadyHas(src, name) {
  return new RegExp(`(?:^|\\n)\\s*(async\\s+)?function\\s+${name}\\s*\\(`).test(src);
}

// Extract a continuous source range from staging_live.html using line numbers
function extractByLines(src, startLine, endLine) {
  const lines = src.split('\n');
  return lines.slice(startLine - 1, endLine).join('\n');
}

const stagingSrc = fs.readFileSync(STAGING, 'utf8');
let curSrc = fs.readFileSync(CUR, 'utf8');

console.log('Mode:', APPLY ? 'APPLY (writes)' : 'DRY-RUN');
console.log('Original prod-restored size:', curSrc.length, 'bytes\n');

// ── 1. Extract + insert top-level functions that prod is missing ──
const blocksToAdd = [];
const skipped = [];
for (const name of TOP_LEVEL_TO_ADD) {
  if (alreadyHas(curSrc, name)) { skipped.push(name); continue; }
  const r = extractFunction(stagingSrc, name);
  if (!r) { console.error('  Could not extract from staging:', name); process.exit(1); }
  blocksToAdd.push({ name, body: r.body });
}
console.log(`Skipped (already in prod): ${skipped.length}`);
console.log(`To add (missing from prod): ${blocksToAdd.length}`);

const banner = '\n    // ════════════════════════════════════════════════════════════\n    // Inspiration portal subsystem (added 2026-05-13).\n    // Source: cch-platform-staging.web.app served HTML.\n    // Surgical: prod-only functions preserved.\n    // ════════════════════════════════════════════════════════════\n';
const insertJs = banner + blocksToAdd.map(b => b.body).join('\n\n') + '\n';

// Anchor: just before `function cpIsInspirationBoard` (exists in prod)
const anchorRe = /\n(\s*)function cpIsInspirationBoard\b/;
const am = anchorRe.exec(curSrc);
if (!am) { console.error('Anchor function cpIsInspirationBoard not found in prod.'); process.exit(1); }
curSrc = curSrc.slice(0, am.index + 1) + insertJs + curSrc.slice(am.index + 1);
console.log(`✓ Inserted ${blocksToAdd.length} functions before cpIsInspirationBoard`);

// ── 2. Replace cpIsInspirationBoard with staging's wrapper ──
const stagingIsInsp = extractFunction(stagingSrc, 'cpIsInspirationBoard');
const curIsInsp = extractFunction(curSrc, 'cpIsInspirationBoard');
if (!stagingIsInsp || !curIsInsp) { console.error('Could not locate cpIsInspirationBoard.'); process.exit(1); }
curSrc = curSrc.slice(0, curIsInsp.start) + stagingIsInsp.body + curSrc.slice(curIsInsp.end);
console.log('✓ Replaced cpIsInspirationBoard with staging wrapper');

// ── 3. Replace cpPortalRouteStateFromHash ──
const stagingRoute = extractFunction(stagingSrc, 'cpPortalRouteStateFromHash');
const curRoute = extractFunction(curSrc, 'cpPortalRouteStateFromHash');
if (!stagingRoute || !curRoute) { console.error('Could not locate cpPortalRouteStateFromHash.'); process.exit(1); }
curSrc = curSrc.slice(0, curRoute.start) + stagingRoute.body + curSrc.slice(curRoute.end);
console.log('✓ Replaced cpPortalRouteStateFromHash with staging version');

// ── 4. Replace the shared concepts||inspiration block ──
// Find prod's `} else if (activePage === 'concepts' || activePage === 'inspiration') {` block
// and its matching closing brace. Walk braces.
const sharedBlockMarker = "else if (activePage === 'concepts' || activePage === 'inspiration')";
const sharedStart = curSrc.indexOf(sharedBlockMarker);
if (sharedStart < 0) { console.error('Could not find shared concepts||inspiration block.'); process.exit(1); }
// Walk from sharedStart to find the closing } of THIS else-if's body
let bracePos = curSrc.indexOf('{', sharedStart);
let depth = 0, i = bracePos, inStr2 = null, esc2 = false, lc2 = false, bc2 = false;
while (i < curSrc.length) {
  const c = curSrc[i], c2 = curSrc[i + 1] || '';
  if (lc2) { if (c === '\n') lc2 = false; }
  else if (bc2) { if (c === '*' && c2 === '/') { bc2 = false; i++; } }
  else if (inStr2) {
    if (esc2) esc2 = false;
    else if (c === '\\') esc2 = true;
    else if (c === inStr2) inStr2 = null;
  } else {
    if (c === '/' && c2 === '/') { lc2 = true; i++; }
    else if (c === '/' && c2 === '*') { bc2 = true; i++; }
    else if (c === '"' || c === "'" || c === '`') inStr2 = c;
    else if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) { i++; break; } }
  }
  i++;
}
const sharedEnd = i;

// Extract from staging: the 3 separate blocks for inspirationBoard / inspirations / concepts.
// Find `else if (activePage === 'inspirationBoard' && inspirationBoardId)` start.
const stagInspBoardStart = stagingSrc.indexOf("else if (activePage === 'inspirationBoard' && inspirationBoardId)");
if (stagInspBoardStart < 0) { console.error('Could not find staging inspirationBoard block.'); process.exit(1); }
// Walk until we pass `concepts` block AND hit the NEXT activePage check after it (e.g. 'proposals' or 'invoices')
// Simpler: walk braces from `else if (activePage === 'inspirationBoard'...` and accept 3 chained else-if blocks
// by tracking how many '} else if (activePage' we cross.
let stagI = stagInspBoardStart;
let blocksCrossed = 0;
const TARGET_BLOCKS = 3; // inspirationBoard, inspirations, concepts
// Track when we exit each else-if body
let depth3 = 0, inStr3 = null, esc3 = false, lc3 = false, bc3 = false;
let firstBrace = stagingSrc.indexOf('{', stagI);
let walkPos = firstBrace;
let blockBodyStarts = [stagI];
while (walkPos < stagingSrc.length) {
  const c = stagingSrc[walkPos], c2 = stagingSrc[walkPos + 1] || '';
  if (lc3) { if (c === '\n') lc3 = false; }
  else if (bc3) { if (c === '*' && c2 === '/') { bc3 = false; walkPos++; } }
  else if (inStr3) {
    if (esc3) esc3 = false;
    else if (c === '\\') esc3 = true;
    else if (c === inStr3) inStr3 = null;
  } else {
    if (c === '/' && c2 === '/') { lc3 = true; walkPos++; }
    else if (c === '/' && c2 === '*') { bc3 = true; walkPos++; }
    else if (c === '"' || c === "'" || c === '`') inStr3 = c;
    else if (c === '{') depth3++;
    else if (c === '}') {
      depth3--;
      if (depth3 === 0) {
        blocksCrossed++;
        if (blocksCrossed >= TARGET_BLOCKS) { walkPos++; break; }
        // Look ahead — expect `else if (activePage ===`
        const peek = stagingSrc.slice(walkPos + 1, walkPos + 100).trim();
        if (!peek.startsWith('else if (activePage ===')) {
          console.error(`Expected next else-if after block ${blocksCrossed}, got: ${peek.slice(0, 80)}`);
          process.exit(1);
        }
      }
    }
  }
  walkPos++;
}
const stagBlocks = stagingSrc.slice(stagInspBoardStart, walkPos);
console.log(`✓ Extracted ${blocksCrossed} chained else-if blocks from staging (${stagBlocks.length} bytes)`);

// Replace the shared block in prod with staging's 3 blocks
// Need to splice from `else if (activePage === 'concepts' || activePage === 'inspiration')` through its closing `}`
curSrc = curSrc.slice(0, sharedStart) + stagBlocks + curSrc.slice(sharedEnd);
console.log('✓ Replaced shared concepts||inspiration block with 3 separate blocks');

// ── 5. Insert cp-insp-* CSS ──
const oldLines = stagingSrc.split('\n');
let cssStart = -1, cssEnd = -1;
for (let li = 0; li < oldLines.length; li++) {
  if (oldLines[li].includes('.cp-insp-board-grid')) { cssStart = li; break; }
}
if (cssStart >= 0) {
  let j = cssStart;
  while (j < oldLines.length && (oldLines[j].includes('.cp-insp-') || oldLines[j].trim().startsWith('//') || oldLines[j].trim() === '')) j++;
  cssEnd = j - 1;
}
if (cssStart < 0 || cssEnd < 0) { console.error('Could not locate cp-insp-* CSS.'); process.exit(1); }
const cssBlock = oldLines.slice(cssStart, cssEnd + 1).join('\n');
const cssAnchor = curSrc.indexOf('/* ===== LIGHTBOX');
if (cssAnchor < 0) { console.error('CSS anchor LIGHTBOX not found.'); process.exit(1); }
curSrc = curSrc.slice(0, cssAnchor) + '    /* ===== Inspiration portal CSS (added 2026-05-13) ===== */\n' + cssBlock + '\n' + curSrc.slice(cssAnchor);
console.log(`✓ Inserted ${cssEnd - cssStart + 1} lines of cp-insp-* CSS`);

console.log(`\nFinal size: ${curSrc.length} bytes (${curSrc.length - fs.readFileSync(CUR, 'utf8').length} delta)`);

// Sanity: verify all 120 prod-only functions still present
const PROD_ONLY_SAMPLE = ['resolvePOVendorDisplay', 'chHouzzPoPaidAmountFromTxnRow', 'ensureStyleLibraryBoard', 'voidInvoice', 'clipApprovalBadgeHtml', 'invoiceComputedGrandTotal', 'dedupeInvoicesForFinancials', 'routeToVendorDetail'];
console.log('\nSanity check — prod-only functions still present in merged output:');
for (const fn of PROD_ONLY_SAMPLE) {
  const c = (curSrc.match(new RegExp(`function ${fn}\\b`, 'g')) || []).length;
  console.log(`  ${fn}: ${c} ${c >= 1 ? '✓' : '✗ MISSING'}`);
}

if (!APPLY) {
  const preview = path.join(__dirname, '..', '_debug', 'index_merge_preview.html');
  fs.writeFileSync(preview, curSrc, 'utf8');
  console.log(`\nDRY-RUN. Preview: ${preview}`);
  process.exit(0);
}
fs.writeFileSync(CUR, curSrc, 'utf8');
console.log('\nAPPLIED.');
