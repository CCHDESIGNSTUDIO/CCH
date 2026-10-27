'use strict';
const path = require('path');
const admin = require('firebase-admin');
const KEY = require(path.join(__dirname, '..', '_debug', 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json'));
const db = admin.initializeApp({ credential: admin.credential.cert(KEY) }, 'hi').firestore();
const str = (v) => String(v == null ? '' : v).trim();
const n = (v) => parseFloat(v) || 0;
const r2 = (v) => Math.round(n(v) * 100) / 100;

(async () => {
  const nums = ['INV-6031', 'INV-6035', 'INV-6048', 'INV-6010', 'INV-6011'];
  for (const num of nums) {
    const q = await db.collection('boards').doc('holtz-hill').collection('invoices').where('invoiceNum', '==', num).get();
    if (q.empty) continue;
    const d = q.docs[0];
    const x = d.data();
    let h = 0, a = 0;
    console.log('\n' + num + ' [' + str(x.status) + '] total $' + n(x.total) + ' source ' + str(x.source));
    (x.items || []).forEach((it) => {
      if (!(it.expenseType === 'service' || it.itemType === 'service')) return;
      h += n(it.qty);
      a += n(it.amount);
      console.log('  ' + str(it.title) + ' | ' + n(it.qty) + 'h $' + n(it.amount) + ' | ' + str(it.serviceDateStart) + '..' + str(it.serviceDateEnd));
    });
    console.log('  service sum: ' + r2(h) + 'h $' + r2(a));
    const linked = [];
    (await db.collection('timeEntries').where('invoiceId', '==', d.id).get()).forEach((doc) => linked.push(doc.data()));
    const juneH = r2(linked.filter((t) => str(t.date).startsWith('2026-06')).reduce((s, t) => s + n(t.hours), 0));
    console.log('  linked rows ' + linked.length + ' | June on invoice: ' + juneH + 'h');
  }
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
