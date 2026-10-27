'use strict';
const path = require('path');
const admin = require('firebase-admin');
const KEY = require(path.join(__dirname, '..', '_debug', 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json'));
const db = admin.initializeApp({ credential: admin.credential.cert(KEY) }, 'd').firestore();
const str = (v) => String(v == null ? '' : v).trim();
const n = (v) => parseFloat(v) || 0;

(async () => {
  const invRef = db.collection('boards').doc('manno-imperatrice').collection('invoices').doc('hblDcmpN7mbSFoFjTgr1');
  const inv = (await invRef.get()).data() || {};
  console.log(JSON.stringify({
    status: inv.status,
    payments: inv.payments,
    paidAmount: inv.paidAmount,
    balanceDue: inv.balanceDue,
    qbInvoiceId: inv.qbInvoiceId,
    sentAt: inv.sentAt,
    clientView: inv.clientView,
    createdAt: inv.createdAt,
    updatedAt: inv.updatedAt
  }, null, 2));

  const te = await db.collection('timeEntries').where('invoiceId', '==', 'hblDcmpN7mbSFoFjTgr1').get();
  let noSnap = 0, withAdded = 0, addedSum = 0;
  te.forEach((d) => {
    const t = d.data();
    if (t.invoicedHours == null || t.invoicedHours === '') noSnap++;
    if (n(t.addedHrs) > 0) { withAdded++; addedSum += n(t.addedHrs); }
  });
  console.log('\nLinked entries:', te.size);
  console.log('Missing invoicedHours snapshot:', noSnap);
  console.log('Rows with addedHrs:', withAdded, 'total +hrs:', addedSum);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
