/**
 * PRODUCTION heal — Summer Dala wrongly linked to Azure (same Neolith URL-dedupe bug as Layla).
 *
 * Board: cloud-rolling-hills · Slabs 5zLV53Y6IBMkPGDgKHaM
 * Pin 43 → was linked to Azure LKdoHDhwDE9B3WyFrOJW / clip LSawd8kLmPuLX92p15qm
 *
 *   node _scripts/heal-summer-dala-promote-prod_BY_CURSOR_2026-07-24.js --apply
 */
'use strict';
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const APPLY = process.argv.includes('--apply');
const KEY = path.join(__dirname, '..', '_debug', 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
const BOARD = 'cloud-rolling-hills';
const SECTION = '5zLV53Y6IBMkPGDgKHaM';
const BAD_LIB = 'LKdoHDhwDE9B3WyFrOJW';
const BAD_CLIP = 'LSawd8kLmPuLX92p15qm';
const PIN_MAIN = 43;
const PIN_EXTRA = [44, 45];

const app = admin.initializeApp({ credential: admin.credential.cert(require(KEY)) }, 'healSummerDala');
const db = app.firestore();

async function main() {
  console.log(APPLY ? 'MODE: APPLY' : 'MODE: dry-run');
  const ibRef = db.collection('boards').doc(BOARD).collection('ideabooks').doc(SECTION);
  const ibSnap = await ibRef.get();
  if (!ibSnap.exists) throw new Error('ideabook missing');
  const images = (ibSnap.data().images || []).slice();
  const main = images[PIN_MAIN];
  if (!main || String(main.caption || '').toLowerCase() !== 'summer dala') {
    throw new Error('pin 43 is not Summer Dala: ' + (main && main.caption));
  }
  const mainUrl = String(main.imageUrl || '').trim();
  if (!mainUrl) throw new Error('pin 43 has no imageUrl');

  if (String(main.libraryProductId || '') !== BAD_LIB) {
    console.warn('WARN: expected Azure lib link, got', main.libraryProductId);
  }

  const azure = await db.collection('products').doc(BAD_LIB).get();
  if (!azure.exists || String((azure.data() || {}).title || '').toLowerCase() !== 'azure') {
    throw new Error('Azure product safety check failed');
  }
  const azureClip = await db.collection('boards').doc(BOARD).collection('clips').doc(BAD_CLIP).get();
  if (!azureClip.exists || String((azureClip.data() || {}).title || '').toLowerCase() !== 'azure') {
    throw new Error('Azure clip safety check failed');
  }
  console.log('Safety OK: Azure untouched.');
  console.log('Main pin', PIN_MAIN, mainUrl);

  const gallery = [mainUrl];
  PIN_EXTRA.forEach((ix) => {
    const im = images[ix];
    if (!im || String(im.caption || '').toLowerCase() !== 'summer dala') return;
    const u = String(im.imageUrl || '').trim();
    if (u && gallery.indexOf(u) < 0) gallery.push(u);
  });
  console.log('Gallery count', gallery.length);

  const backupDir = path.join(__dirname, '..', '_backups');
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
  const backupPath = path.join(backupDir, 'SUMMER_DALA_HEAL_BACKUP_PROD_' + Date.now() + '.json');
  fs.writeFileSync(backupPath, JSON.stringify({
    pinMain: { index: PIN_MAIN, item: main },
    extras: PIN_EXTRA.map((i) => ({ index: i, item: images[i] })),
    azureProductId: BAD_LIB,
    azureClipId: BAD_CLIP
  }, null, 2));
  console.log('Backup', backupPath);

  if (!APPLY) {
    console.log('Dry-run only. Re-run with --apply.');
    return;
  }

  const now = new Date().toISOString();
  const productPayload = {
    title: 'Summer Dala',
    vendor: 'Neolith',
    category: 'Stone & Tile',
    libraryItemKind: 'product',
    imageUrl: mainUrl,
    images: gallery,
    heroImageIndex: 0,
    projectId: BOARD,
    project: 'Cloud – Rolling Hills',
    productUrl: 'https://www.neolith.com/en/collections/classtone/calacatta-royale',
    vendorUrl: 'https://www.neolith.com/en/collections/classtone/calacatta-royale',
    inspirationSource: 'ideabook',
    productLifecycle: 'active',
    source: 'ideabook-promote-heal',
    _healedFromWrongAzureLinkAt: now,
    createdAt: now,
    updatedAt: now,
    owner: 'cindy@cchdesign.com'
  };

  const prodRef = await db.collection('products').add(productPayload);
  const newLibId = prodRef.id;
  console.log('Created products/' + newLibId);
  try {
    await db.collection('productLibrary').doc(newLibId).set(Object.assign({}, productPayload), { merge: true });
  } catch (_e) {}

  const clipPayload = {
    title: 'Summer Dala',
    vendor: 'Neolith',
    category: 'Stone & Tile',
    room: '',
    imageUrl: mainUrl,
    images: gallery.slice(),
    libraryProductId: newLibId,
    libraryProductIdLocked: true,
    source: 'ideabook-promote',
    inspirationSource: 'ideabook',
    qty: 1,
    addedAt: now,
    updatedAt: now,
    savedAt: now
  };
  const clipRef = await db.collection('boards').doc(BOARD).collection('clips').add(clipPayload);
  const newClipId = clipRef.id;
  console.log('Created clips/' + newClipId);
  try {
    const br = db.collection('boards').doc(BOARD);
    const bd = await br.get();
    if (bd.exists) await br.update({ clipCount: (bd.data().clipCount || 0) + 1 });
  } catch (_eCnt) {}

  images[PIN_MAIN] = Object.assign({}, main, {
    caption: 'Summer Dala',
    title: 'Summer Dala',
    vendor: 'Neolith',
    imageUrl: mainUrl,
    libraryProductId: newLibId,
    linkedLibraryProductId: newLibId,
    roomClipId: newClipId,
    promotedRoom: '',
    promotedCategory: 'Stone & Tile',
    productLifecycle: 'active',
    promotedAt: now,
    _healedWrongAzureLinkAt: now,
    _healedFromLibraryProductId: BAD_LIB,
    _healedFromRoomClipId: BAD_CLIP
  });

  PIN_EXTRA.forEach((ix) => {
    const im = images[ix];
    if (!im || String(im.caption || '').toLowerCase() !== 'summer dala') return;
    images[ix] = Object.assign({}, im, {
      libraryProductId: newLibId,
      linkedLibraryProductId: newLibId,
      _linkedToHealedSummerDalaAt: now
    });
  });

  await ibRef.update({ images: images, updatedAt: now });

  const azureAfter = await db.collection('products').doc(BAD_LIB).get();
  const clipAfter = await db.collection('boards').doc(BOARD).collection('clips').doc(BAD_CLIP).get();
  console.log('Verify Azure title:', (azureAfter.data() || {}).title);
  console.log('Verify Azure clip:', (clipAfter.data() || {}).title);

  const resultPath = path.join(backupDir, 'SUMMER_DALA_HEAL_RESULT_PROD_' + Date.now() + '.json');
  fs.writeFileSync(resultPath, JSON.stringify({ newLibraryProductId: newLibId, newClipId, backupPath }, null, 2));
  console.log('Result', resultPath);
  console.log('DONE. Hard-refresh → Library search Summer Dala; Inspiration keeps wood-grain main.');
}

main().catch((e) => { console.error(e); process.exit(1); });
