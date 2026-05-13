/**
 * Step 3: For each Rolling Hills clip in STAGING that has a broken/empty imageUrl,
 * find the matching Houzz catalog product (already in staging /products/) and
 * copy its imageUrl over. Per user rule: do not overwrite clips that already
 * have a working (non-AWS, non-empty) image.
 *
 * STAGING ONLY. Production untouched.
 */
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, writeBatch } = require('firebase/firestore');

const STAGING = {
  apiKey: 'AIzaSyBIwwo7uRij6Q0FZg-qmIS1LC8t2AjXrYo',
  authDomain: 'cch-studio-staging.firebaseapp.com',
  projectId: 'cch-studio-staging',
  storageBucket: 'cch-studio-staging.firebasestorage.app',
  messagingSenderId: '210388013080',
  appId: '1:210388013080:web:fcd520b30c0d50b149736d',
};

const BOARD_ID = 'cloud-rolling-hills';

function norm(s) {
  return String(s || '').toLowerCase().trim().replace(/\s+/g, ' ').replace(/[^\w\s-]/g, '');
}
function isWorkingUrl(u) {
  if (!u || !u.startsWith('http')) return false;
  // AWS pre-signed Houzz URLs are expired/expiring -> treat as NOT working
  if (/ivy-(prod|uploads)\.s3/i.test(u) || (/amazonaws\.com/i.test(u) && /X-Amz-/i.test(u))) return false;
  return true;
}

(async () => {
  const app = initializeApp(STAGING);
  const db = getFirestore(app);

  console.log('[1/4] Reading staging Houzz catalog products...');
  const prodSnap = await getDocs(collection(db, 'products'));
  const catalog = [];
  prodSnap.forEach(d => {
    const x = d.data();
    if (x.source === 'houzz-catalog-apr27' && x.imageUrl) catalog.push(x);
  });
  console.log(`  catalog products with image: ${catalog.length}`);

  // Index catalog by SKU and by title
  const bySku = new Map();
  const byTitle = new Map();
  for (const p of catalog) {
    if (p.sku) {
      const k = norm(p.sku);
      if (k && !bySku.has(k)) bySku.set(k, p);
    }
    if (p.title) {
      const k = norm(p.title);
      if (k && !byTitle.has(k)) byTitle.set(k, p);
    }
  }

  console.log('[2/4] Reading staging Rolling Hills clips...');
  const clipsSnap = await getDocs(collection(db, 'boards', BOARD_ID, 'clips'));
  const clips = [];
  clipsSnap.forEach(d => clips.push({ _id: d.id, ...d.data() }));
  console.log(`  clips: ${clips.length}`);

  console.log('[3/4] Matching + planning updates...');
  let working = 0, alreadyOk = 0, fixed = 0, noMatch = 0;
  const updates = [];
  for (const c of clips) {
    if (isWorkingUrl(c.imageUrl)) { working++; continue; }
    // imageUrl is empty, broken, or expiring AWS — eligible for fix
    let m = null;
    const sk = norm(c.sku);
    const ti = norm(c.title);
    if (sk && bySku.has(sk)) m = bySku.get(sk);
    else if (ti && byTitle.has(ti)) m = byTitle.get(ti);
    if (!m) { noMatch++; continue; }
    if (!isWorkingUrl(m.imageUrl)) {
      // catalog match also has only an AWS url — note but still apply (it'll work until May 25,
      // and the bulk download has the local file ready for permanent upload later)
    }
    updates.push({ clipId: c._id, oldImageUrl: c.imageUrl || '(empty)', newImageUrl: m.imageUrl, matchedHouzzId: m.houzzId });
    fixed++;
  }
  console.log(`  clips with already-working image (untouched): ${working}`);
  console.log(`  clips with empty/broken image and a catalog match: ${fixed}`);
  console.log(`  clips with empty/broken image and NO catalog match: ${noMatch}`);

  console.log('[4/4] Writing updates to staging clips...');
  const BATCH_SIZE = 400;
  let written = 0;
  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    const slice = updates.slice(i, i + BATCH_SIZE);
    for (const u of slice) {
      batch.update(doc(db, 'boards', BOARD_ID, 'clips', u.clipId), {
        imageUrl: u.newImageUrl,
        _imageSource: 'houzz-catalog-apr27',
        _imageMatchHouzzId: u.matchedHouzzId,
        _imageUpdatedAt: new Date().toISOString(),
      });
    }
    await batch.commit();
    written += slice.length;
    console.log(`  ${written}/${updates.length}`);
  }

  console.log(`\nDone. ${written} clip imageUrls updated in staging.`);
  console.log('Reload: https://cch-platform-staging.web.app/#/project/cloud-rolling-hills');
  process.exit(0);
})().catch(e => { console.error('FAILED:', e); process.exit(1); });
