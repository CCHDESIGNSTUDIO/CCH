/**
 * Read-only inspection of Studio IN-12980. Dumps:
 *   - top-level fields
 *   - line item count
 *   - first 3 line items in full
 *   - per-line summary table (idx, title, image basename, sku, qty, cost, markup, total, notes)
 *   - count of lines with cost==0 vs cost>0
 */
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, query, where } = require('firebase/firestore');

const PROD = {
  apiKey: 'AIzaSyAd24U5ArVGrA24IxNcYD2NYiTVycyF4og',
  authDomain: 'cch-design-boards.firebaseapp.com',
  projectId: 'cch-design-boards',
  storageBucket: 'cch-design-boards.firebasestorage.app',
  messagingSenderId: '210388013080',
  appId: '1:210388013080:web:cch-design-boards',
};
const BOARD_ID = 'cloud-rolling-hills';

function basename(u) { if (!u) return ''; const s = String(u).split('?')[0].split('#')[0]; return s.split('/').pop() || ''; }

(async () => {
  const app = initializeApp(PROD);
  const db = getFirestore(app);
  const snap = await getDocs(collection(db, 'boards', BOARD_ID, 'invoices'));
  let target = null;
  snap.forEach(d => {
    const x = d.data();
    if (String(x.number || x.invoiceNum || d.id).toUpperCase().includes('IN-12980')) {
      target = { id: d.id, data: x };
    }
  });
  if (!target) { console.log('IN-12980 not found'); process.exit(1); }

  const x = target.data;
  console.log('=== TOP-LEVEL FIELDS (excl items) ===');
  for (const k of Object.keys(x).sort()) {
    if (k === 'items' || k === 'lineItems' || k === 'lines') continue;
    const v = x[k];
    const s = (v && typeof v === 'object') ? JSON.stringify(v).slice(0,80) : String(v).slice(0,80);
    console.log('  ' + k.padEnd(30) + ' = ' + s);
  }

  // find the line items array — could be 'items', 'lineItems', or 'lines'
  let items = x.items || x.lineItems || x.lines || [];
  console.log('\n=== LINE ITEMS ===');
  console.log('  count:', items.length);
  console.log('  field name on doc: ', x.items ? 'items' : x.lineItems ? 'lineItems' : x.lines ? 'lines' : '(none)');

  if (items.length > 0) {
    console.log('\n=== FIRST LINE ITEM (full shape) ===');
    console.log(JSON.stringify(items[0], null, 2));
    if (items[1]) {
      console.log('\n=== SECOND LINE ITEM (full shape) ===');
      console.log(JSON.stringify(items[1], null, 2));
    }
    if (items[2]) {
      console.log('\n=== THIRD LINE ITEM (full shape) ===');
      console.log(JSON.stringify(items[2], null, 2));
    }
  }

  console.log('\n=== PER-LINE SUMMARY ===');
  console.log('idx | title                                    | imgBasename                    | sku       | qty | cost   | markup | total   | notes');
  let costZero = 0, costPos = 0;
  items.forEach((it, i) => {
    const title = String(it.name || it.title || it.itemName || '').slice(0,40);
    const img = basename(it.image || it.imageUrl || it.coverImage || '');
    const sku = String(it.sku || '').slice(0,9);
    const qty = it.qty != null ? it.qty : it.quantity;
    const cost = it.cost != null ? it.cost : it.unitCost;
    const markup = it.markup != null ? it.markup : it.markupPercent;
    const total = it.total != null ? it.total : it.lineTotal;
    const notes = String(it.notes || it.note || '').slice(0,20);
    if (Number(cost) > 0) costPos++; else costZero++;
    console.log(
      String(i).padStart(3) + ' | ' +
      title.padEnd(40) + ' | ' +
      img.padEnd(30) + ' | ' +
      sku.padEnd(9) + ' | ' +
      String(qty).padEnd(3) + ' | ' +
      String(cost).padEnd(6) + ' | ' +
      String(markup).padEnd(6) + ' | ' +
      String(total).padEnd(7) + ' | ' +
      notes
    );
  });

  console.log('\n=== COST STATS ===');
  console.log('  cost > 0: ' + costPos);
  console.log('  cost == 0 or missing: ' + costZero);

  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
