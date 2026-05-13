/**
 * PHASE 9C — Enrich line items on the 6 newly-created RH docs.
 * Default DRY RUN. --execute to write.
 *
 * For each item in IN-12980/12978/12977/12976 + PR-12951/12957:
 *   - Match against: RH clips → /products/ → /productLibrary/
 *   - Match priority: SKU exact > title exact > title fuzzy (contains)
 *   - Fill in missing: imageUrl, houzzId, libraryProductId, unitCost, cost
 *   - Recompute totalCost on the parent doc
 */
const fs = require('fs');
const path = require('path');
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, updateDoc, getDoc } = require('firebase/firestore');

const PROD = {
  apiKey: 'AIzaSyAd24U5ArVGrA24IxNcYD2NYiTVycyF4og',
  authDomain: 'cch-design-boards.firebaseapp.com',
  projectId: 'cch-design-boards',
  storageBucket: 'cch-design-boards.firebasestorage.app',
  messagingSenderId: '210388013080',
  appId: '1:210388013080:web:cch-design-boards',
};
const BOARD_ID = 'cloud-rolling-hills';
const TARGETS = [
  { sub: 'invoices', id: 'IN-12980' }, { sub: 'invoices', id: 'IN-12978' },
  { sub: 'invoices', id: 'IN-12977' }, { sub: 'invoices', id: 'IN-12976' },
  { sub: 'proposals', id: 'PR-12951' }, { sub: 'proposals', id: 'PR-12957' },
];
const OUT_CSV = path.join(__dirname, 'phase9c-enrich-manifest.csv');
const EXECUTE = process.argv.includes('--execute');

