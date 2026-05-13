/**
 * READ-ONLY dry-run: predict what enriching production products with Houzz catalog data would do.
 *
 * Logic:
 *  - Read all production /products/
 *  - Read Houzz Apr 27 catalog (with images)
 *  - Match each production product to catalog via SKU (exact) -> title (exact normalized) -> title contains
 *  - For each production product, determine if it is "locked" (referenced by any proposal/invoice/PO line item)
 *    using the SAME fuzzy match logic Studio's UI uses (line 39750-39826 of index.html)
 *  - Plan: would-update = matched + not-locked + (image is broken or missing OR houzzId is missing)
 *  - Output: phase-A-dryrun-report.md with counts + samples
 *
 * No writes to anything. No staging touched in this step.
 */
const fs = require('fs');
const path = require('path');
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

const PROD = {
  apiKey: 'AIzaSyAd24U5ArVGrA24IxNcYD2NYiTVycyF4og',
  authDomain: 'cch-design-boards.firebaseapp.com',
  projectId: 'cch-design-boards',
  storageBucket: 'cch-design-boards.appspot.com',
  messagingSenderId: '210388013080',
  appId: '1:210388013080:web:cch-design-boards',
};
const CATALOG = String.raw`C:\Users\cindy\Dropbox\Claude - CCH studio\Houzz FILES\cchdesign_0427\catalog-items-with-images_cchdesign_0427.csv`;
const REPORT = 'phase-A-dryrun-report.md';

