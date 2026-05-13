/**
 * READ-ONLY scan of /products/ + /productLibrary/ for items that should NOT be in the product library:
 *   freight, taxes, deposits, services, fees, shipping/handling, labor, project management, expenses, etc.
 *
 * Output: phase5-expense-candidates.csv  (studioId, collection, title, vendor, category, sku, source, reason)
 * NO writes.
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

const OUT_CSV = path.join(__dirname, 'phase5-expense-candidates.csv');

function csvEsc(v) { if (v == null) return ''; const s = String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }

// Title patterns (case-insensitive, anchored to start of title) — these are NOT real products.
const TITLE_PATTERNS = [
  { rx: /^freight\b/i,                 reason: 'title-freight' },
  { rx: /^pre[\s-]?paid.*tax/i,        reason: 'title-prepaid-tax' },
  { rx: /^(sales?\s*)?tax\b/i,         reason: 'title-tax' },
  { rx: /\bvat\b.*\d/i,                reason: 'title-vat' },           // "16% VAT"
  { rx: /^vat\b/i,                     reason: 'title-vat' },
  { rx: /^retainer\b/i,                reason: 'title-retainer' },
  { rx: /^deposit\b/i,                 reason: 'title-deposit' },
  { rx: /^reimburs/i,                  reason: 'title-reimbursement' },
  { rx: /^expense\b/i,                 reason: 'title-expense' },
  { rx: /\bcc\s*fee\b/i,               reason: 'title-cc-fee' },
  { rx: /^\d+\s*%\s*cc\s*fee/i,        reason: 'title-cc-fee' },
  { rx: /^project[\s-]?management\b/i, reason: 'title-project-mgmt' },
  { rx: /^design[\s-]?service\b/i,     reason: 'title-design-service' },
  { rx: /^design[\s-]?fee\b/i,         reason: 'title-design-fee' },
  { rx: /^delivery[\s-]?fee\b/i,       reason: 'title-delivery-fee' },
  { rx: /^delivery\b\s*$/i,            reason: 'title-delivery' },
  { rx: /^installation\b/i,            reason: 'title-installation' },
  { rx: /^shipping\b/i,                reason: 'title-shipping' },
  { rx: /^handling\b/i,                reason: 'title-handling' },
  { rx: /^labor\b/i,                   reason: 'title-labor' },
  { rx: /^discount\b/i,                reason: 'title-discount' },
  { rx: /^credit\b/i,                  reason: 'title-credit' },
  { rx: /^markup\b/i,                  reason: 'title-markup' },
  { rx: /^commission\b/i,              reason: 'title-commission' },
  { rx: /^return\b/i,                  reason: 'title-return' },
  { rx: /^restocking\b/i,              reason: 'title-restocking' },
];

// Category values that indicate an expense, not a product
const EXPENSE_CATEGORIES = new Set([
  'expenses', 'expense', 'project management', 'tax', 'taxes', 'service', 'services',
  'labor', 'freight', 'shipping', 'fee', 'fees', 'reimbursable', 'reimbursable expenses',
  'design service', 'design fee', 'design services', 'delivery'
]);

const EXPENSE_KINDS = new Set(['expense', 'service', 'freight', 'design_service', 'shipping', 'tax', 'labor', 'fee']);

function classifyDoc(x) {
  const reasons = [];
  const title = String(x.title || '').trim();
  const titleLow = title.toLowerCase();
  const category = String(x.category || '').trim().toLowerCase();
  const kind = String(x.libraryItemKind || x.itemKind || '').trim().toLowerCase();

  for (const { rx, reason } of TITLE_PATTERNS) {
    if (rx.test(title)) { reasons.push(reason); break; }
  }
  if (EXPENSE_CATEGORIES.has(category)) reasons.push('cat-' + category.replace(/\s+/g, '-'));
  if (EXPENSE_KINDS.has(kind)) reasons.push('kind-' + kind);

  return reasons.length ? reasons.join(';') : '';
}

(async () => {
  console.log('READ-ONLY scan for expense / non-product items in /products/ + /productLibrary/\n');
  const app = initializeApp(PROD);
  const db = getFirestore(app);

  const candidates = [];

  for (const colName of ['products', 'productLibrary']) {
    let total = 0, hits = 0;
    try {
      const snap = await getDocs(collection(db, colName));
      snap.forEach(d => {
        total++;
        const x = d.data();
        const reason = classifyDoc(x);
        if (reason) {
          hits++;
          candidates.push({
            collection: colName,
            id: d.id,
            title: x.title || '',
            vendor: x.vendor || x.manufacturer || '',
            category: x.category || '',
            sku: x.sku || '',
            source: x.source || x.dataSource || '',
            reason,
          });
        }
      });
      console.log(`/${colName}/: ${hits} candidates of ${total} docs`);
    } catch (e) {
      console.log(`/${colName}/ error: ${e.message}`);
    }
  }

  // Write CSV
  const csv = ['studioId,collection,title,vendor,category,sku,source,reason'];
  for (const c of candidates) csv.push([c.id, c.collection, c.title, c.vendor, c.category, c.sku, c.source, c.reason].map(csvEsc).join(','));
  fs.writeFileSync(OUT_CSV, csv.join('\n'));

  // Summary by reason
  const byReason = new Map();
  for (const c of candidates) {
    const k = c.reason.split(';')[0];
    byReason.set(k, (byReason.get(k) || 0) + 1);
  }
  console.log(`\nTotal candidates: ${candidates.length}`);
  console.log('By primary reason:');
  for (const [k, v] of [...byReason.entries()].sort((a,b)=>b[1]-a[1])) console.log(`  ${k.padEnd(25)} ${v}`);

  // Sample titles
  console.log('\nSample candidates (first 20):');
  for (const c of candidates.slice(0, 20)) {
    console.log(`  [${c.collection}] "${(c.title || '').slice(0,55)}" | vendor="${(c.vendor||'').slice(0,30)}" | cat="${c.category}" | reason=${c.reason}`);
  }

  console.log(`\nManifest: ${OUT_CSV}`);
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
