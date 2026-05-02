/**
 * PHASE 7 — Rolling Hills clip cleanup.
 * Default DRY RUN. --execute to write.
 *
 * Rules:
 *  - SKIP entirely: clips where source is manual/clipper/cch-studio-clipper/ideabook-asset/studio-added/studio/empty
 *  - For Houzz-source clips (source contains "houzz"):
 *      1. Drop "category-room" clips (room value matches Clipper category whitelist)
 *         IF the same product has at least one real-room clip preserved.
 *      2. Fix string-encoded clientPrice / cost ("$27,135.00" -> 27135).
 *      3. Apply 35% markup where clientPrice missing/zero AND cost > 0.
 *  - NEVER touch the category field on Houzz clips (came in clean from Houzz).
 *  - Edge cases (Houzz clip with empty category) flagged but not auto-fixed.
 */
const fs = require('fs');
const path = require('path');
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, writeBatch } = require('firebase/firestore');

const PROD = {
  apiKey: 'AIzaSyAd24U5ArVGrA24IxNcYD2NYiTVycyF4og',
  authDomain: 'cch-design-boards.firebaseapp.com',
  projectId: 'cch-design-boards',
  storageBucket: 'cch-design-boards.firebasestorage.app',
  messagingSenderId: '210388013080',
  appId: '1:210388013080:web:cch-design-boards',
};

const BOARD_ID = 'cloud-rolling-hills';
const OUT_CSV = path.join(__dirname, 'phase7-rh-cleanup-manifest.csv');
const EXECUTE = process.argv.includes('--execute');

const CATEGORY_WHITELIST_LOWER = new Set([
  'art', 'mirror', 'accessories', 'fabric & trim', 'fabric+trim', 'fabric and trim',
  'furniture', 'stone & tile', 'tile & stone', 'appliances & plumbing', 'plumbing & appliances',
  'hardware', 'floor covering', 'flooring', 'florals', 'wall', 'bedding & pillows',
  'pillows & bedding', 'pillows', 'bedding', 'wall covering', 'wallpaper',
  'custom furniture', 'custom upholstery', 'cabinets', 'cabinetry',
  'custom bedding and pillows', 'custom window coverings', 'window treatments',
  'windows', 'window', 'lighting', 'architectural', 'outdoor', 'electrical',
  'mirrors & accessories', 'fabric', 'fabrics',
]);

const SKIP_SOURCES_LOWER = new Set([
  'manual', 'clipper', 'cch-studio-clipper', 'ideabook-asset', 'studio-added', 'studio', '',
]);

