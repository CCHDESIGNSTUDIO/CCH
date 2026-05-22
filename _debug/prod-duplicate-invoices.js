'use strict';
const path = require('path');
const admin = require('firebase-admin');
const PR = path.join(__dirname, 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
const db = admin.initializeApp({ credential: admin.credential.cert(require(PR)) }, 'pr').firestore();

function lines(x) {
  const a = x.items || x.lineItems || [];
  return Array.isArray(a) ? a.length : 0;
}

(async () => {
  for (const BOARD of ['cloud-rolling-hills', 'cloud-parker', 'cloud-huntington-beach']) {
    try {
      const snap = await db.collection('boards').doc(BOARD).collection('invoices').get();
      const byNum = {};
      snap.forEach((d) => {
        const x = d.data();
        const n = String(x.invoiceNum || x.number || '').trim() || d.id;
        if (!byNum[n]) byNum[n] = [];
        byNum[n].push({ docId: d.id, lines: lines(x) });
      });
      const dups = Object.entries(byNum).filter(([, a]) => a.length > 1);
      const emptyUpper = dups.filter(([, arr]) =>
        arr.some((a) => a.docId === a.docId.toUpperCase() && a.lines === 0)
      );
      console.log(BOARD, '| invoices', snap.size, '| dup #', dups.length, '| upper-empty dup', emptyUpper.length);
      if (emptyUpper.length) {
        console.log('  sample:', emptyUpper[0][0], emptyUpper[0][1].map((a) => a.docId + '(' + a.lines + ')').join(' | '));
      }
    } catch (e) {
      console.log(BOARD, '— board missing or error');
    }
  }
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
