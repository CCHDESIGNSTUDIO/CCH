/**
 * READ-ONLY audit of STAGING products/ category quality.
 * Buckets every product by category against the CCH Canonical Taxonomy (CLEANUP_HISTORY.md),
 * flags rooms-in-category, mashed/concatenated categories, legacy-remap values, and identity gaps.
 *
 * SAFETY: reads STAGING only (.get()). ZERO writes. No production access.
 * Run: node _scripts/audit-staging-categories_BY_CLAUDE_2026-06-08.js
 */
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const KEY_DIR = path.join(__dirname, '..', '_debug', 'service-account.json');
const stagingKey = require(path.join(KEY_DIR, 'cch-studio-staging-firebase-adminsdk-fbsvc-b93c6f1cf4.json'));
const app = admin.initializeApp({ credential: admin.credential.cert(stagingKey) }, 'staging');
const db = app.firestore();

const CANONICAL = ['Lighting','Mirrors & Accessories','Accessories','Furniture & Upholstery','Fabric & Trim',
  'Cabinet Hardware','Window Hardware','Bedding & Pillows','Custom Pillows & Bedding','Custom Window Treatments',
  'Windows','Wall','Wall Covering','Appliances & Plumbing','Floor Covering','Rugs','Stone & Tile','Cabinets',
  'Florals','Art','Architectural'];
const EXPENSE = ['Freight','Labor','Expense','Prepaid Tax','Custom Upholstery'];
const LEGACY = ['Furniture','Hardware','Mirror','Mirrors','Custom Window Coverings','Custom Bedding and Pillows',
  'Fabric','Fabric + Trim','Window','Pillows','Solid Surface','Grout','Dining Chairs','Dining Table',
  'Cabinet Door Style','Appliances  & Plumbing','Bedding'];

const CANON_SET = new Set(CANONICAL.map((s) => s.toLowerCase()));
const EXP_SET = new Set(EXPENSE.map((s) => s.toLowerCase()));
const LEG_SET = new Set(LEGACY.map((s) => s.toLowerCase()));

const ROOM_WORDS = ['room','kitchen','bath','bedroom','closet','pantry','entry','foyer','hall','office','powder',
  'living','dining','great','game','guest','exterior','patio','garage','laundry','mudroom','nook','suite','loft',
  'den','study','nursery','theater','wine','stair','landing','butler','master','mbr','inventory'];

function looksLikeRoom(raw) {
  const c = String(raw || '').toLowerCase().trim();
  if (!c) return false;
  if (/\broom\b/.test(c)) return true;
  if (/^(mbr|hall l\d|guest \d|s\d )/.test(c)) return true;
  for (const w of ROOM_WORDS) { if (c === w) return true; }
  // word-boundary contains for multi-word room labels (e.g. "butler pantry", "great room")
  for (const w of ['kitchen','butler','powder','pantry','foyer','closet','mudroom','laundry','nursery']) {
    if (new RegExp('\\b' + w + '\\b').test(c)) return true;
  }
  return false;
}

function findConcat(raw) {
  const c = String(raw || '').trim();
  for (const A of CANONICAL) {
    if (c.length > A.length && c.startsWith(A)) {
      const rest = c.slice(A.length).trim();
      if (CANON_SET.has(rest.toLowerCase())) return [A, rest];
    }
  }
  return null;
}

(async () => {
  console.log('Reading STAGING products/ (read-only)...');
  const snap = await db.collection('products').get();
  const buckets = { canonical: [], expense: [], legacyRemap: [], empty: [], concatenated: [], roomLike: [], unknown: [] };
  let noProductCode = 0, noHouzz = 0, noSku = 0, noIdentity = 0;
  const catTally = {};

  snap.forEach((d) => {
    const p = d.data() || {};
    const cat = String(p.category || '').trim();
    const rec = { id: d.id, title: p.title || p.name || '', vendor: p.vendor || '', category: cat,
      productCode: String(p.productCode || ''), houzzId: String(p.houzzId || p.houzzProductId || ''), sku: String(p.sku || '') };
    if (!rec.productCode) noProductCode++;
    if (!rec.houzzId) noHouzz++;
    if (!rec.sku) noSku++;
    if (!rec.houzzId && !rec.sku && !rec.productCode) noIdentity++;
    catTally[cat || '(empty)'] = (catTally[cat || '(empty)'] || 0) + 1;

    const lc = cat.toLowerCase();
    if (!cat) buckets.empty.push(rec);
    else if (CANON_SET.has(lc)) buckets.canonical.push(rec);
    else if (EXP_SET.has(lc)) buckets.expense.push(rec);
    else { const cc = findConcat(cat);
      if (cc) { rec.splitsInto = cc; buckets.concatenated.push(rec); }
      else if (looksLikeRoom(cat)) buckets.roomLike.push(rec);
      else if (LEG_SET.has(lc)) buckets.legacyRemap.push(rec);
      else buckets.unknown.push(rec);
    }
  });

  const sizes = Object.fromEntries(Object.entries(buckets).map(([k, v]) => [k, v.length]));
  const badCatValues = Object.entries(catTally)
    .filter(([c]) => { const lc = c.toLowerCase(); return c !== '(empty)' && !CANON_SET.has(lc) && !EXP_SET.has(lc); })
    .sort((a, b) => b[1] - a[1]);

  const report = {
    date: '2026-06-08', source: 'STAGING products/ (cch-studio-staging)', note: 'READ-ONLY. Zero writes.',
    totalProducts: snap.size, bucketCounts: sizes,
    identityGaps: { noProductCode, noHouzzId: noHouzz, noSku, noIdentityAtAll: noIdentity },
    distinctBadCategoryValues: badCatValues.map(([value, count]) => ({ value, count })),
    samples: {
      concatenated: buckets.concatenated.slice(0, 30),
      roomLike: buckets.roomLike.slice(0, 40),
      unknown: buckets.unknown.slice(0, 40),
      empty: buckets.empty.slice(0, 20),
    },
    full: buckets,
  };
  const outDir = path.join(__dirname, '..', '_backup', 'staging-category-audit-2026-06-08');
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, 'STAGING_CATEGORY_AUDIT_BY_CLAUDE_2026-06-08.json');
  fs.writeFileSync(outFile, JSON.stringify(report, null, 2));

  console.log('\n===== STAGING products/ category audit (read-only) =====');
  console.log('Total products:', snap.size);
  console.log('Buckets:', JSON.stringify(sizes));
  console.log('Identity gaps:', JSON.stringify(report.identityGaps));
  console.log('\nDistinct NON-canonical category values (value : count):');
  badCatValues.slice(0, 40).forEach(([v, n]) => console.log('  ' + JSON.stringify(v) + ' : ' + n));
  console.log('\nFull report:', outFile);
  process.exit(0);
})().catch((e) => { console.error('ERROR', e); process.exit(1); });
