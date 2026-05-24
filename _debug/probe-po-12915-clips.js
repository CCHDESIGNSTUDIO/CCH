'use strict';
const path = require('path');
const admin = require('firebase-admin');
const key = path.join(__dirname, 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
const db = admin.initializeApp({ credential: admin.credential.cert(require(key)) }).firestore();

(async () => {
  const snap = await db.collection('boards').doc('cloud-rolling-hills').collection('clips').get();
  const hits = [];
  snap.forEach((d) => {
    const c = d.data();
    const po = String(c.poNum || c.poNumber || '');
    if (!/12915/.test(po)) return;
    hits.push({
      id: d.id,
      title: c.title,
      vendor: c.vendor,
      poNum: po,
      imageUrl: (c.imageUrl || '').slice(0, 70),
      hasImg: !!(c.imageUrl || '').trim(),
    });
  });
  console.log('Clips with PO 12915:', hits.length);
  hits.forEach((h) => console.log(h));
})();
