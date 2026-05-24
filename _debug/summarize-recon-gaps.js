#!/usr/bin/env node
/**
 * Read-only: summarize Houzz vs Studio invoice gaps from recon JSON (all projects).
 * Usage: node summarize-recon-gaps.js [path-to-recon.json]
 */
'use strict';

const fs = require('fs');
const path = require('path');

const reconPath = process.argv[2] || path.join(__dirname, 'recon-phase0-recon-2026-05-22-79641.json');
const j = JSON.parse(fs.readFileSync(reconPath, 'utf8'));
const findings = j.findings || [];

const missing = findings.filter(
  (f) => f.kind === 'invoice' && f.classification === 'STUDIO_MISSING_LINE_ITEMS',
);
const gran = findings.filter(
  (f) => f.kind === 'invoice' && f.classification === 'STUDIO_LINE_GRANULARITY_MISMATCH',
);

const byProject = new Map();
function bump(map, key, field, n = 1) {
  if (!map.has(key)) map.set(key, { missing: 0, gran: 0, gap: 0, big: [] });
  const g = map.get(key);
  g[field] += n;
}

for (const f of missing) {
  const p = (f.studioRecord || {}).projectId || '(none)';
  const gap = Math.abs(f.totalDiff || 0);
  bump(byProject, p, 'missing');
  byProject.get(p).gap += gap;
  if (gap >= 5000) {
    const s = f.studioRecord || {};
    const h = f.houzzRecord || {};
    byProject.get(p).big.push({
      number: s.number,
      gap,
      studioLines: s.itemCount,
      houzzLines: h.itemCount,
      studioTotal: s.total,
      houzzTotal: h.total,
      docId: s.docId,
    });
  }
}
for (const f of gran) {
  const p = (f.studioRecord || {}).projectId || '(none)';
  bump(byProject, p, 'gran');
}

const sorted = [...byProject.entries()].sort((a, b) => b[1].gap - a[1].gap);

console.log('Recon:', reconPath);
console.log('Missing-line invoices (platform):', missing.length);
console.log('Granularity mismatches:', gran.length);
console.log('Projects with findings:', sorted.length);
console.log('');

console.log('--- Top 30 projects by $ gap (missing lines) ---');
sorted.slice(0, 30).forEach(([p, g]) => {
  console.log(
    `${p.padEnd(28)} missing=${String(g.missing).padStart(3)} gran=${String(g.gran).padStart(3)} gap=$${Math.round(g.gap).toLocaleString()}`,
  );
});

const allBig = missing
  .filter((f) => Math.abs(f.totalDiff || 0) >= 5000)
  .sort((a, b) => Math.abs(b.totalDiff || 0) - Math.abs(a.totalDiff || 0));

console.log('\n--- Top 25 invoices (any project, gap >= $5000) ---');
allBig.slice(0, 25).forEach((f) => {
  const s = f.studioRecord || {};
  const h = f.houzzRecord || {};
  console.log(
    [
      (s.projectId || '?').slice(0, 24),
      s.number || '?',
      `lines ${s.itemCount} vs ${h.itemCount}`,
      `studio $${Math.round(s.total || 0).toLocaleString()}`,
      `houzz $${Math.round(h.total || 0).toLocaleString()}`,
      `gap $${Math.round(Math.abs(f.totalDiff || 0)).toLocaleString()}`,
    ].join(' | '),
  );
});

const outCsv = path.join(__dirname, 'recon-gap-by-project.csv');
const lines = ['projectId,missingInvoices,granularityMismatches,totalDollarGap'];
for (const [p, g] of sorted) {
  lines.push([p, g.missing, g.gran, Math.round(g.gap)].join(','));
}
fs.writeFileSync(outCsv, lines.join('\n'));
console.log('\nWrote:', outCsv);