function decodeHtml(s) { return String(s||'').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>'); }
function unwrapHyperlink(c) { if(typeof c!=='string')return c; const m=c.match(/^=HYPERLINK\("([^"]+)"/i); return decodeHtml(m?m[1]:c); }
function parseCSV(text) {
  const rows=[]; let row=[]; let cur=''; let q=false;
  for (let i=0;i<text.length;i++){const c=text[i];
    if(q){if(c==='"'){if(text[i+1]==='"'){cur+='"';i++}else q=false}else cur+=c}
    else{if(c==='"')q=true;else if(c===',') {row.push(cur);cur=''}else if(c==='\r'){}else if(c==='\n'){row.push(cur);rows.push(row);row=[];cur=''}else cur+=c}
  }
  if(cur||row.length){row.push(cur);rows.push(row)}
  return rows;
}
function norm(s) { return String(s||'').toLowerCase().trim().replace(/\s+/g,' ').replace(/[^\w\s-]/g,''); }
function isWorkingImageUrl(u) {
  if (!u || typeof u !== 'string' || !u.startsWith('http')) return false;
  // AWS pre-signed URLs (Houzz) are expired/expiring -> treat as broken
  if (/ivy-(prod|uploads)\.s3/i.test(u) || (/amazonaws\.com/i.test(u) && /X-Amz-/i.test(u))) return false;
  return true;
}

(async () => {
  const start = Date.now();
  console.log('[1/5] Parsing Houzz catalog...');
  const txt = fs.readFileSync(CATALOG, 'utf-8');
  const rows = parseCSV(txt);
  const h = rows[0];
  const get = (r, n) => { const i = h.indexOf(n); return i >= 0 ? (r[i] || '').trim() : ''; };
  const catalog = rows.slice(1).filter(r => r.length > 1 && get(r, 'id')).map(r => ({
    houzzId: get(r, 'id'),
    title: get(r, 'name'),
    sku: get(r, 'sku'),
    supplier: get(r, 'supplier'),
    manufacturer: get(r, 'manufacturer'),
    image1: unwrapHyperlink(get(r, 'image1')),
  }));
  // Build indexes (only items with images for enrichment purposes)
  const catalogWithImg = catalog.filter(c => c.image1 && c.image1.startsWith('http'));
  const bySku = new Map();
  const byTitle = new Map();
  for (const c of catalogWithImg) {
    if (c.sku) { const k = norm(c.sku); if (k && !bySku.has(k)) bySku.set(k, c); }
    if (c.title) { const k = norm(c.title); if (k && !byTitle.has(k)) byTitle.set(k, c); }
  }
  console.log(`  catalog rows: ${catalog.length} (${catalogWithImg.length} with images)`);

  console.log('[2/5] Reading production /products/...');
  const app = initializeApp(PROD);
  const db = getFirestore(app);
  const psnap = await getDocs(collection(db, 'products'));
  const products = [];
  psnap.forEach(d => products.push({ _id: d.id, ...d.data() }));
  console.log(`  production products: ${products.length}`);

  console.log('[3/5] Reading all production boards + their proposals/invoices/POs to build "locked" set...');
  const bsnap = await getDocs(collection(db, 'boards'));
  const boardIds = [];
  bsnap.forEach(d => boardIds.push(d.id));
  console.log(`  boards: ${boardIds.length}`);

  // Collect every line item title and SKU from every PO/proposal/invoice across all boards.
  // Locked-product determination uses the same fuzzy logic as Studio's UI.
  const allLineItems = []; // { title, sku, sourceType, sourceBoard, sourceDocId }
  const lineItemFields = ['items', 'lineItems'];
  let lineItemDocs = 0;
  for (let bi = 0; bi < boardIds.length; bi++) {
    const bid = boardIds[bi];
    for (const sub of ['proposals', 'invoices', 'purchaseOrders']) {
      try {
        const ssnap = await getDocs(collection(db, 'boards', bid, sub));
        ssnap.forEach(d => {
          const x = d.data();
          for (const f of lineItemFields) {
            if (Array.isArray(x[f])) {
              for (const item of x[f]) {
                if (item && (item.title || item.name || item.description || item.sku)) {
                  allLineItems.push({
                    title: norm(item.title || item.name || item.description || ''),
                    sku: norm(item.sku || ''),
                  });
                  lineItemDocs++;
                }
              }
            }
          }
        });
      } catch (e) {
        // ignore subcols that don't exist
      }
    }
    if ((bi + 1) % 20 === 0) console.log(`  boards scanned: ${bi+1}/${boardIds.length}, line items so far: ${lineItemDocs}`);
  }
  // Also check the top-level /invoices collection (Studio's UI queries this for LINKED-Invoices)
  try {
    const tsnap = await getDocs(collection(db, 'invoices'));
    tsnap.forEach(d => {
      const x = d.data();
      for (const f of lineItemFields) {
        if (Array.isArray(x[f])) {
          for (const item of x[f]) {
            if (item && (item.title || item.name || item.description || item.sku)) {
              allLineItems.push({
                title: norm(item.title || item.name || item.description || ''),
                sku: norm(item.sku || ''),
              });
              lineItemDocs++;
            }
          }
        }
      }
    });
    console.log(`  top-level /invoices line items: included`);
  } catch (e) {
    console.log(`  top-level /invoices: ${e.message}`);
  }
  console.log(`  total line items collected: ${lineItemDocs}`);

  console.log('[4/5] Matching + lock-checking...');
  const stats = {
    total: products.length,
    matchedSku: 0,
    matchedTitleExact: 0,
    matchedTitleContains: 0,
    notMatched: 0,
    locked: 0,
    wouldUpdateBoth: 0,        // both houzzId + imageUrl change
    wouldUpdateHouzzIdOnly: 0, // only houzzId added (image already working)
    wouldUpdateImageOnly: 0,   // only imageUrl refreshed (had houzzId already)
    wouldNoOp: 0,              // matched but nothing to do
  };
  const samples = { wouldUpdateBoth: [], wouldUpdateHouzzIdOnly: [], wouldUpdateImageOnly: [], notMatched: [], locked: [] };
  const updateLog = [];

  for (const p of products) {
    const studioSku = norm(p.sku || '');
    const studioTitle = norm(p.title || p.name || '');
    let m = null; let how = '';
    if (studioSku && bySku.has(studioSku)) { m = bySku.get(studioSku); how = 'sku-exact'; stats.matchedSku++; }
    else if (studioTitle && byTitle.has(studioTitle)) { m = byTitle.get(studioTitle); how = 'title-exact'; stats.matchedTitleExact++; }
    else if (studioTitle && studioTitle.length >= 6) {
      // Fall back: catalog title exactly contained within studio title (rough)
      for (const [k, c] of byTitle) {
        if (k.length >= 6 && studioTitle.includes(k)) { m = c; how = 'title-contains'; stats.matchedTitleContains++; break; }
      }
    }
    if (!m) {
      stats.notMatched++;
      if (samples.notMatched.length < 10) samples.notMatched.push({ id: p._id, title: p.title, sku: p.sku });
      continue;
    }

    // Locked check: ANY line item whose title contains studio product's title (when product title is meaningful)
    //                OR whose SKU matches studio SKU
    let locked = false;
    if (studioSku) {
      for (const li of allLineItems) {
        if (li.sku && li.sku === studioSku) { locked = true; break; }
        if (studioSku.length >= 4 && li.title.includes(studioSku)) { locked = true; break; }
      }
    }
    if (!locked && studioTitle.length >= 6) {
      for (const li of allLineItems) {
        if (li.title.includes(studioTitle)) { locked = true; break; }
      }
    }
    if (locked) {
      stats.locked++;
      if (samples.locked.length < 10) samples.locked.push({ id: p._id, title: p.title, sku: p.sku, matchedHow: how });
      continue;
    }

    // Decide what would change
    const hasHouzzId = !!p.houzzId;
    const imageBroken = !isWorkingImageUrl(p.imageUrl);
    if (!hasHouzzId && imageBroken) {
      stats.wouldUpdateBoth++;
      if (samples.wouldUpdateBoth.length < 10) samples.wouldUpdateBoth.push({ id: p._id, title: p.title, sku: p.sku, how, newHouzzId: m.houzzId, newImage: m.image1.slice(0, 80) });
      updateLog.push({ id: p._id, title: p.title, fields: ['houzzId', 'imageUrl'], how, m });
    } else if (!hasHouzzId && !imageBroken) {
      stats.wouldUpdateHouzzIdOnly++;
      if (samples.wouldUpdateHouzzIdOnly.length < 10) samples.wouldUpdateHouzzIdOnly.push({ id: p._id, title: p.title, sku: p.sku, how, newHouzzId: m.houzzId });
      updateLog.push({ id: p._id, title: p.title, fields: ['houzzId'], how, m });
    } else if (hasHouzzId && imageBroken) {
      stats.wouldUpdateImageOnly++;
      if (samples.wouldUpdateImageOnly.length < 10) samples.wouldUpdateImageOnly.push({ id: p._id, title: p.title, sku: p.sku, how, newImage: m.image1.slice(0, 80) });
      updateLog.push({ id: p._id, title: p.title, fields: ['imageUrl'], how, m });
    } else {
      stats.wouldNoOp++;
    }
  }

  console.log('[5/5] Writing report...');
  const lines = [];
  const w = (s) => lines.push(s == null ? '' : s);
  w('# Phase A — Production Enrichment Dry-Run Report');
  w('');
  w('**Mode:** READ-ONLY. No writes performed anywhere.');
  w(`**Generated:** ${new Date().toISOString()}`);
  w(`**Run time:** ${((Date.now()-start)/1000).toFixed(1)}s`);
  w('');
  w('## Summary');
  w('');
  w('| Category | Count |');
  w('|---|--:|');
  w(`| Total production products | ${stats.total} |`);
  w(`| Matched by SKU (exact) | ${stats.matchedSku} |`);
  w(`| Matched by title (exact) | ${stats.matchedTitleExact} |`);
  w(`| Matched by title (contains) | ${stats.matchedTitleContains} |`);
  w(`| **Total matched to Houzz catalog** | **${stats.matchedSku + stats.matchedTitleExact + stats.matchedTitleContains}** |`);
  w(`| No match in Houzz catalog | ${stats.notMatched} |`);
  w(`| Matched but **LOCKED** (on a proposal/invoice/PO line item) — skip | ${stats.locked} |`);
  w(`| Matched + unlocked, would add **houzzId + imageUrl** (broken before) | **${stats.wouldUpdateBoth}** |`);
  w(`| Matched + unlocked, would add **houzzId only** (image already working) | ${stats.wouldUpdateHouzzIdOnly} |`);
  w(`| Matched + unlocked, would refresh **imageUrl only** (had houzzId) | ${stats.wouldUpdateImageOnly} |`);
  w(`| Matched + unlocked, no-op (already had both) | ${stats.wouldNoOp} |`);
  w('');
  const totalWould = stats.wouldUpdateBoth + stats.wouldUpdateHouzzIdOnly + stats.wouldUpdateImageOnly;
  w(`**${totalWould} production products would receive a write** if Phase B is approved. ${stats.locked} would be skipped (locked). ${stats.notMatched} have no Houzz catalog match.`);
  w('');
  w(`**Line-item corpus scanned for "locked" check:** ${lineItemDocs} line items across ${boardIds.length} boards + top-level /invoices.`);
  w('');
  w('## Sample: would update both houzzId + imageUrl (image broken before)');
  w('');
  for (const s of samples.wouldUpdateBoth) {
    w(`- \`${s.id}\` "${s.title}" (sku: ${s.sku||'∅'}, match: ${s.how}) → houzzId=${s.newHouzzId}, image=${s.newImage}…`);
  }
  w('');
  w('## Sample: would add houzzId only (image already working)');
  w('');
  for (const s of samples.wouldUpdateHouzzIdOnly) {
    w(`- \`${s.id}\` "${s.title}" (sku: ${s.sku||'∅'}, match: ${s.how}) → houzzId=${s.newHouzzId}`);
  }
  w('');
  w('## Sample: would refresh imageUrl only');
  w('');
  for (const s of samples.wouldUpdateImageOnly) {
    w(`- \`${s.id}\` "${s.title}" (sku: ${s.sku||'∅'}, match: ${s.how}) → image=${s.newImage}…`);
  }
  w('');
  w('## Sample: locked products (skipped because referenced on a doc)');
  w('');
  for (const s of samples.locked) {
    w(`- \`${s.id}\` "${s.title}" (sku: ${s.sku||'∅'}) — matched to Houzz by ${s.matchedHow}, but skipped`);
  }
  w('');
  w('## Sample: no Houzz catalog match');
  w('');
  for (const s of samples.notMatched) {
    w(`- \`${s.id}\` "${s.title}" (sku: ${s.sku||'∅'})`);
  }
  w('');
  w('---');
  w('');
  w('## What this report does NOT do');
  w('');
  w('- No writes happened. Nothing in production or staging changed.');
  w('- The exact list of every planned update has been written alongside this report as `phase-A-dryrun-updates.json` for inspection.');
  w('- If counts look right, Phase B = mirror to staging /products/ + apply enrichment + verify visually. Then Phase C = same against production.');

  fs.writeFileSync(REPORT, lines.join('\n'));
  fs.writeFileSync('phase-A-dryrun-updates.json', JSON.stringify(updateLog.map(u => ({
    studioId: u.id,
    studioTitle: u.title,
    fieldsToChange: u.fields,
    matchHow: u.how,
    catalogHouzzId: u.m.houzzId,
    catalogTitle: u.m.title,
    catalogImage1: u.m.image1,
  })), null, 2));
  console.log(`\nReport: ${REPORT}`);
  console.log(`Detail JSON: phase-A-dryrun-updates.json (${updateLog.length} planned updates)`);
  process.exit(0);
})().catch(e => { console.error('FAILED:', e); process.exit(1); });
