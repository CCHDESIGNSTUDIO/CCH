#!/usr/bin/env node
'use strict';
const path = require('path');
const admin = require('firebase-admin');
const KEY = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
const db = admin.initializeApp({ credential: admin.credential.cert(require(KEY)) }, 'invpo9900').firestore();

function slimPay(p) {
  if (!p || typeof p !== 'object') return p;
  const o = {};
  Object.keys(p).forEach((k) => {
    const v = p[k];
    if (v && typeof v.toDate === 'function') o[k] = v.toDate().toISOString();
    else o[k] = v;
  });
  return o;
}
function moneyLine(it, i) {
  it = it || {};
  const t = String(it.title || it.name || '').slice(0, 80);
  const desc = String(it.description || it.notes || '').slice(0, 80);
  const amt = it.amount != null ? it.amount : it.totalSelling;
  const hit = /9900|discount|sample|prototype/i.test(t + ' ' + desc + ' ' + String(amt));
  return {
    i, title: t, desc, qty: it.qty, cost: it.cost, amount: amt,
    markupPct: it.markupPct, hit
  };
}

(async () => {
  const board = db.collection('boards').doc('west-avalon');
  const invRef = board.collection('invoices').doc('vEsvMohWndbv6HqXMd8a');
  const pos = await board.collection('purchaseOrders').get();
  let poSnap = null;
  const poHits = [];
  pos.forEach((d) => {
    const x = d.data() || {};
    const num = String(x.poNum || x.number || d.id);
    const id = d.id;
    if (num.indexOf('400124') >= 0 || id === 'gblAgJURSIp1baB3MZO4' || id.indexOf('400124') >= 0 ||
        String(x.linkedInvoiceNum || '').indexOf('10161') >= 0) {
      poHits.push({
        id,
        poNum: x.poNum || x.number,
        vendor: x.vendor,
        total: x.total,
        paidAmount: x.paidAmount,
        totalPaid: x.totalPaid,
        status: x.status,
        paymentCount: (x.payments || []).length,
        payments: (x.payments || []).map(slimPay),
        billFrom: x.bill && x.bill.billFromVendor,
        billPaid: x.bill && x.bill.paidAmount
      });
      if (!poSnap) poSnap = d;
    }
  });
  const invSnap = await invRef.get();
  const inv = invSnap.exists ? invSnap.data() : null;
  const po = poSnap ? poSnap.data() : null;
  console.log(JSON.stringify({ poHits }, null, 2));
  if (!inv) { /* fall through */ }
  const invItems = (inv && inv.items) || [];
  const poItems = (po && po.items) || [];
  const out = {
    invoice: inv ? {
      path: invRef.path,
      invoiceNum: inv.invoiceNum || inv.number,
      status: inv.status,
      total: inv.total,
      paidAmount: inv.paidAmount,
      totalPaid: inv.totalPaid,
      paymentCount: inv.paymentCount,
      _wo243PaymentFixAt: inv._wo243PaymentFixAt || '',
      updatedAt: inv.updatedAt || '',
      payments: (inv.payments || []).map(slimPay),
      discountish: invItems.map(moneyLine).filter((x) => x.hit || Number(x.amount) < 0 || Number(x.cost) < 0),
      itemCount: invItems.length,
      itemSum: invItems.reduce((s, it) => s + (parseFloat(it.amount) || 0), 0)
    } : { missing: true },
    po: po ? {
      path: poSnap.ref.path,
      poNum: po.poNum || po.number,
      status: po.status,
      vendor: po.vendor,
      total: po.total,
      paidAmount: po.paidAmount,
      totalPaid: po.totalPaid,
      bill: po.bill ? {
        received: po.bill.received,
        billTotal: po.bill.billTotal || po.bill.total,
        paidAmount: po.bill.paidAmount,
        billFromVendor: po.bill.billFromVendor
      } : null,
      payments: (po.payments || []).map(slimPay),
      vendorInvoices: Array.isArray(po.vendorInvoices) ? po.vendorInvoices.map((v) => ({
        vendorInvoiceNumber: v.vendorInvoiceNumber || v.invoiceNumber,
        amount: v.amount || v.total,
        date: v.date || v.invoiceDate,
        method: v.method
      })) : undefined,
      discountish: poItems.map(moneyLine).filter((x) => x.hit || Number(x.amount) < 0 || Number(x.cost) < 0),
      itemCount: poItems.length,
      itemSum: poItems.reduce((s, it) => s + (parseFloat(it.amount) || parseFloat(it.total) || parseFloat(it.cost) * (parseFloat(it.qty) || 1) || 0), 0),
      titles: poItems.map((it, i) => i + ':' + String(it.title || '').slice(0, 50))
    } : { missing: true }
  };
  console.log(JSON.stringify(out, null, 2));
})().catch((e) => { console.error(e); process.exit(1); });
