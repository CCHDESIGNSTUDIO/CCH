'use strict';
const path = require('path');
const admin = require('firebase-admin');
const key = path.join(__dirname, 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
const db = admin.initializeApp({ credential: admin.credential.cert(require(key)) }).firestore();

function norm(s) { return String(s || '').toLowerCase().trim().replace(/\s+/g, ' '); }
function tv(t, v) { return norm(t) + '|' + norm(v); }
function isFb(u) { return /firebasestorage/i.test(String(u || '')); }

(async () => {
  const titles = ['New York', 'Manhattan', 'San Francisco', 'Elizabeth'];
  for (const col of ['productLibrary', 'products']) {
    console.log('\n===', col, '===');
    const snap = await db.collection(col).limit(8000).get();
    titles.forEach((title) => {
      snap.forEach((d) => {
        const p = d.data();
        if (norm(p.title || p.name) !== norm(title)) return;
        console.log(' ', title, '| vendor:', p.vendor, '| fb:', isFb(p.imageUrl), '|', String(p.imageUrl || '').slice(0, 70));
      });
    });
  }
  const po = await db.collection('boards').doc('cloud-rolling-hills').collection('purchaseOrders').get();
  console.log('\n=== POs', po.size, '===');
  po.forEach((d) => {
    const p = d.data();
    const items = p.items || [];
    if (!items.length) return;
    console.log(d.id, p.poNumber || p.number, 'items', items.length);
    items.slice(0, 5).forEach((it, i) => {
      console.log('  ', i, it.title || it.name, it.vendor, isFb(it.imageUrl) ? 'fb' : (it.imageUrl ? 'other' : 'NO URL'));
    });
  });
})();
