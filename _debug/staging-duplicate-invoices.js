'use strict';
const path = require('path');
const admin = require('firebase-admin');
const SK = path.join(__dirname, 'service-account.json', 'cch-studio-staging-firebase-adminsdk-fbsvc-b93c6f1cf4.json');
const db = admin.initializeApp({ credential: admin.credential.cert(require(SK)) }, 'st').firestore();
const BOARD = 'cloud-rolling-hills';

function itemCount(x) {
  const a = x.items || x.lineItems || [];
  return Array.isArray(a) ? a.length : 0;
}

(async () => {
  const snap = await db.collection('boards').doc(BOARD).collection('invoices').get();
  const byNum = {};
  const empty = [];
  snap.forEach((d) => {
    const x = d.data();
    const n = String(x.invoiceNum || x.number || '').trim() || d.id;
    const lines = itemCount(x);
    if (!byNum[n]) byNum[n] = [];
    byNum[n].push({ docId: d.id, lines, total: x.total, status: x.status });
    if (lines === 0) empty.push({ docId: d.id, num: n, total: x.total, status: x.status, updatedAt: x.updatedAt });
  });
  const dups = Object.entries(byNum).filter(([, arr]) => arr.length > 1);
  console.log('Invoices:', snap.size, '| empty items[]:', empty.length);
  console.log('\n--- Empty items[] (all) ---');
  empty.forEach((e) => console.log(' ', e.docId, '|', e.num, '| total', e.total, '|', e.status));
  console.log('\n--- Duplicate invoice numbers ---');
  dups.forEach(([num, arr]) => {
    console.log(num + ':');
    arr.forEach((a) => console.log('  ', a.docId, 'lines=' + a.lines, 'total=' + a.total, a.status));
  });
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
