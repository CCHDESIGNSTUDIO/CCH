#!/usr/bin/env node
/**
 * Restore the 28 client-portal functions + cp-insp-* CSS that were
 * deleted in commit 7e57f74. Source of truth: _debug/index_84c1b0b.html.
 *
 * - Reads 84c1b0b version of index.html from _debug.
 * - For each deleted function name, locates `function NAME(` or
 *   `async function NAME(` and extracts the body using brace-balance.
 * - Reads current platform/index.html and inserts the extracted block
 *   right before the existing `function cpIsInspirationBoard` (a safe
 *   anchor — same file region, function order doesn't matter for JS).
 * - Replaces the current 10-line `cpIsInspirationBoard` heuristic with
 *   the 84c1b0b 3-line wrapper that delegates to the now-restored
 *   cpPortalInspirationIdeabook / cpPortalConceptIdeabook.
 * - Locates the cp-insp-* CSS block in 84c1b0b and inserts it into the
 *   current file's CSS area right before `/* ===== LIGHTBOX` (matching
 *   anchor exists in both files).
 *
 * DOES NOT yet touch renderClientPortal — that's a separate step
 * because the section was actively rewritten, not just deleted.
 *
 * Run with: node _scripts/restore-portal-inspiration.js
 *           node _scripts/restore-portal-inspiration.js --apply
 */
const fs = require('fs');
const path = require('path');

const OLD = path.join(__dirname, '..', '_debug', 'index_84c1b0b.html');
const CUR = path.join(__dirname, '..', 'platform', 'index.html');
const APPLY = process.argv.includes('--apply');

const DELETED = [
  // helpers
  '_cpBuildRoomCovers', '_cpDocUrl', '_cpIdeabookRowImageUrl', '_cpSortPortalKeys',
  // identity
  'cpReadStoredClientIdentity', 'cpRenderClientIdentityModal', 'cpClientEmailToSessionDocId',
  'cpPortalEffectiveClientIdentity',
  // portal helpers
  'cpFormatPortalProjectLabel', 'cpBuildMergedPortalDocuments', 'cpCollectIdeabookImageUrls',
  'cpPortalResolveRoomBoardClips', 'cpDesignBoardCoverUrl', 'cpDocIsOnDesignStory',
  'cpResolveDesignStorySpotlights',
  // inspiration filters
  'cpPortalInspirationIdeabook', 'cpPortalConceptIdeabook',
  // inspiration star
  'cpPortalToggleInspirationStar',
  // inspiration comments
  'cpPortalFindCommentIndexById', 'cpPortalClientOwnsInspirationComment',
  'cpPortalPostInspirationComment', 'cpPortalPostInspirationCommentFrom',
  'cpPortalPostInspirationCommentWithText',
  'cpPortalEditInspirationComment', 'cpPortalDeleteInspirationComment',
  'cpPortalOpenInspirationComments',
  // inspiration misc
  'cpPortalSaveInspirationClientNote', 'cpPortalLogInspirationActivity'
];

/**
 * Find a function in source text by name. Returns { start, end, body } where
 * body is the full text including the `function ...` line and its closing `}`.
 * Uses brace counting; handles `function NAME` and `async function NAME`.
 */
function extractFunction(src, name) {
  const re = new RegExp(`(?:^|\\n)(\\s*)(async\\s+)?function\\s+${name}\\s*\\(`);
  const m = re.exec(src);
  if (!m) return null;
  // Start at the first non-newline character of the match
  let start = m.index + (src[m.index] === '\n' ? 1 : 0);
  // Find the opening brace
  let braceOpen = src.indexOf('{', start);
  if (braceOpen < 0) return null;
  // Walk braces — track string and comment state minimally
  let i = braceOpen;
  let depth = 0;
  let inStr = null;     // '"', "'", "`"
  let escape = false;
  let inLineCmt = false;
  let inBlockCmt = false;
  while (i < src.length) {
    const c = src[i];
    const c2 = src[i + 1] || '';
    if (inLineCmt) {
      if (c === '\n') inLineCmt = false;
    } else if (inBlockCmt) {
      if (c === '*' && c2 === '/') { inBlockCmt = false; i++; }
    } else if (inStr) {
      if (escape) { escape = false; }
      else if (c === '\\') { escape = true; }
      else if (c === inStr) { inStr = null; }
    } else {
      if (c === '/' && c2 === '/') { inLineCmt = true; i++; }
      else if (c === '/' && c2 === '*') { inBlockCmt = true; i++; }
      else if (c === '"' || c === "'" || c === '`') { inStr = c; }
      else if (c === '{') { depth++; }
      else if (c === '}') { depth--; if (depth === 0) { i++; break; } }
    }
    i++;
  }
  const end = i; // exclusive
  const body = src.slice(start, end);
  return { start, end, body };
}

const oldSrc = fs.readFileSync(OLD, 'utf8');
const curSrc = fs.readFileSync(CUR, 'utf8');

