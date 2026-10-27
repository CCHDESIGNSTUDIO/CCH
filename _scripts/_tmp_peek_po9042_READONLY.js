#!/usr/bin/env node
'use strict';
/** Read-only: PO-9042 bill/QB fields on production. No writes. */
const path = require('path');
const admin = require('firebase-admin');
const KEY = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
const db = admin.initializeApp({ credential: admin.credential.cert(require(KEY)) }, 'wo9042peek').firestore();

(async () => {
  const boards = await db.collection('boards').get();
  const hits = [];
  for (const b of boards.docs) {
    const pos = await b.ref.collection('purchaseOrders').get();
    pos.forEach((d) => {
      const po = d.data() || {};
      const num = String(po.number || po.poNum || po.num || d.id);
      if (num === 'PO-9042' || num === '9042' || d.id === 'PO-9042') hits.push({ projectId: b.id, project: (b.data() || {}).name, poId: d.id, po });
    });
  }
  if (!hits.length) {
    console.log('NO PO-9042');
    process.exit(0);
  }
  hits.forEach((h) => {
    const po = h.po;
    const bill = po.bill || {};
    console.log(JSON.stringify({
      projectId: h.projectId,
      project: h.project,
      poId: h.poId,
      number: po.number || po.poNum,
      vendor: po.vendor,
      poStatus: po.poStatus,
      status: po.status,
      date: po.date,
      qbDocId: po.qbDocId || '',
      qbSynced: !!po.qbSynced,
      billReceived: !!bill.received,
      vendorInvoiceNumber: bill.vendorInvoiceNumber || '',
      vendorInvoiceDate: bill.vendorInvoiceDate || '',
      billTotal: bill.billTotal,
      qbBillId: bill.qbBillId || '',
      qbPushError: bill.qbPushError || '',
      qbPushErrorAt: bill.qbPushErrorAt || '',
      billedPoLineIds: bill.billedPoLineIds || [],
      vendorInvoiceCount: (bill.vendorInvoices || []).length
    }, null, 2));
  });
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
