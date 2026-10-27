#!/usr/bin/env node
'use strict';
const path = require('path');
const admin = require('firebase-admin');
const KEY = path.join(__dirname, '..', '_debug', 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
const db = admin.initializeApp({ credential: admin.credential.cert(require(KEY)) }, 'wo204Clip').firestore();

(async function main() {
  const board = db.collection('boards').doc('cloud-rolling-hills');
  const ids = ['KEYYVyriZl9Ha32BmfH4'];
  const po = await board.collection('purchaseOrders').doc('ZWaY43tvlDfsqPmrtyy3').get();
  const x = po.data() || {};
  console.log('PO-9045 locked', x.poLocked, 'vendor', x.vendor || x.billToName, 'num', x.poNum);
  (x.items || []).forEach((it, i) => {
    if (String(it.title || '').toLowerCase().includes('basalt')) {
      console.log('9045 line', i, 'clip', it.clipId || it.sourceClipId, 'lib', it.libraryProductId, 'tag', it.lineTag, 'room', it.room);
      if (it.clipId) ids.push(it.clipId);
      if (it.sourceClipId) ids.push(it.sourceClipId);
    }
  });
  const po2 = await board.collection('purchaseOrders').doc('WGLHOwcZgbgYG7oz2fmL').get();
  (po2.data().items || []).forEach((it) => {
    if (it.clipId) ids.push(it.clipId);
    if (it.sourceClipId) ids.push(it.sourceClipId);
  });
  const uniq = [...new Set(ids.filter(Boolean))];
  for (const id of uniq) {
    const c = await board.collection('clips').doc(id).get();
    const d = c.exists ? (c.data() || {}) : {};
    console.log('CLIP', id, 'exists', c.exists, 'title', d.title || d.name, 'finish', JSON.stringify(d.finish || d.color), 'dims', JSON.stringify(d.dimensions || d.size));
  }
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
