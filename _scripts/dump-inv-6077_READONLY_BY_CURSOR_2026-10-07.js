#!/usr/bin/env node
'use strict';
const path = require('path');
const admin = require('firebase-admin');
const KEY = path.join(__dirname, '..', '_debug', 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
const app = admin.initializeApp({ credential: admin.credential.cert(require(KEY)) }, 'inv6077');
const db = app.firestore();
function str(v) { return String(v == null ? '' : v).trim(); }
function n(v) { return parseFloat(v) || 0; }
(async () => {
  const col = db.collection('boards').doc('cloud-rolling-hills').collection('invoices');
  const all = await col.get();
  const hits = [];
  all.forEach((d) => {
    const x = d.data() || {};
    const num = str(x.invoiceNum || x.number || x.name);
    if (num.indexOf('6077') >= 0 || num.indexOf('6067') >= 0 || /medicine|cabinet/i.test(num + ' ' + str(x.title) + ' ' + str(x.shortDescription) + ' ' + str(x.documentTags))) {
      hits.push({ id: d.id, num: num, status: x.status, title: str(x.title || x.shortDescription || x.documentTags), items: (x.items || []).length, total: x.total, published: x.published });
    }
  });
  console.log('hits', hits.length);
  hits.forEach((h) => console.log(JSON.stringify(h)));
  const target = hits.find((h) => h.num.indexOf('6077') >= 0) || hits[0];
  if (!target) { console.log('no 6077'); process.exit(0); }
  const snap = await col.doc(target.id).get();
  const x = snap.data() || {};
  console.log('\nDOC', target.id, x.invoiceNum, 'status', x.status, 'total', x.total, 'items', (x.items || []).length);
  (x.items || []).forEach((it, i) => {
    const img = str(it.imageUrl || it.image || (it.images && it.images[0]) || '');
    console.log((i + 1) + '.', str(it.title || it.name).slice(0, 80), 'qty', n(it.qty), 'amt', n(it.amount || it.totalSelling), 'img', img ? 'YES' : 'no', img.slice(0, 60));
  });
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
