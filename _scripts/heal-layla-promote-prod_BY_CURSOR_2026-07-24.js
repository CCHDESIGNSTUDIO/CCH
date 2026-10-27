/**
 * PRODUCTION heal — Layla Neolith pin wrongly linked to Azure product/clip.
 *
 * Board: cloud-rolling-hills · ideabook Slabs 5zLV53Y6IBMkPGDgKHaM
 * Pin index 38 caption Layla → was linked to products/LKdoHDhwDE9B3WyFrOJW (Azure)
 * and clip LSawd8kLmPuLX92p15qm (Azure). Leave those alone.
 *
 * Dry-run (default):
 *   node _scripts/heal-layla-promote-prod_BY_CURSOR_2026-07-24.js
 * Apply:
 *   node _scripts/heal-layla-promote-prod_BY_CURSOR_2026-07-24.js --apply
 */
'use strict';
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const APPLY = process.argv.includes('--apply');
const KEY = path.join(
  __dirname,
  '..',
  '_debug',
  'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json'
);
const BOARD = 'cloud-rolling-hills';
const SECTION = '5zLV53Y6IBMkPGDgKHaM';
const BAD_LIB = 'LKdoHDhwDE9B3WyFrOJW';
const BAD_CLIP = 'LSawd8kLmPuLX92p15qm';
const PIN_GOOD = 37; // real Layla image
const PIN_BAD = 38;  // wrongly linked / wrong image

const app = admin.initializeApp({ credential: admin.credential.cert(require(KEY)) }, 'healLayla');
const db = app.firestore();

