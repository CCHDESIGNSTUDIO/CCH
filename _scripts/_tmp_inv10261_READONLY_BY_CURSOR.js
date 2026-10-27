#!/usr/bin/env node
'use strict';
const path = require('path');
const admin = require('firebase-admin');
const KEY = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
const db = admin.initializeApp({ credential: admin.credential.cert(require(KEY)) }, 'inv10261').firestore();

function imgCount(it) {
  const list = [];
  const push = (u) => { const s = String(u || '').trim(); if (s && list.indexOf(s) < 0) list.push(s); };
  push(it.imageUrl); push(it.image); push(it.thumbnail);
  const imgs = it.images;
  if (Array.isArray(imgs)) imgs.forEach(push);
  else if (imgs && typeof imgs === 'object') Object.keys(imgs).forEach((k) => {
    const v = imgs[k];
    push(v && (v.url || v.imageUrl || v.src || v));
  });
  return list.length;
}

(async () => {
  const snap = await db.collectionGroup('invoices').get();
  const hits = [];
  snap.forEach((d) => {
    const x = d.data() || {};
    const num = String(x.invoiceNum || x.number || x.name || d.id);
    if (!/10261/.test(num) && d.id.indexOf('10261') < 0) return;
    const items = x.items || x.lineItems || [];
    hits.push({
      path: d.ref.path,
      id: d.id,
      num,
      status: x.status || '',
      nItems: items.length,
      lines: items.map((it, i) => ({
        i,
        title: String(it.title || it.description || '').slice(0, 60),
        room: it.room || '',
        qty: it.qty,
        photos: imgCount(it),
        heroIdx: it.heroImageIndex,
        imageUrl: String(it.imageUrl || it.image || '').slice(0, 80)
      }))
    });
  });
  console.log(JSON.stringify({ count: hits.length, hits }, null, 2));
})().catch((e) => { console.error(e); process.exit(1); });
