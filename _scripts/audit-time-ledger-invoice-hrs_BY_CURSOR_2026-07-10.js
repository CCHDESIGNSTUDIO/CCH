'use strict';
/**
 * READ-ONLY: Compare Time Ledger invoiced hours vs Studio invoice service-line qty.
 * Mirrors platform/index.html timeLedgerRefreshInvoiceHrsVerifyCache logic.
 *
 * Usage:
 *   node _scripts/audit-time-ledger-invoice-hrs_BY_CURSOR_2026-07-10.js
 *   node _scripts/audit-time-ledger-invoice-hrs_BY_CURSOR_2026-07-10.js --project=cloud-rolling-hills
 *   node _scripts/audit-time-ledger-invoice-hrs_BY_CURSOR_2026-07-10.js --since=2025-01
 */
const path = require('path');
const admin = require('firebase-admin');

const KEY = require(path.join(
  __dirname,
  '..',
  '_debug',
  'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json'
));
const db = admin.initializeApp({ credential: admin.credential.cert(KEY) }, 'PROD').firestore();

const str = (v) => String(v == null ? '' : v).trim();
const round2 = (n) => Math.round((parseFloat(n) || 0) * 100) / 100;

function invHrsSnapshot(t) {
  if (!t || !t.invoiceId) return 0;
  if (t.invoicedHours != null && t.invoicedHours !== '') return parseFloat(t.invoicedHours) || 0;
  return parseFloat(t.hours) || 0;
}

function billableHrs(t) {
  return parseFloat(t && t.hours) || 0;
}

function serviceQtyFromItems(items) {
  items = Array.isArray(items) ? items : [];
  let sum = 0;
  let any = false;
  items.forEach((it) => {
    if (!it) return;
    const q = parseFloat(it.qty != null ? it.qty : it.quantity) || 0;
    if (q <= 0) return;
    any = true;
    if (it.expenseType === 'service' || it.itemType === 'service') sum += q;
    else {
      const title = str(it.title || it.name || it.category).toLowerCase();
      if (/design|service|hour|consult|billing|time/.test(title)) sum += q;
    }
  });
  if (sum < 0.01 && any) {
    items.forEach((it) => {
      sum += parseFloat(it && (it.qty != null ? it.qty : it.quantity)) || 0;
    });
  }
  return round2(sum);
}

function parseArgs() {
  const out = { project: '', since: '' };
  process.argv.slice(2).forEach((a) => {
    if (a.startsWith('--project=')) out.project = a.split('=')[1];
    if (a.startsWith('--since=')) out.since = a.split('=')[1];
  });
  return out;
}