function csvEsc(v) { if (v == null) return ''; const s = String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
function normTitle(s) { return String(s||'').toLowerCase().trim().replace(/\s+/g,' ').replace(/[^\w\s-]/g,''); }
function isHouzzSource(s) { const v = String(s||'').toLowerCase().trim(); return v.indexOf('houzz') >= 0 || v === 'clip-sync'; }
function shouldSkip(s) { return SKIP_SOURCES_LOWER.has(String(s||'').toLowerCase().trim()) && !isHouzzSource(s); }
function isCategoryRoomValue(roomVal) {
  const v = String(roomVal||'').toLowerCase().trim();
  if (!v) return false;
  return CATEGORY_WHITELIST_LOWER.has(v);
}
function parsePriceLoose(v) {
  if (v == null) return null;
  if (typeof v === 'number') return isFinite(v) ? v : null;
  const s = String(v).trim().replace(/[\$,]/g, '').replace(/\s+/g, '');
  if (!s) return null;
  const n = parseFloat(s);
  return isFinite(n) ? n : null;
}
function fingerprint(c) {
  const hid = String(c.houzzId || c.houzzProductId || '').trim();
  if (hid) return 'h:' + hid;
  const sku = String(c.sku || '').toLowerCase().trim();
  if (sku) return 's:' + sku;
  const t = normTitle(c.title || c.name || '');
  if (t.length >= 3) return 't:' + t;
  return null;
}

(async () => {
  console.log(`PHASE 7 — Rolling Hills clip cleanup  (mode: ${EXECUTE ? 'EXECUTE' : 'DRY RUN'})\n`);

  const app = initializeApp(PROD);
  const db = getFirestore(app);
  const snap = await getDocs(collection(db, 'boards', BOARD_ID, 'clips'));
  console.log(`  ${snap.size} clips in boards/${BOARD_ID}/clips`);

  const clips = [];
  let skippedNonHouzz = 0;
  snap.forEach(d => {
    const x = d.data();
    if (shouldSkip(x.source)) { skippedNonHouzz++; return; }
    if (!isHouzzSource(x.source)) { skippedNonHouzz++; return; }
    clips.push({ docId: d.id, ...x });
  });
  console.log(`  ${skippedNonHouzz} skipped (manual/clipper/empty/non-houzz source)`);
  console.log(`  ${clips.length} Houzz-source clips eligible for cleanup\n`);

  // Group by fingerprint
  const groups = new Map();
  for (const c of clips) {
    const fp = fingerprint(c);
    if (!fp) continue;
    if (!groups.has(fp)) groups.set(fp, []);
    groups.get(fp).push(c);
  }

  // For each clip, decide action
  const actions = [];
  let willDrop = 0, willFixPrice = 0, willMarkup = 0, willReviewEmptyCat = 0;

  for (const c of clips) {
    const isCatRoom = isCategoryRoomValue(c.room);
    const fp = fingerprint(c);
    const sameFp = fp ? groups.get(fp) : [c];
    const hasParallelRealRoom = sameFp.some(o => o.docId !== c.docId && o.room && !isCategoryRoomValue(o.room));
    const cost = parsePriceLoose(c.cost) || 0;
    const cur = parsePriceLoose(c.clientPrice);
    const cprStored = c.clientPrice;
    const cprIsString = typeof cprStored === 'string' && cprStored.trim();

    // 1) drop category-room clips when a real-room sibling exists
    if (isCatRoom && hasParallelRealRoom) {
      actions.push({ clip: c, action: 'drop', reason: 'category-room with real-room sibling',
        beforeRoom: c.room, afterRoom: '', beforeCategory: c.category || '',
        beforeClientPrice: cprStored != null ? cprStored : '', afterClientPrice: '' });
      willDrop++;
      continue;
    }

    // 2) fix string-encoded price + 3) apply markup
    const fields = {};
    let actionTag = [];

    if (cprIsString && cur != null) {
      fields.clientPrice = cur;
      actionTag.push('fix-string-price');
      willFixPrice++;
    }

    if (cost > 0 && (!cur || cur === 0)) {
      fields.clientPrice = Math.round(cost * 1.35 * 100) / 100;
      actionTag.push('apply-35-markup');
      willMarkup++;
    }

    // Edge: Houzz clip with empty category — flag for manual review
    if (!c.category) {
      actionTag.push('review-empty-category');
      willReviewEmptyCat++;
    }

    if (Object.keys(fields).length === 0 && actionTag.length === 0) continue;
    if (Object.keys(fields).length > 0) fields._clipPricingFixedAt = new Date().toISOString();

    actions.push({ clip: c, action: actionTag.join('+') || 'review-only', reason: actionTag.join(','),
      beforeRoom: c.room || '', afterRoom: c.room || '',
      beforeCategory: c.category || '',
      beforeClientPrice: cprStored != null ? cprStored : '',
      afterClientPrice: fields.clientPrice != null ? fields.clientPrice : (cur != null ? cur : ''),
      fields });
  }

  console.log('--- Plan ---');
  console.log(`  Drop category-room clips:      ${willDrop}`);
  console.log(`  Fix string-encoded prices:     ${willFixPrice}`);
  console.log(`  Apply 35% markup (cost->client): ${willMarkup}`);
  console.log(`  Flagged for manual review (empty cat): ${willReviewEmptyCat}`);
  console.log(`  TOTAL actions: ${actions.length}`);

  // Manifest
  const csv = ['clipDocId,title,vendor,houzzId,sku,source,beforeRoom,afterRoom,beforeCategory,beforeClientPrice,afterClientPrice,action,reason'];
  for (const a of actions) {
    const c = a.clip;
    csv.push([c.docId, c.title || '', c.vendor || '', c.houzzId || '', c.sku || '', c.source || '',
      a.beforeRoom, a.afterRoom, a.beforeCategory, a.beforeClientPrice, a.afterClientPrice, a.action, a.reason].map(csvEsc).join(','));
  }
  fs.writeFileSync(OUT_CSV, csv.join('\n'));
  console.log(`\n  Manifest: ${OUT_CSV}`);

  if (!EXECUTE) { console.log('\nDRY RUN. --execute to write.'); process.exit(0); }

  // Execute
  console.log('\nWRITING TO PRODUCTION...');
  const dropList = actions.filter(a => a.action === 'drop');
  const updateList = actions.filter(a => a.action !== 'drop' && a.action !== 'review-only' && a.fields && Object.keys(a.fields).length);
  console.log(`  Deleting ${dropList.length}, updating ${updateList.length}...`);

  const BATCH = 400;
  let done = 0;
  for (let i = 0; i < dropList.length; i += BATCH) {
    const batch = writeBatch(db);
    for (const a of dropList.slice(i, i + BATCH)) batch.delete(doc(db, 'boards', BOARD_ID, 'clips', a.clip.docId));
    await batch.commit();
    done += Math.min(BATCH, dropList.length - i);
    console.log(`  deleted ${done}/${dropList.length}`);
  }
  done = 0;
  for (let i = 0; i < updateList.length; i += BATCH) {
    const batch = writeBatch(db);
    for (const a of updateList.slice(i, i + BATCH)) batch.update(doc(db, 'boards', BOARD_ID, 'clips', a.clip.docId), a.fields);
    await batch.commit();
    done += Math.min(BATCH, updateList.length - i);
    console.log(`  updated ${done}/${updateList.length}`);
  }
  console.log('\nDONE.');
  process.exit(0);
})().catch(e => { console.error('FAILED:', e); process.exit(1); });
