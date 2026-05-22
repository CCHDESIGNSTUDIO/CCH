#!/usr/bin/env node
/**
 * CCH Studio — Houzz Data Import
 * Merges: Houzz transaction XLS + scraped image map → Firestore
 *
 * Export shapes (Houzz has changed over time — both exist in the wild):
 *   - Legacy: "All Transactions" .xlsx — includes Transaction Type; filter PO rows by type Purchase Order.
 *   - New Houzz: "Outgoing Transactions" / PO-oriented reports — often no Transaction Type; PO- rows with
 *     Project Name, Total, Balance, Paid payments (text), Shipping. Same paid math as houzzMoneyCell + balance.
 *   Project labels and PO # strings may not match Studio character-for-character; the web app merge adds
 *   extra project + PO key variants (see index.html chParseHouzzTxnPurchaseOrderRows / houzzPoMergeLookupKeys).
 *
 * Targets:
 *   1. boards/{projectId}/clips — room board items with images
 *   2. boards/{projectId}/invoices — invoice docs with line items
 *   3. boards/{projectId}/proposals — proposal docs with line items
 *   4. boards/{projectId}/purchaseOrders — PO docs
 *   5. products — company product library (deduplicated)
 */

const XLSX = require('xlsx');
const fs = require('fs');
const https = require('https');
const path = require('path');

// ── CONFIG ──
const PROJECT_ID = 'cch-design-boards';
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
// Latest full transaction export (see HOUZZ-DATA-README.md). Override without editing:
//   set HOUZZ_ALL_TXN_XLSX=C:\path\to\your\all transactions.xlsx
const XLS_PATH =
  process.env.HOUZZ_ALL_TXN_XLSX ||
  'C:/Users/cindy/Dropbox/Claude - CCH studio/Houzz FILES/Houzz reports-2870-02-24-2026-15-11-49-044 all transactions.xlsx';
const IMAGE_MAP_PATH = 'C:/Users/cindy/Dropbox/Claude - CCH studio/extracted_images/houzz_image_map.json';
const IMAGE_BASE_DIR = 'C:/Users/cindy/Dropbox/Claude - CCH studio/extracted_images';
const STORAGE_BUCKET = 'cch-design-boards.firebasestorage.app';

// Rate limiting
const BATCH_SIZE = 20;
const BATCH_DELAY_MS = 500;

