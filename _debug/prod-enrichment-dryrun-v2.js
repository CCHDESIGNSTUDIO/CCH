/**
 * Phase A v2 — refined dry-run with match-confidence tiers per Grok's spec.
 * READ-ONLY. Outputs a CSV (Excel-friendly) + summary markdown.
 *
 * Match tiers (in order, first wins):
 *   HIGH  — SKU exact (both Studio & Houzz have SKU, normalized match)
 *   HIGH  — Studio title exactly equals Houzz title (normalized) AND vendor matches
 *   MED   — Studio title exactly equals Houzz title (normalized), vendor differs/missing
 *   LOW   — Studio title contains Houzz title (or vice versa), length > 6
 *
 * Locked = product is referenced by ANY proposal/invoice/PO line item across all boards
 *          via the SAME fuzzy text logic Studio's UI uses (title-contains or sku-match).
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
const REPORT_MD = 'phase-A-v2-report.md';
const REPORT_CSV = 'phase-A-v2-detail.csv';

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
function csvEscape(v) {
  if (v == null) return '';
  const s = String(v);
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}
function imageStatus(u) {
  if (!u || typeof u !== 'string') return 'empty';
  if (!u.startsWith('http')) return 'invalid';
  if (/ivy-(prod|uploads)\.s3/i.test(u) || (/amazonaws\.com/i.test(u) && /X-Amz-/i.test(u))) return 'aws-expiring';
  if (/firebasestorage\.googleapis\.com/i.test(u)) return 'firebase-permanent';
  return 'retail-or-other';
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
  const catalogWithImg = catalog.filter(c => c.image1 && c.image1.startsWith('http'));
  // Indexes
  const bySku = new Map();
  const byTitle = new Map(); // normTitle -> array of catalog items (for vendor disambiguation)
  for (const c of catalogWithImg) {
    if (c.sku) { const k = norm(c.sku); if (k && !bySku.has(k)) bySku.set(k, c); }
    if (c.title) {
      const k = norm(c.title);
      if (k) { if (!byTitle.has(k)) byTitle.set(k, []); byTitle.get(k).push(c); }
    }
  }
  console.log(`  catalog with images: ${catalogWithImg.length}`);

  console.log('[2/5] Reading production /products/...');
  const app = initializeApp(PROD);
  const db = getFirestore(app);
  const psnap = await getDocs(collection(db, 'products'));
  const products = [];
  psnap.forEach(d => products.push({ _id: d.id, ...d.data() }));
  console.log(`  production products: ${products.length}`);

  console.log('[3/5] Building locked-set from boards...');
  const bsnap = await getDocs(collection(db, 'boards'));
  const boardIds = [];
  bsnap.forEach(d => boardIds.push(d.id));
  const allLineItems = [];
  let scanned = 0;
  for (const bid of boardIds) {
    for (const sub of ['proposals', 'invoices', 'purchaseOrders']) {
      try {
        const ssnap = await getDocs(collection(db, 'boards', bid, sub));
        ssnap.forEach(d => {
          const x = d.data();
          for (const f of ['items','lineItems']) {
            if (Array.isArray(x[f])) {
              for (const item of x[f]) {
                if (item && (item.title || item.name || item.description || item.sku)) {
                  allLineItems.push({
                    title: norm(item.title || item.name || item.description || ''),
                    sku: norm(item.sku || ''),
                  });
                }
              }
            }
          }
        });
      } catch {}
    }
    scanned++;
    if (scanned % 25 === 0) console.log(`  scanned ${scanned}/${boardIds.length} boards, ${allLineItems.length} line items`);
  }
  console.log(`  total line items: ${allLineItems.length}`);

  console.log('[4/5] Matching with confidence tiers + locked check...');
  const stats = { HIGH_SKU:0, HIGH_TITLE_VENDOR:0, MED_TITLE:0, LOW_CONTAINS:0, NO_MATCH:0, LOCKED:0 };
  const detail = [];

  for (const p of products) {
    const studioSku = norm(p.sku || '');
    const studioTitle = norm(p.title || p.name || '');
    const studioVendor = norm(p.vendor || p.manufacturer || '');

    let m = null; let confidence = ''; let matchHow = '';

    // HIGH: SKU exact
    if (studioSku && bySku.has(studioSku)) {
      m = bySku.get(studioSku);
      confidence = 'HIGH';
      matchHow = 'sku-exact';
      stats.HIGH_SKU++;
    } else if (studioTitle && byTitle.has(studioTitle)) {
      // Try vendor-aware: if any catalog item with same title also has matching vendor → HIGH
      const candidates = byTitle.get(studioTitle);
      const vendorMatch = candidates.find(c => {
        const cv = norm(c.supplier || c.manufacturer || '');
        return cv && studioVendor && (cv === studioVendor || cv.includes(studioVendor) || studioVendor.includes(cv));
      });
      if (vendorMatch) {
        m = vendorMatch;
        confidence = 'HIGH';
        matchHow = 'title+vendor';
        stats.HIGH_TITLE_VENDOR++;
      } else {
        m = candidates[0];
        confidence = 'MED';
        matchHow = 'title-exact';
        stats.MED_TITLE++;
      }
    } else if (studioTitle && studioTitle.length >= 6) {
      // LOW: contains
      for (const [k, arr] of byTitle) {
        if (k.length >= 6 && (studioTitle.includes(k) || k.includes(studioTitle))) {
          m = arr[0];
          confidence = 'LOW';
          matchHow = 'title-contains';
          stats.LOW_CONTAINS++;
          break;
        }
      }
    }
    if (!m) { stats.NO_MATCH++; }

    // Locked check (only matters if we'd update — but record for all)
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
    if (locked) stats.LOCKED++;

    detail.push({
      studioId: p._id,
      studioTitle: p.title || p.name || '',
      studioSku: p.sku || '',
      studioVendor: p.vendor || p.manufacturer || '',
      currentImageUrl: p.imageUrl || '',
      currentImageStatus: imageStatus(p.imageUrl),
      currentHouzzId: p.houzzId || '',
      matchConfidence: confidence || 'NO_MATCH',
      matchHow: matchHow,
      catalogHouzzId: m ? m.houzzId : '',
      catalogTitle: m ? m.title : '',
      catalogSku: m ? m.sku : '',
      catalogVendor: m ? (m.supplier || m.manufacturer || '') : '',
      newImageUrl: m ? m.image1 : '',
      locked: locked ? 'YES' : 'no',
      wouldWrite: (m && !locked) ? 'YES' : 'no',
    });
  }

  console.log('[5/5] Writing CSV + markdown report...');
  // CSV
  const cols = ['studioId','studioTitle','studioSku','studioVendor','matchConfidence','matchHow','locked','wouldWrite','currentHouzzId','catalogHouzzId','catalogTitle','catalogSku','catalogVendor','currentImageStatus','currentImageUrl','newImageUrl'];
  const csv = [cols.join(',')];
  for (const r of detail) csv.push(cols.map(c => csvEscape(r[c])).join(','));
  fs.writeFileSync(REPORT_CSV, csv.join('\n'));

  // Markdown
  const wouldWrite = detail.filter(r => r.wouldWrite === 'YES');
  const wouldWriteByConf = {
    HIGH: wouldWrite.filter(r => r.matchConfidence === 'HIGH').length,
    MED: wouldWrite.filter(r => r.matchConfidence === 'MED').length,
    LOW: wouldWrite.filter(r => r.matchConfidence === 'LOW').length,
  };
  const lines = [];
  const w = (s) => lines.push(s == null ? '' : s);
  w('# Phase A v2 — Production Enrichment Dry-Run');
  w('');
  w('**Mode:** READ-ONLY. No writes. Detail CSV alongside this file.');
  w(`**Run:** ${new Date().toISOString()} · ${((Date.now()-start)/1000).toFixed(1)}s`);
  w('');
  w('## Match counts (priority order — first match wins per product)');
  w('');
  w('| Tier | Method | Count |');
  w('|---|---|--:|');
  w(`| HIGH | SKU exact match | ${stats.HIGH_SKU} |`);
  w(`| HIGH | Title-exact AND vendor matches | ${stats.HIGH_TITLE_VENDOR} |`);
  w(`| MED  | Title-exact, vendor differs/missing | ${stats.MED_TITLE} |`);
  w(`| LOW  | Title-contains (substring) | ${stats.LOW_CONTAINS} |`);
  w(`| —    | No match in Houzz catalog | ${stats.NO_MATCH} |`);
  w('');
  w(`**Total products:** ${products.length}`);
  w(`**Total matched:** ${stats.HIGH_SKU + stats.HIGH_TITLE_VENDOR + stats.MED_TITLE + stats.LOW_CONTAINS}`);
  w(`**Locked (referenced on a doc line item — would skip):** ${stats.LOCKED} (note: undercounted — top-level /invoices not scanned)`);
  w('');
  w('## Would-write summary (matched + not locked)');
  w('');
  w(`| Confidence | Would write |`);
  w(`|---|--:|`);
  w(`| HIGH | ${wouldWriteByConf.HIGH} |`);
  w(`| MED | ${wouldWriteByConf.MED} |`);
  w(`| LOW | ${wouldWriteByConf.LOW} |`);
  w(`| **Total** | **${wouldWrite.length}** |`);
  w('');
  w('## Image URL situation (current state across all 6,165)');
  w('');
  const imgStat = {};
  for (const r of detail) imgStat[r.currentImageStatus] = (imgStat[r.currentImageStatus] || 0) + 1;
  w('| Current imageUrl status | Count |');
  w('|---|--:|');
  for (const [k,v] of Object.entries(imgStat).sort((a,b) => b[1]-a[1])) w(`| ${k} | ${v} |`);
  w('');
  w('**`aws-expiring`** = AWS pre-signed URL from old Houzz exports → already broken or breaks May 25. **`firebase-permanent`** + **`retail-or-other`** = working durable URLs (won\'t change unless you ask).');
  w('');
  w('## What the production write would do (per matched + unlocked product)');
  w('');
  w('1. Set field `houzzId` = catalog `id` (e.g. `33490311`).');
  w('2. Set field `imageUrl` = catalog `image1` URL (currently AWS, would be Firebase-permanent if we re-host first).');
  w('3. Touch nothing else: title, sku, vendor, cost, prices, document references all preserved.');
  w('');
  w('## Stop here. Review the CSV. Then say go/no-go.');
  w('');
  w(`Detail CSV: \`phase-A-v2-detail.csv\` — ${detail.length} rows, sortable by confidence column.`);
  fs.writeFileSync(REPORT_MD, lines.join('\n'));

  console.log(`\nWrote ${REPORT_MD} and ${REPORT_CSV} (${detail.length} rows).`);
  console.log(`\nWould-write summary: HIGH=${wouldWriteByConf.HIGH}  MED=${wouldWriteByConf.MED}  LOW=${wouldWriteByConf.LOW}  TOTAL=${wouldWrite.length}`);
  console.log(`Locked: ${stats.LOCKED}  No-match: ${stats.NO_MATCH}`);
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
