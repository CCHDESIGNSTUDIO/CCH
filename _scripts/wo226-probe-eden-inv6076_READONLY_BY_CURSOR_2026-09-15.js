#!/usr/bin/env node
'use strict';
/**
 * Read-only: Eden - Van Dyke time rows (Aug 16-31) + INV-6076.
 * No writes.
 */
const path = require('path');
const admin = require('firebase-admin');
const KEY = path.join(__dirname, '..', '_debug', 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
const db = admin.initializeApp({ credential: admin.credential.cert(require(KEY)) }, 'eden6076').firestore();

function money(v) { return (Math.round((parseFloat(v) || 0) * 100) / 100).toFixed(2); }

(async () => {
  const teSnap = await db.collection('timeEntries').get();
  const eden = [];
  teSnap.forEach((d) => {
    const x = d.data() || {};
    const proj = String(x.project || x.projectName || '');
    const member = String(x.member || x.user || x.createdBy || '');
    const date = String(x.date || '').slice(0, 10);
    if (!/eden/i.test(proj)) return;
    if (!/vanessa/i.test(member)) return;
    if (date < '2026-08-16' || date > '2026-08-31') return;
    eden.push({
      id: d.id,
      date,
      member,
      project: proj,
      service: x.service || '',
      billable: x.billable,
      hours: x.hours,
      trackedHrs: x.trackedHrs,
      addedHrs: x.addedHrs,
      addedReason: x.addedReason || '',
      rate: x.rate,
      invoiceNumber: x.invoiceNumber || x.invoiceNum || '',
      invoiceId: x.invoiceId || '',
      note: String(x.note || x.description || '').slice(0, 80)
    });
  });
  eden.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  console.log('=== Eden timeEntries Vanessa Aug 16-31 ===');
  console.log('count', eden.length);
  eden.forEach((r, i) => {
    console.log(JSON.stringify({ i, last: i === eden.length - 1, ...r }));
  });
  const last = eden[eden.length - 1];
  console.log('LAST ENTRY (payout project category uses this):', last ? { date: last.date, billable: last.billable, service: last.service, hours: last.hours } : null);

  const boards = await db.collection('boards').get();
  let found = null;
  for (const b of boards.docs) {
    const invs = await b.ref.collection('invoices').where('invoiceNum', '==', 'INV-6076').get();
    const invs2 = invs.empty ? await b.ref.collection('invoices').where('number', '==', 'INV-6076').get() : invs;
    invs2.forEach((d) => {
      const x = d.data() || {};
      found = {
        board: b.id,
        boardName: x.projectName || b.id,
        id: d.id,
        num: x.invoiceNum || x.number,
        status: x.status,
        published: !!x.published,
        date: x.date || x.invoiceDate || x.sentAt || '',
        total: money(x.total),
        lines: (x.items || x.lineItems || []).map((it) => ({
          title: it.title || it.description || it.name || '',
          qty: it.qty,
          rate: it.rate || it.price || it.unitPrice,
          amount: it.amount,
          hours: it.hours
        }))
      };
    });
    if (found) break;
  }
  if (!found) {
    for (const b of boards.docs) {
      const invs = await b.ref.collection('invoices').get();
      invs.forEach((d) => {
        const x = d.data() || {};
        const num = String(x.invoiceNum || x.number || d.id);
        if (num === 'INV-6076' || num.indexOf('6076') >= 0) {
          found = { board: b.id, id: d.id, num, status: x.status, total: money(x.total), published: !!x.published };
        }
      });
      if (found) break;
    }
  }
  console.log('=== INV-6076 ===');
  console.log(JSON.stringify(found, null, 2));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
