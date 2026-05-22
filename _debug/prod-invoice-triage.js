'use strict';
const path = require('path');
const admin = require('firebase-admin');
const PR = path.join(__dirname, 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
const db = admin.initializeApp({ credential: admin.credential.cert(require(PR)) }, 'pr').firestore();

const CASES = [
  { board: 'cloud-rolling-hills', inv: '17zvCe3CeU7fZIkkseGW', label: 'RH IN-12902 (lines, no thumbs)' },
  { board: 'shimano-maverick-cir', inv: 'IN-10144', label: 'Shimano IN-10144' },
  { board: 'cloud-susan', inv: 'IN-12427', label: 'Susan IN-12427 ($0 detail)' },
];

function lines(x) {
  const a = x.items || x.lineItems || [];
  return Array.isArray(a) ? a.length : 0;
}

function imgKind(u) {
  u = String(u || '').trim();
  if (!u) return 'missing';
  if (u.startsWith('https://') || u.startsWith('http://')) {
    if (u.includes('firebasestorage')) return 'firebase';
    if (u.includes('ivy-uploads')) return 'ivy-s3';
    return 'https-other';
  }
  return 'fragment';
}

async function boardSummary(boardId) {
  const snap = await db.collection('boards').doc(boardId).collection('invoices').get();
  let dups = 0, upperEmpty = 0, docs = snap.size, withLines = 0;
  const byNum = {};
  snap.forEach((d) => {
    const x = d.data();
    const n = String(x.invoiceNum || x.number || '').trim() || d.id;
    const ln = lines(x);
    if (ln > 0) withLines++;
    if (!byNum[n]) byNum[n] = [];
    byNum[n].push({ id: d.id, ln, total: x.total });
    if (d.id === d.id.toUpperCase() && /^IN-\d/.test(d.id) && ln === 0) upperEmpty++;
  });
  Object.values(byNum).forEach((arr) => { if (arr.length > 1) dups++; });
  return { docs, withLines, dups, upperEmpty };
}

(async () => {
  for (const c of CASES) {
    console.log('\n' + '='.repeat(70));
    console.log(c.label, '| board:', c.board);
    const sum = await boardSummary(c.board);
    console.log('Board stats: invoices', sum.docs, '| with lines', sum.withLines, '| dup # groups', sum.dups, '| upper-empty shells', sum.upperEmpty);

    const col = db.collection('boards').doc(c.board).collection('invoices');
    let docs = [];
    const direct = await col.doc(c.inv).get();
    if (direct.exists) docs.push(direct);
    const all = await col.get();
    all.forEach((d) => {
      const x = d.data();
      const n = String(x.invoiceNum || x.number || d.id);
      if (n.indexOf(c.inv.replace(/^IN-/, '')) >= 0 || d.id === c.inv || n === c.inv) {
        if (!docs.find((x) => x.id === d.id)) docs.push(d);
      }
    });

    if (!docs.length) {
      console.log('  NO matching docs for', c.inv);
      continue;
    }
    for (const d of docs) {
      const x = d.data();
      console.log('\n  docId:', d.id);
      console.log('  invoiceNum:', x.invoiceNum || x.number);
      console.log('  status:', x.status, '| total field:', x.total);
      console.log('  items:', lines(x));
      const kinds = {};
      (x.items || []).slice(0, 12).forEach((it, i) => {
        const k = imgKind(it.imageUrl);
        kinds[k] = (kinds[k] || 0) + 1;
        if (i < 4) console.log('    line', i, (it.title || '').slice(0, 40), '| img:', k, (it.imageUrl || '').slice(0, 85));
      });
      console.log('  image kinds (first 12 lines):', JSON.stringify(kinds));
    }
  }
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
