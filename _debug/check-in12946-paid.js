'use strict';
const path = require('path');
const admin = require('firebase-admin');
const key = path.join(__dirname, 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
admin.initializeApp({ credential: admin.credential.cert(require(key)) });
const db = admin.firestore();

function normInv(n) {
  return String(n || '').replace(/\s+/g, ' ').trim();
}

(async () => {
  const board = 'cloud-rolling-hills';
  const snap = await db.collection('boards').doc(board).collection('invoices').get();
  const hits = [];
  snap.forEach((d) => {
    const x = d.data() || {};
    const num = normInv(x.invoiceNum || x.number || d.id);
    if (/12946/i.test(num) || /12946/i.test(d.id)) {
      hits.push({
        id: d.id,
        invoiceNum: x.invoiceNum,
        number: x.number,
        status: x.status,
        total: x.total,
        paidAmount: x.paidAmount,
        payments: x.payments,
        _fromClips: x._fromClips,
        updatedAt: x.updatedAt,
      });
    }
  });
  console.log('Found', hits.length, 'docs for 12946');
  hits.forEach((h) => console.log(JSON.stringify(h, null, 2)));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
