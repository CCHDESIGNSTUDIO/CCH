'use strict';
const path = require('path');
const admin = require('firebase-admin');
const STAGING_KEY = path.join(__dirname, 'service-account.json', 'cch-studio-staging-firebase-adminsdk-fbsvc-b93c6f1cf4.json');
const PROD_KEY = path.join(__dirname, 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
const BOARD = 'cloud-rolling-hills';
const TARGETS = ['IN-12067', 'IN-12182', 'IN-12929', 'IN-12806'];

function itemCount(x) {
  const a = x.items || x.lineItems || [];
  return Array.isArray(a) ? a.length : 0;
}

async function findInvoice(db, label, num) {
  const snap = await db.collection('boards').doc(BOARD).collection('invoices').get();
  let hit = null;
  snap.forEach((d) => {
    const x = d.data();
    const n = String(x.invoiceNum || x.number || d.id || '');
    if (n.indexOf(num) >= 0 || d.id === num) hit = { id: d.id, ...x };
  });
  if (!hit) {
    console.log(label, num, '— NOT FOUND');
    return;
  }
  console.log('\n' + label + ' ' + num);
  console.log('  docId:', hit.id);
  console.log('  invoiceNum:', hit.invoiceNum || hit.number);
  console.log('  status:', hit.status, '| total:', hit.total);
  console.log('  items:', itemCount(hit), '| lineItems field:', (hit.lineItems || []).length);
  console.log('  updatedAt:', hit.updatedAt || '(none)');
  console.log('  lastEditedBy:', hit.lastEditedBy || hit.lastEditedByEmail || '(none)');
  console.log('  lastEditedAt:', hit.lastEditedAt || '(none)');
  if (itemCount(hit) > 0) {
    const it = (hit.items || hit.lineItems)[0];
    console.log('  first line:', (it.title || it.description || '').slice(0, 70));
  }
}

(async () => {
  const st = admin.initializeApp({ credential: admin.credential.cert(require(STAGING_KEY)) }, 'st').firestore();
  const pr = admin.initializeApp({ credential: admin.credential.cert(require(PROD_KEY)) }, 'pr').firestore();
  for (const num of TARGETS) {
    await findInvoice(st, 'STAGING', num);
    await findInvoice(pr, 'PROD   ', num);
  }
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
