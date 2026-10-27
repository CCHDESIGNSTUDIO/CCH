'use strict';
/**
 * DRY-RUN — Split legacy "Mirrors & Accessories" into Mirror vs Accessories.
 * READ-ONLY by default. Pass --apply only after Cindy reviews manifest + backup.
 *
 * Run (production read-only):
 *   node _scripts/dryrun-mirrors-accessories-split_BY_CLAUDE_2026-06-30.js
 *   node _scripts/dryrun-mirrors-accessories-split_BY_CLAUDE_2026-06-30.js --project staging
 *   node _scripts/dryrun-mirrors-accessories-split_BY_CLAUDE_2026-06-30.js --apply  (writes + backup)
 */
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const STAGING = args.includes('--project') && args[args.indexOf('--project') + 1] === 'staging';

const KEY_DIR = path.join(__dirname, '..', '_debug', 'service-account.json');
const KEY_FILE = STAGING
  ? 'cch-studio-staging-firebase-adminsdk-fbsvc-b93c6f1cf4.json'
  : 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json';
const PROJECT_LABEL = STAGING ? 'staging' : 'production';

const app = admin.initializeApp(
  { credential: admin.credential.cert(require(path.join(KEY_DIR, KEY_FILE))) },
  'mirror-split-' + PROJECT_LABEL
);
const db = app.firestore();

const OUT_DIR = path.join(__dirname, '..', '_backup', 'mirrors-accessories-split-2026-06-30');
fs.mkdirSync(OUT_DIR, { recursive: true });

/** Stored values that are invalid in current MASTER and need split/remap. */
const LEGACY_COMBINED = new Set([
  'mirrors & accessories',
  'mirrors and accessories',
  'mirror & accessories',
  'mirror and accessories',
]);

const LEGACY_MIRROR_VARIANTS = new Set(['mirror', 'mirrors']);

function normCat(raw) {
  return String(raw || '').trim().replace(/\s+/g, ' ');
}

function isLegacyCombined(cat) {
  return LEGACY_COMBINED.has(normCat(cat).toLowerCase());
}

function isLegacyMirrorVariant(cat) {
  const lc = normCat(cat).toLowerCase();
  return LEGACY_MIRROR_VARIANTS.has(lc);
}

function needsFix(cat) {
  const c = normCat(cat);
  if (!c) return false;
  return isLegacyCombined(c) || isLegacyMirrorVariant(c);
}

/** Classify Mirror vs Accessories from title + descriptions. */
function classifyMirrorVsAccessory(item) {
  const title = String(item.title || item.name || item.clientTitle || '').trim();
  const desc = [
    item.clientDescription,
    item.description,
    item.vendorDescription,
    item.notes,
  ].map((x) => String(x || '').trim()).filter(Boolean).join(' ');
  const sku = String(item.sku || item.model || '').trim();
  const combined = (title + ' ' + desc + ' ' + sku).replace(/\s+/g, ' ');

  const titleL = title.toLowerCase();
  const combinedL = combined.toLowerCase();

  const accessorySignals = [
    { re: /\b(vase|bottles?|bowl|tray|urn|jar|sculpture|figurine|bookend|cachepot|obelisk|candelabra|candle\s*holder|pitcher|decanter|carafe|planter|finial|paperweight|trophy|statuette|figurine)\b/i, label: 'decor object' },
    { re: /\b(boxes?|basket|coaster|trivet|desk\s+accessory|object|ornament|figurine|sphere|orb|sphere)\b/i, label: 'accessory object' },
    { re: /\bstoneware\b/i, label: 'stoneware' },
    { re: /\bceramic\b/i, label: 'ceramic' },
    { re: /\bporcelain\b/i, label: 'porcelain' },
    { re: /\bframe\b(?!.*mirror)/i, label: 'frame (non-mirror)' },
  ];

  const titleHasMirror = /\bmirror\b/i.test(title) && !/\bmirrored\b/i.test(title);
  const titleHasAccessory = accessorySignals.some((s) => s.re.test(title));

  // Title wins for obvious mirror products (description may mention "mirrored glass" etc.)
  if (titleHasMirror && !titleHasAccessory) {
    return { newCategory: 'Mirror', confidence: 'high', reason: 'title: mirror product' };
  }

  // Not mirror products — mirrored finish / furniture (description-led)
  const falseMirror = [
    /\bmirrored\b/,
    /\bmirror(ed)?\s+(finish|glass|top|panel|laminate|acrylic|polish|effect)\b/,
    /\b(smoked|antiqued|bronze|gold|silver|mercury|beveled)\s+mirror\b/,
    /\bmirror\s+image\b/,
    /\bwith\s+mirrored\b/,
  ];
  if (falseMirror.some((re) => re.test(combinedL))) {
    return { newCategory: 'Accessories', confidence: 'high', reason: 'mirrored finish / not a mirror product' };
  }

  const mirrorSignals = [
    { re: /\bmirror(s)?\b/i, label: 'mirror keyword' },
    { re: /\blooking\s+glass\b/i, label: 'looking glass' },
    { re: /\bcheval\b/i, label: 'cheval' },
    { re: /\b(lean(er(ing)?|s)?)\s+mirror\b/i, label: 'leaner mirror' },
    { re: /\bwall\s+mirror\b/i, label: 'wall mirror' },
    { re: /\bfloor\s+mirror\b/i, label: 'floor mirror' },
    { re: /\bvanity\s+mirror\b/i, label: 'vanity mirror' },
    { re: /\bhand\s+mirror\b/i, label: 'hand mirror' },
    { re: /\btrumeau\b/i, label: 'trumeau' },
    { re: /\bgirandole\b/i, label: 'girandole' },
    { re: /\bconvex\s+mirror\b/i, label: 'convex mirror' },
    { re: /\bsunburst\s+mirror\b/i, label: 'sunburst mirror' },
  ];

  const mirrorHits = mirrorSignals.filter((s) => s.re.test(combined)).map((s) => s.label);
  const accessoryHits = accessorySignals.filter((s) => s.re.test(combined)).map((s) => s.label);

  if (titleHasAccessory && !titleHasMirror) {
    return { newCategory: 'Accessories', confidence: 'high', reason: 'title: ' + (accessoryHits[0] || 'accessory object') };
  }

  if (mirrorHits.length && !accessoryHits.length) {
    return { newCategory: 'Mirror', confidence: 'medium', reason: mirrorHits.join(', ') };
  }
  if (accessoryHits.length && !mirrorHits.length) {
    return { newCategory: 'Accessories', confidence: 'medium', reason: accessoryHits.join(', ') };
  }

  if (mirrorHits.length && accessoryHits.length) {
    if (/\b(tray|box|bowl|vase|bottle|urn|jar)\b/i.test(title)) {
      return { newCategory: 'Accessories', confidence: 'low', reason: 'ambiguous — object type in title (' + accessoryHits[0] + ')' };
    }
    if (titleHasMirror) {
      return { newCategory: 'Mirror', confidence: 'low', reason: 'ambiguous — mirror in title' };
    }
    return { newCategory: 'Accessories', confidence: 'low', reason: 'ambiguous — default Accessories (' + accessoryHits[0] + ')' };
  }

  // Legacy lowercase "mirror" with no text — assume Mirror
  if (isLegacyMirrorVariant(item._storedCategory)) {
    return { newCategory: 'Mirror', confidence: 'low', reason: 'legacy mirror category, no keyword — default Mirror' };
  }

  return { newCategory: 'Accessories', confidence: 'low', reason: 'no keyword match — default Accessories (manual review)' };
}

