/**
 * PHASE 11 WRITER — Rolling Hills doc lines → project selections (clips).
 *
 * Default DRY RUN. --execute to write.
 *
 * For each line item across boards/cloud-rolling-hills/{invoices,proposals}/*.items[]:
 *   - Already has _matchedClipId? → skip (already linked)
 *   - Match an existing clip (image/houzzId/title)? → write _matchedClipId only
 *   - Service line (no image, no houzzId, no sku)? → write _isService: true on doc line, no clip
 *   - Real product without a clip? → create new clip + write _matchedClipId
 *
 * New clips dedupe by (houzzId || imageFilename || normalized title).
 *
 * Touches:
 *   - boards/cloud-rolling-hills/clips/{newAutoId}     (creates ~N new clips)
 *   - boards/cloud-rolling-hills/invoices/{docId}.items[i]._matchedClipId
 *   - boards/cloud-rolling-hills/proposals/{docId}.items[i]._matchedClipId
 *   - boards/cloud-rolling-hills/invoices/{docId}.items[i]._isService = true (for service lines)
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
const OUT_CSV = path.join(__dirname, 'phase11-writer-manifest.csv');
const EXECUTE = process.argv.includes('--execute');

const norm = (s) => String(s || '').toLowerCase().replace(/[\s\-_"'’″]+/g, ' ').replace(/\s+/g, ' ').trim();
const basename = (u) => { if (!u) return ''; const s = String(u).split('?')[0].split('#')[0]; return (s.split('/').pop() || '').toLowerCase(); };
const csvEsc = (v) => { if (v == null) return ''; const s = String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const safeNum = (v) => { const n = parseFloat(v); return isFinite(n) ? n : null; };

(async () => {
  console.log(`PHASE 11 WRITER  (${EXECUTE ? 'EXECUTE' : 'DRY RUN'})\n`);

  const app = initializeApp(PROD);
  const db = getFirestore(app);

  // 1. Load existing clips + index
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
  console.log(`Loaded ${clips.length} existing clips`);

  // 2. Walk all doc line items, classify each
  const docs = { invoices: [], proposals: [] };
  for (const sub of ['invoices', 'proposals']) {
    const snap = await getDocs(collection(db, 'boards', BOARD_ID, sub));
    snap.forEach(d => docs[sub].push({ docId: d.id, data: d.data() }));
  }

  // Records: { sub, docId, idx, item (raw), action, clipId, newClipKey, isService }
  // Action: 'already-linked' | 'link-existing' | 'create-and-link' | 'mark-service'
  const records = [];
  const newClipsByKey = new Map();   // dedupe key -> new clip data (filled in below)

  function classifyLine(it) {
    if (it._matchedClipId) return { action: 'already-linked' };
    const img = (it.imageFilename || basename(it.imageUrl || it.image || '')).toLowerCase();
    const houzz = String(it.houzzId || '');
    const sku = String(it.sku || '').toLowerCase().trim();
    const t = norm(it.title || it.name || '');
    if (img && byImage.has(img))     return { action: 'link-existing', clip: byImage.get(img),    method: 'image' };
    if (houzz && byHouzzId.has(houzz)) return { action: 'link-existing', clip: byHouzzId.get(houzz), method: 'houzzId' };
    if (t && byTitleNorm.has(t))     return { action: 'link-existing', clip: byTitleNorm.get(t),  method: 'title' };
    // No match — service or real product?
    const isService = !img && !houzz && !sku;
    if (isService) return { action: 'mark-service' };
    return { action: 'create-and-link', img, houzz, sku, t };
  }

  function dedupeKey(it, classified) {
    if (classified.houzz) return 'h:' + classified.houzz;
    if (classified.img)   return 'i:' + classified.img;
    if (classified.sku)   return 's:' + classified.sku;
    return 't:' + classified.t;
  }

  for (const sub of ['invoices', 'proposals']) {
    for (const d of docs[sub]) {
      const items = d.data.items || d.data.lineItems || [];
      items.forEach((it, idx) => {
        const c = classifyLine(it);
        const rec = {
          sub, docId: d.docId, docNum: String(d.data.number || d.data.invoiceNum || d.data.proposalNum || d.docId),
          idx, action: c.action, clipId: '', newClipKey: '', method: c.method || '', title: it.title || it.name || ''
        };
        if (c.action === 'link-existing') rec.clipId = c.clip.docId;
        if (c.action === 'create-and-link') {
          const key = dedupeKey(it, c);
          rec.newClipKey = key;
          if (!newClipsByKey.has(key)) {
            newClipsByKey.set(key, {
              key,
              firstSeenAt: { docNum: rec.docNum, lineIdx: idx },
              clipData: {
                title: it.title || it.name || '',
                imageFilename: it.imageFilename || basename(it.imageUrl || it.image || ''),
                imageUrl: it.imageUrl || it.image || '',
                sku: it.sku || '',
                houzzId: String(it.houzzId || ''),
                libraryProductId: it.libraryProductId || '',
                vendor: it.vendor || '',
                room: it.room || '',
                category: it.category || '',
                cost: safeNum(it.cost) || 0,
                clientPrice: safeNum(it.clientPrice) || safeNum(it.unitPrice) || 0,
                markup: safeNum(it.markup) || 0,
                markupValue: safeNum(it.markupValue) || 0,
                materials: it.materials || '',
                finish: it.finish || '',
                clientDescription: it.clientDescription || '',
                vendorDescription: it.vendorDescription || '',
                source: 'phase11-doc-backfill',
                _createdFromDocLine: { sub, docNum: rec.docNum, lineIdx: idx },
                _createdAt: new Date().toISOString(),
              }
            });
          }
        }
        records.push(rec);
      });
    }
  }

  // 3. Pre-allocate new clip docIds (Firestore auto-id) so we can write _matchedClipId in same batch
  for (const [key, entry] of newClipsByKey) {
    const ref = doc(collection(db, 'boards', BOARD_ID, 'clips'));
    entry.newDocId = ref.id;
    entry.ref = ref;
  }
  // Wire each create-and-link record to its new clip's docId
  for (const r of records) {
    if (r.action === 'create-and-link') r.clipId = newClipsByKey.get(r.newClipKey).newDocId;
  }

  // 4. Console summary
  const counts = { 'already-linked': 0, 'link-existing': 0, 'create-and-link': 0, 'mark-service': 0 };
  for (const r of records) counts[r.action]++;
  console.log('\n--- Action counts ---');
  for (const k of Object.keys(counts)) console.log(`  ${k.padEnd(20)}: ${counts[k]}`);
  console.log(`  new clips to create: ${newClipsByKey.size}  (after dedupe from ${counts['create-and-link']} create-and-link lines)`);

  // 5. Per-doc summary
  console.log('\n--- Per-doc summary ---');
  const perDoc = {};
  for (const r of records) {
    if (!perDoc[r.docNum]) perDoc[r.docNum] = { sub: r.sub, total: 0, alreadyLinked: 0, linkExisting: 0, createAndLink: 0, service: 0 };
    perDoc[r.docNum].total++;
    if (r.action === 'already-linked') perDoc[r.docNum].alreadyLinked++;
    else if (r.action === 'link-existing') perDoc[r.docNum].linkExisting++;
    else if (r.action === 'create-and-link') perDoc[r.docNum].createAndLink++;
    else if (r.action === 'mark-service') perDoc[r.docNum].service++;
  }
  for (const num of Object.keys(perDoc).sort()) {
    const p = perDoc[num];
    if (p.total > 1) {
      console.log(`  ${num.padEnd(10)} ${p.sub.padEnd(10)} total=${String(p.total).padStart(3)} linked=${String(p.alreadyLinked).padStart(3)} link=${String(p.linkExisting).padStart(3)} create=${String(p.createAndLink).padStart(3)} svc=${String(p.service).padStart(3)}`);
    }
  }

  // 6. Build CSV manifest
  const header = ['action','sub','docNum','docId','lineIdx','method','clipId','newClipKey','title'];
  const csvLines = [header.join(',')];
  for (const r of records) csvLines.push(header.map(k => csvEsc(r[k])).join(','));
  csvLines.push('');
  csvLines.push('NEW CLIPS TO CREATE');
  csvLines.push(['newDocId','dedupeKey','title','imageFilename','sku','houzzId','vendor','room','firstSeen'].join(','));
  for (const [key, entry] of newClipsByKey) {
    csvLines.push([entry.newDocId, key, entry.clipData.title, entry.clipData.imageFilename, entry.clipData.sku, entry.clipData.houzzId, entry.clipData.vendor, entry.clipData.room, `${entry.firstSeenAt.docNum}[${entry.firstSeenAt.lineIdx}]`].map(csvEsc).join(','));
  }
  fs.writeFileSync(OUT_CSV, csvLines.join('\n'));
  console.log(`\n  Manifest: ${OUT_CSV}`);

  if (!EXECUTE) { console.log('\nDRY RUN. --execute to write.'); process.exit(0); }

  // 7. EXECUTE — chunked batches
  console.log('\nWRITING TO PRODUCTION...');

  // Group records by (sub, docId) so we update each doc once
  const updatesPerDoc = new Map();   // key = sub|docId -> { items modified }
  for (const r of records) {
    if (r.action === 'already-linked') continue;
    const key = r.sub + '|' + r.docId;
    if (!updatesPerDoc.has(key)) updatesPerDoc.set(key, { sub: r.sub, docId: r.docId, mods: [] });
    updatesPerDoc.get(key).mods.push(r);
  }

  // Build per-doc updated items[] arrays
  const docUpdatePayloads = [];   // [{ ref, fields }]
  for (const [key, u] of updatesPerDoc) {
    const docDataEntry = docs[u.sub].find(d => d.docId === u.docId);
    if (!docDataEntry) { console.log('  doc missing:', key); continue; }
    const items = JSON.parse(JSON.stringify(docDataEntry.data.items || docDataEntry.data.lineItems || []));
    for (const m of u.mods) {
      if (m.action === 'mark-service') {
        items[m.idx] = { ...items[m.idx], _isService: true, _phase11ProcessedAt: new Date().toISOString() };
      } else {
        items[m.idx] = { ...items[m.idx], _matchedClipId: m.clipId, _phase11ProcessedAt: new Date().toISOString() };
      }
    }
    docUpdatePayloads.push({
      ref: doc(db, 'boards', BOARD_ID, u.sub, u.docId),
      fields: { items, _phase11AppliedAt: new Date().toISOString() }
    });
  }

  // Write everything in batches of 400 ops
  const allOps = [];
  for (const [, entry] of newClipsByKey) allOps.push({ kind: 'create-clip', ref: entry.ref, data: entry.clipData });
  for (const p of docUpdatePayloads)      allOps.push({ kind: 'update-doc', ref: p.ref, data: p.fields });

  console.log(`  Total ops: ${allOps.length}  (clip-creates: ${newClipsByKey.size}, doc-updates: ${docUpdatePayloads.length})`);
  const BATCH_SIZE = 400;
  for (let i = 0; i < allOps.length; i += BATCH_SIZE) {
    const slice = allOps.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);
    for (const op of slice) {
      if (op.kind === 'create-clip') batch.set(op.ref, op.data);
      else                            batch.update(op.ref, op.data);
    }
    await batch.commit();
    console.log(`  batch ${i/BATCH_SIZE+1}: wrote ${slice.length} ops (total ${i + slice.length}/${allOps.length})`);
  }
  console.log('\nDONE.');
  process.exit(0);
})().catch(e => { console.error('FAILED:', e); process.exit(1); });
