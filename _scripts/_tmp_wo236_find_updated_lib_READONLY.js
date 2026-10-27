#!/usr/bin/env node
'use strict';
const path = require('path');
const admin = require('firebase-admin');
const KEY = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
const db = admin.initializeApp({ credential: admin.credential.cert(require(KEY)) }, 'wo236scan').firestore();
const BOARD = 'cloud-rolling-hills';
const TITLE = /large rec|glass lantern|sconce/i;

function imgOf(x) {
  const url = String((x && (x.imageUrl || x.image)) || '');
  const i0 = Array.isArray(x && x.images) && x.images[0] ? String(x.images[0]) : '';
  return { imageUrl: url, images0: i0, nImages: Array.isArray(x && x.images) ? x.images.length : 0, updatedAt: x && x.updatedAt || '' };
}

(async () => {
  const out = { lanternLibs: [], recentLibUpdates: [], clipMismatches: [] };

  const [pSnap, lSnap] = await Promise.all([
    db.collection('products').get(),
    db.collection('productLibrary').get()
  ]);
  const byId = {};
  pSnap.forEach((d) => { byId[d.id] = Object.assign({ _col: 'products', id: d.id }, d.data()); });
  lSnap.forEach((d) => {
    if (!byId[d.id]) byId[d.id] = Object.assign({ _col: 'productLibrary', id: d.id }, d.data());
  });

  Object.keys(byId).forEach((id) => {
    const p = byId[id];
    const t = String(p.title || '');
    if (TITLE.test(t) || String(p.houzzId || '') === '54545585') {
      out.lanternLibs.push({
        col: p._col, id, title: t, vendor: p.vendor || '', category: p.category || '',
        houzzId: p.houzzId || '', updatedAt: p.updatedAt || p.imageUpdatedAt || '',
        img: String(p.imageUrl || '').slice(0, 140)
      });
    }
  });

  // products updated in last 14 days with lighting-ish titles
  const cutoff = Date.now() - 14 * 24 * 3600 * 1000;
  function tsMs(v) {
    if (!v) return 0;
    if (typeof v.toDate === 'function') return v.toDate().getTime();
    if (v._seconds) return v._seconds * 1000;
    const n = Date.parse(String(v));
    return isNaN(n) ? 0 : n;
  }
  Object.keys(byId).forEach((id) => {
    const p = byId[id];
    const ms = tsMs(p.updatedAt) || tsMs(p.imageUpdatedAt) || tsMs(p.modifiedAt);
    if (ms < cutoff) return;
    const t = String(p.title || '');
    if (!/light|lantern|sconce|chandelier|pendant|lamp/i.test(t)) return;
    out.recentLibUpdates.push({
      id, title: t.slice(0, 80), ms, updatedAt: p.updatedAt || '',
      img: String(p.imageUrl || '').slice(0, 100)
    });
  });
  out.recentLibUpdates.sort((a, b) => b.ms - a.ms);
  out.recentLibUpdates = out.recentLibUpdates.slice(0, 25);

  const clips = await db.collection('boards').doc(BOARD).collection('clips').get();
  for (const d of clips.docs) {
    const c = d.data() || {};
    const lid = String(c.libraryProductId || c.linkedLibraryProductId || '').trim();
    if (!lid) continue;
    const p = byId[lid];
    if (!p) continue;
    const cImg = String(c.imageUrl || (Array.isArray(c.images) && c.images[0]) || '').trim();
    const pImg = String(p.imageUrl || (Array.isArray(p.images) && p.images[0]) || '').trim();
    if (!pImg) continue;
    const cBase = cImg.split('?')[0];
    const pBase = pImg.split('?')[0];
    if (cBase === pBase) continue;
    out.clipMismatches.push({
      clipId: d.id,
      title: String(c.title || '').slice(0, 70),
      libId: lid,
      clipImg: cImg.slice(0, 90),
      libImg: pImg.slice(0, 90),
      libUpdated: p.updatedAt || ''
    });
  }

  console.log(JSON.stringify({
    lanternCount: out.lanternLibs.length,
    lanternLibs: out.lanternLibs,
    recentCount: out.recentLibUpdates.length,
    recentLibUpdates: out.recentLibUpdates,
    mismatchCount: out.clipMismatches.length,
    clipMismatches: out.clipMismatches.slice(0, 40)
  }, null, 2));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
