/**
 * Phase 11 — full lists of every doc line item by category.
 * Output: console + CSV.
 *   1. LINK-EXISTING (22) — match an existing clip
 *   2. CREATE-NEW with houzzId (12) — real Houzz products, no clip in project
 *   3. CREATE-NEW image-only (53) — products without houzzId on doc line
 *   4. SKIP-SERVICE (69) — labor / freight / design hours
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
const OUT_CSV = path.join(__dirname, 'phase11-full-list.csv');

const norm = (s) => String(s || '').toLowerCase().replace(/[\s\-_"'’″]+/g, ' ').replace(/\s+/g, ' ').trim();
const basename = (u) => { if (!u) return ''; const s = String(u).split('?')[0].split('#')[0]; return (s.split('/').pop() || '').toLowerCase(); };
const csvEsc = (v) => { if (v == null) return ''; const s = String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };

(async () => {
  const app = initializeApp(PROD);
  const db = getFirestore(app);

  // Clips index
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
  const byHouzzId = new Map(), byImage = new Map(), byTitleNorm = new Map();
  for (const c of clips) {
    if (c.houzzId) byHouzzId.set(c.houzzId, c);
    if (c.imageFilename) byImage.set(c.imageFilename, c);
    const t = norm(c.title);
    if (t) byTitleNorm.set(t, c);
  }

  // Doc lines (only no-link or no-match)
  const linkExisting = [], hasHouzz = [], hasImage = [], serviceLines = [];

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
          libraryProductId: it.libraryProductId || '',
          existingMatchedClipId: it._matchedClipId || '',
          vendor: it.vendor || '',
          room: it.room || '',
          cost: it.cost,
        };
        if (r.existingMatchedClipId) return;  // already linked — skip
        // try match
        let m = null, method = '';
        if (r.imageFilename && byImage.has(r.imageFilename)) { m = byImage.get(r.imageFilename); method = 'image'; }
        else if (r.houzzId && byHouzzId.has(r.houzzId)) { m = byHouzzId.get(r.houzzId); method = 'houzzId'; }
        else if (r.title && byTitleNorm.has(norm(r.title))) { m = byTitleNorm.get(norm(r.title)); method = 'title'; }
        if (m) { linkExisting.push({ ...r, matchMethod: method, clipId: m.docId, clipTitle: m.title }); return; }
        // no match — bucket
        if (r.houzzId) hasHouzz.push(r);
        else if (r.imageFilename || r.sku) hasImage.push(r);
        else serviceLines.push(r);
      });
    });
  }

  function pad(s, n) { return String(s == null ? '' : s).slice(0, n).padEnd(n); }

  console.log(`\n========== 1. LINK-EXISTING (${linkExisting.length}) ==========`);
  console.log('  doc        line  title                                       method   clipId          clipTitle');
  for (const r of linkExisting) {
    console.log(`  ${pad(r.docNum,10)} [${pad(r.idx,3)}] ${pad(r.title,42)} ${pad(r.matchMethod,8)} ${pad(r.clipId,15)} ${pad(r.clipTitle,40)}`);
  }

  console.log(`\n========== 2. CREATE-NEW with houzzId (${hasHouzz.length}) ==========`);
  console.log('  doc        line  title                                      houzzId    image                                   libProdId');
  for (const r of hasHouzz) {
    console.log(`  ${pad(r.docNum,10)} [${pad(r.idx,3)}] ${pad(r.title,42)} ${pad(r.houzzId,10)} ${pad(r.imageFilename,40)} ${pad(r.libraryProductId,12)}`);
  }

  console.log(`\n========== 3. CREATE-NEW image/sku only, NO houzzId (${hasImage.length}) ==========`);
  console.log('  doc        line  title                                      image                                   sku             vendor');
  for (const r of hasImage) {
    console.log(`  ${pad(r.docNum,10)} [${pad(r.idx,3)}] ${pad(r.title,42)} ${pad(r.imageFilename,40)} ${pad(r.sku,15)} ${pad(r.vendor,20)}`);
  }

  console.log(`\n========== 4. SKIP-SERVICE (${serviceLines.length}) ==========`);
  console.log('  doc        line  title');
  for (const r of serviceLines) {
    console.log(`  ${pad(r.docNum,10)} [${pad(r.idx,3)}] ${pad(r.title,60)}`);
  }

  // CSV (one big sheet, with a 'category' column)
  const header = ['category','sub','docNum','lineIdx','title','imageFilename','sku','houzzId','libraryProductId','vendor','room','cost','matchMethod','clipId','clipTitle'];
  const lines = [header.join(',')];
  for (const r of linkExisting) lines.push([...['LINK-EXISTING'], r.sub, r.docNum, r.idx, r.title, r.imageFilename, r.sku, r.houzzId, r.libraryProductId, r.vendor, r.room, r.cost, r.matchMethod, r.clipId, r.clipTitle].map(csvEsc).join(','));
  for (const r of hasHouzz)     lines.push([...['CREATE-NEW-HAS-HOUZZID'], r.sub, r.docNum, r.idx, r.title, r.imageFilename, r.sku, r.houzzId, r.libraryProductId, r.vendor, r.room, r.cost, '', '', ''].map(csvEsc).join(','));
  for (const r of hasImage)     lines.push([...['CREATE-NEW-IMAGE-ONLY'], r.sub, r.docNum, r.idx, r.title, r.imageFilename, r.sku, r.houzzId, r.libraryProductId, r.vendor, r.room, r.cost, '', '', ''].map(csvEsc).join(','));
  for (const r of serviceLines) lines.push([...['SKIP-SERVICE'], r.sub, r.docNum, r.idx, r.title, r.imageFilename, r.sku, r.houzzId, r.libraryProductId, r.vendor, r.room, r.cost, '', '', ''].map(csvEsc).join(','));
  fs.writeFileSync(OUT_CSV, lines.join('\n'));
  console.log(`\n  Full CSV: ${OUT_CSV}`);

  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
