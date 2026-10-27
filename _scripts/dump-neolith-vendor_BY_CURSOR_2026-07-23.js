'use strict';
const path = require('path');
const admin = require('firebase-admin');
const KEY = path.join(
  __dirname,
  '..',
  '_debug',
  'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json'
);
const db = admin.initializeApp({ credential: admin.credential.cert(require(KEY)) }, 'neoDump').firestore();

(async () => {
  const d = await db.collection('vendors').doc('YYsJKrdKGj5TAZkaHsBD').get();
  console.log('DOC', JSON.stringify(d.data(), null, 2));
  const all = await db.collection('vendors').get();
  console.log('vendors/ total docs:', all.size);
  const names = [];
  all.forEach((x) => {
    const n = String((x.data() || {}).name || '').trim();
    if (/^n/i.test(n)) names.push(n);
  });
  names.sort((a, b) => a.localeCompare(b));
  console.log('N* names (' + names.length + '):');
  console.log(names.join('\n'));

  // Alphabet position of Neolith among all named vendors (same sort as Studio)
  const allNames = [];
  all.forEach((x) => {
    const data = x.data() || {};
    if (data.category === 'Workroom' || data.category === 'Delivery / Receiver') return;
    const n = String(data.name || '').trim();
    if (n) allNames.push(n);
  });
  allNames.sort((a, b) => a.localeCompare(b));
  const idx = allNames.findIndex((n) => n === 'Neolith');
  console.log('Studio list index of Neolith:', idx, 'of', allNames.length);
  if (idx >= 0) console.log('Neighbors:', allNames.slice(Math.max(0, idx - 2), idx + 3));

  const listDoc = await db.doc('settings/vendors').get();
  const list = listDoc.exists && Array.isArray(listDoc.data().list) ? listDoc.data().list : [];
  console.log('settings/vendors.list has Neolith?', list.some((x) => /neolith/i.test(String(x))));
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
