#!/usr/bin/env node
'use strict';
const path = require('path');
const admin = require('firebase-admin');
const KEY = require(path.join(__dirname, '..', '_debug', 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json'));
const db = admin.initializeApp({ credential: admin.credential.cert(KEY) }, 'x').firestore();
const str = (v) => String(v == null ? '' : v).trim();
const n = (v) => parseFloat(v) || 0;
const r2 = (v) => Math.round(n(v) * 100) / 100;

function tracked(t) {
  if (t.trackedHrs != null && t.trackedHrs !== '') return n(t.trackedHrs);
  return Math.max(0, n(t.hours) - n(t.addedHrs));
}

function buildLineItems(entries) {
  const byService = {};
  entries.forEach((t) => {
    const key = str(t.service) || 'Services';
    if (!byService[key]) byService[key] = { hours: 0, total: 0, rate: n(t.rate) || n(t.hourlyRate) };
    byService[key].hours += n(t.hours);
    byService[key].total += n(t.total);
  });
  return Object.entries(byService).map(([service, d]) => ({
    title: service,
    qty: r2(d.hours),
    amount: r2(d.total),
    rate: d.hours > 0 ? r2(d.total / d.hours) : 0
  }));
}

(async () => {
  const BOARD = 'holtz-hill';
  const invs = await db.collection('boards').doc(BOARD).collection('invoices').where('invoiceNum', '==', 'INV-6048').get();
  const invDoc = invs.docs[0];
  const inv = invDoc.data();
  const invId = invDoc.id;

  const rows = [];
  (await db.collection('timeEntries').where('invoiceId', '==', invId).get()).forEach((d) => rows.push({ id: d.id, ...d.data() }));
  rows.sort((a, b) => str(a.date).localeCompare(str(b.date)));

  const june = rows.filter((t) => str(t.date).startsWith('2026-06'));
  const nonJune = rows.filter((t) => !str(t.date).startsWith('2026-06'));

  console.log('=== INV-6048 Holtz Hill (Sent) ===');
  console.log('Status:', inv.status, '| Total $' + n(inv.total));
  console.log('Linked rows:', rows.length, '| June:', june.length, '| Other months:', nonJune.length);
  console.log('');

  let invH = 0, inv$ = 0;
  console.log('Invoice lines:');
  (inv.items || []).forEach((it) => {
    const q = n(it.qty);
    const a = n(it.amount);
    invH += q; inv$ += a;
    console.log('  ' + str(it.title) + ' | ' + q + 'h $' + a);
  });
  console.log('Invoice service total: ' + r2(invH) + 'h $' + r2(inv$));
  console.log('');

  const ledgerH = r2(rows.reduce((s, t) => s + n(t.hours), 0));
  const ledger$ = r2(rows.reduce((s, t) => s + n(t.total), 0));
  const rebuilt = buildLineItems(rows);
  console.log('Ledger total: ' + ledgerH + 'h $' + ledger$);
  console.log('GAP: ' + r2(ledgerH - invH) + 'h $' + r2(ledger$ - inv$));
  console.log('');

  console.log('--- June 2026 rows on INV-6048 ---');
  let jT = { tr: 0, ad: 0, bill: 0, $: 0 };
  june.forEach((t) => {
    const tr = tracked(t);
    const ad = n(t.addedHrs);
    const bl = n(t.hours);
    jT.tr += tr; jT.ad += ad; jT.bill += bl; jT.$ += n(t.total);
    const bump = bl > tr + 0.01 ? ' BUMP+' + r2(bl - tr) : '';
    console.log(str(t.date).slice(0, 10) + ' | tr=' + r2(tr) + ' +=' + r2(ad) + ' bill=' + r2(bl) + ' $' + r2(t.total) + bump + ' | ' + str(t.service).slice(0, 28));
  });
  console.log('June subtotal: tracked ' + r2(jT.tr) + ' +hrs ' + r2(jT.ad) + ' bill ' + r2(jT.bill) + ' $' + r2(jT.$));

  console.log('\n--- Non-June rows on INV-6048 ---');
  let oT = { tr: 0, ad: 0, bill: 0, $: 0 };
  nonJune.forEach((t) => {
    const tr = tracked(t);
    const ad = n(t.addedHrs);
    const bl = n(t.hours);
    oT.tr += tr; oT.ad += ad; oT.bill += bl; oT.$ += n(t.total);
    const bump = bl > tr + 0.01 ? ' BUMP+' + r2(bl - tr) : '';
    console.log(str(t.date).slice(0, 10) + ' | tr=' + r2(tr) + ' +=' + r2(ad) + ' bill=' + r2(bl) + ' $' + r2(t.total) + bump + ' | ' + str(t.service).slice(0, 28));
  });
  console.log('Other months subtotal: tracked ' + r2(oT.tr) + ' +hrs ' + r2(oT.ad) + ' bill ' + r2(oT.bill) + ' $' + r2(oT.$));

  console.log('\n--- Rebuilt lines from ledger ---');
  rebuilt.forEach((l) => console.log('  ' + l.title + ' | ' + l.qty + 'h $' + l.amount));

  // Any holtz June with hours bump (bill > tracked) not using addedHrs
  console.log('\n--- All Holtz June rows where bill > tracked (implicit extra hrs) ---');
  const allJune = [];
  (await db.collection('timeEntries').get()).forEach((d) => {
    const t = d.data();
    const p = str(t.project || t.projectName).toLowerCase();
    if (!p.includes('holtz')) return;
    if (!str(t.date).startsWith('2026-06')) return;
    if (t.billable === false) return;
    allJune.push({ id: d.id, ...t });
  });
  const bumps = allJune.filter((t) => n(t.hours) > tracked(t) + 0.01);
  if (!bumps.length) console.log('  None — all June bill hours equal tracked (no +Hrs, no bump).');
  else bumps.forEach((t) => console.log('  ' + str(t.date) + ' bill=' + n(t.hours) + ' tracked=' + tracked(t) + ' | ' + str(t.service)));

  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
