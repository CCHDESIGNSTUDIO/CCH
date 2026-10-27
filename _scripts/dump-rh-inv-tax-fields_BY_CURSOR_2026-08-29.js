'use strict';
const path = require('path');
const admin = require('firebase-admin');
const KEY = path.join(__dirname, '..', '_debug', 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
const app = admin.initializeApp({ credential: admin.credential.cert(require(KEY)) }, 'dumpRh');
const db = app.firestore();
(async function () {
  const board = await db.collection('boards').doc('cloud-rolling-hills').get();
  const bd = board.data() || {};
  console.log('board_tax', bd.taxRate, bd.salesTaxRate, bd.defaultTaxRate);
  const want = { 'INV-6065':1,'INV-6069':1,'INV-6068':1,'INV-6067':1,'INV-6064':1 };
  const snap = await db.collection('boards').doc('cloud-rolling-hills').collection('invoices').get();
  snap.forEach(function (d) {
    const x = d.data() || {};
    const num = String(x.invoiceNum || x.number || '');
    if (!want[num]) return;
    console.log(JSON.stringify({
      num: num,
      id: d.id,
      status: x.status,
      taxRate: x.taxRate,
      tax: x.tax,
      taxAmount: x.taxAmount,
      subtotal: x.subtotal,
      total: x.total,
      qbDocId: x.qbDocId || '',
      squareUrl: !!String(x.squareCheckoutUrl || '').trim(),
      squareCents: x.squareCheckoutAmountCents || 0,
      items: (x.items || []).length
    }));
  });
  process.exit(0);
})().catch(function (e) { console.error(e); process.exit(1); });
