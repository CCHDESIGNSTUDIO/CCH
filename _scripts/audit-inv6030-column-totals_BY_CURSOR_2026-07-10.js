'use strict';
/** READ-ONLY: full column math for INV-6030 linked ledger rows */
const path = require('path');
const admin = require('firebase-admin');
const KEY = require(path.join(__dirname, '..', '_debug', 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json'));
const db = admin.initializeApp({ credential: admin.credential.cert(KEY) }, 'calc').firestore();

const PID = 'cloud-rolling-hills';
const INV_ID = 'TztTb3puQToRQouIWJlC';

const n = (v) => parseFloat(v) || 0;
const r2 = (v) => Math.round(n(v) * 100) / 100;
const r4 = (v) => Math.round(n(v) * 10000) / 10000;
const str = (v) => String(v == null ? '' : v).trim();

function tracked(t) {
  if (t.trackedHrs != null && t.trackedHrs !== '') return n(t.trackedHrs);
  return Math.max(0, n(t.hours) - n(t.addedHrs));
}
function billHrs(t) { return n(t.hours); }
function added(t) { return n(t.addedHrs); }

(async () => {
  const invSnap = await db.collection('boards').doc(PID).collection('invoices').doc(INV_ID).get();
  const inv = invSnap.data() || {};

  const teSnap = await db.collection('timeEntries')
    .where('invoiceProjectId', '==', PID)
    .where('invoiceId', '==', INV_ID)
    .get();

  const rows = [];
  teSnap.forEach((d) => rows.push({ id: d.id, ...d.data() }));
  rows.sort((a, b) => str(a.date).localeCompare(str(b.date)) || str(a.service).localeCompare(str(b.service)));

  console.log('INV-6030 | ' + rows.length + ' linked rows\n');
  console.log('Date       | Service                          | Tracked | +Hrs  | Bill  | Rate   | Amount    | chk');
  console.log('-----------|----------------------------------|---------|-------|-------|--------|-----------|------');

  let T = { tracked: 0, added: 0, bill: 0, amount: 0, invAmt: 0 };
  const bySvc = {};

  rows.forEach((t) => {
    const tr = tracked(t);
    const ad = added(t);
    const bl = billHrs(t);
    const rate = n(t.rate) || n(t.hourlyRate);
    const amt = n(t.total);
    const calcAmt = r2(bl * rate);
    const chk = Math.abs(calcAmt - amt) < 0.02 ? 'ok' : 'amt≠hrs×rate';

    T.tracked += tr;
    T.added += ad;
    T.bill += bl;
    T.amount += amt;
    T.invAmt += n(t.invoicedAmount);

    const svc = str(t.service) || '(none)';
    if (!bySvc[svc]) bySvc[svc] = { n: 0, tracked: 0, added: 0, bill: 0, amount: 0 };
    const g = bySvc[svc];
    g.n++; g.tracked += tr; g.added += ad; g.bill += bl; g.amount += amt;

    const date = str(t.date).slice(0, 10);
    console.log(
      (date + '         ').slice(0, 10) + ' | ' +
      (svc + '                                ').slice(0, 32) + ' | ' +
      String(r2(tr)).padStart(7) + ' | ' +
      String(r2(ad)).padStart(5) + ' | ' +
      String(r2(bl)).padStart(5) + ' | ' +
      String(r4(rate)).padStart(6) + ' | ' +
      ('$' + r2(amt)).padStart(9) + ' | ' + chk
    );
  });

  console.log('-----------|----------------------------------|---------|-------|-------|--------|-----------|------');
  console.log(
    'TOTAL      |                                  | ' +
    String(r2(T.tracked)).padStart(7) + ' | ' +
    String(r2(T.added)).padStart(5) + ' | ' +
    String(r2(T.bill)).padStart(5) + ' |        | ' +
    ('$' + r2(T.amount)).padStart(9) + ' |'
  );
  console.log('');
  console.log('Column checks:');
  console.log('  Tracked + +Hrs = Bill Hrs ?  ' + r2(T.tracked) + ' + ' + r2(T.added) + ' = ' + r2(T.tracked + T.added) + '  (bill col ' + r2(T.bill) + ')  ' + (Math.abs(T.tracked + T.added - T.bill) < 0.02 ? 'YES' : 'NO'));
  console.log('  Sum invoicedAmount on rows:   $' + r2(T.invAmt));
  console.log('');

  console.log('--- By service (ledger columns summed) ---');
  console.log('Service                          | rows | Tracked | +Hrs  | Bill  | Amount');
  let gT = { tracked: 0, added: 0, bill: 0, amount: 0 };
  Object.keys(bySvc).sort().forEach((svc) => {
    const g = bySvc[svc];
    gT.tracked += g.tracked; gT.added += g.added; gT.bill += g.bill; gT.amount += g.amount;
    console.log(
      (svc + '                                ').slice(0, 32) + ' | ' +
      String(g.n).padStart(4) + ' | ' +
      String(r2(g.tracked)).padStart(7) + ' | ' +
      String(r2(g.added)).padStart(5) + ' | ' +
      String(r2(g.bill)).padStart(5) + ' | $' + r2(g.amount)
    );
  });
  console.log('TOTAL                            | ' + String(rows.length).padStart(4) + ' | ' +
    String(r2(gT.tracked)).padStart(7) + ' | ' + String(r2(gT.added)).padStart(5) + ' | ' +
    String(r2(gT.bill)).padStart(5) + ' | $' + r2(gT.amount));
  console.log('');

  console.log('--- Sent invoice INV-6030 (what client paid) ---');
  let invH = 0, inv$ = 0;
  (inv.items || []).forEach((it) => {
    const q = n(it.qty != null ? it.qty : it.quantity);
    const a = n(it.amount);
    invH += q; inv$ += a;
    console.log('  ' + str(it.title) + ' | qty ' + r2(q) + 'h | $' + r2(a));
  });
  console.log('INVOICE TOTAL                    | qty ' + r2(invH) + 'h | $' + r2(inv$));
  console.log('');
  console.log('--- GAP (ledger bill − invoice qty) ---');
  console.log('  Hours:  ' + r2(T.bill) + ' − ' + r2(invH) + ' = ' + r2(T.bill - invH) + 'h');
  console.log('  Dollars: $' + r2(T.amount) + ' − $' + r2(inv$) + ' = $' + r2(T.amount - inv$));

  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
