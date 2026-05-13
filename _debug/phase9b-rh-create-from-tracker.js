/**
 * PHASE 9B — Create missing Rolling Hills docs from project tracker XLSX.
 * Default DRY RUN. --execute to write.
 *
 * Source: project_tracker_report-2870-04-22-2026-12-22-11-342 Cloud RH.xlsx
 * Target: boards/cloud-rolling-hills/{invoices,proposals}/<docId>
 *
 * For each missing PR/IN, builds:
 *   - number, status, date, total, totalSelling, totalCost (derived from line items)
 *   - items[] array (one entry per tracker row)
 *   - vendor (most-frequent across line items)
 *   - source = 'houzz-tracker-import-may3'
 *   - marker _createdFromHouzzTrackerMay3
 *   - qbId from houzz_qb_ids.json if present
 */
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, doc, setDoc, getDocs, writeBatch } = require('firebase/firestore');

const PROD = {
  apiKey: 'AIzaSyAd24U5ArVGrA24IxNcYD2NYiTVycyF4og',
  authDomain: 'cch-design-boards.firebaseapp.com',
  projectId: 'cch-design-boards',
  storageBucket: 'cch-design-boards.firebasestorage.app',
  messagingSenderId: '210388013080',
  appId: '1:210388013080:web:cch-design-boards',
};
const TRACKER = String.raw`C:\Users\cindy\Dropbox\Claude - CCH studio\Houzz FILES\ARCHIVE\project_tracker_report-2870-04-22-2026-12-22-11-342 Cloud RH.xlsx`;
const QB_IDS = path.join(__dirname, '..', 'platform', 'houzz_qb_ids.json');
const BOARD_ID = 'cloud-rolling-hills';
const OUT_CSV = path.join(__dirname, 'phase9b-create-manifest.csv');
const EXECUTE = process.argv.includes('--execute');

