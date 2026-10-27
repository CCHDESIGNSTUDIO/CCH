#!/usr/bin/env node
'use strict';
/**
 * Restore Anna Semi-Flush Mount (SKU 44764) clipper image.
 * Clip kept imageFilename wytfj_44764.jpeg but URL was swapped to Moers (33491972).
 * Correct Anna Houzz catalog: 58307313 (wytfj_44764 → slot 1).
 *
 *   node _scripts/restore-anna-clipper-image_BY_CLAUDE_2026-06-03.js
 *   node _scripts/restore-anna-clipper-image_BY_CLAUDE_2026-06-03.js --apply
 */
const path = require('path');
const fs = require('fs');
const admin = require('firebase-admin');

const APPLY = process.argv.includes('--apply');
const PROJECT_ID = 'cloud-rolling-hills';
const CLIP_ID = 'RHcPR9xep5IdBZEKUAK5';
const LIB_ID = '93WNGh4hetTjLelYY9Xy';
const WRONG_HOUZZ = '33491972';
const ANNA_HOUZZ = '58307313';

const ANNA_IMAGES = [
  'https://firebasestorage.googleapis.com/v0/b/cch-design-boards.firebasestorage.app/o/houzz-products%2F58307313%2F1.jpeg?alt=media&token=8caf3a7c-e454-41ad-8794-ad3afa7e8ad6',
  'https://firebasestorage.googleapis.com/v0/b/cch-design-boards.firebasestorage.app/o/houzz-products%2F58307313%2F2.jpeg?alt=media&token=c0a2196d-b2ff-49d3-80a3-0738d5e799e1',
  'https://firebasestorage.googleapis.com/v0/b/cch-design-boards.firebasestorage.app/o/houzz-products%2F58307313%2F3.jpeg?alt=media&token=8957548f-e40b-4a4a-8b9e-a418387a0f85',
  'https://firebasestorage.googleapis.com/v0/b/cch-design-boards.firebasestorage.app/o/houzz-products%2F58307313%2F4.jpeg?alt=media&token=9b0ad6d0-5a48-42ce-8060-a3a621d30be6',
  'https://firebasestorage.googleapis.com/v0/b/cch-design-boards.firebasestorage.app/o/houzz-products%2F58307313%2F5.jpeg?alt=media&token=8ebf3406-7468-4982-aee0-419e82620a84',
];

const KEY = path.join(
  __dirname,
  '..',
  '_debug',
  'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json'
);

function usesWrongMoers(url) {
  return String(url || '').indexOf(WRONG_HOUZZ) >= 0 || String(url || '').indexOf('49786') >= 0;
}

function imagePatch() {
  return {
    imageUrl: ANNA_IMAGES[0],
    images: ANNA_IMAGES.slice(),
    heroImageIndex: 0,
    imageFilename: 'wytfj_44764.jpeg',
    houzzId: ANNA_HOUZZ,
    _imageLocked: true,
    _clipSourceTruth: true,
  };
}

async function main() {
  if (!fs.existsSync(KEY)) {
    console.error('Missing service account:', KEY);
    process.exit(1);
  }
  admin.initializeApp({ credential: admin.credential.cert(require(KEY)) });
  const db = admin.firestore();
  const ts = new Date().toISOString();
  const patch = Object.assign({}, imagePatch(), { _annaImageRestoreAt: ts, updatedAt: ts });

  const clipRef = db.collection('boards').doc(PROJECT_ID).collection('clips').doc(CLIP_ID);
  const clipSnap = await clipRef.get();
  if (!clipSnap.exists) {
    console.error('Clip missing:', CLIP_ID);
    process.exit(1);
  }
  const clipBefore = clipSnap.data() || {};

  const libRef = db.collection('products').doc(LIB_ID);
  const plRef = db.collection('productLibrary').doc(LIB_ID);
  const libBefore = (await libRef.get()).data() || {};

  const invHits = [];
  const invSnap = await db.collection('boards').doc(PROJECT_ID).collection('invoices').get();
  for (const d of invSnap.docs) {
    const data = d.data() || {};
    const items = Array.isArray(data.items) ? data.items : [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i] || {};
      if (String(it.clipId || it.sourceClipId || '') !== CLIP_ID) continue;
      invHits.push({ ref: d.ref, items: items.slice(), lineIdx: i, item: it, invId: d.id, num: data.number || data.invoiceNum });
    }
  }

  const report = {
    mode: APPLY ? 'apply' : 'dry-run',
    clip: {
      id: CLIP_ID,
      before: {
        imageUrl: clipBefore.imageUrl,
        imageFilename: clipBefore.imageFilename,
        houzzId: clipBefore.houzzId,
        images: clipBefore.images,
      },
      after: patch,
    },
    library: {
      id: LIB_ID,
      before: { imageUrl: libBefore.imageUrl, houzzId: libBefore.houzzId },
    },
    invoices: invHits.map((h) => ({
      id: h.invId,
      num: h.num,
      lineIdx: h.lineIdx,
      before: { imageUrl: h.item.imageUrl, imageFilename: h.item.imageFilename, houzzId: h.item.houzzId },
    })),
  };

  const wrongStill =
    usesWrongMoers(clipBefore.imageUrl) ||
    (Array.isArray(clipBefore.images) && clipBefore.images.some(usesWrongMoers));
  if (!wrongStill && String(clipBefore.houzzId || '') === ANNA_HOUZZ) {
    console.log('Anna clip already has correct 58307313 image. Nothing to do.');
    return;
  }

  console.log(JSON.stringify(report, null, 2));
  if (!APPLY) {
    console.log('\nDry-run. Run with --apply to write.');
    return;
  }

  await clipRef.set(patch, { merge: true });
  await libRef.set(patch, { merge: true });
  await plRef.set(Object.assign({}, patch, { unitCost: libBefore.costPrice || libBefore.unitCost }), { merge: true });

  for (const inv of invHits) {
    const items = inv.items.slice();
    items[inv.lineIdx] = Object.assign({}, items[inv.lineIdx], patch, {
      libraryProductId: LIB_ID,
      libraryProductIdLocked: true,
    });
    await inv.ref.update({ items, updatedAt: ts });
  }

  const backupDir = path.join(__dirname, '..', '_backup', 'anna-image-restore-2026-06-03');
  fs.mkdirSync(backupDir, { recursive: true });
  fs.writeFileSync(path.join(backupDir, 'apply-report.json'), JSON.stringify({ at: ts, report }, null, 2));
  console.log('\nApplied Anna clipper image restore. Backup:', backupDir);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
