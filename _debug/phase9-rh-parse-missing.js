/**
 * PHASE 9 — Parse Houzz master file (cchdesign_0427.csv) for Rolling Hills missing docs.
 *
 * Source-of-truth tables in the master CSV:
 *   - Invoices header   (signature: INVOICE_NUMBER,CREATED_AT,INVOICE_TYPE,CLIENT_NAME)
 *   - Invoice line items (signature: INVOICE_NUMBER,TITLE,DESCRIPTION,QUANTITY)
 *   - Documents          (signature: DOCUMENT_NUMBER,NAME,CREATED_AT,TYPE,PROJECT_NAME)
 *   - POs header         (signature: PURCHASE_ORDER_NUMBER,CREATED_AT,NAME,LAST_UPDATED)
 *   - PO line items      (signature: PURCHASE_ORDER_NUMBER,IMAGE_NAME,TITLE,DESCRIPTION)
 *
 * Filters to PROJECT_NAME = "Cloud - Rolling Hills", joins line items to headers,
 * compares to Studio boards/cloud-rolling-hills/{invoices,proposals,purchaseOrders},
 * outputs dry-run manifest of missing docs.
 *
 * NO writes. Read-only analysis.
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
const MASTER = String.raw`C:\Users\cindy\Dropbox\Claude - CCH studio\Houzz FILES\cchdesign_0427_original\cchdesign_0427.csv`;
const BOARD_NAME_TARGET = 'cloud - rolling hills';
const BOARD_ID = 'cloud-rolling-hills';
const OUT_CSV = path.join(__dirname, 'phase9-rh-missing-manifest.csv');

function parseCSV(text) {
  const rows = []; let row = []; let cur = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i+1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else { if (c === '"') q = true;
      else if (c === ',') { row.push(cur); cur = ''; }
      else if (c === '\r') { /* skip */ }
      else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
      else cur += c; }
  }
  if (cur.length || row.length) { row.push(cur); rows.push(row); }
  return rows;
}
function csvEsc(v) { if (v == null) return ''; const s = String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }

function findSection(rows, headerSig) {
  // headerSig: array of column names that must all be present in the row to qualify
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length < headerSig.length) continue;
    const lower = r.map(c => String(c).trim().toLowerCase());
    if (headerSig.every(s => lower.indexOf(s.toLowerCase()) >= 0)) {
      return { startRow: i, header: r };
    }
  }
  return null;
}

function extractSection(rows, startRow, header) {
  // Take rows after `startRow` until we hit a row that looks like a different header
  // (>=3 non-empty fields and matches header signatures of OTHER sections) or a sequence of empty rows.
  const out = [];
  const colCount = header.length;
  const stopHeaders = [
    'INVOICE_NUMBER', 'PURCHASE_ORDER_NUMBER', 'DOCUMENT_NUMBER',
    'PROFESSIONAL NAME', 'PRODUCT NAME', 'NAME', 'PROJECT_NAME',
  ];
  let emptyStreak = 0;
  for (let i = startRow + 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.every(c => String(c).trim() === '')) {
      emptyStreak++;
      if (emptyStreak >= 2) break;
      continue;
    }
    emptyStreak = 0;
    // Check if this looks like a NEW header row — first cell is one of our known headers
    const firstCell = String(r[0] || '').trim();
    if (stopHeaders.indexOf(firstCell) >= 0 && firstCell !== header[0]) break;
    out.push(r);
  }
  return out;
}

function rowToObj(header, row) {
  const obj = {};
  for (let i = 0; i < header.length; i++) obj[header[i]] = row[i] != null ? row[i] : '';
  return obj;
}