function rowFromDoc(ref, data, storedCategory) {
  const item = Object.assign({}, data, { _storedCategory: storedCategory });
  const cls = classifyMirrorVsAccessory(item);
  return {
    ref,
    id: ref.split('/').pop(),
    collection: ref.replace(/\/[^/]+$/, ''),
    title: String(data.title || data.name || data.clientTitle || '').trim(),
    vendor: String(data.vendor || '').trim(),
    sku: String(data.sku || data.model || '').trim(),
    oldCategory: storedCategory,
    newCategory: cls.newCategory,
    confidence: cls.confidence,
    reason: cls.reason,
    project: String(data.project || data.projectId || data.projectName || '').trim(),
  };
}

function csvEscape(v) {
  const s = String(v == null ? '' : v);
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

async function scanRootCollection(name) {
  const rows = [];
  const snap = await db.collection(name).get();
  snap.forEach((d) => {
    const p = d.data() || {};
    const cat = normCat(p.category);
    if (!needsFix(cat)) return;
    rows.push(rowFromDoc(name + '/' + d.id, p, cat));
  });
  return rows;
}

async function scanBoards() {
  const clipRows = [];
  const lineRows = [];
  const boards = await db.collection('boards').get();

  for (const b of boards.docs) {
    const boardId = b.id;
    const clips = await b.ref.collection('clips').get();
    clips.forEach((c) => {
      const p = c.data() || {};
      const cat = normCat(p.category);
      if (!needsFix(cat)) return;
      clipRows.push(rowFromDoc('boards/' + boardId + '/clips/' + c.id, p, cat));
    });

    for (const sub of ['invoices', 'purchaseOrders', 'proposals']) {
      const snap = await b.ref.collection(sub).get();
      snap.forEach((d) => {
        const data = d.data() || {};
        const items = data.items || data.lineItems || [];
        if (!Array.isArray(items)) return;
        items.forEach((it, idx) => {
          const cat = normCat(it.category);
          if (!needsFix(cat)) return;
          lineRows.push(rowFromDoc(
            'boards/' + boardId + '/' + sub + '/' + d.id + '/items[' + idx + ']',
            it,
            cat
          ));
        });
      });
    }
  }
  return { clipRows, lineRows };
}

async function applyChanges(allRows, backup) {
  if (!APPLY) return;
  const batchSize = 400;
  let batch = db.batch();
  let n = 0;

  for (const r of allRows) {
    if (r.ref.includes('/items[')) continue; // doc line arrays need separate apply path
    const parts = r.ref.split('/');
    if (parts[0] === 'products' || parts[0] === 'productLibrary') {
      const ref = db.collection(parts[0]).doc(parts[1]);
      batch.update(ref, {
        category: r.newCategory,
        _categoryFixedAt: admin.firestore.FieldValue.serverTimestamp(),
        _categorySplitFrom: r.oldCategory,
        _taxonomyV: '2026-06-30-mirror-split',
      });
      n++;
    } else if (parts[0] === 'boards' && parts[2] === 'clips') {
      const ref = db.collection('boards').doc(parts[1]).collection('clips').doc(parts[3]);
      batch.update(ref, {
        category: r.newCategory,
        _categoryFixedAt: admin.firestore.FieldValue.serverTimestamp(),
        _categorySplitFrom: r.oldCategory,
        _taxonomyV: '2026-06-30-mirror-split',
      });
      n++;
    }
    if (n >= batchSize) {
      await batch.commit();
      batch = db.batch();
      n = 0;
    }
  }
  if (n > 0) await batch.commit();

  fs.writeFileSync(path.join(OUT_DIR, 'APPLIED_' + PROJECT_LABEL + '_backup.json'), JSON.stringify(backup, null, 2));
  console.log('APPLY complete — backup written.');
}

(async () => {
  console.log('Mirrors & Accessories split — DRY RUN on ' + PROJECT_LABEL.toUpperCase());
  console.log(APPLY ? '*** APPLY MODE — WRITES ENABLED ***' : 'READ-ONLY (zero writes)');

  const products = await scanRootCollection('products');
  console.log('  products/: ' + products.length + ' legacy rows');
  const library = await scanRootCollection('productLibrary');
  console.log('  productLibrary/: ' + library.length + ' legacy rows');
  const { clipRows, lineRows } = await scanBoards();
  console.log('  boards/*/clips: ' + clipRows.length + ' legacy rows');
  console.log('  doc line items: ' + lineRows.length + ' legacy rows');

  const allRows = products.concat(library, clipRows, lineRows);
  const byNew = { Mirror: 0, Accessories: 0 };
  const byConf = { high: 0, medium: 0, low: 0 };
  const bySource = {};

  allRows.forEach((r) => {
    byNew[r.newCategory] = (byNew[r.newCategory] || 0) + 1;
    byConf[r.confidence] = (byConf[r.confidence] || 0) + 1;
    const src = r.collection.split('/')[0];
    bySource[src] = (bySource[src] || 0) + 1;
  });

  const lowReview = allRows.filter((r) => r.confidence === 'low');
  const mirrorSamples = allRows.filter((r) => r.newCategory === 'Mirror').slice(0, 40);
  const accessorySamples = allRows.filter((r) => r.newCategory === 'Accessories').slice(0, 40);

  const report = {
    generatedAt: new Date().toISOString(),
    project: PROJECT_LABEL,
    mode: APPLY ? 'apply' : 'dry-run',
    note: 'Split legacy Mirrors & Accessories → Mirror or Accessories using title/description keywords.',
    totals: {
      all: allRows.length,
      toMirror: byNew.Mirror || 0,
      toAccessories: byNew.Accessories || 0,
      byConfidence: byConf,
      bySource,
    },
    lowConfidenceReview: lowReview,
    mirrorSamples,
    accessorySamples,
    allRows,
  };

  const jsonFile = path.join(OUT_DIR, 'DRYRUN_' + PROJECT_LABEL + '_mirrors_accessories_split_BY_CLAUDE_2026-06-30.json');
  fs.writeFileSync(jsonFile, JSON.stringify(report, null, 2));

  const csvHeader = 'ref,title,vendor,sku,oldCategory,newCategory,confidence,reason,project\n';
  const csvBody = allRows.map((r) =>
    [r.ref, r.title, r.vendor, r.sku, r.oldCategory, r.newCategory, r.confidence, r.reason, r.project]
      .map(csvEscape).join(',')
  ).join('\n');
  const csvFile = path.join(OUT_DIR, 'DRYRUN_' + PROJECT_LABEL + '_mirrors_accessories_split_BY_CLAUDE_2026-06-30.csv');
  fs.writeFileSync(csvFile, csvHeader + csvBody);

  console.log('\n===== SUMMARY =====');
  console.log('Total rows to fix:', allRows.length);
  console.log('  → Mirror:', byNew.Mirror || 0);
  console.log('  → Accessories:', byNew.Accessories || 0);
  console.log('Confidence: high=' + (byConf.high || 0) + ' medium=' + (byConf.medium || 0) + ' low=' + (byConf.low || 0));
  console.log('By source:', JSON.stringify(bySource));
  console.log('\nLow-confidence (manual review):', lowReview.length);
  lowReview.slice(0, 15).forEach((r) => {
    console.log('  [' + r.confidence + '] ' + r.title + ' → ' + r.newCategory + ' (' + r.reason + ')');
  });
  console.log('\nJSON:', jsonFile);
  console.log('CSV:', csvFile);

  if (APPLY) {
    await applyChanges(allRows.filter((r) => !r.ref.includes('/items[')), allRows);
  }

  process.exit(0);
})().catch((e) => {
  console.error('ERROR', e);
  process.exit(1);
});
