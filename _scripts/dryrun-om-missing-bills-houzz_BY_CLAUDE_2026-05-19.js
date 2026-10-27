#!/usr/bin/env node
'use strict';
/**
 * Dry-run: Order Management KPIs after Houzz + missing-bills fix (read-only).
 *   node dryrun-om-missing-bills-houzz_BY_CLAUDE_2026-05-19.js
 */
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const KEY = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
admin.initializeApp({ credential: admin.credential.cert(require(KEY)) });
const db = admin.firestore();
const OUT = path.join(__dirname, '..', '_backup', 'om-houzz-missing-bills-dryrun-2026-05-19');

function poNum(po) {
  return String(po.number || po.num || po.poNum || po.poNumber || '').trim();
}
function poTotal(po) {
  if (po.items && po.items.length) {
    let t = 0;
    po.items.forEach((l) => { t += (parseFloat(l.cost) || 0) * (parseFloat(l.qty) || 1); });
    if (t > 0) return t;
  }
  return parseFloat(po.total) || 0;
}
function omPaid(po) {
  let s = 0;
  (po.payments || []).forEach((e) => { s += parseFloat(e && (e.amount != null ? e.amount : e)) || 0; });
  if (s > 0.001) return s;
  const d = parseFloat(po.paidAmount);
  return Number.isNaN(d) ? 0 : d;
}
function isLegacy400(po) { return /^(?:po[-\s]?)?400\d+$/i.test(poNum(po)); }
function isHouzzSource(po) {
  if (!po) return false;
  if (po.houzzImport === true) return true;
  const src = String(po.source || po.dataSource || po.origin || '').trim().toLowerCase();
  if (src === 'houzz-import' || src === 'houzz_import' || src.indexOf('houzz') >= 0) return true;
  if (po.houzzBalance != null && po.houzzBalance !== '') return true;
  if (String(po._qbIdSource || '').toLowerCase() === 'houzz-import') return true;
  for (const p of po.payments || []) {
    if (String((p || {}).method || '').toLowerCase().indexOf('houzz') >= 0) return true;
  }
  if (isLegacy400(po)) return true;
  return false;
}
function isOpen(po) {
  const st = String(po.status || '').toLowerCase();
  if (['received', 'cancelled', 'installed', 'paid', 'closed', 'delivered'].includes(st)) return false;
  if (String(po.paymentStatus || '').toLowerCase() === 'paid') return false;
  return true;
}
function isZeroBal(po) { return Math.abs(poTotal(po) - omPaid(po)) <= 0.02; }
function hideFromOm(po) {
  if (!isHouzzSource(po)) return false;
  if (!isOpen(po)) return true;
  if (isZeroBal(po)) return true;
  return false;
}
function procLane(po) {
  const proc = String(po.procurementStatus || '').trim();
  if (proc === 'Confirmed') return 'confirmed';
  if (proc === 'Waiting for Confirmation' || proc === 'Sent to Vendor') return 'waiting';
  if (po.poSentAt || po.poLocked || String(po.poStatus || '').trim().toLowerCase() === 'sent') return 'waiting';
  return 'draft';
}
function billReceived(po) {
  const bill = po.bill || {};
  return !!(bill.received || bill.qbBillId);
}
function pastDraftForBilling(po) {
  if (procLane(po) !== 'draft') return true;
  const st = String(po.status || '').trim().toLowerCase();
  return ['waiting for confirmation', 'ordered', 'back ordered', 'shipped', 'partial',
    'partially received', 'sent to vendor', 'open', 'confirmed', 'pending',
    'partially paid', 'no status'].includes(st);
}
function billLane(po) {
  if (!isOpen(po)) return 'closed';
  if (billReceived(po)) return 'received';
  if (procLane(po) === 'draft') return 'na';
  return 'pending';
}
function needsBill(po) {
  if (!isOpen(po) || hideFromOm(po)) return false;
  if (billReceived(po)) return false;
  if (isHouzzSource(po)) {
    if (isZeroBal(po)) return false;
    if (po.qbDocId) return false;
    return true;
  }
  const lane = billLane(po);
  if (lane === 'pending' || lane === 'partial') return true;
  return pastDraftForBilling(po);
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const pos = [];
  for (const b of (await db.collection('boards').get()).docs) {
    (await b.ref.collection('purchaseOrders').get()).forEach((d) => {
      pos.push({ id: d.id, projectId: b.id, ...d.data() });
    });
  }
  const trackable = pos.filter((p) => !hideFromOm(p));
  const allOpen = trackable.filter(isOpen);
  const noBill = allOpen.filter(needsBill);
  const houzzHidden = pos.filter(hideFromOm);
  const houzzOpenInOm = allOpen.filter(isHouzzSource);
  const noBillStudio = noBill.filter((p) => !isHouzzSource(p));
  const noBillHouzz = noBill.filter(isHouzzSource);

  const report = {
    ts: new Date().toISOString(),
    totalPoDocs: pos.length,
    houzzHiddenClosedOrPaid: houzzHidden.length,
    openTrackable: allOpen.length,
    houzzOpenIncluded: houzzOpenInOm.length,
    studioOpenIncluded: allOpen.length - houzzOpenInOm.length,
    missingBillsTotal: noBill.length,
    missingBillsStudio: noBillStudio.length,
    missingBillsHouzz: noBillHouzz.length,
    missingBillsStudioList: noBillStudio.map((p) => ({
      po: poNum(p), project: p.projectId, status: p.status, lane: billLane(p),
    })),
    missingBillsHouzzSample: noBillHouzz.slice(0, 40).map((p) => ({
      po: poNum(p), project: p.projectId, status: p.status,
      due: Math.round((poTotal(p) - omPaid(p)) * 100) / 100,
    })),
    openHouzzSample: houzzOpenInOm.slice(0, 30).map((p) => ({
      po: poNum(p), project: p.projectId, status: p.status,
      total: poTotal(p), paid: omPaid(p),
    })),
  };

  fs.writeFileSync(path.join(OUT, 'dry-run-report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({
    houzzHiddenClosedOrPaid: report.houzzHiddenClosedOrPaid,
    openTrackable: report.openTrackable,
    houzzOpenIncluded: report.houzzOpenIncluded,
    missingBills: report.missingBillsTotal,
    missingBillsStudio: report.missingBillsStudio,
    missingBillsHouzz: report.missingBillsHouzz,
    reportPath: OUT,
  }, null, 2));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