(async () => {
  const args = parseArgs();
  const snap = await db.collection('timeEntries').get();
  const entries = [];
  snap.forEach((d) => {
    const t = d.data() || {};
    if (!str(t.invoiceId)) return;
    if (args.since && str(t.date).slice(0, 7) < args.since) return;
    entries.push({ id: d.id, ...t });
  });

  const groups = {};
  entries.forEach((t) => {
    const pid = str(t.invoiceProjectId || t.projectId);
    const iid = str(t.invoiceId);
    if (!pid || !iid) return;
    if (args.project && pid !== args.project) return;
    const key = pid + '|' + iid;
    if (!groups[key]) {
      groups[key] = {
        pid,
        iid,
        invNum: str(t.invoiceNumber || t.invoiceNum),
        projectName: str(t.project || t.projectName),
        ledgerSnap: 0,
        ledgerBill: 0,
        entryCount: 0,
        legacyCount: 0,
        addedHrsSum: 0
      };
    }
    const g = groups[key];
    g.ledgerSnap += invHrsSnapshot(t);
    g.ledgerBill += billableHrs(t);
    g.entryCount++;
    g.addedHrsSum += parseFloat(t.addedHrs) || 0;
    if (t.invoicedHours == null || t.invoicedHours === '') g.legacyCount++;
  });

  const keys = Object.keys(groups).sort();
  let ok = 0;
  let mismatch = 0;
  let missingDoc = 0;
  const mismatchRows = [];

  for (let i = 0; i < keys.length; i++) {
    const g = groups[keys[i]];
    g.ledgerSnap = round2(g.ledgerSnap);
    g.ledgerBill = round2(g.ledgerBill);
    g.addedHrsSum = round2(g.addedHrsSum);

    let invQty = 0;
    let invExists = false;
    let invSource = '';
    try {
      const invSnap = await db.collection('boards').doc(g.pid).collection('invoices').doc(g.iid).get();
      invExists = invSnap.exists;
      if (invExists) {
        const data = invSnap.data() || {};
        if (!g.invNum) g.invNum = str(data.invoiceNum || data.number);
        invQty = serviceQtyFromItems(data.items);
        invSource = str(data.source);
      }
    } catch (e) {
      g.error = e.message || String(e);
    }

    g.invoiceQty = invQty;
    g.match = invExists && Math.abs(g.ledgerSnap - invQty) < 0.05;
    g.billMatch = invExists && Math.abs(g.ledgerBill - invQty) < 0.05;

    if (!invExists) {
      missingDoc++;
      mismatchRows.push({ ...g, reason: 'invoice doc missing' });
    } else if (!g.match) {
      mismatch++;
      mismatchRows.push({ ...g, reason: 'ledger snap vs invoice qty' });
    } else {
      ok++;
    }
  }

  console.log('=== TIME LEDGER vs INVOICE HOURS (production) ===');
  if (args.project) console.log('Filter project board id:', args.project);
  if (args.since) console.log('Filter since month:', args.since);
  console.log('Linked invoice groups:', keys.length);
  console.log('OK (ledger invoiced hrs = invoice service qty):', ok);
  console.log('MISMATCH:', mismatch);
  console.log('Missing invoice doc:', missingDoc);
  console.log('');

  if (mismatchRows.length) {
    console.log('--- Mismatches / missing (up to 40) ---');
    mismatchRows.slice(0, 40).forEach((g) => {
      console.log(
        [
          g.invNum || g.iid,
          g.projectName || g.pid,
          'entries=' + g.entryCount,
          'ledgerSnap=' + g.ledgerSnap + 'h',
          'ledgerBill=' + g.ledgerBill + 'h',
          'invoiceQty=' + g.invoiceQty + 'h',
          'legacyRows=' + g.legacyCount,
          g.addedHrsSum > 0 ? ('+hrs=' + g.addedHrsSum) : '',
          g.reason,
          g.error || ''
        ].filter(Boolean).join(' | ')
      );
    });
    if (mismatchRows.length > 40) console.log('... +' + (mismatchRows.length - 40) + ' more');
  }

  const rh = keys.filter((k) => k.startsWith('cloud-rolling-hills|'));
  if (rh.length && !args.project) {
    console.log('\n--- Cloud - Rolling Hills (' + rh.length + ' invoices) ---');
    rh.forEach((k) => {
      const g = groups[k];
      const flag = g.match ? 'OK' : (g.error ? 'ERR' : 'CHECK');
      console.log(
        flag + ' ' + (g.invNum || g.iid) +
        ' ledger=' + g.ledgerSnap + 'h invoice=' + g.invoiceQty + 'h' +
        (g.legacyCount ? ' legacy=' + g.legacyCount : '') +
        (g.addedHrsSum ? ' +hrs=' + g.addedHrsSum : '')
      );
    });
  }

  if (args.project && keys.length === 1) {
    const g = groups[keys[0]];
    console.log('\n--- Invoice doc items (service lines) ---');
    try {
      const invSnap = await db.collection('boards').doc(g.pid).collection('invoices').doc(g.iid).get();
      if (invSnap.exists) {
        const data = invSnap.data() || {};
        (data.items || []).forEach((it, idx) => {
          console.log(
            '  [' + idx + '] ' + str(it.title || it.category) +
            ' qty=' + (parseFloat(it.qty != null ? it.qty : it.quantity) || 0) +
            ' expenseType=' + str(it.expenseType) +
            ' amount=' + (parseFloat(it.amount) || 0)
          );
        });
        console.log('timeEntryIds on invoice:', (data.timeEntryIds || []).length);
      }
    } catch (e) {
      console.log('detail error:', e.message);
    }
    console.log('\n--- Linked ledger rows (first 15) ---');
    entries
      .filter((t) => str(t.invoiceProjectId || t.projectId) === g.pid && str(t.invoiceId) === g.iid)
      .slice(0, 15)
      .forEach((t) => {
        console.log(
          '  ' + str(t.date) + ' ' + str(t.member) +
          ' bill=' + billableHrs(t) + 'h snap=' + invHrsSnapshot(t) + 'h' +
          (t.invoicedHours == null || t.invoicedHours === '' ? ' legacy' : '') +
          (parseFloat(t.addedHrs) ? ' +hrs=' + t.addedHrs : '') +
          ' ' + str(t.service).slice(0, 24)
        );
      });
  }

  process.exit(0);
})().catch((e) => {
  console.error('ERROR', e.message || e);
  process.exit(1);
});
