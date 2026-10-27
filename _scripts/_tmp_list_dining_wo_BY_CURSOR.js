'use strict';
const path = require('path');
const admin = require('firebase-admin');
const KEY = path.join(__dirname, '..', '_debug', 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
admin.initializeApp({ credential: admin.credential.cert(require(KEY)) }, 'din');
const db = admin.app('din').firestore();
(async () => {
  const snap = await db.collection('boards').doc('cloud-rolling-hills').collection('workOrders').get();
  const rows = [];
  snap.forEach((d) => {
    const x = d.data() || {};
    rows.push({
      id: d.id,
      wo: x.workOrderNumber || '',
      loc: x.location || '',
      room: x.room || '',
      cat: x.category || '',
      arch: (x.sourceImport && x.sourceImport.rev2ArchUpdate && x.sourceImport.rev2ArchUpdate.archMark) || '',
      meas: x.measurements || {},
      intent: String(x.designIntent || '').slice(0, 120)
    });
  });
  rows.sort((a, b) => String(a.wo).localeCompare(String(b.wo)));
  console.log('TOTAL', rows.length);
  console.log('--- dining / W2 ---');
  rows
    .filter((r) => /dining|^W2\b|W2\s/i.test(r.room + ' ' + r.loc))
    .forEach((r) => console.log(JSON.stringify(r, null, 2)));
  console.log('--- all CLO-W ---');
  rows.filter((r) => /^CLO-W-/i.test(r.wo)).forEach((r) => console.log(r.wo, r.cat, '|', r.loc, '|', r.room, '|', r.arch));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
