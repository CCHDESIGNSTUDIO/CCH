/**
 * PHASE 2B/2C — Repoint production /products/ imageUrl from Houzz AWS pre-signed URLs
 *               to permanent Firebase Storage URLs uploaded in Phase 2A.
 *
 * Default: DRY RUN (no Firestore writes). Pass --execute to write.
 *
 * Source of truth: phase2a-upload-manifest.json (houzzId -> downloadUrl).
 *
 * Safety rails:
 *  - Only touch docs with `_enrichedFromHouzzApr27` marker (i.e., my Phase 1 enrichment touched them).
 *  - Only touch docs with `houzzId` in the upload manifest.
 *  - SKIP protected sources: cch-studio-clipper, clipper, manual, ideabook-asset.
 *  - SKIP if current imageUrl already on Firebase Storage / retail CDN / data URI.
 *  - Save old imageUrl to `_imageUrlPrevApr27` for rollback.
 *  - Add marker `_imagesRehostedAt: <ISO>`.
 *
 * Output: phase2b-repoint-manifest.csv with action per doc.
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

const MANIFEST = path.join(__dirname, 'phase2a-upload-manifest.json');
const OUT_CSV = path.join(__dirname, 'phase2b-repoint-manifest.csv');
const PROTECTED_SOURCES = new Set(['cch-studio-clipper', 'clipper', 'manual', 'ideabook-asset']);
const EXECUTE = process.argv.includes('--execute');

function csvEsc(v) { if (v == null) return ''; const s = String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
function isAlreadyPermanent(u) {
  if (!u) return false;
  const s = String(u).trim();
  if (s.startsWith('data:')) return true;
  if (/firebasestorage\.googleapis\.com|firebasestorage\.app/i.test(s)) return true;
  // Retail vendor CDNs we should never overwrite
  if (/cdn\.brandfolder\.io|fourhands\.com|visualcomfort\.com|arteriorshome\.com|brunschwig|kravet\.com/i.test(s)) return true;
  return false;
}

(async () => {
  console.log(`PHASE 2B/2C — REPOINT imageUrl  (mode: ${EXECUTE ? 'EXECUTE — WRITES TO PRODUCTION' : 'DRY RUN — no writes'})`);
  console.log();

  if (!fs.existsSync(MANIFEST)) {
    console.error(`Phase 2A upload manifest missing: ${MANIFEST}`);
    process.exit(1);
  }
  const upload = JSON.parse(fs.readFileSync(MANIFEST, 'utf-8'));
  const urlByHouzz = new Map();
  for (const r of upload.results || []) {
    if (r.status !== 'ok') continue;
    if (!r.downloadUrl) continue;
    if (!urlByHouzz.has(r.houzzId)) urlByHouzz.set(r.houzzId, r.downloadUrl);
  }
  console.log(`[1/4] Loaded ${urlByHouzz.size} permanent URLs from Phase 2A manifest`);

  console.log('[2/4] Reading PRODUCTION /products/...');
  const app = initializeApp(PROD);
  const db = getFirestore(app);
  const psnap = await getDocs(collection(db, 'products'));
  const products = [];
  psnap.forEach(d => products.push({ _id: d.id, ...d.data() }));
  console.log(`  ${products.length} products`);

  console.log('[3/4] Computing actions...');
  const updates = [];
  let skipNoMarker = 0, skipProtected = 0, skipPermanent = 0, skipNoMatch = 0, skipNoHouzzId = 0, willUpdate = 0;
  for (const p of products) {
    const hid = String(p.houzzId || p.houzzProductId || '').trim();
    if (!hid) { skipNoHouzzId++; continue; }
    if (!p._enrichedFromHouzzApr27) { skipNoMarker++; continue; }
    const src = String(p.source || p.dataSource || p.origin || '').trim().toLowerCase();
    if (PROTECTED_SOURCES.has(src)) { skipProtected++; continue; }
    const newUrl = urlByHouzz.get(hid);
    if (!newUrl) { skipNoMatch++; continue; }
    const cur = String(p.imageUrl || '').trim();
    if (isAlreadyPermanent(cur)) { skipPermanent++; continue; }
    updates.push({ id: p._id, title: p.title || '', houzzId: hid, oldImageUrl: cur, newImageUrl: newUrl });
    willUpdate++;
  }
  console.log(`  Will update:                  ${willUpdate}`);
  console.log(`  Skip no marker:               ${skipNoMarker}`);
  console.log(`  Skip protected source:        ${skipProtected}`);
  console.log(`  Skip already permanent:       ${skipPermanent}`);
  console.log(`  Skip no match in upload:      ${skipNoMatch}`);
  console.log(`  Skip no houzzId:              ${skipNoHouzzId}`);

  // Manifest CSV
  const csv = ['studioId,title,houzzId,oldImageUrl,newImageUrl,action'];
  for (const u of updates) csv.push([u.id, u.title, u.houzzId, u.oldImageUrl, u.newImageUrl, EXECUTE ? 'updated' : 'will-update'].map(csvEsc).join(','));
  fs.writeFileSync(OUT_CSV, csv.join('\n'));
  console.log(`  Manifest: ${OUT_CSV}`);

  if (!EXECUTE) {
    console.log('\nDRY RUN complete. Re-run with --execute to write to production.');
    process.exit(0);
  }

  console.log('[4/4] WRITING TO PRODUCTION...');
  const BATCH = 400;
  let written = 0;
  const nowIso = new Date().toISOString();
  for (let i = 0; i < updates.length; i += BATCH) {
    const batch = writeBatch(db);
    const slice = updates.slice(i, i + BATCH);
    for (const u of slice) {
      batch.update(doc(db, 'products', u.id), {
        imageUrl: u.newImageUrl,
        _imageUrlPrevApr27: u.oldImageUrl,
        _imagesRehostedAt: nowIso,
      });
    }
    await batch.commit();
    written += slice.length;
    console.log(`  wrote ${written}/${updates.length}`);
  }
  console.log(`\nEXECUTE complete. Wrote ${written} updates.`);
  process.exit(0);
})().catch(e => { console.error('FAILED:', e); process.exit(1); });
