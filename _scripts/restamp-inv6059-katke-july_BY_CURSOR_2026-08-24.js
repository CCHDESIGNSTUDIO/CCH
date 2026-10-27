#!/usr/bin/env node
'use strict';
/**
 * Restamp Katke July hours onto INV-6059 after INV-6058 discard unlinked the rows.
 *
 *   node _scripts/restamp-inv6059-katke-july_BY_CURSOR_2026-08-24.js
 *   node _scripts/restamp-inv6059-katke-july_BY_CURSOR_2026-08-24.js --apply
 */
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const APPLY = process.argv.includes('--apply');
const BOARD_ID = 'katke-graceland-dr';
const INV_NUM = 'INV-6059';
const DATE_FROM = '2026-07-01';
const DATE_TO = '2026-07-31';

const KEY = require(path.join(
  __dirname,
  '..',
  '_debug',
  'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json'
));
const db = admin.initializeApp({ credential: admin.credential.cert(KEY) }, 'restamp6059').firestore();

const str = (v) => String(v == null ? '' : v).trim();
const n = (v) => parseFloat(v) || 0;
const r2 = (v) => Math.round(n(v) * 100) / 100;

function looksKatke(t) {
  const pid = str(t.projectId).toLowerCase();
  const name = str(t.project).toLowerCase();
  if (pid === BOARD_ID) return true;
  if (name.includes('katke')) return true;
  if (name.includes('graceland')) return true;
  return false;
}

function dateInJuly(t) {
  const d = str(t.date);
  return d >= DATE_FROM && d <= DATE_TO;
}

(async () => {
  const invs = await db.collection('boards').doc(BOARD_ID).collection('invoices').get();
  let invDoc = null;
  invs.forEach((d) => {
    const x = d.data() || {};
    const num = str(x.invoiceNum || x.number);
    if (num === INV_NUM) invDoc = { id: d.id, ...x };
  });
  if (!invDoc) throw new Error(INV_NUM + ' not found on ' + BOARD_ID);

  const invTotal = r2(invDoc.total || invDoc.amount);
  const listedIds = (invDoc.timeEntryIds || []).map(str).filter(Boolean);
  const projectName = str(invDoc.projectName) || 'Katke - Graceland Dr.';

  console.log('Invoice', INV_NUM, 'doc', invDoc.id);
  console.log('  status', str(invDoc.status), 'source', str(invDoc.source), 'total', invTotal);
  console.log('  tags', str(invDoc.documentTags || invDoc.shortDescription));
  console.log('  timeEntryIds on invoice', listedIds.length);

  const listed = [];
  for (let i = 0; i < listedIds.length; i++) {
    const snap = await db.collection('timeEntries').doc(listedIds[i]).get();
    if (snap.exists) listed.push({ id: snap.id, ...snap.data() });
    else listed.push({ id: listedIds[i], _missing: true });
  }

  const allTe = [];
  const teSnap = await db.collection('timeEntries').get();
  teSnap.forEach((d) => allTe.push({ id: d.id, ...d.data() }));

  const julyKatke = allTe.filter((t) => looksKatke(t) && dateInJuly(t) && t.billable !== false);
  const alreadyThis = allTe.filter((t) => str(t.invoiceId) === invDoc.id || str(t.invoiceNumber) === INV_NUM || str(t.invoiceNum) === INV_NUM);
  const uninvoicedJuly = julyKatke.filter((t) => !str(t.invoiceId));

  console.log('  rows already pointing at 6059', alreadyThis.length);
  console.log('  July Katke billable rows', julyKatke.length);
  console.log('  July Katke uninvoiced', uninvoicedJuly.length, 'h', r2(uninvoicedJuly.reduce((s, t) => s + n(t.hours), 0)), '$', r2(uninvoicedJuly.reduce((s, t) => s + n(t.total), 0)));

  let targets = [];
  if (listedIds.length) {
    listed.forEach((t) => {
      if (t._missing) return;
      const cur = str(t.invoiceId);
      if (cur && cur !== invDoc.id) {
        console.log('  SKIP listed id already on other invoice', t.id, cur, str(t.invoiceNumber));
        return;
      }
      targets.push(t);
    });
  }
  if (!targets.length) {
    targets = uninvoicedJuly.slice();
  } else {
    uninvoicedJuly.forEach((t) => {
      if (!targets.some((x) => x.id === t.id)) targets.push(t);
    });
  }

  const targetHrs = r2(targets.reduce((s, t) => s + n(t.hours), 0));
  const targetAmt = r2(targets.reduce((s, t) => s + n(t.total), 0));
  console.log('\nWould restamp', targets.length, 'rows ·', targetHrs, 'h · $' + targetAmt);
  targets.sort((a, b) => str(a.date).localeCompare(str(b.date)) || str(a.member).localeCompare(str(b.member)));
  targets.forEach((t) => {
    console.log(
      '  ',
      str(t.date),
      '|',
      str(t.member).slice(0, 22),
      '|',
      n(t.hours),
      'h | $' + r2(t.total),
      '| curInv',
      str(t.invoiceId) || '—',
      str(t.invoiceNumber || t.invoiceNum) || ''
    );
  });

  if (Math.abs(targetAmt - invTotal) > 0.5) {
    console.log('\nAMOUNT MISMATCH vs invoice $' + invTotal + ' — aborting apply even if --apply.');
    if (APPLY) process.exit(2);
  }

  const backup = {
    when: new Date().toISOString(),
    invoice: {
      id: invDoc.id,
      invoiceNum: INV_NUM,
      total: invTotal,
      timeEntryIds: listedIds,
      projectName
    },
    targets: targets.map((t) => ({
      id: t.id,
      date: t.date,
      member: t.member,
      hours: t.hours,
      total: t.total,
      project: t.project,
      projectId: t.projectId,
      invoiceId: t.invoiceId || null,
      invoiceNumber: t.invoiceNumber || t.invoiceNum || null,
      invoiceProjectId: t.invoiceProjectId || null
    }))
  };
  const backupDir = path.join(__dirname, '..', '_backup', 'inv6059-restamp-2026-08-24');
  fs.mkdirSync(backupDir, { recursive: true });
  const backupPath = path.join(backupDir, APPLY ? 'after-apply.json' : 'dry-run.json');
  fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));
  console.log('\nBackup', backupPath);

  if (!APPLY) {
    console.log('\nDRY RUN. Pass --apply to write invoiceId/invoiceNumber/invoiceProjectId onto those rows.');
    process.exit(0);
  }

  const batch = db.batch();
  const now = new Date().toISOString();
  targets.forEach((t) => {
    const ref = db.collection('timeEntries').doc(t.id);
    batch.update(ref, {
      invoiceId: invDoc.id,
      invoiceNumber: INV_NUM,
      invoiceNum: INV_NUM,
      invoicedAmount: n(t.total),
      invoicedHours: n(t.hours),
      invoicedAddedHrs: n(t.addedHrs),
      invoiceProjectId: BOARD_ID,
      projectId: BOARD_ID,
      project: projectName,
      updatedAt: now
    });
  });
  const invRef = db.collection('boards').doc(BOARD_ID).collection('invoices').doc(invDoc.id);
  batch.update(invRef, {
    timeEntryIds: targets.map((t) => t.id),
    projectId: BOARD_ID,
    projectName: projectName,
    updatedAt: now
  });
  await batch.commit();
  console.log('\nAPPLIED. Restamped', targets.length, 'time entries onto', INV_NUM, 'board', BOARD_ID);
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
