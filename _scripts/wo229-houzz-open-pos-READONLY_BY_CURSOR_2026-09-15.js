#!/usr/bin/env node
'use strict';
/**
 * WO-229 read-only: Houzz-open POs on production vs Studio bill/QB fields.
 * Same open rule as #/allpos/pending (cchPoIsOpen).
 * No Firestore writes. Does not call QuickBooks (needs secrets + rotates refresh token).
 */
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const KEY = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
const db = admin.initializeApp({ credential: admin.credential.cert(require(KEY)) }, 'wo229').firestore();

function money(n) { return Math.round((parseFloat(n) || 0) * 100) / 100; }
function csvEsc(v) {
  const s = String(v == null ? '' : v);
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function poNum(po, id) {
  const n = String(po.number || po.poNum || po.num || '').trim();
  if (n) return n;
  const sid = String(id || po.id || '');
  if (sid.indexOf('clip-po-') === 0) return sid.slice(8);
  return sid.slice(0, 12);
}

function isHouzzPo(po, id) {
  const num = poNum(po, id);
  const digits = num.replace(/^PO-/i, '').replace(/\D/g, '');
  if (/^888\d{3,}$/.test(digits) || /^PO-888/i.test(num)) return true;
  if (String(id || '').indexOf('clip-po-') === 0) return true;
  const src = String(po.source || po.importSource || po.origin || '').toLowerCase();
  if (src.indexOf('houzz') >= 0) return true;
  if (po._fromClips || po._houzzImport || po.houzzId) return true;
  const qsrc = String(po._qbIdSource || '').toLowerCase();
  if (qsrc.indexOf('houzz') >= 0) return true;
  return false;
}

function isOpen(po) {
  const st = String(po.status || '').toLowerCase();
  const paySt = String(po.paymentStatus || '').toLowerCase();
  if (st === 'received' || st === 'cancelled' || st === 'installed' || st === 'paid' || st === 'closed' || st === 'delivered') return false;
  if (paySt === 'paid') return false;
  return true;
}

function paidOf(po) {
  let paySum = 0;
  if (Array.isArray(po.payments) && po.payments.length) {
    po.payments.forEach((e) => { paySum += parseFloat(e && (e.amount != null ? e.amount : e)) || 0; });
  }
  paySum = money(paySum);
  const direct = money(po.paidAmount);
  return Math.max(paySum, direct);
}

function totalOf(po) {
  const bill = po.bill || {};
  if (bill.received && bill.billTotal != null) return money(bill.billTotal);
  const t = money(po.total);
  if (t > 0) return t;
  if (Array.isArray(po.items) && po.items.length) {
    return money(po.items.reduce((s, it) => s + (parseFloat(it.amount || it.total || it.lineTotal) || ((parseFloat(it.qty) || 0) * (parseFloat(it.cost) || 0))), 0));
  }
  if (bill.poTotalAtSend != null) return money(bill.poTotalAtSend);
  return 0;
}

function qbPoId(po) {
  const q = po.qbDocId || po.qbInvoiceId || po.qbId || po.quickbooksDocId || po.houzzQbDocId;
  return q != null && String(q).trim() !== '' ? String(q).trim() : '';
}

(async () => {
  const boards = await db.collection('boards').get();
  const rows = [];
  const allOpen = [];
  const allDocs = [];
  const clipOnly = [];
  for (const b of boards.docs) {
    const pos = await b.ref.collection('purchaseOrders').get();
    const bName = String((b.data() || {}).name || (b.data() || {}).clientName || b.id);
    pos.forEach((d) => {
      const po = d.data() || {};
      po.id = d.id;
      const rec = {
        projectId: b.id,
        project: bName,
        poId: d.id,
        poNum: poNum(po, d.id),
        vendor: String(po.vendor || po.vendorName || '').trim(),
        status: String(po.status || ''),
        paymentStatus: String(po.paymentStatus || ''),
        open: isOpen(po),
        date: String(po.date || po.issueDate || po.createdAt || '').slice(0, 10),
        total: totalOf(po),
        paid: paidOf(po),
        remaining: 0,
        houzz: isHouzzPo(po, d.id),
        qbPoId: qbPoId(po),
        qbBillId: String((po.bill || {}).qbBillId || '').trim(),
        qbBillDoc: String((po.bill || {}).qbDocNumber || '').trim(),
        billReceived: !!(po.bill && po.bill.received),
        billTotal: po.bill && po.bill.billTotal != null ? money(po.bill.billTotal) : '',
        source: String(po.source || po.importSource || ''),
        itemCount: Array.isArray(po.items) ? po.items.length : 0,
        fromClips: false
      };
      rec.remaining = money(Math.max(0, rec.total - rec.paid));
      allDocs.push(rec);
      if (rec.open) allOpen.push(rec);
        if (rec.houzz && rec.open) rows.push(rec);
      });
      try {
        const clips = await b.ref.collection('clips').get();
        const byNum = {};
        clips.forEach((cd) => {
          const c = cd.data() || {};
          const pn = String(c.poNum || '').trim();
          if (!pn) return;
          if (!byNum[pn]) {
            byNum[pn] = {
              projectId: b.id, project: bName, poId: 'clip-po-' + pn, poNum: pn,
              vendor: String(c.vendor || ''), status: String(c.poStatus || 'Ordered'),
              paymentStatus: '', open: true, date: String(c.poDate || '').slice(0, 10),
              total: 0, paid: 0, remaining: 0, houzz: true, qbPoId: '', qbBillId: '',
              qbBillDoc: '', billReceived: false, billTotal: '', source: 'clip',
              itemCount: 0, fromClips: true
            };
            byNum[pn].open = isOpen({ status: byNum[pn].status, paymentStatus: '' });
          }
          byNum[pn].total = money(byNum[pn].total + (parseFloat(c.totalCost || c.cost) || 0));
          byNum[pn].paid = Math.max(byNum[pn].paid, money(c.paidAmount));
          byNum[pn].itemCount += 1;
          if (c.vendor && !byNum[pn].vendor) byNum[pn].vendor = c.vendor;
        });
        Object.keys(byNum).forEach((pn) => {
          const rec = byNum[pn];
          rec.remaining = money(Math.max(0, rec.total - rec.paid));
          rec.houzz = isHouzzPo({ number: pn, source: 'houzz' }, rec.poId) || true;
          const hasDoc = allDocs.some((x) => x.projectId === b.id && String(x.poNum).replace(/^PO-/i, '') === pn.replace(/^PO-/i, ''));
          if (hasDoc) return;
          clipOnly.push(rec);
          if (rec.open) {
            allOpen.push(rec);
            rows.push(rec);
          }
        });
      } catch (eClip) { /* clips optional */ }
    }

  rows.sort((a, b) => a.poNum.localeCompare(b.poNum) || a.project.localeCompare(b.project));

  const bucket = (r) => {
    if (r.remaining <= 0.02) return r.qbBillId || r.qbPoId ? 'studio_open_zero_due_has_qb' : 'studio_open_zero_due_no_qb';
    if (r.qbBillId) return 'studio_open_balance_has_qb_bill';
    if (r.qbPoId) return 'studio_open_balance_has_qb_po_only';
    return 'studio_open_balance_no_qb';
  };

  const counts = {};
  let dueHouzz = 0;
  rows.forEach((r) => {
    r.bucket = bucket(r);
    counts[r.bucket] = (counts[r.bucket] || 0) + 1;
    dueHouzz += r.remaining;
  });

  const byProject = {};
  rows.forEach((r) => {
    if (!byProject[r.project]) byProject[r.project] = { n: 0, due: 0, zero: 0 };
    byProject[r.project].n += 1;
    byProject[r.project].due += r.remaining;
    if (r.remaining <= 0.02) byProject[r.project].zero += 1;
  });

  const outDir = path.join(__dirname, '..', '_debug');
  const stamp = '2026-09-15';
  const csvPath = path.join(outDir, 'HOUZZ_OPEN_POS_VS_STUDIO_QB_FIELDS_BY_CURSOR_' + stamp + '.csv');
  const jsonPath = path.join(outDir, 'HOUZZ_OPEN_POS_VS_STUDIO_QB_FIELDS_BY_CURSOR_' + stamp + '.json');
  const headers = ['bucket', 'poNum', 'project', 'vendor', 'status', 'date', 'total', 'paid', 'remaining', 'qbBillDoc', 'qbBillId', 'qbPoId', 'billReceived', 'source', 'itemCount', 'projectId', 'poId'];
  const csv = [headers.join(',')].concat(rows.map((r) => headers.map((h) => csvEsc(r[h])).join(','))).join('\n');
  fs.writeFileSync(csvPath, csv);
  const summary = {
    generatedAt: new Date().toISOString(),
    source: 'production Firestore cch-design-boards',
    openRule: 'cchPoIsOpen: status not received/cancelled/installed/paid/closed/delivered and paymentStatus not paid',
    houzzRule: 'PO-888* or clip-po-* or source/houzz fields',
    qbNote: 'QB bill balances were NOT queried live. qbBillId/qbDocId are Studio-stored. Match to a QB Unpaid Bills export next.',
    allOpenCount: allOpen.length,
    houzzOpenCount: rows.length,
    poDocsTotal: allDocs.length,
    poDocsHouzz: allDocs.filter((r) => r.houzz).length,
    poDocsHouzzOpen: allDocs.filter((r) => r.houzz && r.open).length,
    poDocsHouzzClosed: allDocs.filter((r) => r.houzz && !r.open).length,
    clipOnlyOpen: clipOnly.filter((r) => r.open).length,
    openStudioSample: allOpen.filter((r) => !r.fromClips).slice(0, 25).map((r) => ({
      poNum: r.poNum, project: r.project, vendor: r.vendor, status: r.status, remaining: r.remaining, houzz: r.houzz
    })),
    houzzClosedStatusCounts: (function() {
      const c = {};
      allDocs.filter((r) => r.houzz && !r.open).forEach((r) => {
        const k = (r.status || '(blank)') + '|' + (r.paymentStatus || '');
        c[k] = (c[k] || 0) + 1;
      });
      return c;
    })(),
    houzzRemainingSum: money(dueHouzz),
    nonHouzzOpenCount: allOpen.length - rows.length,
    buckets: counts,
    byProject: Object.keys(byProject).sort().map((k) => ({
      project: k,
      openHouzz: byProject[k].n,
      zeroDue: byProject[k].zero,
      remaining: money(byProject[k].due)
    })),
    actuallyPending: rows.filter((r) => r.remaining > 0.02).map((r) => ({
      poNum: r.poNum, project: r.project, vendor: r.vendor, remaining: r.remaining,
      qbBillId: r.qbBillId || '', qbPoId: r.qbPoId || '', bucket: r.bucket
    }))
  };
  fs.writeFileSync(jsonPath, JSON.stringify(summary, null, 2));
  console.log(JSON.stringify({
    allOpen: allOpen.length,
    houzzOpen: rows.length,
    poDocs: allDocs.length,
    poDocsHouzz: allDocs.filter((r) => r.houzz).length,
    clipOnly: clipOnly.length,
    houzzRemainingSum: money(dueHouzz),
    buckets: counts,
    csv: csvPath,
    json: jsonPath
  }, null, 2));
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
