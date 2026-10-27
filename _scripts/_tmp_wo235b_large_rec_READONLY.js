#!/usr/bin/env node
'use strict';
const path = require('path');
const admin = require('firebase-admin');
const KEY = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
const db = admin.initializeApp({ credential: admin.credential.cert(require(KEY)) }, 'wo235b').firestore();
const BOARD = 'cloud-rolling-hills';

async function findProducts() {
  const out = [];
  const seen = {};
  async function addSnap(snap) {
    snap.forEach((d) => {
      if (seen[d.id]) return;
      seen[d.id] = true;
      const x = d.data() || {};
      out.push({
        col: 'products',
        id: d.id,
        title: x.title || x.name || '',
        houzzId: x.houzzId || x.houzzProductId || '',
        category: x.category || '',
        vendor: x.vendor || '',
        sku: x.sku || '',
        imageUrl: String(x.imageUrl || '').slice(0, 80)
      });
    });
  }
  await addSnap(await db.collection('products').where('title', '==', 'Large Rec Glass Lantern sconce').limit(10).get());
  await addSnap(await db.collection('products').where('houzzId', '==', '54545585').limit(10).get());
  await addSnap(await db.collection('products').where('houzzProductId', '==', '54545585').limit(10).get());
  try {
    await addSnap(await db.collection('productLibrary').where('title', '==', 'Large Rec Glass Lantern sconce').limit(10).get());
  } catch (_e) {}
  const tall = await db.collection('products').doc('QtMhnee1hurOGMoUUhj7').get();
  if (tall.exists) {
    const x = tall.data() || {};
    out.push({
      col: 'products',
      id: tall.id,
      note: 'sibling Tall Rec',
      title: x.title || '',
      houzzId: x.houzzId || x.houzzProductId || '',
      category: x.category || '',
      vendor: x.vendor || ''
    });
  }
  return out;
}

(async () => {
  const inv = (await db.collection('boards').doc(BOARD).collection('invoices').doc('tDCQlNyXqkGjdYMaCehL').get()).data() || {};
  const clipIds = [];
  (inv.items || []).forEach((it) => {
    const c = String(it.clipId || it.sourceClipId || '').trim();
    if (c) clipIds.push({ title: it.title || it.name, clipId: c, lib: it.libraryProductId || '' });
  });
  const missing = [];
  for (const row of clipIds) {
    const s = await db.collection('boards').doc(BOARD).collection('clips').doc(row.clipId).get();
    if (!s.exists) missing.push(row);
  }

  const acts = [];
  try {
    const snap = await db.collection('activity').orderBy('timestamp', 'desc').limit(120).get();
    snap.forEach((d) => {
      const a = d.data() || {};
      if (String(a.projectId || '') !== BOARD && String(a.project || '') !== BOARD) return;
      const blob = (a.description || '') + ' ' + (a.action || '') + ' ' + (a.type || '');
      if (/delet|clip|selection/i.test(blob)) {
        acts.push({
          type: a.type, action: a.action, description: String(a.description || '').slice(0, 200),
          user: a.user || '', timestamp: a.timestamp || ''
        });
      }
    });
  } catch (e) {
    acts.push({ error: String(e.message || e) });
  }

  const clip = (await db.collection('boards').doc(BOARD).collection('clips').doc('y1225j48vzeYDheN0BXm').get()).data() || {};
  const houzzClip = (await db.collection('boards').doc(BOARD).collection('clips').doc('large-rec-glass-lantern-sconce').get()).data() || {};

  console.log(JSON.stringify({
    products: await findProducts(),
    inv6067MissingClips: missing,
    inv6067ClipCount: clipIds.length,
    recentDeletes: acts,
    proposalClip: {
      title: clip.title, libraryProductId: clip.libraryProductId || '', houzzId: clip.houzzId || clip.houzzProductId || '',
      imageUrl: String(clip.imageUrl || '').slice(0, 100), source: clip.source, room: clip.room,
      proposalNum: clip.proposalNum, invoiceNum: clip.invoiceNum
    },
    houzzImportClip: {
      exists: !!(houzzClip.title || houzzClip.houzzId),
      title: houzzClip.title, houzzId: houzzClip.houzzId || houzzClip.houzzProductId || '',
      libraryProductId: houzzClip.libraryProductId || '', imageUrl: String(houzzClip.imageUrl || '').slice(0, 100)
    }
  }, null, 2));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
