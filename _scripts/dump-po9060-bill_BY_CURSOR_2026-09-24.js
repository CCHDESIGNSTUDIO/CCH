/**
 * PRODUCTION read-only: PO-9060 bill lines vs stored price changes.
 *   node _scripts\dump-po9060-bill_BY_CURSOR_2026-09-24.js
 */
'use strict';
const path = require('path');
const admin = require('firebase-admin');
const KEY = path.join(__dirname, '..', '_debug', 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
const app = admin.initializeApp({ credential: admin.credential.cert(require(KEY)) }, 'dump9060');
const db = app.firestore();

function n(v) {
  const x = parseFloat(v);
  return Number.isFinite(x) ? Math.round(x * 100) / 100 : null;
}

(async function main() {
  const col = db.collection('boards').doc('cloud-rolling-hills').collection('purchaseOrders');
  const snap = await col.get();
  const hits = [];
  snap.forEach(function (d) {
    const x = d.data() || {};
    const num = String(x.poNumber || x.number || '');
    if (num.indexOf('9060') >= 0) hits.push(d.id);
  });
  console.log('ids', hits.join(','));
  for (const id of hits) {
    const d = (await col.doc(id).get()).data() || {};
    const b = d.bill || {};
    console.log('DOC', JSON.stringify({
      id: id,
      poNumber: d.poNumber || d.number,
      vendor: d.vendor,
      total: n(d.total),
      poTotalAtSend: n(d.poTotalAtSend),
      poLocked: d.poLocked,
      poStatus: d.poStatus,
      billTotal: n(b.billTotal),
      poSubtotal: n(b.poSubtotal),
      additionalSubtotal: n(b.additionalSubtotal),
      freight: n(b.freight),
      tax: n(b.tax),
      priceChange: n(b.priceChange),
      extras: n(b.extras),
      variance: d.variance || null,
      vendorInvoiceNumber: b.vendorInvoiceNumber || '',
      qbBillId: b.qbBillId || '',
      studioUpdatedAt: b.studioUpdatedAt || '',
      receivedAt: b.receivedAt || ''
    }));
    console.log('PO_LINES');
    (d.items || []).forEach(function (it) {
      console.log(JSON.stringify({
        title: String(it.title || it.name || '').slice(0, 70),
        qty: it.qty,
        cost: n(it.cost),
        amount: n(it.amount),
        shipping: n(it.shipping),
        id: it.id || it.lineId || ''
      }));
    });
    console.log('BILL_PO_LINES');
    (b.poLines || []).forEach(function (it) {
      console.log(JSON.stringify({
        title: String(it.title || '').slice(0, 70),
        qty: it.qty,
        cost: n(it.cost),
        amount: n(it.amount),
        lineId: it.lineId || ''
      }));
    });
    console.log('VENDOR_INVOICES');
    (b.vendorInvoices || []).forEach(function (r) {
      console.log(JSON.stringify({
        type: r.type,
        amount: n(r.amount),
        desc: String(r.description || '').slice(0, 80),
        inv: r.invoiceUnitPrice,
        po: r.poUnitPrice,
        qty: r.qty
      }));
    });
    console.log('BILL_ITEMS');
    (b.items || []).forEach(function (it) {
      console.log(JSON.stringify({
        source: it.source,
        title: String(it.title || '').slice(0, 80),
        amount: n(it.amount),
        inv: it.invoiceUnitPrice,
        po: it.poUnitPrice,
        qty: it.qty
      }));
    });
  }
  process.exit(0);
})().catch(function (e) {
  console.error(e.message || e);
  process.exit(1);
});