// ── FIRESTORE REST HELPERS ──
function toFirestoreValue(val) {
  if (val === null || val === undefined) return { nullValue: 'NULL_VALUE' };
  if (typeof val === 'number') {
    if (Number.isInteger(val)) return { integerValue: String(val) };
    return { doubleValue: val };
  }
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'string') return { stringValue: val };
  if (Array.isArray(val)) return { arrayValue: { values: val.map(toFirestoreValue) } };
  if (typeof val === 'object') {
    const fields = {};
    for (const k of Object.keys(val)) fields[k] = toFirestoreValue(val[k]);
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

function buildFirestoreDoc(obj) {
  const fields = {};
  for (const k of Object.keys(obj)) {
    if (obj[k] !== undefined) fields[k] = toFirestoreValue(obj[k]);
  }
  return { fields };
}

function firestoreRequest(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(FIRESTORE_BASE + urlPath);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: method,
      headers: { 'Content-Type': 'application/json' }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { resolve(data); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function createDoc(collection, docId, data) {
  const urlPath = `/${collection}${docId ? '/' + docId : ''}`;
  if (docId) {
    // PATCH (upsert)
    const mask = Object.keys(data).map(k => `updateMask.fieldPaths=${k}`).join('&');
    const patchUrl = `/${collection}/${docId}?${mask}`;
    return firestoreRequest('PATCH', patchUrl, buildFirestoreDoc(data));
  } else {
    // POST (auto-id)
    return firestoreRequest('POST', `/${collection}`, buildFirestoreDoc(data));
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── SLUG HELPERS ──
function slugify(name) {
  return (name || '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 60);
}

/** Parse Houzz "Payments" cell (number, $ string, or first dollar amount in text). */
function houzzMoneyCell(v) {
  if (v === null || v === undefined || v === '') return NaN;
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  const s = String(v).replace(/[$,\s]/g, '').trim();
  const m = s.match(/-?\d+\.?\d*/);
  if (!m) return NaN;
  const n = parseFloat(m[0]);
  return Number.isNaN(n) ? NaN : n;
}

/**
 * Paid amount for a PO row from the All Transactions / Outgoing report.
 * When Balance ~0, paid = line Total + Shipping (Paid payments text may omit freight).
 * Otherwise: first $ in Payments / Paid payments (capped at order total), or total − balance.
 */
function houzzPoPaidAmountFromTxn(po) {
  const total = (parseFloat(po.amount) || 0) + (parseFloat(po.shipping) || 0);
  const bal = houzzMoneyCell(po.balance);
  if (!Number.isNaN(bal) && total > 0 && bal <= 0.02) {
    return Math.round(total * 100) / 100;
  }
  const paidFromCell = houzzMoneyCell(po.payments);
  if (!Number.isNaN(paidFromCell) && paidFromCell > 0) {
    return total > 0 ? Math.min(total, paidFromCell) : paidFromCell;
  }
  if (!Number.isNaN(bal) && total > 0) {
    const fromBal = total - bal;
    if (fromBal >= 0 && fromBal <= total + 0.01) return Math.round(fromBal * 100) / 100;
  }
  return 0;
}

// Project name → Firestore board ID mapping
function projectNameToId(name) {
  const n = (name || '').trim();
  // Common mappings from Houzz project names to Firestore board IDs
  return slugify(n);
}

// ── MAIN IMPORT ──
async function main() {
  console.log('╔══════════════════════════════════════╗');
  console.log('║  CCH Studio — Houzz Data Import      ║');
  console.log('╚══════════════════════════════════════╝');
  console.log();

  // 1. Load XLS transactions
  console.log('[1/4] Loading transaction XLS...');
  const wb = XLSX.readFile(XLS_PATH);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json(ws, { header: 1 });

  // Headers at row 4 (0-indexed)
  const headers = raw[4];
  console.log('  Headers:', headers.filter(Boolean).join(', '));

  // Parse data rows (starting at row 5)
  const transactions = [];
  for (let i = 5; i < raw.length; i++) {
    const row = raw[i];
    if (!row || !row[2]) continue;

    const project = (row[0] || '').toString().trim();
    const code = (row[2] || '').toString().trim();
    const desc = (row[4] || '').toString().trim();
    const date = (row[5] || row[3] || '').toString().trim();
    const type = (row[7] || '').toString().trim().toLowerCase();
    const address = (row[8] || '').toString().replace(/\r\n/g, ', ').trim();
    const status = (row[9] || '').toString().trim();
    const amount = parseFloat(row[10]) || 0;
    const markup = row[11] !== '-' ? (parseFloat(row[11]) || 0) : 0;
    const taxableAmt = parseFloat(row[12]) || 0;
    const taxRate = parseFloat((row[14] || '').toString().replace('%', '')) || 0;
    const taxAmt = parseFloat(row[15]) || 0;
    const shipping = parseFloat(row[16]) || 0;
    const shippingMarkup = parseFloat(row[17]) || 0;
    const payments = row[21];
    const balance = parseFloat(row[22]) || 0;
    const connectedDocs = (row[23] || '').toString().replace(/\r\n/g, ', ').trim();
    const createdBy = (row[24] || '').toString().trim();
    const qbDocId = row[25] ? String(row[25]) : '';

    transactions.push({
      project, code, desc, date, type, address, status,
      amount, markup, taxableAmt, taxRate, taxAmt, shipping, shippingMarkup,
      payments, balance, connectedDocs, createdBy, qbDocId
    });
  }
  console.log(`  Loaded ${transactions.length} transactions from ${new Set(transactions.map(t => t.project)).size} projects`);

  // 2. Load image map
  console.log('[2/4] Loading image map...');
  const imageMap = JSON.parse(fs.readFileSync(IMAGE_MAP_PATH, 'utf8'));
  console.log(`  ${imageMap.length} products, ${imageMap.filter(i => i.hasThumbnail).length} with images`);

  // Build lookup by title+vendor for matching
  const imageLookup = {};
  imageMap.forEach(img => {
    const key = (img.title || '').toLowerCase().trim();
    if (key) imageLookup[key] = img;
    // Also index by first 30 chars for fuzzy match
    const short = key.substring(0, 30);
    if (short && !imageLookup[short]) imageLookup[short] = img;
  });

  // 3. Group transactions by project
  console.log('[3/4] Organizing by project...');
  const byProject = {};
  transactions.forEach(t => {
    if (!byProject[t.project]) byProject[t.project] = [];
    byProject[t.project].push(t);
  });

  const projectNames = Object.keys(byProject).sort();
  console.log(`  ${projectNames.length} projects to process`);

  // 4. Push to Firestore
  console.log('[4/4] Pushing to Firestore...');
  console.log();

  let totalClips = 0, totalInvoices = 0, totalProposals = 0, totalPOs = 0, totalProducts = 0;
  const productLib = new Map(); // deduplicated product library

  for (const projName of projectNames) {
    const projId = projectNameToId(projName);
    if (!projId) continue;

    const txns = byProject[projName];
    const invoices = txns.filter(t => t.type === 'invoice');
    const proposals = txns.filter(t => t.type === 'proposal');
    const pos = txns.filter(t => t.type === 'purchase order');
    const retainers = txns.filter(t => t.type === 'retainer');

    process.stdout.write(`  ${projName} (${projId}): ${invoices.length}I ${proposals.length}P ${pos.length}PO ... `);

    // Ensure project board doc exists
    const clientName = projName.split(' - ')[0].trim();
    const clientAddr = txns[0] ? txns[0].address : '';

    try {
      await createDoc('boards', projId, {
        name: projName,
        clientName: clientName,
        clientAddress: clientAddr,
        houzzImport: true,
        updatedAt: new Date().toISOString()
      });
    } catch (e) {
      process.stdout.write('ERR creating board: ' + e.message + '\n');
      continue;
    }

    // ── INVOICES ──
    for (const inv of invoices) {
      const invDocId = slugify(inv.code);
      // Find matching image
      const descLow = (inv.desc || '').toLowerCase().trim();
      const img = imageLookup[descLow] || imageLookup[descLow.substring(0, 30)];

      // Calculate cost from amount and markup
      const sellPrice = inv.amount;
      const markupAmt = inv.markup;
      const cost = markupAmt > 0 ? (sellPrice - markupAmt) : sellPrice;
      const markupPct = cost > 0 && markupAmt > 0 ? Math.round((markupAmt / cost) * 100) : 0;

      const item = {
        title: inv.desc || inv.code,
        vendor: '',
        room: '',
        category: '',
        qty: 1,
        cost: Math.round(cost * 100) / 100,
        markupPct: markupPct,
        shipping: inv.shipping,
        amount: sellPrice,
        imageUrl: img ? (img.websiteLink || '') : '',
        description: inv.desc,
        shipTo: ''
      };

      // Extract vendor from connected POs
      const connPOs = (inv.connectedDocs || '').split(',').map(s => s.trim()).filter(s => s.startsWith('PO-'));
      const matchingPO = pos.find(p => connPOs.includes(p.code));
      if (matchingPO && matchingPO.address) {
        const addrParts = matchingPO.address.split(',');
        if (addrParts[0]) item.vendor = addrParts[0].trim();
      }

      // Find image from scraped data
      if (img && img.vendor) item.vendor = img.vendor;
      if (img && img.room) item.room = img.room;
      if (img && img.category) item.category = img.category;

      const invData = {
        invoiceNum: inv.code,
        number: inv.code,
        name: inv.desc || inv.code,
        status: inv.status || 'Paid',
        date: inv.date,
        createdAt: inv.date,
        total: sellPrice,
        taxRate: inv.taxRate,
        taxAmount: inv.taxAmt,
        shipping: inv.shipping,
        items: [item],
        connectedDocs: inv.connectedDocs,
        createdBy: inv.createdBy,
        qbDocId: inv.qbDocId,
        houzzImport: true,
        payments: inv.status === 'Paid' ? [{ amount: sellPrice, date: inv.date, method: 'Houzz Import' }] : []
      };

      // Link to proposal if connected
      const connPRs = (inv.connectedDocs || '').split(',').map(s => s.trim()).filter(s => s.startsWith('PR-'));
      if (connPRs.length > 0) {
        invData.linkedProposalNum = connPRs[0];
        invData.linkedProposalId = slugify(connPRs[0]);
      }

      try {
        await createDoc(`boards/${projId}/invoices`, invDocId, invData);
        totalInvoices++;
      } catch (e) {}

      // Add to product library
      if (inv.desc && inv.desc.length > 2 && !inv.desc.match(/design fee|retainer|consultation|deposit/i)) {
        const plKey = (inv.desc + '|' + (item.vendor || '')).toLowerCase();
        if (!productLib.has(plKey)) {
          productLib.set(plKey, {
            title: inv.desc,
            vendor: item.vendor || '',
            room: item.room || '',
            category: item.category || '',
            costPrice: item.cost,
            sellPrice: sellPrice,
            markupPct: markupPct,
            image: img ? (img.websiteLink || '') : '',
            imageUrl: img ? (img.websiteLink || '') : '',
            sku: img ? (img.sku || '') : '',
            description: '',
            source: 'houzz-import',
            project: projName
          });
        }
      }
    }

    // ── PROPOSALS ──
    for (const prop of proposals) {
      const propDocId = slugify(prop.code);
      const descLow = (prop.desc || '').toLowerCase().trim();
      const img = imageLookup[descLow] || imageLookup[descLow.substring(0, 30)];

      const sellPrice = prop.amount;
      const markupAmt = prop.markup;
      const cost = markupAmt > 0 ? (sellPrice - markupAmt) : sellPrice;
      const markupPct = cost > 0 && markupAmt > 0 ? Math.round((markupAmt / cost) * 100) : 0;

      const item = {
        title: prop.desc || prop.code,
        vendor: img ? (img.vendor || '') : '',
        room: img ? (img.room || '') : '',
        category: img ? (img.category || '') : '',
        qty: 1,
        cost: Math.round(cost * 100) / 100,
        markupPct: markupPct,
        shipping: prop.shipping,
        amount: sellPrice,
        imageUrl: img ? (img.websiteLink || '') : '',
        description: prop.desc,
        shipTo: ''
      };

      const propData = {
        proposalNum: prop.code,
        number: prop.code,
        name: prop.desc || prop.code,
        status: prop.status === 'Invoiced' ? 'Approved' : (prop.status || 'Draft'),
        date: prop.date,
        createdAt: prop.date,
        total: sellPrice,
        taxRate: prop.taxRate,
        items: [item],
        connectedDocs: prop.connectedDocs,
        createdBy: prop.createdBy,
        houzzImport: true
      };

      // Link to invoice if connected
      const connINs = (prop.connectedDocs || '').split(',').map(s => s.trim()).filter(s => s.startsWith('IN-'));
      if (connINs.length > 0) {
        propData.linkedInvoiceId = slugify(connINs[0]);
        propData.linkedInvoiceNum = connINs[0];
      }

      try {
        await createDoc(`boards/${projId}/proposals`, propDocId, propData);
        totalProposals++;
      } catch (e) {}
    }

    // ── PURCHASE ORDERS ──
    for (const po of pos) {
      const poDocId = slugify(po.code);
      const descLow = (po.desc || '').toLowerCase().trim();
      const img = imageLookup[descLow] || imageLookup[descLow.substring(0, 30)];

      // Extract vendor from address
      const addrLines = (po.address || '').split(',');
      const vendor = addrLines[0] ? addrLines[0].trim() : '';

      const item = {
        title: po.desc || po.code,
        vendor: vendor,
        room: img ? (img.room || '') : '',
        category: img ? (img.category || '') : '',
        qty: 1,
        cost: po.amount,
        markupPct: 0,
        shipping: po.shipping,
        amount: po.amount,
        imageUrl: img ? (img.websiteLink || '') : '',
        description: po.desc,
        expenseType: 'product'
      };

      const poTotal = po.amount + po.shipping;
      const paidAmt = houzzPoPaidAmountFromTxn(po);
      const poData = {
        number: po.code,
        name: po.desc || po.code,
        vendor: vendor,
        status: po.status || 'Ordered',
        date: po.date,
        createdAt: po.date,
        total: poTotal,
        paidAmount: paidAmt,
        payments: paidAmt > 0 ? [{ amount: paidAmt, date: po.date, method: 'Houzz transaction report' }] : [],
        houzzBalance: po.balance,
        items: [item],
        connectedDocs: po.connectedDocs,
        createdBy: po.createdBy,
        qbDocId: po.qbDocId,
        houzzImport: true
      };

      try {
        await createDoc(`boards/${projId}/purchaseOrders`, poDocId, poData);
        totalPOs++;
      } catch (e) {}
    }

    // ── CLIPS (from image map for this project) ──
    const projImages = imageMap.filter(img => {
      const imgProjSlug = (img.projectId || '').toLowerCase();
      return imgProjSlug === projId || projName.toLowerCase().includes(imgProjSlug.replace(/-/g, ' '));
    });

    for (const img of projImages) {
      const clipId = slugify((img.title || '').substring(0, 40) + '-' + (img.vendor || '').substring(0, 20));
      if (!clipId) continue;

      // Check if we have a local image file
      let localImagePath = '';
      if (img.projectId) {
        const imgDir = path.join(IMAGE_BASE_DIR, img.projectId);
        if (img.imageFilename) {
          // Find the matching numbered file
          try {
            const files = fs.readdirSync(imgDir);
            const match = files.find(f => f.includes(img.imageFilename) || f.includes(slugify(img.title || '')));
            if (match) localImagePath = path.join(imgDir, match);
          } catch (e) {}
        }
      }

      const clipData = {
        title: (img.title || '').replace(/\n/g, ' ').trim(),
        vendor: img.vendor || '',
        room: img.room || '',
        category: img.category || '',
        websiteLink: img.websiteLink || '',
        sku: img.sku || '',
        imageUrl: img.websiteLink || '', // Will be updated with Storage URL after upload
        source: 'houzz-import',
        hasLocalImage: !!localImagePath,
        localImagePath: localImagePath
      };

      // Try to match with transaction data for pricing
      const titleLow = (img.title || '').toLowerCase().trim();
      const matchingTxn = transactions.find(t =>
        t.project === projName &&
        (t.desc || '').toLowerCase().trim() === titleLow
      );
      if (matchingTxn) {
        clipData.cost = matchingTxn.amount - (matchingTxn.markup || 0);
        clipData.totalSelling = matchingTxn.amount;
        clipData.clientPrice = matchingTxn.amount;
        clipData.markupPct = clipData.cost > 0 ? Math.round((matchingTxn.markup / clipData.cost) * 100) : 0;
        clipData.invoiceNum = matchingTxn.code.startsWith('IN-') ? matchingTxn.code : '';
        clipData.proposalNum = matchingTxn.code.startsWith('PR-') ? matchingTxn.code : '';
        clipData.poNum = matchingTxn.code.startsWith('PO-') ? matchingTxn.code : '';
      }

      try {
        await createDoc(`boards/${projId}/clips`, clipId, clipData);
        totalClips++;
      } catch (e) {}
    }

    process.stdout.write(`OK\n`);

    // Rate limit between projects
    await sleep(BATCH_DELAY_MS);
  }

  // ── PRODUCT LIBRARY ──
  console.log();
  console.log('Pushing product library...');
  let plCount = 0;
  for (const [key, product] of productLib) {
    const docId = slugify(product.title.substring(0, 50));
    if (!docId) continue;
    try {
      await createDoc('products', docId, product);
      plCount++;
      if (plCount % 50 === 0) {
        process.stdout.write(`  ${plCount} products...`);
        await sleep(BATCH_DELAY_MS);
      }
    } catch (e) {}
  }
  totalProducts = plCount;

  // Also push image-map products that weren't in transactions
  console.log('  Adding image-map products...');
  for (const img of imageMap) {
    if (!img.title || img.title.length < 2) continue;
    const plKey = (img.title + '|' + (img.vendor || '')).toLowerCase();
    if (productLib.has(plKey)) continue; // already added

    const docId = slugify((img.title || '').substring(0, 50));
    if (!docId) continue;

    try {
      await createDoc('products', docId, {
        title: (img.title || '').replace(/\n/g, ' ').trim(),
        vendor: img.vendor || '',
        room: img.room || '',
        category: img.category || '',
        image: img.websiteLink || '',
        imageUrl: img.websiteLink || '',
        sku: img.sku || '',
        costPrice: 0,
        sellPrice: 0,
        source: 'houzz-image-scrape',
        project: ''
      });
      totalProducts++;
      if (totalProducts % 100 === 0) {
        process.stdout.write(`  ${totalProducts} total products...\n`);
        await sleep(BATCH_DELAY_MS);
      }
    } catch (e) {}
  }

  console.log();
  console.log('╔══════════════════════════════════════╗');
  console.log('║           IMPORT COMPLETE            ║');
  console.log('╠══════════════════════════════════════╣');
  console.log(`║  Invoices:   ${String(totalInvoices).padStart(6)}               ║`);
  console.log(`║  Proposals:  ${String(totalProposals).padStart(6)}               ║`);
  console.log(`║  POs:        ${String(totalPOs).padStart(6)}               ║`);
  console.log(`║  Clips:      ${String(totalClips).padStart(6)}               ║`);
  console.log(`║  Products:   ${String(totalProducts).padStart(6)}               ║`);
  console.log('╚══════════════════════════════════════╝');
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
