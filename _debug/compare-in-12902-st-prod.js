'use strict';
const path = require('path');
const admin = require('firebase-admin');
const ST = path.join(__dirname, 'service-account.json', 'cch-studio-staging-firebase-adminsdk-fbsvc-b93c6f1cf4.json');
const PR = path.join(__dirname, 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
const BOARD = 'cloud-rolling-hills';
const DOC_ID = '17zvCe3CeU7fZIkkseGW';

function summarize(db, label) {
  return db.collection('boards').doc(BOARD).collection('invoices').doc(DOC_ID).get().then((d) => {
    if (!d.exists) {
      console.log(label, 'doc', DOC_ID, '— NOT FOUND');
      return null;
    }
    const x = d.data();
    const items = x.items || [];
    console.log('\n' + label, DOC_ID);
    console.log('  invoiceNum:', x.invoiceNum || x.number);
    console.log('  status:', x.status, '| total:', x.total);
    console.log('  items:', items.length);
    items.forEach((it, i) => {
      const u = String(it.imageUrl || '').trim();
      console.log('   ', i, (it.title || '').slice(0, 50), '| room:', it.room || '', '| amt:', it.amount);
      console.log('       img:', u ? (u.includes('ivy') ? 'ivy-s3' : u.includes('firebasestorage') ? 'firebase' : 'url') : 'NONE', u.slice(0, 70));
    });
    return { id: d.id, num: x.invoiceNum || x.number, items: items.length, total: x.total };
  });
}

async function findPlumbingInvoice(db, label) {
  const snap = await db.collection('boards').doc(BOARD).collection('invoices').get();
  snap.forEach((d) => {
    const x = d.data();
    const items = x.items || [];
    const hasPlumb = items.some((it) => /plumbing/i.test(String(it.title || it.description || '')));
    if (hasPlumb && items.length <= 2) {
      console.log('\n' + label, 'candidate', d.id, x.invoiceNum || x.number, 'lines', items.length, 'total', x.total);
      items.forEach((it, i) => console.log('   ', i, it.title, it.amount, (it.imageUrl || '').slice(0, 60)));
    }
  });
}

(async () => {
  const st = admin.initializeApp({ credential: admin.credential.cert(require(ST)) }, 'st').firestore();
  const pr = admin.initializeApp({ credential: admin.credential.cert(require(PR)) }, 'pr').firestore();
  await summarize(st, 'STAGING');
  await summarize(pr, 'PRODUCTION');
  console.log('\n--- Staging invoices matching single PLUMBING line pattern ---');
  await findPlumbingInvoice(st, 'STAGING');
  console.log('\n--- Prod IN-12902 duplicates on board ---');
  const ps = await pr.collection('boards').doc(BOARD).collection('invoices').get();
  ps.forEach((d) => {
    const n = String((d.data().invoiceNum || d.data().number || '')).trim();
    if (n.indexOf('12902') >= 0) {
      const x = d.data();
      console.log(' ', d.id, 'lines', (x.items || []).length, 'total', x.total);
    }
  });
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
