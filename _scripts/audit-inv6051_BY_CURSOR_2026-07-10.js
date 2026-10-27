'use strict';
/** READ-ONLY: INV-6051 Manno invoice vs linked ledger */
const path = require('path');
const admin = require('firebase-admin');
const KEY = require(path.join(__dirname, '..', '_debug', 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json'));
const db = admin.initializeApp({ credential: admin.credential.cert(KEY) }, 'i').firestore();
const str = (v) => String(v == null ? '' : v).trim();
const n = (v) => parseFloat(v) || 0;
const r2 = (v) => Math.round(n(v) * 100) / 100;

function tracked(t) {
  if (t.trackedHrs != null && t.trackedHrs !== '') return n(t.trackedHrs);
  return Math.max(0, n(t.hours) - n(t.addedHrs));
}

(async () => {
  const boards = await db.collection('boards').get();
  let invDoc = null;
  let boardId = null;

  for (const b of boards.docs) {
    const q1 = await db.collection('boards').doc(b.id).collection('invoices').where('invoiceNum', '==', 'INV-6051').get();
    const q2 = q1.empty
      ? await db.collection('boards').doc(b.id).collection('invoices').where('number', '==', 'INV-6051').get()
      : q1;
    if (!q2.empty) {
      invDoc = q2.docs[0];
      boardId = b.id;
      break;
    }
  }
  if (!invDoc) {
    console.log('INV-6051 not found');
    process.exit(1);
  }

  const inv = invDoc.data() || {};
  const invId = invDoc.id;
  console.log('Board:', boardId);
  console.log('Invoice doc:', invId);
  console.log('projectName:', str(inv.projectName));
  console.log('status:', str(inv.status));
  console.log('source:', str(inv.source));
  console.log('date:', str(inv.date));
  console.log('total:', n(inv.total));
  console.log('timeEntryIds:', (inv.timeEntryIds || []).length);
  console.log('');

  console.log('--- Invoice lines ---');
  let invH = 0, inv$ = 0;
  (inv.items || []).forEach((it, i) => {
    const q = n(it.qty != null ? it.qty : it.quantity);
    const a = n(it.amount);
    invH += q;
    inv$ += a;
    console.log('[' + i + '] ' + str(it.title || it.category) + ' | qty=' + q + ' rate=' + n(it.rate) + ' amount=' + a + ' expenseType=' + str(it.expenseType));
  });
  console.log('Service total: ' + r2(invH) + 'h $' + r2(inv$));
  console.log('');

  const teSnap = await db.collection('timeEntries')
    .where('invoiceId', '==', invId)
    .get();
  const rows = [];
  teSnap.forEach((d) => rows.push({ id: d.id, ...d.data() }));

  // also by invoice number
  if (!rows.length) {
    const te2 = await db.collection('timeEntries').where('invoiceNumber', '==', 'INV-6051').get();
    te2.forEach((d) => rows.push({ id: d.id, ...d.data() }));
  }

  rows.sort((a, b) => str(a.date).localeCompare(str(b.date)));

  console.log('--- Linked ledger rows (' + rows.length + ') ---');
  let T = { tracked: 0, added: 0, bill: 0, amt: 0 };
  const bySvc = {};
  rows.forEach((t) => {
    const tr = tracked(t);
    const ad = n(t.addedHrs);
    const bl = n(t.hours);
    const amt = n(t.total);
    T.tracked += tr;
    T.added += ad;
    T.bill += bl;
    T.amt += amt;
    const svc = str(t.service) || 'Services';
    if (!bySvc[svc]) bySvc[svc] = { n: 0, bill: 0, amt: 0, ids: [] };
    bySvc[svc].n++;
    bySvc[svc].bill += bl;
    bySvc[svc].amt += amt;
    bySvc[svc].ids.push(t.id);
    console.log(str(t.date).slice(0, 10) + ' | ' + svc.slice(0, 36) + ' | tr=' + r2(tr) + ' +=' + r2(ad) + ' bill=' + r2(bl) + ' $' + r2(amt) + ' | ' + str(t.member).split(' ')[0]);
  });
  console.log('TOTAL ledger: tracked=' + r2(T.tracked) + ' +hrs=' + r2(T.added) + ' bill=' + r2(T.bill) + ' $' + r2(T.amt));
  console.log('GAP hrs: ' + r2(T.bill - invH) + ' | GAP $: ' + r2(T.amt - inv$));
  console.log('');
  console.log('--- Ledger by service (invoice line source) ---');
  Object.keys(bySvc).sort().forEach((svc) => {
    const g = bySvc[svc];
    const effRate = g.bill > 0 ? r2(g.amt / g.bill) : 0;
    console.log(svc + ' | rows=' + g.n + ' | bill=' + r2(g.bill) + 'h $' + r2(g.amt) + ' | effRate=' + effRate);
  });

  // entries on invoice timeEntryIds but not linked
  const linkedIds = new Set(rows.map((r) => r.id));
  const missing = (inv.timeEntryIds || []).filter((id) => !linkedIds.has(id));
  if (missing.length) console.log('\nOn invoice timeEntryIds but not invoiceId-linked:', missing.length);

  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
