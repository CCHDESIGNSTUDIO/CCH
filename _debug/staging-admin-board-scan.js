'use strict';
const path = require('path');
const admin = require('firebase-admin');
const SK = path.join(__dirname, 'service-account.json', 'cch-studio-staging-firebase-adminsdk-fbsvc-b93c6f1cf4.json');
const db = admin.initializeApp({ credential: admin.credential.cert(require(SK)) }, 'st').firestore();

function itemCount(x) {
  const a = x.items || x.lineItems || [];
  return Array.isArray(a) ? a.length : 0;
}

(async () => {
  const boards = await db.collection('boards').get();
  console.log('STAGING boards:', boards.size, '\n');
  let totInv = 0, totInvEmpty = 0, totInvLines = 0;
  let totPo = 0, totPoEmpty = 0, totPoLines = 0;
  for (const b of boards.docs) {
    const x = b.data();
    const inv = await b.ref.collection('invoices').get();
    const po = await b.ref.collection('purchaseOrders').get();
    const prop = await b.ref.collection('proposals').get();
    const clips = await b.ref.collection('clips').get();
    let iE = 0, iL = 0, pE = 0, pL = 0;
    inv.forEach((d) => {
      totInv++;
      const n = itemCount(d.data());
      totInvLines += n;
      if (n === 0) { totInvEmpty++; iE++; }
      else iL++;
    });
    po.forEach((d) => {
      totPo++;
      const n = itemCount(d.data());
      totPoLines += n;
      if (n === 0) { totPoEmpty++; pE++; }
      else pL++;
    });
    console.log(b.id);
    console.log('  name:', x.name || x.title);
    console.log('  clips:', clips.size, '| proposals:', prop.size, '| invoices:', inv.size, '(', iL, 'with lines,', iE, 'empty ) | POs:', po.size, '(', pL, 'with lines,', pE, 'empty )');
    if (inv.size > 0) {
      const sample = inv.docs.find((d) => itemCount(d.data()) > 0) || inv.docs[0];
      const sx = sample.data();
      console.log('  sample invoice:', sample.id, sx.invoiceNum || sx.number, '| lines:', itemCount(sx), '| total:', sx.total, '| status:', sx.status);
    }
    if (inv.size > 0 && iE > 0) {
      const empty = inv.docs.filter((d) => itemCount(d.data()) === 0).slice(0, 3);
      empty.forEach((d) => {
        const ex = d.data();
        console.log('    EMPTY:', d.id, ex.invoiceNum || ex.number, 'total=' + ex.total, 'updated=' + (ex.updatedAt || '').slice(0, 19));
      });
    }
    console.log('');
  }
  console.log('TOTALS: invoices', totInv, '| empty', totInvEmpty, '| lines', totInvLines);
  console.log('TOTALS: POs', totPo, '| empty', totPoEmpty, '| lines', totPoLines);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
