'use strict';
const path = require('path');
const admin = require('firebase-admin');
const PR = path.join(__dirname, 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
const db = admin.initializeApp({ credential: admin.credential.cert(require(PR)) }, 'pr').firestore();

(async () => {
  const boards = ['cloud-susan', 'cloud-parker', 'shimano-maverick-cir', 'cloud-rolling-hills', '7225-bugletrail', 'cloud-huntington-beach'];
  for (const b of boards) {
    const snap = await db.collection('boards').doc(b).collection('invoices').get();
    let dups = 0, upperEmpty = 0;
    const by = {};
    snap.forEach((d) => {
      const n = String((d.data().invoiceNum || d.data().number || '')).trim() || d.id;
      if (!by[n]) by[n] = [];
      by[n].push({ id: d.id, ln: (d.data().items || []).length });
      if (d.id === d.id.toUpperCase() && /^IN-\d/.test(d.id) && !(d.data().items || []).length) upperEmpty++;
    });
    Object.values(by).forEach((a) => { if (a.length > 1) dups++; });
    console.log(b.padEnd(26), 'invoices', String(snap.size).padStart(4), '| dup#', String(dups).padStart(3), '| upper-empty shells', upperEmpty);
  }
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
