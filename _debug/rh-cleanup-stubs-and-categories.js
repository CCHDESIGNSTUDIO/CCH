/**
 * RH ONLY — two-part cleanup:
 *   1. Delete broken stub clips: no imageFilename + no houzzId + no SKU.
 *      Skip if referenced by any doc line's _matchedClipId (would orphan).
 *   2. Split concatenated category strings ("LightingBedding & Pillows" → "Lighting"
 *      or "Bedding & Pillows" based on title keyword).
 *
 * Default DRY RUN. --execute to write.
 */
const fs = require('fs');
const path = require('path');
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, deleteDoc, writeBatch } = require('firebase/firestore');

const PROD = {
  apiKey: 'AIzaSyAd24U5ArVGrA24IxNcYD2NYiTVycyF4og',
  authDomain: 'cch-design-boards.firebaseapp.com',
  projectId: 'cch-design-boards',
  storageBucket: 'cch-design-boards.firebasestorage.app',
  messagingSenderId: '210388013080',
  appId: '1:210388013080:web:cch-design-boards',
};
const BOARD_ID = 'cloud-rolling-hills';
const OUT_CSV = path.join(__dirname, 'rh-cleanup-manifest.csv');
const EXECUTE = process.argv.includes('--execute');

const csvEsc = (v) => { if (v == null) return ''; const s = String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const basename = (u) => { if (!u) return ''; const s = String(u).split('?')[0].split('#')[0]; return (s.split('/').pop() || '').toLowerCase(); };

// Canonical category list (longest first for prefix matching)
const CATEGORIES = [
  'Bedding & Pillows',
  'Window Treatments',
  'Tile & Stone',
  'Wallcovering',
  'Cabinetry',
  'Appliances',
  'Lighting',
  'Furniture',
  'Accessories',
  'Plumbing',
  'Hardware',
  'Outdoor',
  'Kitchen',
  'Rugs',
  'Bath',
  'Art',
];
// Sort longest-first so "Bedding & Pillows" is tried before "Bath"
CATEGORIES.sort((a, b) => b.length - a.length);

// Title keyword → category hint (lowercase substring → category)
const TITLE_HINT = [
  ['chandelier', 'Lighting'],
  ['sconce', 'Lighting'],
  ['pendant', 'Lighting'],
  ['lantern', 'Lighting'],
  ['ceiling fan', 'Lighting'],
  ['flush mount', 'Lighting'],
  ['flushmount', 'Lighting'],
  ['lamp', 'Lighting'],
  ['light', 'Lighting'],
  ['cone', 'Lighting'],
  ['shade', 'Lighting'],
  ['drum', 'Lighting'],
  ['pillow', 'Bedding & Pillows'],
  ['duvet', 'Bedding & Pillows'],
  ['bedding', 'Bedding & Pillows'],
  ['sheet', 'Bedding & Pillows'],
  ['rug', 'Rugs'],
  ['drape', 'Window Treatments'],
  ['curtain', 'Window Treatments'],
  ['shower', 'Plumbing'],
  ['faucet', 'Plumbing'],
  ['sink', 'Plumbing'],
  ['toilet', 'Plumbing'],
  ['knob', 'Hardware'],
  ['pull', 'Hardware'],
];

function splitConcat(catStr) {
  if (!catStr) return null;
  const parts = [];
  let remaining = String(catStr).trim();
  while (remaining.length) {
    let matched = false;
    for (const c of CATEGORIES) {
      if (remaining.startsWith(c)) {
        parts.push(c);
        remaining = remaining.slice(c.length).trim();
        matched = true;
        break;
      }
    }
    if (!matched) {
      // Couldn't parse — bail
      return null;
    }
  }
  return parts.length >= 2 ? parts : null;   // only return if multi
}

function pickCategoryByTitle(title, candidates) {
  const t = String(title || '').toLowerCase();
  for (const [kw, cat] of TITLE_HINT) {
    if (t.includes(kw) && candidates.includes(cat)) return cat;
  }
  return candidates[0];   // fallback to first
}

(async () => {
  console.log(`RH CLEANUP  (${EXECUTE ? 'EXECUTE' : 'DRY RUN'})\n`);

  const app = initializeApp(PROD);
  const db = getFirestore(app);

  // Load all RH clips
  const clipsSnap = await getDocs(collection(db, 'boards', BOARD_ID, 'clips'));
  const clips = [];
  clipsSnap.forEach(d => {
    const x = d.data();
    const cost = parseFloat(x.cost) || 0;
    const clientPrice = parseFloat(x.clientPrice) || parseFloat(x.unitPrice) || 0;
    clips.push({
      docId: d.id,
      raw: x,
      title: x.title || x.name || x.productName || '',
      imageFilename: (x.imageFilename || basename(x.imageUrl || x.image || x.coverImage || '')).toLowerCase(),
      sku: String(x.sku || x.SKU || '').toLowerCase().trim(),
      houzzId: String(x.houzzId || x.houzzProductId || ''),
      libraryProductId: x.libraryProductId || '',
      category: x.category || '',
      vendor: String(x.vendor || '').trim(),
      cost,
      clientPrice,
    });
  });
  console.log(`Loaded ${clips.length} RH clips`);

  // Build set of clip IDs referenced by any doc line
  const referencedClipIds = new Set();
  for (const sub of ['invoices', 'proposals']) {
    const snap = await getDocs(collection(db, 'boards', BOARD_ID, sub));
    snap.forEach(d => {
      const x = d.data();
      const items = x.items || x.lineItems || [];
      for (const it of items) {
        if (it._matchedClipId) referencedClipIds.add(it._matchedClipId);
      }
    });
  }
  console.log(`Clips referenced by at least one doc line: ${referencedClipIds.size}`);

  // 1. Identify broken stub clips
  // Tighter criteria: must have NONE of (image, houzzId, sku, vendor, cost, clientPrice)
  // AND title must look like garbage (description fragment, note, or pure room name)
  const ROOM_NAME_PATTERNS = [
    /^hall\s*l?\d*$/i, /^hall ceiling light$/i,
    /^reading room$/i, /^mbr & bath$/i, /^mbr$/i, /^master bath/i,
    /^tracey'?s closet$/i, /^ron'?s closet$/i,
    /^pool bath$/i, /^powder( \d)?$/i, /^guest \d+$/i,
    /^dining room$/i, /^great room$/i, /^game room$/i, /^kitchen$/i,
    /^laundry$/i, /^mudroom$/i, /^butler pantry$/i, /^entry$/i,
    /^bar$/i, /^wine cellar/i, /^foyer$/i, /^living room$/i,
    /^office$/i, /^study$/i, /^theater$/i,
  ];
  const looksLikeGarbageTitle = (t) => {
    const s = String(t || '').trim();
    if (!s) return true;
    // Pure room name?
    if (ROOM_NAME_PATTERNS.some(re => re.test(s))) return true;
    // Description fragment markers
    if (/^[a-z]/.test(s)) return true;                                // starts with lowercase
    if (s.endsWith('...') || s.endsWith('..')) return true;
    if (/^(in|of|with|made|crafted|characterized|hardware\.|looked|machine-)/i.test(s)) return true;
    if (/(maintenance|requests|samples|locations)$/i.test(s)) return true;
    if (/^lamp source:/i.test(s)) return true;
    return false;
  };

  const stubsToDelete = [];
  const stubsKeptDueToReference = [];
  const stubsKeptDueToData = [];
  for (const c of clips) {
    const noIdentifiers = !c.imageFilename && !c.houzzId && !c.sku;
    const noBusinessData = !c.vendor && c.cost === 0 && c.clientPrice === 0;
    if (!noIdentifiers || !noBusinessData) continue;
    if (referencedClipIds.has(c.docId)) {
      stubsKeptDueToReference.push(c);
      continue;
    }
    if (!looksLikeGarbageTitle(c.title)) {
      stubsKeptDueToData.push(c);
      continue;
    }
    stubsToDelete.push(c);
  }

  // 2. Identify category fixes
  const categoryFixes = [];
  for (const c of clips) {
    if (stubsToDelete.includes(c)) continue;   // don't bother fixing things we'll delete
    const parts = splitConcat(c.category);
    if (!parts) continue;
    const chosen = pickCategoryByTitle(c.title, parts);
    if (chosen !== c.category) {
      categoryFixes.push({ ...c, currentCategory: c.category, newCategory: chosen, candidates: parts });
    }
  }

  // Console summary
  console.log(`\n--- Plan ---`);
  console.log(`  Broken stubs to DELETE:               ${stubsToDelete.length}`);
  console.log(`  Stubs PRESERVED (doc line refs them): ${stubsKeptDueToReference.length}`);
  console.log(`  Stubs PRESERVED (real-name title):    ${stubsKeptDueToData.length}`);
  console.log(`  Concatenated categories to SPLIT:     ${categoryFixes.length}`);
  console.log(`  Total writes: ${stubsToDelete.length + categoryFixes.length}`);

  if (stubsToDelete.length) {
    console.log(`\n  --- Stubs to DELETE (first 20) ---`);
    for (const c of stubsToDelete.slice(0, 20)) {
      console.log(`    ${c.docId.slice(0,12).padEnd(13)}  title="${(c.title||'').slice(0,40)}"  cat="${c.category}"`);
    }
    if (stubsToDelete.length > 20) console.log(`    ...and ${stubsToDelete.length - 20} more`);
  }

  if (stubsKeptDueToReference.length) {
    console.log(`\n  --- Stubs PRESERVED (referenced by doc lines, would orphan) ---`);
    for (const c of stubsKeptDueToReference.slice(0, 10)) {
      console.log(`    ${c.docId.slice(0,12).padEnd(13)}  title="${(c.title||'').slice(0,40)}"`);
    }
    if (stubsKeptDueToReference.length > 10) console.log(`    ...and ${stubsKeptDueToReference.length - 10} more`);
  }

  if (categoryFixes.length) {
    console.log(`\n  --- Category splits (first 20) ---`);
    for (const f of categoryFixes.slice(0, 20)) {
      console.log(`    ${(f.title||'').slice(0,40).padEnd(42)}  "${f.currentCategory}"  →  "${f.newCategory}"`);
    }
    if (categoryFixes.length > 20) console.log(`    ...and ${categoryFixes.length - 20} more`);
  }

  // CSV
  const lines = ['action,clipId,title,currentCategory,newCategory,imageFilename,houzzId,sku'];
  for (const c of stubsToDelete) lines.push(['delete-stub', c.docId, c.title, c.category, '', c.imageFilename, c.houzzId, c.sku].map(csvEsc).join(','));
  for (const c of stubsKeptDueToReference) lines.push(['stub-kept-referenced', c.docId, c.title, c.category, '', c.imageFilename, c.houzzId, c.sku].map(csvEsc).join(','));
  for (const f of categoryFixes) lines.push(['split-category', f.docId, f.title, f.currentCategory, f.newCategory, f.imageFilename, f.houzzId, f.sku].map(csvEsc).join(','));
  fs.writeFileSync(OUT_CSV, lines.join('\n'));
  console.log(`\n  Manifest: ${OUT_CSV}`);

  if (!EXECUTE) { console.log('\nDRY RUN. --execute to write.'); process.exit(0); }

  console.log('\nWRITING TO PRODUCTION...');
  // Batch deletes + category updates together
  const BATCH_SIZE = 400;
  const ops = [];
  for (const c of stubsToDelete) ops.push({ kind: 'delete', ref: doc(db, 'boards', BOARD_ID, 'clips', c.docId) });
  for (const f of categoryFixes) ops.push({ kind: 'update', ref: doc(db, 'boards', BOARD_ID, 'clips', f.docId), data: { category: f.newCategory, _categoryFixedAt: new Date().toISOString() } });

  for (let i = 0; i < ops.length; i += BATCH_SIZE) {
    const slice = ops.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);
    for (const op of slice) {
      if (op.kind === 'delete') batch.delete(op.ref);
      else batch.update(op.ref, op.data);
    }
    await batch.commit();
    console.log(`  batch ${i/BATCH_SIZE + 1}: wrote ${slice.length} ops`);
  }
  console.log('\nDONE.');
  process.exit(0);
})().catch(e => { console.error('FAILED:', e); process.exit(1); });
