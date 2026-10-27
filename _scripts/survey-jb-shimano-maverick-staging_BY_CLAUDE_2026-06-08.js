'use strict';
/** READ-ONLY: Jonathan Browning products on staging (dups by houzzId) + the Shimano/Maverick
 *  board ids + how many JB clips each project has. ZERO writes. */
const admin = require('firebase-admin');
const path = require('path');
const stgKey = require(path.join(__dirname, '..', '_debug', 'service-account.json', 'cch-studio-staging-firebase-adminsdk-fbsvc-b93c6f1cf4.json'));
const db = admin.initializeApp({ credential: admin.credential.cert(stgKey) }, 'stg').firestore();
const str = (v) => String(v == null ? '' : v).trim();
const hz = (o) => str(o && (o.houzzId || o.houzzProductId || o.catalogId));
const JB = /jonathan\s*browning/i;

(async () => {
  // 1) JB products in the library
  const prod = await db.collection('products').get();
  const jb = []; prod.forEach((d) => { const p = d.data() || {}; if (JB.test(str(p.vendor))) jb.push(Object.assign({ _id: d.id }, p)); });
  const byHz = {}; jb.forEach((p) => { const h = hz(p) || ('t:' + str(p.title).toLowerCase()); (byHz[h] = byHz[h] || []).push(p); });
  const dupGroups = Object.values(byHz).filter((g) => g.length > 1);
  console.log('=== Jonathan Browning — Product Library (staging) ===');
  console.log('JB products:', jb.length, '| unique houzzIds:', Object.keys(byHz).length, '| dup groups:', dupGroups.length, '| dup rows to remove:', jb.length - Object.keys(byHz).length, '\n');

  // 2) boards matching shimano / maverick
  const boards = await db.collection('boards').get();
  const matches = [];
  boards.forEach((d) => { const n = str((d.data() || {}).name); if (/shimano|maverick|mustang/i.test(n) || /shimano|maverick|mustang/i.test(d.id)) matches.push({ id: d.id, name: n }); });
  console.log('=== Boards matching shimano / maverick / mustang ===');
  matches.forEach((m) => console.log('  ' + m.id + '   "' + m.name + '"'));

  // 3) JB clip count per matched board
  console.log('\n=== Jonathan Browning clips per matched board ===');
  for (const m of matches) {
    const cs = await db.collection('boards').doc(m.id).collection('clips').get();
    let n = 0, hzset = new Set(); cs.forEach((d) => { const c = d.data() || {}; if (JB.test(str(c.vendor))) { n++; const h = hz(c); if (h) hzset.add(h); } });
    console.log('  ' + m.id + ': ' + n + ' JB clips, ' + hzset.size + ' unique houzzIds (dups: ' + (n - hzset.size) + ')');
  }
  process.exit(0);
})().catch((e) => { console.error('ERROR', e); process.exit(1); });
