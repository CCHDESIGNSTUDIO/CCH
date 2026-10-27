/**
 * READ-ONLY: find STAGING products whose category is a VALID value but WRONG for the item
 * (e.g. a pendant/sconce tagged "Bedding & Pillows"), plus empties. Title-keyword inference.
 * SAFETY: reads STAGING only. ZERO writes.
 */
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const KEY_DIR = path.join(__dirname, '..', '_debug', 'service-account.json');
const k = require(path.join(KEY_DIR, 'cch-studio-staging-firebase-adminsdk-fbsvc-b93c6f1cf4.json'));
const db = admin.initializeApp({ credential: admin.credential.cert(k) }, 'staging').firestore();

// title-keyword -> expected canonical category (high-confidence only)
const RULES = [
  { cat: 'Lighting', re: /\b(pendant|sconce|chandelier|lantern|flush\s*mount|flushmount|flush|drum|lamp|light|linear|cascade)\b/i },
  { cat: 'Rugs', re: /\b(rug|runner)\b/i },
  { cat: 'Mirrors & Accessories', re: /\bmirror\b/i },
  { cat: 'Stone & Tile', re: /\b(tile|stone|countertop|slab|grout|marble|quartz)\b/i },
];
function expected(title) { for (const r of RULES) if (r.re.test(title)) return r.cat; return null; }

(async () => {
  console.log('Reading STAGING products/ (read-only)...');
  const snap = await db.collection('products').get();
  const mismatches = [];
  const empties = [];
  snap.forEach((d) => {
    const p = d.data() || {};
    const title = String(p.title || p.name || '');
    const cat = String(p.category || '').trim();
    const exp = expected(title);
    if (!cat) { if (exp) empties.push({ id: d.id, title, vendor: p.vendor || '', expected: exp }); return; }
    if (exp && cat.toLowerCase() !== exp.toLowerCase()) {
      mismatches.push({ id: d.id, title, vendor: p.vendor || '', category: cat, expected: exp,
        houzzId: String(p.houzzId || p.houzzProductId || '') });
    }
  });
  // group mismatches by current (wrong) category
  const byWrong = {};
  mismatches.forEach((m) => { const key = m.expected + ' tagged as "' + m.category + '"'; byWrong[key] = (byWrong[key] || 0) + 1; });

  const report = { date: '2026-06-08', source: 'STAGING products/', note: 'READ-ONLY. Zero writes.',
    total: snap.size, miscategorizedCount: mismatches.length, emptyButInferable: empties.length,
    mismatchGroups: Object.entries(byWrong).sort((a, b) => b[1] - a[1]).map(([k, n]) => ({ pattern: k, count: n })),
    sampleMismatches: mismatches.slice(0, 60), sampleEmpties: empties.slice(0, 40),
    fullMismatches: mismatches, fullEmpties: empties };
  const outDir = path.join(__dirname, '..', '_backup', 'staging-category-audit-2026-06-08');
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, 'STAGING_MISCATEGORIZED_BY_CLAUDE_2026-06-08.json');
  fs.writeFileSync(outFile, JSON.stringify(report, null, 2));

  console.log('\n===== STAGING miscategorized (valid value, wrong item) =====');
  console.log('Total products:', snap.size);
  console.log('Miscategorized (title says X, category says other):', mismatches.length);
  console.log('Empty category but title is inferable:', empties.length);
  console.log('\nTop mismatch patterns:');
  report.mismatchGroups.slice(0, 25).forEach((g) => console.log('  ' + g.pattern + ' : ' + g.count));
  console.log('\nFull report:', outFile);
  process.exit(0);
})().catch((e) => { console.error('ERROR', e); process.exit(1); });
