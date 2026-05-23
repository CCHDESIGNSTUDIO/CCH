'use strict';
const path = require('path');
const admin = require('firebase-admin');
const SK = path.join(__dirname, 'service-account.json', 'cch-studio-staging-firebase-adminsdk-fbsvc-b93c6f1cf4.json');
const db = admin.initializeApp({ credential: admin.credential.cert(require(SK)) }, 'st').firestore();
const BOARD = 'cloud-rolling-hills';
const DOC = '17zvCe3CeU7fZIkkseGW';

function kind(u) {
  u = String(u || '').trim();
  if (!u) return 'none';
  if (u.includes('&amp;')) return 'html-entity';
  if (u.includes('ivy-uploads')) return 'ivy';
  if (u.includes('firebasestorage')) return 'firebase';
  if (u.startsWith('http')) return 'http-other';
  return 'fragment';
}

(async () => {
  const inv = await db.collection('boards').doc(BOARD).collection('invoices').doc(DOC).get();
  const x = inv.data();
  const invKey = 'IN-12902';
  console.log('Invoice', DOC, x.invoiceNum, 'lines', (x.items || []).length);
  (x.items || []).forEach((it, i) => {
    console.log(i, (it.title || '').slice(0, 40), '| img:', kind(it.imageUrl), (it.imageUrl || '').slice(0, 90));
  });
  const clips = await db.collection('boards').doc(BOARD).collection('clips').get();
  let match = 0;
  clips.forEach((d) => {
    const c = d.data();
    const tag = String(c.invoiceNum || c.houzzInvoice || '');
    if (tag.indexOf('12902') < 0) return;
    match++;
    if (match <= 8) {
      const u = c.imageUrl || c.image || c.thumbnail || '';
      console.log('clip', (c.title || '').slice(0, 35), '|', kind(u), String(u).slice(0, 90));
    }
  });
  console.log('clips tagged 12902:', match);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
