'use strict';
const path = require('path');
const admin = require('firebase-admin');
const ST = path.join(__dirname, 'service-account.json', 'cch-studio-staging-firebase-adminsdk-fbsvc-b93c6f1cf4.json');
const db = admin.initializeApp({ credential: admin.credential.cert(require(ST)) }, 'st').firestore();
const BOARD = 'cloud-rolling-hills';
const DOC = '17zvCe3CeU7fZIkkseGW';

function nk(s) { return String(s || '').toLowerCase().trim().replace(/\s+/g, ' '); }
function isFb(u) { return /firebasestorage|\.firebasestorage\.app/i.test(String(u || '')); }

function matchLine(title, desc, clips) {
  const it = nk(title);
  const hits = [];
  clips.forEach((c) => {
    const ct = nk(c.title || c.name);
    if (!ct) return;
    if (ct === it || (it.length >= 4 && (ct.includes(it) || it.includes(ct)))) hits.push(c);
  });
  hits.sort((a, b) => (isFb(b.imageUrl) ? 1 : 0) - (isFb(a.imageUrl) ? 1 : 0));
  return hits[0];
}

(async () => {
  const inv = (await db.collection('boards').doc(BOARD).collection('invoices').doc(DOC).get()).data();
  const clips = [];
  (await db.collection('boards').doc(BOARD).collection('clips').get()).forEach((d) => {
    clips.push({ id: d.id, ...d.data() });
  });
  console.log('clips', clips.length, 'firebase', clips.filter((c) => isFb(c.imageUrl)).length);
  (inv.items || []).forEach((it, i) => {
    const m = matchLine(it.title, it.description, clips);
    console.log(i, (it.title || '').slice(0, 42));
    console.log('  line', isFb(it.imageUrl) ? 'firebase' : 'ivy/none', String(it.imageUrl || '').slice(0, 60));
    if (m) console.log('  clip', m.title, isFb(m.imageUrl) ? 'firebase' : 'ivy', String(m.imageUrl || '').slice(0, 60));
    else console.log('  clip NO MATCH');
  });
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
