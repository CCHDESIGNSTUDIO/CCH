#!/usr/bin/env node
'use strict';
/**
 * Read-only: Cloud Rolling Hills room-board clip junk audit.
 *   node _scripts/audit-rh-roomboard-junk_BY_CLAUDE_2026-06-02.js
 */
const path = require('path');
const admin = require('firebase-admin');
const KEY = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
admin.initializeApp({ credential: admin.credential.cert(require(KEY)) });
const db = admin.firestore();
const PID = 'cloud-rolling-hills';

function junkScore(title) {
  const t = String(title || '').trim();
  if (!t) return { score: 0, reasons: [] };
  const reasons = [];
  let score = 0;

  if (/^(weight|wattage|total wattage|top to center|extension|height|width|depth|overall weight)/i.test(t)) {
    score += 50;
    reasons.push('spec-prefix');
  }
  if (/weight\s*:/i.test(t)) { score += 40; reasons.push('weight-colon'); }
  if (/wattage|watts\b/i.test(t) && t.length < 80) { score += 35; reasons.push('wattage'); }
  if (/provide satisfying|contrast\./i.test(t)) { score += 45; reasons.push('marketing-fragment'); }
  if (/top to center/i.test(t)) { score += 40; reasons.push('top-to-center'); }
  if (/cm\)|in \(\d|\blbs\.?\s*$/i.test(t) && t.length < 70) { score += 25; reasons.push('dimension-fragment'); }
  if (/takes \d+x|not included|socket type|plug in no/i.test(t)) { score += 30; reasons.push('bulb-spec'); }
  if (/cracked edge\.?$/i.test(t) || /^licorice$/i.test(t)) { score += 35; reasons.push('scraped-fragment'); }
  if (/illuminating |vaudeville|become a go-to/i.test(t)) { score += 40; reasons.push('sentence-scrape'); }
  if (t.length < 12 && /lbs|watt|inch|cm/i.test(t)) { score += 20; reasons.push('short-spec'); }
  if (t.length > 120 && !/\b(pendant|sconce|chandelier|mirror|sofa|chair|table|lamp|fixture|mount)\b/i.test(t)) {
    score += 15;
    reasons.push('long-non-product');
  }

  return { score, reasons };
}

function isJunkTitle(title) {
  return junkScore(title).score >= 25;
}

(async () => {
  const snap = await db.collection('boards').doc(PID).collection('clips').get();
  const rows = [];
  const bySource = {};
  let junkCount = 0;
  let notClipper = 0;

  snap.forEach((d) => {
    const x = d.data() || {};
    const src = String(x.source || '(none)').trim();
    bySource[src] = (bySource[src] || 0) + 1;
    if (src !== 'cch-studio-clipper') notClipper++;
    const title = String(x.title || '').trim();
    const js = junkScore(title);
    if (js.score >= 25) junkCount++;
    rows.push({
      id: d.id,
      title,
      source: src,
      room: x.room || '',
      vendor: x.vendor || '',
      addedAt: x.addedAt,
      updatedAt: x.updatedAt,
      junkScore: js.score,
      junkReasons: js.reasons,
    });
  });

  rows.sort((a, b) => b.junkScore - a.junkScore || String(b.title).localeCompare(a.title));

  const junkRows = rows.filter((r) => r.junkScore >= 25);
  const worst10 = junkRows.slice(0, 10);

  console.log('=== Cloud Rolling Hills — Room Board clips (read-only) ===\n');
  console.log('Total clips:', snap.size);
  console.log('Spec-fragment / junk titles (score >= 25):', junkCount);
  console.log('source !== cch-studio-clipper:', notClipper);
  console.log('\nBy source:');
  Object.keys(bySource).sort((a, b) => bySource[b] - bySource[a]).forEach((s) => {
    console.log(' ', s + ':', bySource[s]);
  });

  console.log('\n--- 10 worst junk samples (by score) ---');
  if (!worst10.length) {
    console.log('(none matched junk heuristics — showing top 10 low-title-quality houzz-import if any)');
    const fallback = rows
      .filter((r) => r.source === 'houzz-import' || r.source === 'library')
      .filter((r) => r.junkScore > 0)
      .slice(0, 10);
    fallback.forEach((r, i) => {
      console.log(`${i + 1}. ${r.id}`);
      console.log(`   title: ${r.title}`);
      console.log(`   source: ${r.source} | room: ${r.room || '(none)'} | score: ${r.junkScore} [${r.junkReasons.join(', ')}]`);
    });
  } else {
    worst10.forEach((r, i) => {
      console.log(`${i + 1}. ${r.id}`);
      console.log(`   title: ${r.title}`);
      console.log(`   source: ${r.source} | room: ${r.room || '(none)'} | score: ${r.junkScore} [${r.junkReasons.join(', ')}]`);
    });
  }

  console.log('\n--- User-requested title patterns (clip titles) ---');
  const userPatterns = [
    { label: 'Weight:', re: /weight\s*:/i },
    { label: 'provide satisfying contrast.', re: /provide satisfying contrast/i },
    { label: 'Total Wattage:', re: /total wattage\s*:/i },
    { label: 'any spec-fragment (score>=25)', re: null },
  ];
  userPatterns.forEach((p) => {
    if (!p.re) {
      console.log(` ${p.label}: ${junkCount}`);
      return;
    }
    const n = rows.filter((r) => p.re.test(r.title)).length;
    console.log(` ${p.label}: ${n}`);
  });

  console.log('\n--- Broader junk title patterns ---');
  const patterns = {
    'weight: (any)': 0,
    'provide satisfying (any)': 0,
    'wattage/watts': 0,
    'top to center': 0,
    'overall weight': 0,
    'extension:/height:/width: prefix': 0,
  };
  rows.forEach((r) => {
    const t = r.title.toLowerCase();
    if (/weight\s*:/.test(t)) patterns['weight: (any)']++;
    if (/provide satisfying/.test(t)) patterns['provide satisfying (any)']++;
    if (/wattage|watts\b/.test(t)) patterns['wattage/watts']++;
    if (/top to center/.test(t)) patterns['top to center']++;
    if (/overall weight/.test(t)) patterns['overall weight']++;
    if (/^(extension|height|width):/i.test(r.title)) patterns['extension:/height:/width: prefix']++;
  });
  Object.entries(patterns).forEach(([k, v]) => console.log(` ${k}: ${v}`));

  console.log('\nClipper clips (protected):', bySource['cch-studio-clipper'] || 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
