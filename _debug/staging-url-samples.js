'use strict';
const path = require('path');
const admin = require('firebase-admin');
const ST = path.join(__dirname, 'service-account.json', 'cch-studio-staging-firebase-adminsdk-fbsvc-b93c6f1cf4.json');
const PR = path.join(__dirname, 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
const stDb = admin.initializeApp({ credential: admin.credential.cert(require(ST)) }, 'st').firestore();
const prDb = admin.initializeApp({ credential: admin.credential.cert(require(PR)) }, 'pr').firestore();

async function dumpLines(db, label, board, invIdOrNum) {
  const snap = await db.collection('boards').doc(board).collection('invoices').get();
  let doc = null;
  snap.forEach((d) => {
    if (d.id === invIdOrNum) doc = d;
    const x = d.data();
    const n = String(x.invoiceNum || x.number || '');
    if (n.indexOf(invIdOrNum) >= 0 && !doc) doc = d;
  });
  if (!doc) {
    console.log(label, 'not found', invIdOrNum);
    return;
  }
  const x = doc.data();
  console.log('\n' + label, doc.id, '|', x.invoiceNum || x.number, '| lines:', (x.items || []).length);
  (x.items || []).slice(0, 6).forEach((it, i) => {
    const u = String(it.imageUrl || (it.images && it.images[0]) || '').trim();
    console.log('  [' + i + ']', (it.title || '').slice(0, 45), '| img:', u ? u.slice(0, 120) : '(none)');
  });
}

async function clipSamples(db, label, board, n) {
  const snap = await db.collection('boards').doc(board).collection('clips').limit(80).get();
  let shown = 0;
  console.log('\n' + label + ' clip image samples:');
  snap.forEach((d) => {
    if (shown >= n) return;
    const c = d.data();
    const u = String(c.imageUrl || c.image || c.thumbnail || '').trim();
    if (!u) return;
    shown++;
    console.log('  ', (c.title || '').slice(0, 40), '|', u.slice(0, 110));
  });
}

(async () => {
  await dumpLines(stDb, 'STAGING RH', 'cloud-rolling-hills', '17zvCe3CeU7fZIkkseGW');
  await dumpLines(stDb, 'STAGING RH', 'cloud-rolling-hills', 'in-12067');
  await dumpLines(stDb, 'STAGING BUGLE', '7225-bugletrail', '7abFwpBnUZEcd1IC3xz0');
  await dumpLines(stDb, 'STAGING BUGLE', '7225-bugletrail', 'IN-10076');
  await dumpLines(prDb, 'PROD BUGLE', '7225-bugletrail', '7abFwpBnUZEcd1IC3xz0');
  await dumpLines(prDb, 'PROD RH', 'cloud-rolling-hills', 'in-12067');
  await clipSamples(stDb, 'STAGING RH', 'cloud-rolling-hills', 5);
  await clipSamples(stDb, 'STAGING BUGLE', '7225-bugletrail', 5);
  await clipSamples(prDb, 'PROD BUGLE', '7225-bugletrail', 5);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
