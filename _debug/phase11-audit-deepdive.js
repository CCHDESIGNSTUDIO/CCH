/**
 * Phase 11 deep dive — bucket the 134 no-match lines by what identifiers they DO have.
 * Also: how many of the 335 RH clips have houzzId populated?
 */
const fs = require('fs');
const path = require('path');
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

const PROD = {
  apiKey: 'AIzaSyAd24U5ArVGrA24IxNcYD2NYiTVycyF4og',
  authDomain: 'cch-design-boards.firebaseapp.com',
  projectId: 'cch-design-boards',
  storageBucket: 'cch-design-boards.firebasestorage.app',
  messagingSenderId: '210388013080',
  appId: '1:210388013080:web:cch-design-boards',
};
const BOARD_ID = 'cloud-rolling-hills';
const norm = (s) => String(s || '').toLowerCase().replace(/[\s\-_"'’″]+/g, ' ').replace(/\s+/g, ' ').trim();
const basename = (u) => { if (!u) return ''; const s = String(u).split('?')[0].split('#')[0]; return (s.split('/').pop() || '').toLowerCase(); };

(async () => {
  const app = initializeApp(PROD);
  const db = getFirestore(app);

  // 1. Clip identifier coverage
  const clipsSnap = await getDocs(collection(db, 'boards', BOARD_ID, 'clips'));
  const clips = [];
  clipsSnap.forEach(d => {
    const x = d.data();
    clips.push({
      docId: d.id,
      title: x.title || x.name || x.productName || '',
      imageFilename: (x.imageFilename || basename(x.imageUrl || x.image || x.coverImage || '')).toLowerCase(),
      sku: String(x.sku || x.SKU || '').toLowerCase().trim(),
      houzzId: String(x.houzzId || x.houzzProductId || ''),
    });
  });
  const clipsWithHouzzId = clips.filter(c => c.houzzId).length;
  const clipsWithImage = clips.filter(c => c.imageFilename).length;
  const clipsWithSku = clips.filter(c => c.sku).length;
  console.log(`=== CLIP IDENTIFIER COVERAGE (${clips.length} clips) ===`);
  console.log(`  with houzzId: ${clipsWithHouzzId}/${clips.length} (${(100*clipsWithHouzzId/clips.length).toFixed(0)}%)`);
  console.log(`  with image:   ${clipsWithImage}/${clips.length} (${(100*clipsWithImage/clips.length).toFixed(0)}%)`);
  console.log(`  with sku:     ${clipsWithSku}/${clips.length} (${(100*clipsWithSku/clips.length).toFixed(0)}%)`);

  // Build clip indexes including loose matchers
  const byHouzzId = new Map();
  const byImage = new Map();
  const byTitleNorm = new Map();
  for (const c of clips) {
    if (c.houzzId) byHouzzId.set(c.houzzId, c);
    if (c.imageFilename) byImage.set(c.imageFilename, c);
    if (c.title) {
      const t = norm(c.title);
      if (t) byTitleNorm.set(t, c);
    }
  }

  // 2. Walk doc lines, classify no-match lines
  const noMatch = [];
  for (const sub of ['invoices', 'proposals']) {
    const snap = await getDocs(collection(db, 'boards', BOARD_ID, sub));
    snap.forEach(d => {
      const x = d.data();
      const docNum = String(x.number || x.invoiceNum || x.proposalNum || d.id).trim();
      const items = x.items || x.lineItems || [];
      items.forEach((it, idx) => {
        const r = {
          sub, docNum, idx,
          title: it.title || it.name || '',
          imageFilename: (it.imageFilename || basename(it.imageUrl || it.image || '')).toLowerCase(),
          sku: String(it.sku || '').toLowerCase().trim(),
          houzzId: String(it.houzzId || ''),
          existingMatchedClipId: it._matchedClipId || '',
          vendor: it.vendor || '',
          libraryProductId: it.libraryProductId || '',
        };
        // re-run match
        if (r.existingMatchedClipId) return;
        if (r.imageFilename && byImage.has(r.imageFilename)) return;
        if (r.houzzId && byHouzzId.has(r.houzzId)) return;
        const t = norm(r.title);
        if (t && byTitleNorm.has(t)) return;
        // truly no-match
        noMatch.push(r);
      });
    });
  }
  console.log(`\n=== NO-MATCH LINES: ${noMatch.length} total ===`);

  // 3. Bucket by identifier presence
  const buckets = {
    'has-houzzId-only': [],
    'has-image-only': [],
    'has-sku-only': [],
    'has-houzzId+image': [],
    'has-image+sku': [],
    'has-houzzId+sku': [],
    'has-all-three': [],
    'title-only': [],
    'nothing-just-title': [],
  };
  for (const r of noMatch) {
    const h = !!r.houzzId, i = !!r.imageFilename, s = !!r.sku;
    if (h && i && s) buckets['has-all-three'].push(r);
    else if (h && i) buckets['has-houzzId+image'].push(r);
    else if (h && s) buckets['has-houzzId+sku'].push(r);
    else if (i && s) buckets['has-image+sku'].push(r);
    else if (h) buckets['has-houzzId-only'].push(r);
    else if (i) buckets['has-image-only'].push(r);
    else if (s) buckets['has-sku-only'].push(r);
    else if (r.title) buckets['nothing-just-title'].push(r);
  }
  for (const k of Object.keys(buckets)) {
    if (buckets[k].length) console.log(`  ${k.padEnd(22)}: ${buckets[k].length}`);
  }

  // 4. For lines with houzzId, list a few — these are the puzzling ones
  console.log('\n=== NO-MATCH LINES THAT HAVE A houzzId (should have matched a clip but didn\'t) ===');
  const withHouzz = noMatch.filter(r => r.houzzId);
  console.log(`  Total: ${withHouzz.length}`);
  for (const r of withHouzz.slice(0, 15)) {
    console.log(`  ${r.docNum.padEnd(10)} [${r.idx}] ${(r.title||'').slice(0,40).padEnd(42)} houzzId=${r.houzzId.padEnd(10)} img=${(r.imageFilename||'').slice(0,30).padEnd(32)} libProdId=${r.libraryProductId.slice(0,8)}`);
  }

  // 5. For lines with NO identifiers, list a few — these are likely services
  console.log('\n=== NO-MATCH LINES WITH NO IDENTIFIERS (likely services/freight) ===');
  const noIdent = noMatch.filter(r => !r.houzzId && !r.imageFilename && !r.sku);
  console.log(`  Total: ${noIdent.length}`);
  // group by title pattern
  const titleCounts = {};
  for (const r of noIdent) {
    const t = (r.title || '(empty)').trim();
    titleCounts[t] = (titleCounts[t] || 0) + 1;
  }
  const sorted = Object.entries(titleCounts).sort((a, b) => b[1] - a[1]);
  for (const [t, n] of sorted.slice(0, 20)) {
    console.log(`  x${String(n).padStart(3)}  ${t.slice(0, 60)}`);
  }

  // 6. For lines with image only, list a few
  console.log('\n=== NO-MATCH LINES WITH IMAGE BUT NO houzzId (real products without Houzz ID) ===');
  const imgOnly = noMatch.filter(r => r.imageFilename && !r.houzzId);
  console.log(`  Total: ${imgOnly.length}`);
  for (const r of imgOnly.slice(0, 10)) {
    console.log(`  ${r.docNum.padEnd(10)} [${r.idx}] ${(r.title||'').slice(0,40).padEnd(42)} img=${r.imageFilename.slice(0,40).padEnd(42)} sku=${r.sku||''}`);
  }

  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