(async () => {
  console.log('PHASE 9 — RH missing-docs parser (dry run)\n');

  console.log('  Reading master file...');
  const text = fs.readFileSync(MASTER, 'utf-8');
  const rows = parseCSV(text);
  console.log('  Total rows:', rows.length);

  // Find sections
  const invHeaderSig = ['INVOICE_NUMBER', 'CREATED_AT', 'INVOICE_TYPE', 'CLIENT_NAME'];
  const invLineSig   = ['INVOICE_NUMBER', 'TITLE', 'DESCRIPTION', 'QUANTITY'];
  const docHeaderSig = ['DOCUMENT_NUMBER', 'TYPE', 'PROJECT_NAME', 'STATUS'];
  const poHeaderSig  = ['PURCHASE_ORDER_NUMBER', 'CREATED_AT', 'CLIENT_NAME', 'VENDOR_COMPANY'];
  const poLineSig    = ['PURCHASE_ORDER_NUMBER', 'IMAGE_NAME', 'TITLE', 'DESCRIPTION'];

  const invH = findSection(rows, invHeaderSig);
  const invL = findSection(rows, invLineSig);
  const docH = findSection(rows, docHeaderSig);
  const poH  = findSection(rows, poHeaderSig);
  const poL  = findSection(rows, poLineSig);

  console.log('\n  Sections found:');
  console.log('    Invoices header:   ' + (invH ? 'line ' + invH.startRow : 'NOT FOUND'));
  console.log('    Invoice lines:     ' + (invL ? 'line ' + invL.startRow : 'NOT FOUND'));
  console.log('    Documents:         ' + (docH ? 'line ' + docH.startRow : 'NOT FOUND'));
  console.log('    POs header:        ' + (poH ? 'line ' + poH.startRow : 'NOT FOUND'));
  console.log('    PO lines:          ' + (poL ? 'line ' + poL.startRow : 'NOT FOUND'));

  // Extract rows
  const invHeaderRows = invH ? extractSection(rows, invH.startRow, invH.header) : [];
  const invLineRows   = invL ? extractSection(rows, invL.startRow, invL.header) : [];
  const docRows       = docH ? extractSection(rows, docH.startRow, docH.header) : [];
  const poHeaderRows  = poH ? extractSection(rows, poH.startRow, poH.header) : [];
  const poLineRows    = poL ? extractSection(rows, poL.startRow, poL.header) : [];

  console.log('\n  Section row counts:');
  console.log('    Invoices headers:  ' + invHeaderRows.length);
  console.log('    Invoice lines:     ' + invLineRows.length);
  console.log('    Documents:         ' + docRows.length);
  console.log('    POs headers:       ' + poHeaderRows.length);
  console.log('    PO lines:          ' + poLineRows.length);

  // Filter to Rolling Hills
  function isRH(projName) {
    const p = String(projName || '').toLowerCase().trim();
    return p === BOARD_NAME_TARGET || p.includes('rolling hills');
  }

  const rhInvoices = invHeaderRows.map(r => rowToObj(invH.header, r)).filter(x => isRH(x.PROJECT_NAME));
  const rhDocs = docRows.map(r => rowToObj(docH.header, r)).filter(x => isRH(x.PROJECT_NAME));
  const rhPOs = poHeaderRows.map(r => rowToObj(poH.header, r));
  // POs may have different project field name — let's check
  const poProjField = poH.header.find(h => /project.?name/i.test(h));
  const rhPOsFiltered = poProjField ? rhPOs.filter(x => isRH(x[poProjField])) : rhPOs;

  console.log('\n  Rolling Hills filtered:');
  console.log('    Invoices:  ' + rhInvoices.length);
  console.log('    Documents: ' + rhDocs.length + ' (' + [...new Set(rhDocs.map(d => d.TYPE))].join(', ') + ')');
  console.log('    POs:       ' + rhPOsFiltered.length + ' (po project field: ' + poProjField + ')');

  // Group line items by their parent
  const invLinesByNum = {};
  for (const lr of invLineRows) {
    const o = rowToObj(invL.header, lr);
    const num = String(o.INVOICE_NUMBER || '').trim();
    if (!num) continue;
    if (!invLinesByNum[num]) invLinesByNum[num] = [];
    invLinesByNum[num].push(o);
  }
  const poLinesByNum = {};
  for (const lr of poLineRows) {
    const o = rowToObj(poL.header, lr);
    const num = String(o.PURCHASE_ORDER_NUMBER || '').trim();
    if (!num) continue;
    if (!poLinesByNum[num]) poLinesByNum[num] = [];
    poLinesByNum[num].push(o);
  }

  // Read Studio's existing
  const app = initializeApp(PROD);
  const db = getFirestore(app);
  const studioInv = new Set(), studioPR = new Set(), studioPO = new Set();
  function normNum(s, prefix) { const m = String(s||'').trim().toUpperCase().match(new RegExp('(' + prefix + ')[\\s-]?(\\d+)')); return m ? m[1] + '-' + m[2] : ''; }
  for (const [sub, prefix, set] of [['invoices','IN',studioInv],['proposals','PR',studioPR],['purchaseOrders','PO',studioPO]]) {
    const snap = await getDocs(collection(db, 'boards', BOARD_ID, sub));
    snap.forEach(d => {
      const x = d.data();
      const num = normNum(x.number || x.invoiceNum || x.proposalNum || x.poNumber || d.id, prefix);
      if (num) set.add(num);
    });
  }
  console.log('\n  Studio currently has (RH):');
  console.log('    Invoices:  ' + studioInv.size);
  console.log('    Proposals: ' + studioPR.size);
  console.log('    POs:       ' + studioPO.size);

  // Identify missing
  const missingInv = rhInvoices.filter(x => {
    const num = normNum(x.INVOICE_NUMBER, 'IN');
    return num && !studioInv.has(num);
  });
  const missingPR = rhDocs.filter(x => {
    const code = String(x.CODE || x.DOCUMENT_NUMBER || '').toUpperCase();
    if (!code.startsWith('PR-')) return false;
    const num = normNum(code, 'PR');
    return num && !studioPR.has(num);
  });
  const missingPO = rhPOsFiltered.filter(x => {
    const num = normNum(x.PURCHASE_ORDER_NUMBER, 'PO');
    return num && !studioPO.has(num);
  });

  console.log('\n=== MISSING (in Houzz, not in Studio) ===');
  console.log('  Invoices:  ' + missingInv.length);
  console.log('  Proposals: ' + missingPR.length);
  console.log('  POs:       ' + missingPO.length);

  // Build manifest
  const csv = ['type,number,projectName,status,total,paid,clientName,vendor,billingDate,createdAt,lineItemCount,connectedDocId'];
  for (const x of missingInv) {
    const num = normNum(x.INVOICE_NUMBER, 'IN');
    const items = invLinesByNum[x.INVOICE_NUMBER] || invLinesByNum[num] || [];
    csv.push(['invoice', num, x.PROJECT_NAME, x.STATUS || '', x.TOTAL_PAYMENT || '', x.TOTAL_PAID || '', x.CLIENT_NAME || '', '', x.BILLING_DATE || x.INVOICE_DATE || '', x.CREATED_AT || '', items.length, ''].map(csvEsc).join(','));
  }
  for (const x of missingPR) {
    const num = normNum(x.CODE || x.DOCUMENT_NUMBER, 'PR');
    csv.push(['proposal', num, x.PROJECT_NAME, x.STATUS || '', x.TOTAL_PAYMENT || '', x.TOTAL_PAID || '', '', '', x.ISSUED_AT || x.CREATED_AT || '', x.CREATED_AT || '', '', x.CONNECTED_DOCUMENT_ID || ''].map(csvEsc).join(','));
  }
  for (const x of missingPO) {
    const num = normNum(x.PURCHASE_ORDER_NUMBER, 'PO');
    const items = poLinesByNum[x.PURCHASE_ORDER_NUMBER] || poLinesByNum[num] || [];
    csv.push(['po', num, x[poProjField] || '', x.STATUS || x.ORDER_STATUS || '', x.TOTAL_PAYMENT || '', x.TOTAL_PAID || '', x.CLIENT_NAME || '', x.VENDOR_COMPANY || '', x.PURCHASE_ORDER_DATE || '', x.CREATED_AT || '', items.length, ''].map(csvEsc).join(','));
  }
  fs.writeFileSync(OUT_CSV, csv.join('\n'));
  console.log('\n  Manifest: ' + OUT_CSV + ' (' + (csv.length - 1) + ' rows)');

  // Sample 5 of each
  console.log('\n  --- Sample missing invoices (first 5) ---');
  missingInv.slice(0, 5).forEach(x => {
    const num = normNum(x.INVOICE_NUMBER, 'IN');
    const items = invLinesByNum[x.INVOICE_NUMBER] || [];
    console.log('    ' + num + '  status=' + (x.STATUS || '?') + '  total=$' + (x.TOTAL_PAYMENT || 0) + '  items=' + items.length + '  date=' + (x.BILLING_DATE || x.INVOICE_DATE || ''));
  });
  console.log('\n  --- Sample missing POs (first 5) ---');
  missingPO.slice(0, 5).forEach(x => {
    const num = normNum(x.PURCHASE_ORDER_NUMBER, 'PO');
    const items = poLinesByNum[x.PURCHASE_ORDER_NUMBER] || [];
    console.log('    ' + num + '  status=' + (x.STATUS || '?') + '  vendor=' + (x.VENDOR_COMPANY || '') + '  total=$' + (x.TOTAL_PAYMENT || 0) + '  items=' + items.length);
  });
  console.log('\n  --- Sample missing proposals (first 5) ---');
  missingPR.slice(0, 5).forEach(x => {
    console.log('    ' + normNum(x.CODE || x.DOCUMENT_NUMBER, 'PR') + '  status=' + (x.STATUS || '?') + '  total=$' + (x.TOTAL_PAYMENT || 0) + '  type=' + (x.TYPE || ''));
  });

  process.exit(0);
})().catch(e => { console.error('FAILED:', e); process.exit(1); });
