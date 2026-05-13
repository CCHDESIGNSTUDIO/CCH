/**
 * Read-only: compare Rolling Hills **Studio** invoices to a Houzz **.xlsx**.
 *
 * Two supported workbook shapes:
 * 1) **Project Tracker (product grid)** — first-row headers include `Invoice`, `Title`, `Total Selling Price`.
 *    Groups **many rows per invoice** → use this to see missing line items vs Studio.
 * 2) **All Transactions (by customer)** — header row ~5 has `Code`, `Transaction Type`, `Amount`, `Shipping`.
 *    **One row per invoice code** (no line items). Script prints Houzz header $ for IN-* only and warns
 *    that line-level gaps need the **product grid** tracker, not this file.
 *
 * Usage:
 *   node rh-tracker-invoice-line-gap.js [path.xlsx] [IN-12946,IN-12958,...]
 *
 * If `_debug/service-account.json/*.json` exists, also prints Studio `items` count + `total`.
 *
 * Does NOT write Firestore.
 */
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const DEFAULT_XLSX = String.raw`C:\Users\cindy\Dropbox\Claude - CCH studio\Houzz FILES\Project Trackers\Cloud -= Rolling Hills reports-2870-05-12-2026-09-17-08-433.xlsx`;
const BOARD_ID = 'cloud-rolling-hills';

const xlsxPath = process.argv[2] || DEFAULT_XLSX;
const targetRaw = process.argv[3] || 'IN-12946,IN-12958,IN-12902';
const TARGETS = new Set(
  targetRaw
    .split(/[,;\s]+/)
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
);

