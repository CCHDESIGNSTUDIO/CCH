#!/usr/bin/env node
'use strict';
/**
 * Sync INV-6051 (Manno- Imperatrice) from linked Time Ledger rows BEFORE client send.
 * - Rebuilds service line items from ledger (createTimeInvoice logic)
 * - Sets invoicedHours / invoicedAddedHrs / invoicedAmount snapshots on linked entries
 *
 * Usage:
 *   node _scripts/fix-inv6051-sync-from-ledger_BY_CURSOR_2026-07-10.js           # dry-run
 *   node _scripts/fix-inv6051-sync-from-ledger_BY_CURSOR_2026-07-10.js --apply   # write
 */
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const APPLY = process.argv.includes('--apply');
const BOARD_ID = 'manno-imperatrice';
const INV_DOC_ID = 'hblDcmpN7mbSFoFjTgr1';
const INV_NUM = 'INV-6051';

const KEY = require(path.join(__dirname, '..', '_debug', 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json'));
const db = admin.initializeApp({ credential: admin.credential.cert(KEY) }, 'fix6051').firestore();

const str = (v) => String(v == null ? '' : v).trim();
const n = (v) => parseFloat(v) || 0;
const r2 = (v) => Math.round(n(v) * 100) / 100;

function buildLineItems(entries) {
  const byService = {};
  entries.forEach((t) => {
    const key = str(t.service) || 'Services';
    if (!byService[key]) {
      byService[key] = { hours: 0, total: 0, noteLines: [], rate: n(t.rate) || n(t.hourlyRate), _dmin: '', _dmax: '' };
    }
    byService[key].hours += n(t.hours);
    byService[key].total += n(t.total);
    const lineText = str(t.notes || t.note || t.description);
    if (lineText) byService[key].noteLines.push(lineText);
    const d = str(t.date);
    if (d) {
      if (!byService[key]._dmin || d < byService[key]._dmin) byService[key]._dmin = d;
      if (!byService[key]._dmax || d > byService[key]._dmax) byService[key]._dmax = d;
    }
  });

  return Object.entries(byService).map(([service, data]) => {
    const hrs = data.hours || 0;
    const tot = data.total || 0;
    const effRate = hrs > 0 ? Math.round((tot / hrs) * 10000) / 10000 : (n(data.rate) || 0);
    const d0 = data._dmin || '';
    const d1 = data._dmax || data._dmin || '';
    return {
      title: service,
      description: '',
      lineNotes: data.noteLines.length ? data.noteLines.join('\n') : '',
      serviceDateStart: d0,
      serviceDateEnd: d1,
      expenseType: 'service',
      qty: hrs,
      cost: 0,
      markupPct: 0,
      shipping: 0,
      room: '',
      category: service,
      rate: effRate,
      amount: tot,
      taxable: false
    };
  });
}

function svcTotals(items) {
  let h = 0, $ = 0;
  (items || []).forEach((it) => {
    if (!it || !(it.expenseType === 'service' || it.itemType === 'service')) return;
    h += n(it.qty != null ? it.qty : it.quantity);
    $ += n(it.amount);
  });
  return { h: r2(h), $: r2($) };
}

function itemsSignature(items) {
  return (items || [])
    .map((it) => str(it.title) + '|' + r2(it.qty) + '|' + r2(it.amount) + '|' + r2(it.rate))
    .sort()
    .join(';;');
}

(async () => {
  const invRef = db.collection('boards').doc(BOARD_ID).collection('invoices').doc(INV_DOC_ID);
  const invSnap = await invRef.get();
  if (!invSnap.exists) throw new Error('Invoice not found');
  const invBefore = invSnap.data() || {};

  const teSnap = await db.collection('timeEntries').where('invoiceId', '==', INV_DOC_ID).get();
  const entries = [];
  teSnap.forEach((d) => entries.push({ id: d.id, ...d.data() }));

  if (!entries.length) throw new Error('No linked time entries');

  const newItems = buildLineItems(entries);
  const newTotal = r2(newItems.reduce((s, li) => s + n(li.amount), 0));
  const ledgerH = r2(entries.reduce((s, t) => s + n(t.hours), 0));
  const ledger$ = r2(entries.reduce((s, t) => s + n(t.total), 0));
  const addedHrs = r2(entries.reduce((s, t) => s + n(t.addedHrs), 0));
  const oldSvc = svcTotals(invBefore.items);
  const newSvc = svcTotals(newItems);

  const entryPatches = entries.map((t) => ({
    id: t.id,
    invoicedHours: n(t.hours),
    invoicedAddedHrs: n(t.addedHrs),
    invoicedAmount: n(t.total),
    invoiceProjectId: BOARD_ID,
    invoiceNumber: INV_NUM,
    invoiceNum: INV_NUM
  }));

  const backupDir = path.join(__dirname, '..', '_backup', 'inv6051-sync-2026-07-10');
  const report = {
    mode: APPLY ? 'APPLY' : 'DRY-RUN',
    invoice: INV_NUM,
    boardId: BOARD_ID,
    invDocId: INV_DOC_ID,
    status: str(invBefore.status),
    paidAmount: n(invBefore.paidAmount),
    entries: entries.length,
    ledgerH,
    ledger$,
    addedHrs,
    oldInvoiceSvcH: oldSvc.h,
    oldInvoiceSvc$: oldSvc.$,
    newInvoiceSvcH: newSvc.h,
    newInvoiceSvc$: newSvc.$,
    oldTotal: n(invBefore.total),
    newTotal,
    itemsChanged: itemsSignature(invBefore.items) !== itemsSignature(newItems),
    entrySnapshotsToWrite: entryPatches.filter((p) => true).length
  };

  console.log('=== INV-6051 sync from ledger (' + report.mode + ') ===');
  console.log('Status:', report.status, '| paid $' + report.paidAmount);
  console.log('Linked entries:', report.entries);
  console.log('Ledger: ' + report.ledgerH + 'h $' + report.ledger$ + ' (includes +' + report.addedHrs + 'h added on ' + entries.filter((t) => n(t.addedHrs) > 0).length + ' rows)');
  console.log('Invoice service lines NOW: ' + report.oldInvoiceSvcH + 'h $' + report.oldInvoiceSvc$ + ' total $' + report.oldTotal);
  console.log('Invoice service lines NEW: ' + report.newInvoiceSvcH + 'h $' + report.newInvoiceSvc$ + ' total $' + report.newTotal);
  console.log('Line items changed?', report.itemsChanged ? 'YES' : 'NO (already matches)');
  console.log('Entry snapshots (invoicedHours/invoicedAddedHrs):', report.entrySnapshotsToWrite, 'rows');

  console.log('\n--- Rebuilt lines ---');
  newItems.forEach((it, i) => {
    console.log('  [' + i + '] ' + it.title + ' | ' + r2(it.qty) + 'h @ ' + r2(it.rate) + ' = $' + r2(it.amount));
  });

  fs.mkdirSync(backupDir, { recursive: true });
  fs.writeFileSync(path.join(backupDir, 'BACKUP_invoice.json'), JSON.stringify({ id: INV_DOC_ID, ...invBefore }, null, 2));
  fs.writeFileSync(path.join(backupDir, 'BACKUP_timeEntries.json'), JSON.stringify(entries, null, 2));
  fs.writeFileSync(path.join(backupDir, APPLY ? 'APPLIED_report.json' : 'DRYRUN_report.json'), JSON.stringify(report, null, 2));
  console.log('\nBackup:', backupDir);

  if (!APPLY) {
    console.log('\nDRY-RUN only. Re-run with --apply to write.');
    process.exit(0);
  }

  const batch = db.batch();
  batch.update(invRef, {
    items: newItems,
    total: newTotal,
    timeEntryIds: entries.map((e) => e.id),
    updatedAt: new Date().toISOString(),
    _inv6051LedgerSyncAt: new Date().toISOString(),
    _inv6051LedgerSyncBy: 'fix-inv6051-sync-from-ledger_BY_CURSOR_2026-07-10.js'
  });

  entryPatches.forEach((p) => {
    batch.update(db.collection('timeEntries').doc(p.id), {
      invoicedHours: p.invoicedHours,
      invoicedAddedHrs: p.invoicedAddedHrs,
      invoicedAmount: p.invoicedAmount,
      invoiceProjectId: p.invoiceProjectId,
      invoiceNumber: p.invoiceNumber,
      invoiceNum: p.invoiceNum,
      updatedAt: new Date().toISOString()
    });
  });

  await batch.commit();
  console.log('\nAPPLIED: invoice lines + ' + entryPatches.length + ' entry snapshots.');
  process.exit(0);
})().catch((e) => {
  console.error('ERROR', e.message || e);
  process.exit(1);
});