console.log('Extracting deleted functions from 84c1b0b...');
const blocks = [];
const missing = [];
for (const name of DELETED) {
  const r = extractFunction(oldSrc, name);
  if (!r) { missing.push(name); continue; }
  // Sanity: trim leading newlines from body, keep indentation
  blocks.push({ name, body: r.body });
  console.log(`  + ${name.padEnd(45)} ${r.body.length} bytes`);
}
if (missing.length) {
  console.error('\nCould not locate in 84c1b0b:', missing);
  process.exit(1);
}

// Extract cp-insp-* CSS block: contiguous run of '.cp-insp-...' lines
// inside a JS string-concat (each line is "...' +" style).
console.log('\nExtracting cp-insp-* CSS lines from 84c1b0b...');
const oldLines = oldSrc.split('\n');
let cssStart = -1, cssEnd = -1;
for (let i = 0; i < oldLines.length; i++) {
  if (oldLines[i].includes('.cp-insp-board-grid')) { cssStart = i; break; }
}
if (cssStart >= 0) {
  // Find the LAST contiguous line that still mentions .cp-insp-
  let j = cssStart;
  while (j < oldLines.length && (oldLines[j].includes('.cp-insp-') || oldLines[j].trim().startsWith('//') || oldLines[j].trim() === '')) {
    j++;
  }
  cssEnd = j - 1;
}
if (cssStart < 0 || cssEnd < 0 || cssEnd < cssStart) { console.error('Could not locate CSS block.'); process.exit(1); }
const cssBlock = oldLines.slice(cssStart, cssEnd + 1).join('\n');
console.log(`  CSS block: lines ${cssStart + 1}-${cssEnd + 1} (${cssEnd - cssStart + 1} lines)`);

// Compose the insertion block.
const banner = `\n    // ════════════════════════════════════════════════════════════\n    // RESTORED 2026-05-13 from commit 84c1b0b (deleted in 7e57f74).\n    // Client portal inspiration star/comment system + helpers.\n    // ════════════════════════════════════════════════════════════\n`;
const insertJs = banner + blocks.map(b => b.body).join('\n\n') + '\n';

// Find insertion anchor in current file: just before `function cpIsInspirationBoard`.
const anchorRe = /\n(\s*)function cpIsInspirationBoard\b/;
const anchorMatch = anchorRe.exec(curSrc);
if (!anchorMatch) { console.error('Could not find anchor cpIsInspirationBoard in current file.'); process.exit(1); }
const anchorIdx = anchorMatch.index + 1; // start of line
console.log(`\nJS insertion anchor in current: char ${anchorIdx} (line ~${curSrc.slice(0, anchorIdx).split('\n').length})`);

// Find the current cpIsInspirationBoard body and prepare a replacement
// using 84c1b0b's wrapper version.
const curIsInspBody = extractFunction(curSrc, 'cpIsInspirationBoard');
const oldIsInspBody = extractFunction(oldSrc, 'cpIsInspirationBoard');
if (!curIsInspBody || !oldIsInspBody) { console.error('Cannot get cpIsInspirationBoard bodies.'); process.exit(1); }
console.log(`Will replace current cpIsInspirationBoard (${curIsInspBody.end - curIsInspBody.start} bytes) with 84c1b0b version (${oldIsInspBody.end - oldIsInspBody.start} bytes).`);

// Find CSS insertion anchor in current: before the LIGHTBOX comment block.
const cssAnchorIdx = curSrc.indexOf('/* ===== LIGHTBOX');
if (cssAnchorIdx < 0) { console.error('Could not find CSS anchor "/* ===== LIGHTBOX" in current file.'); process.exit(1); }
console.log(`CSS insertion anchor in current: char ${cssAnchorIdx} (line ~${curSrc.slice(0, cssAnchorIdx).split('\n').length})`);

// Build the new file content.
let out = curSrc;
// 1. Insert restored JS block before cpIsInspirationBoard
out = out.slice(0, anchorIdx) + insertJs + out.slice(anchorIdx);
// 2. Replace current cpIsInspirationBoard with 84c1b0b version
//    (do this after step 1 — need to re-locate it since we inserted text)
const newIsInsp = extractFunction(out, 'cpIsInspirationBoard');
if (newIsInsp) {
  out = out.slice(0, newIsInsp.start) + oldIsInspBody.body + out.slice(newIsInsp.end);
}
// 3. Insert CSS block before LIGHTBOX
const newCssAnchor = out.indexOf('/* ===== LIGHTBOX');
const cssInsertText = '    /* ===== Restored 2026-05-13: cp-insp-* portal inspiration styles ===== */\n' + cssBlock + '\n';
out = out.slice(0, newCssAnchor) + cssInsertText + out.slice(newCssAnchor);

console.log(`\nOriginal size: ${curSrc.length} bytes`);
console.log(`Restored size: ${out.length} bytes (+${out.length - curSrc.length})`);

if (!APPLY) {
  // Write to a preview file
  const preview = path.join(__dirname, '..', '_debug', 'index_restored_preview.html');
  fs.writeFileSync(preview, out, 'utf8');
  console.log(`\nDRY-RUN. Preview written: ${preview}`);
  console.log('Re-run with --apply to overwrite platform/index.html.');
  process.exit(0);
}

fs.writeFileSync(CUR, out, 'utf8');
console.log(`\nAPPLIED. ${CUR} updated.`);
