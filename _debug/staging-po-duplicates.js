'use strict';
const path = require('path');
const admin = require('firebase-admin');
const SK = path.join(__dirname, 'service-account.json', 'cch-studio-staging-firebase-adminsdk-fbsvc-b93c6f1cf4.json');
const db = admin.initializeApp({ credential: admin.credential.cert(require(SK)) }, 'st').firestore();

function lines(x) {
  const a = x.items || x.lineItems || [];
  return Array.isArray(a) ? a.length : 0;
}

(async () => {
  for (const BOARD of ['cloud-rolling-hills', '7225-bugletrail']) {
    const snap = await db.collection('boards').doc(BOARD).collection('purchaseOrders').get();
    const byNum = {};
    snap.forEach((d) => {
      const x = d.data();
      const n = String(x.number || x.poNum || x.poNumber || '').trim() || d.id;
      if (!byNum[n]) byNum[n] = [];
      byNum[n].push({ docId: d.id, lines: lines(x) });
    });
    const dups = Object.entries(byNum).filter(([, a]) => a.length > 1);
    console.log('\n' + BOARD + ' POs:', snap.size, 'dup numbers:', dups.length);
    dups.forEach(([n, arr]) => console.log(' ', n, arr.map((a) => a.docId + '(' + a.lines + ')').join(' | ')));
    const empty = [];
    snap.forEach((d) => { if (lines(d.data()) === 0) empty.push(d.id); });
    if (empty.length) console.log('  empty PO docs:', empty.join(', '));
  }
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