const normInv = (s) => String(s || '').trim().toUpperCase().replace(/^#/, '');
const safeNum = (v) => {
  const n = parseFloat(String(v).replace(/[$,]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

function detectFormat(wb) {
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const asObjects = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  if (asObjects.length && asObjects[0] && ('Invoice' in asObjects[0] || 'invoice' in asObjects[0])) {
    return { kind: 'product_grid', rows: asObjects };
  }
  const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  const HEADER_ROW = 4;
  if (raw[HEADER_ROW] && raw[HEADER_ROW].some((c) => String(c || '').trim().toLowerCase() === 'code')) {
    return { kind: 'all_transactions', raw, headerRow: HEADER_ROW };
  }
  return { kind: 'unknown', rows: asObjects, raw };
}

function groupProductGridByInvoice(rows) {
  /** @type {Map<string, { rows: object[], sumSell: number, titles: string[] }>} */
  const m = new Map();
  for (const row of rows) {
    const inv = normInv(row['Invoice'] || row['invoice'] || '');
    if (!inv) continue;
    if (!m.has(inv)) m.set(inv, { rows: [], sumSell: 0, titles: [] });
    const g = m.get(inv);
    g.rows.push(row);
    g.sumSell += safeNum(row['Total Selling Price']);
    const t = String(row['Title'] || row['Client Description'] || '').trim();
    if (t) g.titles.push(t);
  }
  return m;
}

function parseAllTransactionsForCodes(raw, headerRow, wanted) {
  const header = raw[headerRow];
  const idx = (name) => header.findIndex((c) => String(c || '').toLowerCase().trim() === name.toLowerCase());
  const cCode = idx('Code');
  const cType = idx('Transaction Type');
  const cAmount = idx('Amount');
  const cShip = idx('Shipping');
  if (cCode < 0) return new Map();
  const m = new Map();
  for (let i = headerRow + 1; i < raw.length; i++) {
    const r = raw[i];
    const code = normInv(r[cCode]);
    if (!code) continue;
    if (wanted.size && !wanted.has(code)) continue;
    if (!wanted.size && !/^IN-/i.test(code)) continue;
    const amount = safeNum(r[cAmount]);
    const ship = safeNum(cShip >= 0 ? r[cShip] : 0);
    m.set(code, {
      type: cType >= 0 ? String(r[cType] || '').trim() : '',
      amount,
      ship,
      grand: amount + ship,
    });
  }
  return m;
}

async function maybeStudio(invCodes) {
  const saDir = path.join(__dirname, 'service-account.json');
  let credPath = null;
  try {
    const names = fs.readdirSync(saDir);
    const j = names.find((n) => n.endsWith('.json'));
    if (j) credPath = path.join(saDir, j);
  } catch (_) {}
  if (!credPath || !fs.existsSync(credPath)) {
    console.log('\n(No service account under _debug/service-account.json — skipping Studio fetch.)\n');
    return null;
  }
  const admin = require('firebase-admin');
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(require(credPath)) });
  }
  const db = admin.firestore();
  const snap = await db.collection('boards').doc(BOARD_ID).collection('invoices').get();
  /** @type {Map<string, { docId: string, total: number, nItems: number, invoiceNum: string }>} */
  const byNum = new Map();
  snap.forEach((d) => {
    const x = d.data() || {};
    const code = normInv(x.invoiceNum || x.number || '');
    if (!code) return;
    byNum.set(code, {
      docId: d.id,
      total: safeNum(x.total),
      nItems: Array.isArray(x.items) ? x.items.length : 0,
      invoiceNum: String(x.invoiceNum || x.number || ''),
    });
  });

  console.log('\n=== Studio (boards/' + BOARD_ID + '/invoices) ===\n');
  for (const code of invCodes) {
    const st = byNum.get(code);
    console.log(code + (st ? '' : '  (no invoice doc with this number)'));
    if (st) {
      console.log(
        `  docId=${st.docId}  items=${st.nItems}  total=$${st.total.toFixed(2)}  num=${st.invoiceNum}`
      );
    }
  }
  return byNum;
}

(async () => {
  if (!fs.existsSync(xlsxPath)) {
    console.error('File not found:', xlsxPath);
    process.exit(1);
  }
  console.log('Workbook:', xlsxPath);
  console.log('Targets:', [...TARGETS].join(', ') || '(all IN-* in file if product grid)');

  const wb = XLSX.readFile(xlsxPath);
  const fmt = detectFormat(wb);
  const codes = TARGETS.size ? [...TARGETS] : [];

  if (fmt.kind === 'product_grid') {
    const byInv = groupProductGridByInvoice(fmt.rows);
    const listCodes = codes.length ? codes : [...byInv.keys()].filter((k) => /^IN-/i.test(k)).sort();
    console.log('\nFormat: **Project Tracker product grid** (line-level)\n');
    for (const code of listCodes) {
      const g = byInv.get(code);
      if (!g) {
        console.log(`${code}:  NO ROWS — no "Invoice" column match (typo or invoice only in another export).`);
        continue;
      }
      console.log(`${code}:  ${g.rows.length} tracker row(s)  |  sum(Total Selling Price) = $${g.sumSell.toFixed(2)}`);
      g.titles.slice(0, 10).forEach((t, i) => console.log(`    ${i + 1}. ${t.slice(0, 90)}${t.length > 90 ? '…' : ''}`));
      if (g.titles.length > 10) console.log(`    … +${g.titles.length - 10} more`);
    }
  } else if (fmt.kind === 'all_transactions') {
    const byCode = parseAllTransactionsForCodes(fmt.raw, fmt.headerRow, TARGETS);
    console.log('\nFormat: **All Transactions (one row per Code)** — not line-item detail.\n');
    console.log(
      'For IN-12946 / IN-12958 missing $40K / $1,900 **line items**, use a Houzz **Project Tracker** export\n' +
        '(spreadsheet with columns: Invoice, Title, Total Selling Price, …) — same file type Studio "Import from Houzz Pro" expects.\n'
    );
    for (const code of codes) {
      const h = byCode.get(code);
      if (!h) console.log(`${code}:  (not in this All Transactions export)`);
      else
        console.log(
          `${code}:  Houzz row  type=${h.type || '—'}  amount+ship=$${h.grand.toFixed(2)}  (amount $${h.amount.toFixed(
            2
          )} + ship $${h.ship.toFixed(2)})`
        );
    }
  } else {
    console.log('\nUnknown workbook layout (no Invoice header row, no Code@row5). Open in Excel and compare to:');
    console.log('- Project Tracker grid, or');
    console.log('- All Transactions by customer (see rh-full-audit.js).');
  }

  const studioMap = await maybeStudio(codes.length ? codes : [...TARGETS]);

  if (fmt.kind === 'product_grid' && studioMap) {
    console.log('\n=== Quick gap (Studio items vs tracker rows) ===\n');
    const byInv = groupProductGridByInvoice(fmt.rows);
    for (const code of codes) {
      const g = byInv.get(code);
      const st = studioMap.get(code);
      if (g && st) {
        const gap = g.rows.length - st.nItems;
        console.log(
          `${code}:  tracker_rows=${g.rows.length}  studio_items=${st.nItems}  Δrows=${gap}  |  tracker_sell_sum=$${g.sumSell.toFixed(
            2
          )}  studio_total=$${st.total.toFixed(2)}`
        );
      }
    }
  }

  console.log('\nRecap:');
  console.log('- IN-12980 void in Studio = OK; audits comparing to live Houzz $ are misleading for voids.');
  console.log('- IN-12902 timeline edits: Studio is source of truth for “who changed what”; re-import or PDF fix only if you choose.');
  console.log('- IN-12946 / IN-12958 short since import: need **product grid** tracker + this script (or manual) to list missing lines.');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
