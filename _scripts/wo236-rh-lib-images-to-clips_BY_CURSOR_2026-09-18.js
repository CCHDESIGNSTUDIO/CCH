#!/usr/bin/env node
'use strict';
/**
 * WO-236 — copy library hero onto RH clips for products Cindy updated today.
 * Default dry-run. --apply writes image fields only (no money).
 */
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const KEY = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
const db = admin.initializeApp({ credential: admin.credential.cert(require(KEY)) }, 'wo236apply').firestore();
const BOARD = 'cloud-rolling-hills';
const LIB_IDS = [
  'QtMhnee1hurOGMoUUhj7', // Tall Rec Glass Lantern Sconce
  'SvwMl1gIAsJIsA3aPaiJ', // Vertical Sconce Rectangular
  'Vba2v8UykZ1LaILgRmWB'  // Summit Single Sconce
];
const APPLY = process.argv.includes('--apply');

function imgPack(x) {
  x = x || {};
  const images = Array.isArray(x.images) ? x.images.filter(Boolean).map(String) : [];
  const hero = String(x.imageUrl || x.image || images[0] || '').trim();
  return { hero, images, image: String(x.image || ''), override: x.imageUrlOverride || '', updatedAt: x.updatedAt || '' };
}

(async () => {
  const libs = {};
  for (const id of LIB_IDS) {
    let snap = await db.collection('products').doc(id).get();
    if (!snap.exists) snap = await db.collection('productLibrary').doc(id).get();
    const d = snap.data() || {};
    libs[id] = Object.assign({ id, title: d.title || '', exists: snap.exists }, imgPack(d));
  }

  const clipsSnap = await db.collection('boards').doc(BOARD).collection('clips').get();
  const hits = [];
  clipsSnap.forEach((doc) => {
    const c = doc.data() || {};
    const lid = String(c.libraryProductId || c.linkedLibraryProductId || '').trim();
    if (LIB_IDS.indexOf(lid) < 0) return;
    const pack = imgPack(c);
    const lib = libs[lid];
    hits.push({
      clipId: doc.id,
      title: c.title || '',
      room: c.room || '',
      libId: lid,
      sameHero: pack.hero === lib.hero,
      clipHero: pack.hero,
      libHero: lib.hero,
      clipImages: pack.images,
      libImages: lib.images,
      override: pack.override,
      qty: c.qty, cost: c.cost, unitCost: c.unitCost, amount: c.amount
    });
  });

  const planned = hits.filter((h) => h.libHero && !h.sameHero);
  console.log(JSON.stringify({ apply: APPLY, libs, hits, plannedCount: planned.length, plannedIds: planned.map((h) => h.clipId) }, null, 2));

  if (!APPLY) {
    console.log('DRY RUN — pass --apply to write clip imageUrl/images.');
    process.exit(0);
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(__dirname, '..', '_backup', 'wo236-rh-lib-images-' + stamp);
  fs.mkdirSync(backupDir, { recursive: true });

  const written = [];
  for (const h of planned) {
    const cref = db.collection('boards').doc(BOARD).collection('clips').doc(h.clipId);
    const before = (await cref.get()).data() || {};
    fs.writeFileSync(path.join(backupDir, h.clipId + '.json'), JSON.stringify(before, null, 2));
    const lib = libs[h.libId];
    const images = (lib.images && lib.images.length) ? lib.images.slice() : [lib.hero];
    if (images[0] !== lib.hero) {
      images.splice(images.indexOf(lib.hero), 1);
      images.unshift(lib.hero);
    }
    const patch = {
      imageUrl: lib.hero,
      image: lib.hero,
      images: images,
      heroImageIndex: 0,
      imageUrlOverride: admin.firestore.FieldValue.delete(),
      updatedAt: new Date().toISOString(),
      _wo236ImageFromLibrary: true
    };
    await cref.update(patch);
    written.push({ clipId: h.clipId, title: h.title, libId: h.libId });
  }
  fs.writeFileSync(path.join(backupDir, '_written.json'), JSON.stringify(written, null, 2));
  console.log(JSON.stringify({ wrote: written.length, backupDir, written }, null, 2));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
