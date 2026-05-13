#!/usr/bin/env node
/**
 * Whitesail dry-run extractor.
 *
 * Reads cchdesign_0427.csv (the canonical Houzz dump), splits it into
 * sections by uppercase header lines, and emits per-section CSVs
 * containing only rows that reference "31 Whitesail" / "Whitesail" /
 * "Sahand" / "Nayebaziz".
 *
 * Output: Houzz FILES/_whitesail_extract/<section>.csv
 *
 * NO Firestore writes. Pure read.
 *
 * Run: node _scripts/extract-whitesail-from-0427.js
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const SRC = 'C:\\Users\\cindy\\Dropbox\\Claude - CCH studio\\Houzz FILES\\cchdesign_0427\\cchdesign_0427.csv';
const OUT_DIR = 'C:\\Users\\cindy\\Dropbox\\Claude - CCH studio\\Houzz FILES\\_whitesail_extract';

const NEEDLES = [/whitesail/i, /sahand/i, /nayebaziz/i];

// Heuristic: a "section header" is a line that is (a) entirely
// uppercase letters/underscores/spaces optionally in quotes, AND
// (b) followed shortly by a header row of column names.
function isSectionHeader(line) {
  const trimmed = line.replace(/^"|"$/g, '').trim();
  if (!trimmed) return false;
  if (trimmed.length > 60) return false; // section headers are short
  if (!/^[A-Z_ ]+$/.test(trimmed)) return false;
  if (trimmed.split(/\s+/).length > 6) return false;
  return true;
}

function safeName(s) {
  return s.replace(/[^A-Za-z0-9]+/g, '_').toLowerCase();
}

function matches(line) {
  return NEEDLES.some(re => re.test(line));
}

(async () => {
  if (!fs.existsSync(SRC)) {
    console.error('Source CSV not found:', SRC);
    process.exit(1);
  }
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const rl = readline.createInterface({
    input: fs.createReadStream(SRC, { encoding: 'utf8' }),
    crlfDelay: Infinity
  });

  const sections = []; // { name, startLine, headerLine, headerRow, dataRows: [] }
  let current = null;
  let lineNum = 0;
  let nextLineIsHeaderRow = false;

  // Track running header context — section header line, then likely a
  // blank, then the column-names row.
  let pendingHeaderRowFor = null;

  for await (const raw of rl) {
    lineNum++;
    const line = raw.replace(/\r$/, '');

    if (isSectionHeader(line)) {
      const name = line.replace(/^"|"$/g, '').trim();
      // Push previous section
      if (current) sections.push(current);
      current = { name, startLine: lineNum, headerLine: null, headerRow: null, dataRows: [] };
      pendingHeaderRowFor = current;
      continue;
    }

    if (pendingHeaderRowFor && line.trim() && !pendingHeaderRowFor.headerRow) {
      // First non-blank line after section header == column row
      pendingHeaderRowFor.headerLine = lineNum;
      pendingHeaderRowFor.headerRow = line;
      pendingHeaderRowFor = null;
      continue;
    }

    if (current && matches(line)) {
      current.dataRows.push({ lineNum, line });
    }
  }
  if (current) sections.push(current);

  // Write per-section extracts
  const summary = [];
  for (const sec of sections) {
    if (!sec.dataRows.length) {
      summary.push({ section: sec.name, startLine: sec.startLine, matchCount: 0, file: null });
      continue;
    }
    const filename = `${String(sec.startLine).padStart(6, '0')}_${safeName(sec.name)}.csv`;
    const outPath = path.join(OUT_DIR, filename);
    const out = [];
    if (sec.headerRow) out.push(sec.headerRow);
    for (const r of sec.dataRows) out.push(r.line);
    fs.writeFileSync(outPath, out.join('\n') + '\n', 'utf8');
    summary.push({
      section: sec.name,
      startLine: sec.startLine,
      matchCount: sec.dataRows.length,
      file: filename
    });
  }

  // Write summary
  const summaryPath = path.join(OUT_DIR, '_SUMMARY.json');
  fs.writeFileSync(summaryPath, JSON.stringify({
    source: SRC,
    generatedAt: new Date().toISOString(),
    needles: NEEDLES.map(r => r.source),
    sectionsScanned: sections.length,
    sectionsWithMatches: summary.filter(s => s.matchCount > 0).length,
    sections: summary
  }, null, 2), 'utf8');

  console.log('=== Whitesail dry-run extract complete ===');
  console.log('Sections scanned:', sections.length);
  console.log('Sections with Whitesail rows:', summary.filter(s => s.matchCount > 0).length);
  console.log('');
  console.log('Per-section row counts (only sections with hits):');
  for (const s of summary.filter(x => x.matchCount > 0)) {
    console.log(`  L${s.startLine}  ${s.section.padEnd(28)} ${s.matchCount} rows  → ${s.file}`);
  }
  console.log('');
  console.log('Output dir:', OUT_DIR);
  console.log('Summary:   ', summaryPath);
})();
