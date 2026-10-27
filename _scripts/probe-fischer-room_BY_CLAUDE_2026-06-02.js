#!/usr/bin/env node
'use strict';
const path = require('path');
const admin = require('firebase-admin');
const KEY = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
admin.initializeApp({ credential: admin.credential.cert(require(KEY)) });
const db = admin.firestore();
const PID = 'cloud-rolling-hills';

function scanItems(label, docId, num, items) {
  const hits = [];
  (items || []).forEach((it, i) => {
    const blob = [it.title, it.name, it.vendor, it.description, num].join(' ').toLowerCase();
    if (!/fischer|fisher|suite\s*4|guest suite 4/i.test(blob)) return;
    hits.push({
      where: label,
      docId,
      docNum: num,
      lineIdx: i,
      title: (it.title || it.name || '').slice(0, 80),
      vendor: it.vendor,
      room: it.room,
      category: it.category,
      clipId: it.clipId || it.sourceClipId,
      libraryProductId: it.libraryProductId,
    });
  });
  return hits;
}

(async () => {
  const all = [];
  const invSnap = await db.collection('boards').doc(PID).collection('invoices').get();
  invSnap.forEach((d) => {
    const x = d.data() || {};
    const num = x.invoiceNum || x.name || x.number || d.id;
    all.push(...scanItems('invoice', d.id, num, x.items));
  });
  const propSnap = await db.collection('boards').doc(PID).collection('proposals').get();
  propSnap.forEach((d) => {
    const x = d.data() || {};
    const num = x.proposalNum || x.name || x.number || d.id;
    all.push(...scanItems('proposal', d.id, num, x.items));
  });
  console.log('hits', all.length);
  console.log(JSON.stringify(all, null, 2));

  const fisher = all.filter((x) => /fisher sconce/i.test(x.title || ''));
  for (const h of fisher.length ? fisher : all.filter((x) => x.clipId)) {
    const c = await db.collection('boards').doc(PID).collection('clips').doc(h.clipId).get();
    if (!c.exists) {
      console.log('\nclip missing', h.clipId);
      continue;
    }
    const cd = c.data() || {};
    console.log('\nclip', h.clipId, 'room=', cd.room, 'title=', (cd.title || '').slice(0, 60), 'lib=', cd.libraryProductId);
    const lid = String(cd.libraryProductId || h.libraryProductId || '').trim();
    if (lid) {
      const p = await db.collection('products').doc(lid).get();
      if (p.exists) {
        const pd = p.data() || {};
        console.log('  products/', lid, 'room=', pd.room, 'title=', (pd.title || '').slice(0, 60));
      }
    }
  }
})();
