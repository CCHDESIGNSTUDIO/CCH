/**
 * PHASE 11 AUDIT — Rolling Hills doc lines vs clips. READ-ONLY.
 *
 * For each line item across boards/cloud-rolling-hills/{invoices,proposals}/*.items[]:
 *   - Already has _matchedClipId? → already-linked
 *   - Match against existing clips (by image basename / sku / houzzId / norm-title)?
 *     → match-found (just needs link write)
 *   - No match? → needs-new-clip (must be created)
 *
 * Output: CSV manifest + console summary.
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
const OUT_CSV = path.join(__dirname, 'phase11-audit-rh-selections.csv');

const norm = (s) => String(s || '').toLowerCase().replace(/[\s\-_"'’″]+/g, ' ').replace(/\s+/g, ' ').trim();
const basename = (u) => { if (!u) return ''; const s = String(u).split('?')[0].split('#')[0]; return (s.split('/').pop() || '').toLowerCase(); };
const csvEsc = (v) => { if (v == null) return ''; const s = String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };

(async () => {
  const app = initializeApp(PROD);
  const db = getFirestore(app);

  // 1. Load all clips in this project
  console.log(`Loading clips from boards/${BOARD_ID}/clips/...`);
  const clipsSnap = await getDocs(collection(db, 'boards', BOARD_ID, 'clips'));
  const clips = [];
  clipsSnap.forEach(d => {
    const x = d.data();
    clips.push({
      docId: d.id,
      title: x.title || x.name || x.productName || '',
      imageFilename: x.imageFilename || basename(x.imageUrl || x.image || x.coverImage || ''),
      sku: x.sku || x.SKU || '',
      houzzId: String(x.houzzId || x.houzzProductId || ''),
      libraryProductId: x.libraryProductId || '',
      vendor: x.vendor || '',
      room: x.room || '',
      cost: x.cost,
      clientPrice: x.clientPrice,
      raw: x,
    });
  });
  console.log(`  ${clips.length} clips loaded`);

  // Build indexes
  const byImage = new Map(), bySKU = new Map(), byHouzzId = new Map(), byTitle = new Map();
  for (const c of clips) {
    const img = (c.imageFilename || '').toLowerCase();
    if (img) {
      if (!byImage.has(img)) byImage.set(img, []);
      byImage.get(img).push(c);
    }
    const sku = String(c.sku).toLowerCase().trim();
    if (sku) {
      if (!bySKU.has(sku)) bySKU.set(sku, []);
      bySKU.get(sku).push(c);
    }
    if (c.houzzId) {
      if (!byHouzzId.has(c.houzzId)) byHouzzId.set(c.houzzId, []);
      byHouzzId.get(c.houzzId).push(c);
    }
    const t = norm(c.title);
    if (t) {
      if (!byTitle.has(t)) byTitle.set(t, []);
      byTitle.get(t).push(c);
    }
  }

  // 2. Walk every doc line item
  const lineRecords = [];
  for (const sub of ['invoices', 'proposals']) {
    const snap = await getDocs(collection(db, 'boards', BOARD_ID, sub));
    snap.forEach(d => {
      const x = d.data();
      const docNum = String(x.number || x.invoiceNum || x.proposalNum || d.id).trim();
      const items = x.items || x.lineItems || [];
      items.forEach((it, idx) => {
        lineRecords.push({
          sub, docId: d.id, docNum,
          source: x.source || '',
          lineIdx: idx,
          title: it.title || it.name || '',
          imageFilename: (it.imageFilename || basename(it.imageUrl || it.image || '')).toLowerCase(),
          sku: String(it.sku || '').toLowerCase().trim(),
          houzzId: String(it.houzzId || ''),
          libraryProductId: it.libraryProductId || '',
          existingMatchedClipId: it._matchedClipId || '',
          vendor: it.vendor || '',
          room: it.room || '',
          cost: it.cost,
          totalSelling: it.totalSelling,
        });
      });
    });
  }
  console.log(`  ${lineRecords.length} doc line items across ${new Set(lineRecords.map(r => r.docNum)).size} docs`);

  // 3. Match each line to clips
  function tryMatch(r) {
    if (r.existingMatchedClipId) {
      const found = clips.find(c => c.docId === r.existingMatchedClipId);
      return { method: 'already-linked', clip: found || null };
    }
    if (r.imageFilename && byImage.has(r.imageFilename)) return { method: 'image', clip: byImage.get(r.imageFilename)[0] };
    if (r.houzzId && byHouzzId.has(r.houzzId)) return { method: 'houzzId', clip: byHouzzId.get(r.houzzId)[0] };
    if (r.sku && bySKU.has(r.sku)) return { method: 'sku', clip: bySKU.get(r.sku)[0] };
    const t = norm(r.title);
    if (t && byTitle.has(t)) return { method: 'title', clip: byTitle.get(t)[0] };
    return { method: 'no-match', clip: null };
  }

  const results = lineRecords.map(r => {
    const m = tryMatch(r);
    return { ...r, method: m.method, matchedClipId: m.clip ? m.clip.docId : '', matchedClipTitle: m.clip ? m.clip.title : '' };
  });

  // 4. Summary
  const breakdown = {};
  for (const r of results) breakdown[r.method] = (breakdown[r.method] || 0) + 1;
  const docsScoped = new Set(results.map(r => r.docNum));
  console.log(`\n--- AUDIT SUMMARY ---`);
  console.log(`  Project: cloud-rolling-hills`);
  console.log(`  Existing clips: ${clips.length}`);
  console.log(`  Total doc line items: ${results.length} across ${docsScoped.size} docs`);
  console.log(`  Match breakdown:`);
  for (const k of Object.keys(breakdown).sort()) {
    console.log(`    ${k.padEnd(15)}: ${breakdown[k]}`);
  }

  // Per-doc breakdown
  console.log(`\n--- PER-DOC LINK STATUS (lines needing link vs needing new clip) ---`);
  const perDoc = {};
  for (const r of results) {
    if (!perDoc[r.docNum]) perDoc[r.docNum] = { sub: r.sub, total: 0, alreadyLinked: 0, canLink: 0, noMatch: 0 };
    perDoc[r.docNum].total++;
    if (r.method === 'already-linked') perDoc[r.docNum].alreadyLinked++;
    else if (r.method === 'no-match') perDoc[r.docNum].noMatch++;
    else perDoc[r.docNum].canLink++;
  }
  const sortedDocs = Object.keys(perDoc).sort();
  for (const num of sortedDocs) {
    const p = perDoc[num];
    if (p.total > 1) {  // skip single-line docs (most are stub Paid invoices)
      console.log(`  ${num.padEnd(10)}  ${p.sub.padEnd(10)} total=${String(p.total).padStart(3)} linked=${String(p.alreadyLinked).padStart(3)} canLink=${String(p.canLink).padStart(3)} needNew=${String(p.noMatch).padStart(3)}`);
    }
  }

  // 5. Sample no-match titles
  const noMatch = results.filter(r => r.method === 'no-match');
  if (noMatch.length) {
    console.log(`\n--- SAMPLE NO-MATCH LINES (first 10) ---`);
    for (const r of noMatch.slice(0, 10)) {
      console.log(`  ${r.docNum.padEnd(10)} [${r.lineIdx}] ${(r.title||'').slice(0,40).padEnd(42)} img=${r.imageFilename||'(none)'} sku=${r.sku||'(none)'} houzzId=${r.houzzId||'(none)'}`);
    }
  }

  // 6. CSV manifest
  const header = ['sub','docNum','docId','lineIdx','source','method','matchedClipId','matchedClipTitle','title','imageFilename','sku','houzzId','vendor','room','cost','totalSelling','existingMatchedClipId'];
  const csvLines = [header.join(',')];
  for (const r of results) csvLines.push(header.map(k => csvEsc(r[k])).join(','));
  fs.writeFileSync(OUT_CSV, csvLines.join('\n'));
  console.log(`\n  Manifest: ${OUT_CSV}`);

  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