function csvEsc(v) { if (v == null) return ''; const s = String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
function normTitle(s) { return String(s||'').toLowerCase().trim().replace(/\s+/g,' ').replace(/[^\w\s-]/g,''); }
function normSku(s) { return String(s||'').toLowerCase().trim().replace(/\s+/g,''); }
function num(v) { const n = parseFloat(v); return isFinite(n) ? n : 0; }

function buildLookups(docs) {
  // docs: [{collectionName, docId, data}]
  const bySku = new Map(), byTitle = new Map(), byTitleStems = [];
  for (const d of docs) {
    const x = d.data;
    const sku = normSku(x.sku);
    const t = normTitle(x.title || x.name);
    if (sku && !bySku.has(sku)) bySku.set(sku, d);
    if (t && t.length >= 3 && !byTitle.has(t)) byTitle.set(t, d);
    if (t && t.length >= 4) byTitleStems.push({ stem: t, doc: d });
  }
  return { bySku, byTitle, byTitleStems };
}

function tryMatch(item, lookups) {
  const sku = normSku(item.sku);
  if (sku) {
    for (const L of lookups) if (L.bySku.has(sku)) return { source: L.name, match: L.bySku.get(sku), how: 'sku' };
  }
  const t = normTitle(item.title);
  if (t && t.length >= 3) {
    for (const L of lookups) if (L.byTitle.has(t)) return { source: L.name, match: L.byTitle.get(t), how: 'title-exact' };
    // Fuzzy: tracker title CONTAINS clip/library title (or vice versa)
    for (const L of lookups) {
      for (const ent of L.byTitleStems) {
        if (ent.stem === t) continue; // already matched
        if (t.length >= 6 && ent.stem.length >= 6) {
          if (t.includes(ent.stem) || ent.stem.includes(t)) {
            return { source: L.name, match: ent.doc, how: 'title-fuzzy' };
          }
        }
      }
    }
  }
  return null;
}

(async () => {
  console.log(`PHASE 9C — Line-item enrichment for new RH docs  (${EXECUTE ? 'EXECUTE' : 'DRY RUN'})\n`);

  const app = initializeApp(PROD);
  const db = getFirestore(app);

  // Build lookups from 3 sources
  console.log('  Loading lookup sources...');
  const clipsSnap = await getDocs(collection(db, 'boards', BOARD_ID, 'clips'));
  const clipDocs = []; clipsSnap.forEach(d => clipDocs.push({ docId: d.id, data: d.data() }));
  const productsSnap = await getDocs(collection(db, 'products'));
  const productDocs = []; productsSnap.forEach(d => productDocs.push({ docId: d.id, data: d.data() }));
  let libDocs = [];
  try {
    const libSnap = await getDocs(collection(db, 'productLibrary'));
    libSnap.forEach(d => libDocs.push({ docId: d.id, data: d.data() }));
  } catch (_e) {
    console.log('  /productLibrary/ skipped (auth required) — continuing with clips + /products/ only');
  }

  const clipsLookup = buildLookups(clipDocs); clipsLookup.name = 'clip';
  const productsLookup = buildLookups(productDocs); productsLookup.name = 'product';
  const libLookup = buildLookups(libDocs); libLookup.name = 'productLibrary';

  console.log('  Loaded: ' + clipDocs.length + ' clips, ' + productDocs.length + ' /products/, ' + libDocs.length + ' /productLibrary/');

  const lookupChain = [clipsLookup, productsLookup, libLookup];

  const csvRows = ['docId,itemIdx,title,sku,matchedSource,matchedBy,addedImageUrl,addedHouzzId,addedCost,addedUnitCost'];
  const updates = [];

  for (const target of TARGETS) {
    const dref = doc(db, 'boards', BOARD_ID, target.sub, target.id);
    const ds = await getDoc(dref);
    if (!ds.exists()) { console.log('  SKIP ' + target.id + ': not found'); continue; }
    const x = ds.data();
    const items = x.items || [];
    let touched = 0, addedImage = 0, addedHouzzId = 0, addedCost = 0;
    const newItems = items.map((it, idx) => {
      const result = tryMatch(it, lookupChain);
      if (!result) { csvRows.push([target.id, idx, it.title || '', it.sku || '', '', '', '', '', '', ''].map(csvEsc).join(',')); return it; }
      const m = result.match.data;
      const fields = {};
      if (!String(it.imageUrl || '').trim() && String(m.imageUrl || '').trim()) { fields.imageUrl = m.imageUrl; addedImage++; }
      if (!String(it.houzzId || '').trim() && String(m.houzzId || m.houzzProductId || '').trim()) { fields.houzzId = String(m.houzzId || m.houzzProductId).trim(); addedHouzzId++; }
      if (!String(it.libraryProductId || '').trim() && result.match.docId) fields.libraryProductId = result.match.docId;
      const itCost = num(it.cost), itUnit = num(it.unitCost);
      const mCost = num(m.cost), mUnit = num(m.unitCost) || num(m.costPrice);
      if (!itCost && mCost) { fields.cost = mCost; addedCost++; }
      if (!itUnit && mUnit) { fields.unitCost = mUnit; }
      // Inherit imageFilename from match if our slot is empty
      if (!String(it.imageFilename || '').trim() && String(m.imageFilename || '').trim()) fields.imageFilename = m.imageFilename;
      if (Object.keys(fields).length === 0) {
        csvRows.push([target.id, idx, it.title || '', it.sku || '', result.source, result.how, '', '', '', ''].map(csvEsc).join(','));
        return it;
      }
      touched++;
      const merged = Object.assign({}, it, fields);
      csvRows.push([target.id, idx, it.title || '', it.sku || '', result.source, result.how,
        fields.imageUrl ? 'Y' : '', fields.houzzId || '', fields.cost ? fields.cost : '', fields.unitCost ? fields.unitCost : ''
      ].map(csvEsc).join(','));
      return merged;
    });
    // Recompute totals
    const totalCost = newItems.reduce((s, it) => s + (num(it.cost) || (num(it.unitCost) * num(it.qty || 1)) || 0), 0);
    console.log('  ' + target.id + ': ' + items.length + ' items | enriched=' + touched + ' (img+' + addedImage + ' houzzId+' + addedHouzzId + ' cost+' + addedCost + ') | totalCost: $' + (x.totalCost || 0).toFixed(2) + ' → $' + totalCost.toFixed(2));
    updates.push({ ref: dref, items: newItems, totalCost: Math.round(totalCost * 100) / 100, target });
  }

  fs.writeFileSync(OUT_CSV, csvRows.join('\n'));
  console.log('\n  Manifest: ' + OUT_CSV);

  if (!EXECUTE) { console.log('\nDRY RUN. --execute to write.'); process.exit(0); }

  console.log('\nWRITING UPDATES...');
  for (const u of updates) {
    await updateDoc(u.ref, { items: u.items, totalCost: u.totalCost, _lineItemsEnrichedAt: new Date().toISOString() });
    console.log('  updated ' + u.target.sub + '/' + u.target.id);
  }
  console.log('\nDONE.');
  process.exit(0);
})().catch(e => { console.error('FAILED:', e); process.exit(1); });
