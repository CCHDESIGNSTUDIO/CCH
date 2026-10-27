#!/usr/bin/env node
'use strict';
/** READ-ONLY: Holtz Hill June 2026 time — tracked, +hrs, bill, invoice link */
const path = require('path');
const admin = require('firebase-admin');
const KEY = require(path.join(__dirname, '..', '_debug', 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json'));
const db = admin.initializeApp({ credential: admin.credential.cert(KEY) }, 'holtz').firestore();

const str = (v) => String(v == null ? '' : v).trim();
const n = (v) => parseFloat(v) || 0;
const r2 = (v) => Math.round(n(v) * 100) / 100;

const JUNE = '2026-06';
const HOLTZ_NAMES = ['holtz hill', 'holtz-hill', 'holtz'];

function isHoltz(t) {
  const p = str(t.project || t.projectName).toLowerCase();
  const pid = str(t.projectId || t.invoiceProjectId).toLowerCase();
  return HOLTZ_NAMES.some((h) => p.includes('holtz') || pid.includes('holtz'));
}

function tracked(t) {
  if (t.trackedHrs != null && t.trackedHrs !== '') return n(t.trackedHrs);
  return Math.max(0, n(t.hours) - n(t.addedHrs));
}

function inJune(t) {
  const d = str(t.date);
  return d.slice(0, 7) === JUNE;
}

(async () => {
  const snap = await db.collection('timeEntries').get();
  const june = [];
  const juneAll = [];
  snap.forEach((d) => {
    const t = { id: d.id, ...d.data() };
    if (!isHoltz(t)) return;
    if (!inJune(t)) return;
    juneAll.push(t);
    if (t.billable === false) return;
    const h = n(t.hours);
    if (h <= 0 && n(t.addedHrs) <= 0) return;
    june.push(t);
  });

  june.sort((a, b) => str(a.date).localeCompare(str(b.date)) || str(a.service).localeCompare(str(b.service)));

  let T = { tracked: 0, added: 0, bill: 0, amt: 0, invH: 0, inv$: 0, unbH: 0, unb$: 0 };
  const bySvc = {};
  const byInv = {};

  console.log('=== Holtz Hill — June 2026 billable time ===\n');
  console.log('Date       | Service                    | Tracked | +Hrs | Bill | Rate  | Amount  | Invoice');
  console.log('-----------|----------------------------|---------|------|------|-------|---------|--------');

  june.forEach((t) => {
    const tr = tracked(t);
    const ad = n(t.addedHrs);
    const bl = n(t.hours);
    const rate = n(t.rate) || n(t.hourlyRate);
    const amt = n(t.total);
    const inv = str(t.invoiceNumber || t.invoiceNum) || (str(t.invoiceId) ? '(linked)' : '—');

    T.tracked += tr;
    T.added += ad;
    T.bill += bl;
    T.amt += amt;

    if (str(t.invoiceId)) {
      T.invH += bl;
      T.inv$ += amt;
      const ik = inv || str(t.invoiceId);
      if (!byInv[ik]) byInv[ik] = { h: 0, $: 0, added: 0, rows: 0 };
      byInv[ik].h += bl;
      byInv[ik].$ += amt;
      byInv[ik].added += ad;
      byInv[ik].rows++;
    } else {
      T.unbH += bl;
      T.unb$ += amt;
    }

    const svc = str(t.service) || 'Services';
    if (!bySvc[svc]) bySvc[svc] = { tracked: 0, added: 0, bill: 0, amt: 0, rows: 0 };
    bySvc[svc].tracked += tr;
    bySvc[svc].added += ad;
    bySvc[svc].bill += bl;
    bySvc[svc].amt += amt;
    bySvc[svc].rows++;

    console.log(
      str(t.date).slice(0, 10) + ' | ' +
      (svc + '                        ').slice(0, 26) + ' | ' +
      String(r2(tr)).padStart(7) + ' | ' +
      String(r2(ad)).padStart(4) + ' | ' +
      String(r2(bl)).padStart(4) + ' | ' +
      String(r2(rate)).padStart(5) + ' | ' +
      ('$' + r2(amt)).padStart(7) + ' | ' + inv
    );
  });

  console.log('-----------|----------------------------|---------|------|------|-------|---------|--------');
  console.log(
    'TOTAL      |                            | ' +
    String(r2(T.tracked)).padStart(7) + ' | ' +
    String(r2(T.added)).padStart(4) + ' | ' +
    String(r2(T.bill)).padStart(4) + ' |       | ' +
    ('$' + r2(T.amt)).padStart(7)
  );

  console.log('\n--- June summary ---');
  console.log('Billable rows:', june.length, '(non-billable June rows excluded:', juneAll.length - june.length + ')');
  console.log('Tracked hrs:  ', r2(T.tracked));
  console.log('+ Hrs:        ', r2(T.added), '(' + june.filter((t) => n(t.addedHrs) > 0).length + ' rows)');
  console.log('Bill Hrs:     ', r2(T.bill), ' (tracked + added =', r2(T.tracked + T.added) + ')');
  console.log('Amount:       ', '$' + r2(T.amt));
  console.log('Studio-linked:', r2(T.invH) + 'h $' + r2(T.inv$));
  console.log('Not linked:   ', r2(T.unbH) + 'h $' + r2(T.unb$), '(skip per Houzz # work)');

  console.log('\n--- By service ---');
  Object.keys(bySvc).sort().forEach((svc) => {
    const g = bySvc[svc];
    console.log('  ' + svc + ': bill ' + r2(g.bill) + 'h (tracked ' + r2(g.tracked) + ' +hrs ' + r2(g.added) + ') $' + r2(g.amt) + ' | ' + g.rows + ' rows');
  });

  if (Object.keys(byInv).length) {
    console.log('\n--- By Studio invoice link ---');
    for (const [inv, g] of Object.entries(byInv)) {
      console.log('  ' + inv + ': ' + r2(g.h) + 'h (+hrs ' + r2(g.added) + ') $' + r2(g.$) + ' | ' + g.rows + ' rows');
    }
  }

  // Rows with +hrs detail
  const addedRows = june.filter((t) => n(t.addedHrs) > 0.001);
  if (addedRows.length) {
    console.log('\n--- Extra hours (+Hrs) detail ---');
    addedRows.forEach((t) => {
      console.log('  ' + str(t.date).slice(0, 10) + ' | +' + r2(t.addedHrs) + 'h → bill ' + r2(t.hours) + 'h $' + r2(t.total) + ' | ' + str(t.service) + ' | inv ' + (str(t.invoiceNumber || t.invoiceNum) || '—'));
    });
    console.log('  Total +Hrs in June:', r2(addedRows.reduce((s, t) => s + n(t.addedHrs), 0)) + 'h');
    console.log('  +Hrs $ value:', '$' + r2(addedRows.reduce((s, t) => s + n(t.addedHrs) * (n(t.rate) || n(t.hourlyRate)), 0)));
  } else {
    console.log('\nNo +Hrs rows in June (addedHrs field empty on all June billable rows).');
  }

  // Check Holtz time-tracker invoices that include June dates
  const boards = ['holtz-hill', 'holtz hill'];
  console.log('\n--- Holtz time-tracker invoices (June-overlap check) ---');
  for (const bid of ['holtz-hill']) {
    const invs = await db.collection('boards').doc(bid).collection('invoices').get();
    invs.forEach((d) => {
      const x = d.data() || {};
      if (str(x.source) !== 'time-tracker') return;
      const num = str(x.invoiceNum || x.number);
      let svcH = 0, svc$ = 0;
      (x.items || []).forEach((it) => {
        if (it && (it.expenseType === 'service' || it.itemType === 'service')) {
          svcH += n(it.qty != null ? it.qty : it.quantity);
          svc$ += n(it.amount);
        }
      });
      const linked = june.filter((t) => str(t.invoiceId) === d.id);
      const linkedH = r2(linked.reduce((s, t) => s + n(t.hours), 0));
      const linkedAdded = r2(linked.reduce((s, t) => s + n(t.addedHrs), 0));
      const juneOnInv = linked.length;
      if (juneOnInv || (str(x.notes).includes('2026-06') || (x.items || []).some((it) => str(it.serviceDateStart).startsWith('2026-06') || str(it.serviceDateEnd).startsWith('2026-06')))) {
        console.log('  ' + num + ' [' + str(x.status) + '] invoice ' + r2(svcH) + 'h $' + r2(svc$) +
          ' | June rows linked: ' + juneOnInv + ' (' + linkedH + 'h, +hrs ' + linkedAdded + ')');
      }
    });
  }

  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
