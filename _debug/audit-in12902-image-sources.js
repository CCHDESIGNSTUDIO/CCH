'use strict';
const path = require('path');
const admin = require('firebase-admin');
const key = path.join(__dirname, 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
const db = admin.initializeApp({ credential: admin.credential.cert(require(key)) }).firestore();

function kind(u) {
  u = String(u || '').replace(/&amp;/g, '&');
  if (!u) return 'none';
  if (/firebasestorage|\.firebasestorage\.app/i.test(u)) return 'firebase';
  if (/ivy-uploads/i.test(u)) return 'ivy';
  return 'other';
}

function norm(s) { return String(s || '').toLowerCase().trim().replace(/\s+/g, ' '); }

(async () => {
  const board = 'cloud-rolling-hills';
  const invId = '17zvCe3CeU7fZIkkseGW';
  const inv = (await db.collection('boards').doc(board).collection('invoices').doc(invId).get()).data();
  const clips = [];
  (await db.collection('boards').doc(board).collection('clips').get()).forEach((d) => {
    clips.push({ id: d.id, ...d.data() });
  });
  console.log('IN-12902', inv.invoiceNum, 'lines', (inv.items || []).length);
  (inv.items || []).forEach((it, i) => {
    const t = norm(it.title);
    const match = clips.filter((c) => {
      const ct = norm(c.title || c.name);
      return ct === t || (t.length >= 4 && (ct.includes(t) || t.includes(ct)));
    });
    const imgs = [it.imageUrl].concat(it.images || []).filter(Boolean);
    console.log('\n' + i, it.title);
    console.log('  line imageUrl:', kind(it.imageUrl), String(it.imageUrl || '').slice(0, 70));
    console.log('  images[] count:', (it.images || []).length, (it.images || []).map(kind).join(','));
    console.log('  houzzId on line:', it.houzzId || it.houzzProductId || '(none)');
    match.slice(0, 2).forEach((c) => {
      console.log('  clip', c.id, c.title, '|', kind(c.imageUrl), 'houzzId', c.houzzId || c.houzzProductId);
      if (kind(c.imageUrl) === 'firebase') console.log('    firebase:', String(c.imageUrl).slice(0, 75));
    });
  });
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
