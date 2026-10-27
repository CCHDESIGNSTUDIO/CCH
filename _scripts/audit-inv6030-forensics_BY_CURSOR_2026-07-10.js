'use strict';
/** READ-ONLY forensics for INV-6030 Cloud - Rolling Hills */
const path = require('path');
const admin = require('firebase-admin');
const KEY = require(path.join(__dirname, '..', '_debug', 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json'));
const db = admin.initializeApp({ credential: admin.credential.cert(KEY) }, 'rh6030').firestore();

const PID = 'cloud-rolling-hills';
const INV_NUM = 'INV-6030';

const str = (v) => String(v == null ? '' : v).trim();
const n = (v) => parseFloat(v) || 0;
const r2 = (v) => Math.round(n(v) * 100) / 100;

function tracked(t) {
  if (t.trackedHrs != null && t.trackedHrs !== '') return n(t.trackedHrs);
  return Math.max(0, n(t.hours) - n(t.addedHrs));
}

(async () => {
  const invSnap = await db.collection('boards').doc(PID).collection('invoices')
    .where('invoiceNum', '==', INV_NUM).limit(1).get();
  if (invSnap.empty) {
    const invSnap2 = await db.collection('boards').doc(PID).collection('invoices')
      .where('number', '==', INV_NUM).limit(1).get();
    if (invSnap2.empty) { console.log('Invoice not found'); process.exit(1); }
    invSnap.docs.push(...invSnap2.docs);
  }
  const invDoc = invSnap.docs[0];
  const inv = invDoc.data();
  const invId = invDoc.id;

  console.log('=== ' + INV_NUM + ' (' + invId + ') ===');
  console.log('createdAt:', inv.createdAt || inv.date || '(unknown)');
  console.log('source:', inv.source || '');
  console.log('status:', inv.status || '');
  console.log('total $:', n(inv.total));
  console.log('timeEntryIds:', (inv.timeEntryIds || []).length);
  console.log('');

  console.log('--- Invoice service lines ---');
  let invQty = 0;
  let invAmt = 0;
  (inv.items || []).forEach((it, i) => {
    const q = n(it.qty != null ? it.qty : it.quantity);
    const a = n(it.amount);
    invQty += q;
    invAmt += a;
    console.log('  [' + i + '] ' + str(it.title || it.category) + ' | qty=' + q + ' | rate=' + n(it.rate) + ' | amount=' + a);
  });
  console.log('Invoice service qty total:', r2(invQty), 'h | line amounts sum:', r2(invAmt));
  console.log('');

  const teSnap = await db.collection('timeEntries')
    .where('invoiceProjectId', '==', PID)
    .where('invoiceId', '==', invId)
    .get();

  const entries = [];
  teSnap.forEach((d) => entries.push({ id: d.id, ...d.data() }));

  // Also match by invoice number if projectId path differs
  if (!entries.length) {
    const teSnap2 = await db.collection('timeEntries').where('invoiceNumber', '==', INV_NUM).get();
    teSnap2.forEach((d) => {
      const t = d.data();
      if (str(t.project).toLowerCase().includes('rolling')) entries.push({ id: d.id, ...t });
    });
  }

  entries.sort((a, b) => str(a.date).localeCompare(str(b.date)));

  let sumHours = 0, sumTracked = 0, sumAdded = 0, sumTotal = 0, sumInvAmt = 0;
  let addedRows = 0;
  const byService = {};

  console.log('--- Ledger rows (' + entries.length + ') ---');
  entries.forEach((t) => {
    const h = n(t.hours);
    const tr = tracked(t);
    const ad = n(t.addedHrs);
    const tot = n(t.total);
    const invAmt = n(t.invoicedAmount);
    sumHours += h;
    sumTracked += tr;
    sumAdded += ad;
    sumTotal += tot;
    sumInvAmt += invAmt;
    if (ad > 0.001) addedRows++;
    const svc = str(t.service) || 'Services';
    if (!byService[svc]) byService[svc] = { hours: 0, tracked: 0, added: 0, total: 0, count: 0 };
    byService[svc].hours += h;
    byService[svc].tracked += tr;
    byService[svc].added += ad;
    byService[svc].total += tot;
    byService[svc].count++;
  });

  console.log('Ledger totals: billHrs=' + r2(sumHours) + ' tracked=' + r2(sumTracked) + ' +hrs=' + r2(sumAdded) + ' ($' + r2(sumTotal) + ')');
  console.log('Rows with addedHrs > 0:', addedRows);
  console.log('Sum invoicedAmount on entries: $' + r2(sumInvAmt));
  console.log('');

  console.log('--- Ledger grouped by service (same as createTimeInvoice) ---');
  Object.keys(byService).sort().forEach((svc) => {
    const g = byService[svc];
    console.log('  ' + svc + ' | entries=' + g.count + ' | hours=' + r2(g.hours) + ' | tracked=' + r2(g.tracked) + ' | +hrs=' + r2(g.added) + ' | $' + r2(g.total));
  });
  const groupedQty = Object.values(byService).reduce((s, g) => s + g.hours, 0);
  console.log('Grouped bill hrs (should match invoice if created from current data):', r2(groupedQty));
  console.log('Gap vs invoice qty:', r2(groupedQty - invQty), 'h');
  console.log('');

  if (addedRows) {
    console.log('--- Rows with + Hrs ---');
    entries.filter((t) => n(t.addedHrs) > 0.001).forEach((t) => {
      console.log('  ' + str(t.date) + ' | tracked=' + r2(tracked(t)) + ' +hrs=' + r2(t.addedHrs) + ' bill=' + r2(t.hours) + ' | $' + r2(t.total) + ' | ' + str(t.service).slice(0, 40));
    });
  } else {
    console.log('No rows currently have addedHrs > 0 on this invoice.');
  }

  // Service name fuzzy match invoice lines vs ledger
  console.log('');
  console.log('--- Service name alignment (invoice line vs ledger group) ---');
  (inv.items || []).forEach((it) => {
    const title = str(it.title || it.category);
    const keys = Object.keys(byService);
    const match = keys.find((k) => k === title) || keys.find((k) => title.includes(k) || k.includes(title));
    const g = match ? byService[match] : null;
    console.log('  Invoice "' + title + '" qty=' + n(it.qty) +
      (g ? ' ↔ ledger "' + match + '" hours=' + r2(g.hours) + ' (diff ' + r2(g.hours - n(it.qty)) + 'h)' : ' ↔ NO ledger group match'));
  });

  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