async function main() {
  console.log(APPLY ? 'MODE: APPLY (production writes)' : 'MODE: dry-run');
  console.log('Board', BOARD, 'section', SECTION);

  const ibRef = db.collection('boards').doc(BOARD).collection('ideabooks').doc(SECTION);
  const ibSnap = await ibRef.get();
  if (!ibSnap.exists) throw new Error('ideabook missing');
  const ib = ibSnap.data() || {};
  const images = Array.isArray(ib.images) ? ib.images.slice() : [];
  const good = images[PIN_GOOD];
  const bad = images[PIN_BAD];
  if (!good || typeof good !== 'object') throw new Error('pin ' + PIN_GOOD + ' missing');
  if (!bad || typeof bad !== 'object') throw new Error('pin ' + PIN_BAD + ' missing');

  const goodCaption = String(good.caption || good.title || '').trim();
  const badCaption = String(bad.caption || bad.title || '').trim();
  const goodUrl = String(good.imageUrl || '').trim();
  console.log('Good pin', PIN_GOOD, { caption: goodCaption, imageUrl: goodUrl.slice(0, 80) });
  console.log('Bad pin', PIN_BAD, {
    caption: badCaption,
    libraryProductId: bad.libraryProductId || '',
    roomClipId: bad.roomClipId || '',
    imageUrl: String(bad.imageUrl || '').slice(0, 80)
  });

  if (goodCaption.toLowerCase() !== 'layla') throw new Error('pin 37 caption is not Layla: ' + goodCaption);
  if (badCaption.toLowerCase() !== 'layla') throw new Error('pin 38 caption is not Layla: ' + badCaption);
  if (String(bad.libraryProductId || '') !== BAD_LIB) {
    console.warn('WARN: expected bad lib', BAD_LIB, 'got', bad.libraryProductId);
  }
  if (String(bad.roomClipId || '') !== BAD_CLIP) {
    console.warn('WARN: expected bad clip', BAD_CLIP, 'got', bad.roomClipId);
  }

  // Safety: Azure product/clip must still be Azure
  const azureProd = await db.collection('products').doc(BAD_LIB).get();
  if (!azureProd.exists) throw new Error('Azure product missing — abort');
  const azureTitle = String((azureProd.data() || {}).title || '').trim();
  if (azureTitle.toLowerCase() !== 'azure') {
    throw new Error('Expected Azure product title, got: ' + azureTitle);
  }
  const azureClip = await db.collection('boards').doc(BOARD).collection('clips').doc(BAD_CLIP).get();
  if (!azureClip.exists) throw new Error('Azure clip missing — abort');
  const azureClipTitle = String((azureClip.data() || {}).title || '').trim();
  if (azureClipTitle.toLowerCase() !== 'azure') {
    throw new Error('Expected Azure clip title, got: ' + azureClipTitle);
  }
  console.log('Safety OK: Azure product + clip untouched targets confirmed.');

  const backupDir = path.join(__dirname, '..', '_backups');
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
  const backupPath = path.join(backupDir, 'LAYLA_HEAL_BACKUP_PROD_' + Date.now() + '.json');
  const backup = {
    board: BOARD,
    section: SECTION,
    pinGood: { index: PIN_GOOD, item: good },
    pinBad: { index: PIN_BAD, item: bad },
    azureProductId: BAD_LIB,
    azureClipId: BAD_CLIP
  };
  fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));
  console.log('Backup written:', backupPath);

  const now = new Date().toISOString();
  const boardName = 'Cloud – Rolling Hills';
  const productPayload = {
    title: 'Layla',
    vendor: 'Neolith',
    category: 'Stone & Tile',
    libraryItemKind: 'product',
    imageUrl: goodUrl,
    images: [goodUrl].concat(
      String(images[39] && images[39].imageUrl || '').trim() &&
      String(images[39].caption || '').toLowerCase() === 'layla'
        ? [String(images[39].imageUrl).trim()]
        : []
    ).filter(Boolean),
    projectId: BOARD,
    project: boardName,
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

  const clipPayload = {
    title: 'Layla',
    vendor: 'Neolith',
    category: 'Stone & Tile',
    room: '',
    imageUrl: goodUrl,
    images: productPayload.images.slice(),
    libraryProductId: null, // filled after product create
    libraryProductIdLocked: true,
    source: 'ideabook-promote',
    inspirationSource: 'ideabook',
    cost: null,
    clientPrice: null,
    qty: 1,
    addedAt: now,
    updatedAt: now,
    savedAt: now
  };

  console.log('\nWill create products/ row:', JSON.stringify({
    title: productPayload.title,
    vendor: productPayload.vendor,
    category: productPayload.category,
    imageUrl: productPayload.imageUrl.slice(0, 80),
    imageCount: productPayload.images.length
  }, null, 2));
  console.log('Will create new clip (NOT', BAD_CLIP + ')');
  console.log('Will patch pin', PIN_BAD, 'image + links; also stamp pin', PIN_GOOD, 'libraryProductId');
  console.log('Will NOT modify Azure product', BAD_LIB, 'or clip', BAD_CLIP);

  if (!APPLY) {
    console.log('\nDry-run only. Re-run with --apply to write production.');
    return;
  }

  const prodRef = await db.collection('products').add(productPayload);
  const newLibId = prodRef.id;
  console.log('Created products/' + newLibId);

  try {
    await db.collection('productLibrary').doc(newLibId).set(
      Object.assign({}, productPayload, { unitCost: productPayload.costPrice || null }),
      { merge: true }
    );
  } catch (eDual) {
    console.warn('productLibrary dual-write skipped/failed:', eDual.message || eDual);
  }

  clipPayload.libraryProductId = newLibId;
  const clipRef = await db.collection('boards').doc(BOARD).collection('clips').add(clipPayload);
  const newClipId = clipRef.id;
  console.log('Created clips/' + newClipId);

  try {
    const boardRef = db.collection('boards').doc(BOARD);
    const bd = await boardRef.get();
    if (bd.exists) {
      const cur = bd.data().clipCount || 0;
      await boardRef.update({ clipCount: cur + 1 });
    }
  } catch (_eCnt) {}

  // Restore bad pin to Layla image + new links
  images[PIN_BAD] = Object.assign({}, bad, {
    caption: 'Layla',
    title: 'Layla',
    vendor: 'Neolith',
    imageUrl: goodUrl,
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

  // Stamp good pin so Library badge is consistent (same product, no separate clip required)
  images[PIN_GOOD] = Object.assign({}, good, {
    libraryProductId: newLibId,
    linkedLibraryProductId: newLibId,
    promotedCategory: 'Stone & Tile',
    productLifecycle: 'active',
    promotedAt: now,
    _linkedToHealedLaylaAt: now
  });

  // Optional: pin 39 also Layla gallery — link library id only, keep own image
  if (images[39] && typeof images[39] === 'object' &&
      String(images[39].caption || '').toLowerCase() === 'layla') {
    images[39] = Object.assign({}, images[39], {
      libraryProductId: newLibId,
      linkedLibraryProductId: newLibId,
      _linkedToHealedLaylaAt: now
    });
  }

  await ibRef.update({
    images: images,
    updatedAt: now
  });
  console.log('Updated ideabook images (pins 37/38/39).');

  // Verify Azure untouched
  const azureAfter = await db.collection('products').doc(BAD_LIB).get();
  const clipAfter = await db.collection('boards').doc(BOARD).collection('clips').doc(BAD_CLIP).get();
  console.log('Verify Azure product title:', (azureAfter.data() || {}).title);
  console.log('Verify Azure clip title:', (clipAfter.data() || {}).title);

  const resultPath = path.join(backupDir, 'LAYLA_HEAL_RESULT_PROD_' + Date.now() + '.json');
  fs.writeFileSync(resultPath, JSON.stringify({
    newLibraryProductId: newLibId,
    newClipId: newClipId,
    backupPath: backupPath,
    azureProductId: BAD_LIB,
    azureClipId: BAD_CLIP
  }, null, 2));
  console.log('Result:', resultPath);
  console.log('DONE. Hard-refresh production → Product Library search Layla; Inspiration Slabs pin 38 should show Layla image + 📦.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
