#!/usr/bin/env node
/**
 * Part 2 of portal restoration: replace renderClientPortal in
 * platform/index.html with staging's version (which has the working
 * inspiration star/comment render path).
 *
 * Reads staging's full HTML from _debug/staging_live.html.
 * Extracts renderClientPortal function via brace-balance.
 * Replaces the same function in current platform/index.html.
 *
 * Run:  node _scripts/restore-portal-render.js          (dry-run)
 *       node _scripts/restore-portal-render.js --apply  (write)
 */
const fs = require('fs');
const path = require('path');

const STAGING = path.join(__dirname, '..', '_debug', 'staging_live.html');
const CUR = path.join(__dirname, '..', 'platform', 'index.html');
const APPLY = process.argv.includes('--apply');

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

const stagingSrc = fs.readFileSync(STAGING, 'utf8');
const curSrc = fs.readFileSync(CUR, 'utf8');

console.log('Extracting renderClientPortal from staging...');
const stagingRcp = extractFunction(stagingSrc, 'renderClientPortal');
if (!stagingRcp) { console.error('Could not find renderClientPortal in staging.'); process.exit(1); }
console.log(`  staging body: ${stagingRcp.body.length} bytes, lines ${stagingSrc.slice(0, stagingRcp.start).split('\n').length}-${stagingSrc.slice(0, stagingRcp.end).split('\n').length}`);

console.log('Locating renderClientPortal in current...');
const curRcp = extractFunction(curSrc, 'renderClientPortal');
if (!curRcp) { console.error('Could not find renderClientPortal in current.'); process.exit(1); }
console.log(`  current body: ${curRcp.body.length} bytes, lines ${curSrc.slice(0, curRcp.start).split('\n').length}-${curSrc.slice(0, curRcp.end).split('\n').length}`);

const out = curSrc.slice(0, curRcp.start) + stagingRcp.body + curSrc.slice(curRcp.end);
console.log(`\nSize delta: ${out.length - curSrc.length} bytes`);

if (!APPLY) {
  const preview = path.join(__dirname, '..', '_debug', 'index_part2_preview.html');
  fs.writeFileSync(preview, out, 'utf8');
  console.log(`\nDRY-RUN. Preview written: ${preview}`);
  console.log('Re-run with --apply to overwrite platform/index.html.');
  process.exit(0);
}

fs.writeFileSync(CUR, out, 'utf8');
console.log(`\nAPPLIED. ${CUR} updated.`);