function csvEsc(v) { if (v == null) return ''; const s = String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
function normNum(s, prefix) { const m = String(s||'').trim().toUpperCase().match(new RegExp('(' + prefix + ')[\\s-]?(\\d+)')); return m ? m[1] + '-' + m[2] : ''; }
function num(v) { const n = parseFloat(v); return isFinite(n) ? n : 0; }
function parseHouzzDate(s) {
  if (!s) return '';
  const m = String(s).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return m[3] + '-' + m[1].padStart(2, '0') + '-' + m[2].padStart(2, '0');
  return String(s).trim();
}
function pickStatus(s) {
  if (!s) return '';
  const m = String(s).match(/-\s*([A-Za-z][A-Za-z\s]*)$/);
  return m ? m[1].trim() : String(s).trim();
}

(async () => {
  console.log('PHASE 9B — RH create-missing from tracker  (' + (EXECUTE ? 'EXECUTE' : 'DRY RUN') + ')\n');

  // QB ID lookup
  const qbIds = JSON.parse(fs.readFileSync(QB_IDS, 'utf-8'));

  // Read tracker
  const wb = XLSX.readFile(TRACKER);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  const h = rows[0];
  const I = (n) => h.findIndex(c => String(c).toLowerCase().trim() === n.toLowerCase());
  const cols = {
    proj: I('Project Name'), category: I('Category'), title: I('Title'),
    propRaw: I('Proposal'), propDate: I('Proposal Date'),
    invRaw: I('Invoice'), invDate: I('Invoice Date'),
    poRaw: I('Purchase Order'), poDate: I('Purchase Order Date'),
    image: I('Image'), room: I('Room'),
    clientDesc: I('Client Description'), vendor: I('Vendor'), vendorDesc: I('Vendor Description'),
    materials: I('Materials'), finish: I('Finish/Color'), status: I('Status'), sku: I('SKU'),
    qty: I('Selling Quantity'), unitPrice: I('Unit Selling Price'),
    markupPct: I('Markup %'), markupVal: I('Markup Value'), totalSell: I('Total Selling Price'),
    taxable: I('Taxable Item'), clientTax: I('Client Tax'), vendorTax: I('Vendor Tax'),
    purchaseQty: I('Purchase Quantity'), unitCost: I('Unit Purchase Cost'), totalCost: I('Total Purchase Cost'),
    shipPC: I('Shipping Purchase Cost'), shipSP: I('Shipping Selling Price'),
  };

  // Group rows by doc number
  const byInv = new Map(), byProp = new Map();
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const propNum = normNum(r[cols.propRaw], 'PR');
    const invNum = normNum(r[cols.invRaw], 'IN');
    const item = {
      title: String(r[cols.title] || '').trim(),
      sku: String(r[cols.sku] || '').trim(),
      vendor: String(r[cols.vendor] || '').trim(),
      category: String(r[cols.category] || '').trim(),
      room: String(r[cols.room] || '').trim(),
      qty: num(r[cols.qty]) || 1,
      unitCost: num(r[cols.unitCost]),
      cost: num(r[cols.totalCost]),
      unitSelling: num(r[cols.unitPrice]),
      markupPct: num(r[cols.markupPct]),
      markupValue: num(r[cols.markupVal]),
      totalSelling: num(r[cols.totalSell]),
      clientTax: num(r[cols.clientTax]),
      shippingCost: num(r[cols.shipPC]),
      shippingSelling: num(r[cols.shipSP]),
      taxable: String(r[cols.taxable] || '').trim().toLowerCase() === 'taxable',
      clientDescription: String(r[cols.clientDesc] || '').trim(),
      vendorDescription: String(r[cols.vendorDesc] || '').trim(),
      materials: String(r[cols.materials] || '').trim(),
      finish: String(r[cols.finish] || '').trim(),
      imageFilename: String(r[cols.image] || '').trim(),
      status: pickStatus(r[cols.invRaw] || r[cols.propRaw]),
      _trackerRowProposal: propNum,
      _trackerRowInvoice: invNum,
      _trackerRowDate: parseHouzzDate(r[cols.invDate] || r[cols.propDate]),
    };
    if (invNum) {
      if (!byInv.has(invNum)) byInv.set(invNum, []);
      byInv.get(invNum).push(item);
    }
    if (propNum) {
      if (!byProp.has(propNum)) byProp.set(propNum, []);
      byProp.get(propNum).push(item);
    }
  }

  // Read existing Studio docs
  const app = initializeApp(PROD);
  const db = getFirestore(app);
  const studioInv = new Set(), studioPR = new Set();
  for (const [sub, prefix, set] of [['invoices','IN',studioInv],['proposals','PR',studioPR]]) {
    const snap = await getDocs(collection(db, 'boards', BOARD_ID, sub));
    snap.forEach(d => {
      const x = d.data();
      const n = normNum(x.number || x.invoiceNum || x.proposalNum || d.id, prefix);
      if (n) set.add(n);
    });
  }

  // Build clip lookup so new line items inherit houzzId + Firebase imageUrl from existing clips.
  // Match priority: SKU first, then normalized title.
  const clipsSnap = await getDocs(collection(db, 'boards', BOARD_ID, 'clips'));
  function normTitle(s) { return String(s||'').toLowerCase().trim().replace(/\s+/g,' ').replace(/[^\w\s-]/g,''); }
  function normSku(s) { return String(s||'').toLowerCase().trim().replace(/\s+/g,''); }
  const clipBySku = new Map(), clipByTitle = new Map();
  clipsSnap.forEach(d => {
    const c = { docId: d.id, ...d.data() };
    const sku = normSku(c.sku);
    const t = normTitle(c.title || c.name);
    if (sku && !clipBySku.has(sku)) clipBySku.set(sku, c);
    if (t && t.length >= 3 && !clipByTitle.has(t)) clipByTitle.set(t, c);
  });
  function matchClip(item) {
    const sku = normSku(item.sku);
    if (sku && clipBySku.has(sku)) return clipBySku.get(sku);
    const t = normTitle(item.title);
    if (t && clipByTitle.has(t)) return clipByTitle.get(t);
    return null;
  }
  console.log('  Loaded ' + clipsSnap.size + ' RH clips for line-item enrichment lookup');

  // Build creates for missing
  function buildDoc(num, items, kind) {
    const totalSelling = items.reduce((s, it) => s + (it.totalSelling || 0), 0);
    const totalCost = items.reduce((s, it) => s + (it.cost || 0), 0);
    const shippingCost = items.reduce((s, it) => s + (it.shippingCost || 0), 0);
    const shippingSelling = items.reduce((s, it) => s + (it.shippingSelling || 0), 0);
    const clientTax = items.reduce((s, it) => s + (it.clientTax || 0), 0);
    const total = totalSelling + shippingSelling + clientTax;
    // Most common vendor
    const vendorCount = {};
    items.forEach(i => { if (i.vendor) vendorCount[i.vendor] = (vendorCount[i.vendor] || 0) + 1; });
    const topVendor = Object.entries(vendorCount).sort((a,b) => b[1]-a[1]).map(e => e[0])[0] || '';
    const status = items[0].status || '';
    const dateStr = items[0]._trackerRowDate || '';
    const qbId = qbIds[num] || '';
    return {
      number: num,
      [kind === 'invoice' ? 'invoiceNum' : 'proposalNum']: num,
      status: status,
      total: Math.round(total * 100) / 100,
      totalSelling: Math.round(totalSelling * 100) / 100,
      totalCost: Math.round(totalCost * 100) / 100,
      shippingCost: Math.round(shippingCost * 100) / 100,
      shippingSelling: Math.round(shippingSelling * 100) / 100,
      clientTax: Math.round(clientTax * 100) / 100,
      paidAmount: /paid/i.test(status) ? Math.round(total * 100) / 100 : 0,
      invoiceBalance: /paid/i.test(status) ? 0 : Math.round(total * 100) / 100,
      vendor: topVendor,
      date: dateStr,
      items: items.map(it => {
        // Enrich with existing clip data: houzzId, Firebase Storage imageUrl, libraryProductId
        const clip = matchClip(it);
        return {
          title: it.title, sku: it.sku, vendor: it.vendor, category: it.category, room: it.room,
          qty: it.qty, unitCost: it.unitCost, cost: it.cost,
          unitPrice: it.unitSelling, clientPrice: it.unitSelling, totalSelling: it.totalSelling,
          markup: it.markupPct, markupValue: it.markupValue,
          clientTax: it.clientTax, shippingCost: it.shippingCost, shippingSelling: it.shippingSelling,
          clientDescription: it.clientDescription, vendorDescription: it.vendorDescription,
          materials: it.materials, finish: it.finish,
          imageFilename: it.imageFilename,
          taxable: it.taxable,
          // From matched clip: keep image + houzzId in sync with what user already curated.
          imageUrl: clip ? (clip.imageUrl || '') : '',
          houzzId: clip ? String(clip.houzzId || clip.houzzProductId || '').trim() : '',
          libraryProductId: clip ? clip.docId : '',
          _matchedClipId: clip ? clip.docId : '',
        };
      }),
      qbId: qbId,
      source: 'houzz-tracker-import-may3',
      _createdFromHouzzTrackerMay3: new Date().toISOString(),
      createdAt: (function() { try { const d = dateStr ? new Date(dateStr) : new Date(); return isFinite(d.getTime()) ? d.toISOString() : new Date().toISOString(); } catch(_e) { return new Date().toISOString(); } })(),
      updatedAt: new Date().toISOString(),
    };
  }

  const plannedCreates = [];
  for (const [num, items] of byInv) {
    if (studioInv.has(num)) continue;
    plannedCreates.push({ kind: 'invoice', sub: 'invoices', docId: num, num, lineCount: items.length, doc: buildDoc(num, items, 'invoice') });
  }
  for (const [num, items] of byProp) {
    if (studioPR.has(num)) continue;
    plannedCreates.push({ kind: 'proposal', sub: 'proposals', docId: num, num, lineCount: items.length, doc: buildDoc(num, items, 'proposal') });
  }

  console.log('--- Plan ---');
  console.log('  Will create: ' + plannedCreates.length + ' docs');
  for (const p of plannedCreates) {
    console.log('  ' + p.kind.padEnd(9) + ' ' + p.num.padEnd(12) + '  lines=' + String(p.lineCount).padStart(3) +
      '  total=$' + p.doc.total.toFixed(2).padStart(10) + '  vendor=' + (p.doc.vendor.slice(0, 25) || '(mixed)') +
      '  status=' + p.doc.status + '  qbId=' + (p.doc.qbId || '-'));
  }

  // Manifest
  const csv = ['kind,number,docId,lineCount,total,totalSelling,totalCost,paidAmount,vendor,status,date,qbId'];
  for (const p of plannedCreates) {
    const d = p.doc;
    csv.push([p.kind, p.num, p.docId, p.lineCount, d.total, d.totalSelling, d.totalCost, d.paidAmount, d.vendor, d.status, d.date, d.qbId].map(csvEsc).join(','));
  }
  fs.writeFileSync(OUT_CSV, csv.join('\n'));
  console.log('\n  Manifest: ' + OUT_CSV);

  if (!EXECUTE) { console.log('\nDRY RUN. --execute to write.'); process.exit(0); }

  console.log('\nCREATING DOCS IN PRODUCTION...');
  // Use docId = the PO/IN/PR number for predictable IDs
  for (const p of plannedCreates) {
    await setDoc(doc(db, 'boards', BOARD_ID, p.sub, p.docId), p.doc);
    console.log('  created ' + p.sub + '/' + p.docId);
  }
  console.log('\nDONE. ' + plannedCreates.length + ' docs created.');
  process.exit(0);
})().catch(e => { console.error('FAILED:', e); process.exit(1); });
