/**
 * PRODUCTION — restore Layla MAIN (slab hero) image after mistaken heal duplicate.
 *
 * Pin 38 / Layla product get imagen_destacada (dark slab hero).
 * Azure product gets neolith_azure_slab.jpg (matches Azure inspiration pin).
 *
 *   node _scripts/restore-layla-main-image-prod_BY_CURSOR_2026-07-24.js
 *   node _scripts/restore-layla-main-image-prod_BY_CURSOR_2026-07-24.js --apply
 */
'use strict';
const path = require('path');
const admin = require('firebase-admin');

const APPLY = process.argv.includes('--apply');
const KEY = path.join(__dirname, '..', '_debug', 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
const BOARD = 'cloud-rolling-hills';
const SECTION = '5zLV53Y6IBMkPGDgKHaM';
const LAYLA_LIB = 'NAZpQO7lTCCQveuCvGxm';
const LAYLA_CLIP = '2du9GVAtZcZ4cZQpObJQ';
const AZURE_LIB = 'LKdoHDhwDE9B3WyFrOJW';
const PIN_MAIN = 38;

const LAYLA_MAIN = 'https://a.storyblok.com/f/150360/1250x1824/4e70578277/imagen_destacada.jpg/m/';
const LAYLA_HP1 = 'https://a.storyblok.com/f/150360/1100x1600/04e7486d0f/layla_hp_1.jpg';
const LAYLA_HP3 = 'https://a.storyblok.com/f/150360/1100x1600/b2957b5d2c/layla_hp_3.jpg';
const AZURE_SLAB = 'https://a.storyblok.com/f/150360/1500x2959/6b38c92141/neolith_azure_slab.jpg';

const app = admin.initializeApp({ credential: admin.credential.cert(require(KEY)) }, 'restoreLaylaMain');
const db = app.firestore();

async function main() {
  console.log(APPLY ? 'MODE: APPLY' : 'MODE: dry-run');
  const now = new Date().toISOString();

  const layla = (await db.collection('products').doc(LAYLA_LIB).get()).data() || {};
  const azure = (await db.collection('products').doc(AZURE_LIB).get()).data() || {};
  if (String(layla.title || '').toLowerCase() !== 'layla') throw new Error('Layla product title mismatch');
  if (String(azure.title || '').toLowerCase() !== 'azure') throw new Error('Azure product title mismatch');

  const ibRef = db.collection('boards').doc(BOARD).collection('ideabooks').doc(SECTION);
  const ib = (await ibRef.get()).data() || {};
  const images = (ib.images || []).slice();
  const pin = images[PIN_MAIN];
  if (!pin || String(pin.caption || '').toLowerCase() !== 'layla') throw new Error('pin 38 not Layla');

  const laylaImages = [LAYLA_MAIN, LAYLA_HP1, LAYLA_HP3];
  console.log('Layla product imageUrl now:', layla.imageUrl);
  console.log('→ set to MAIN slab:', LAYLA_MAIN);
  console.log('Pin 38 imageUrl now:', pin.imageUrl);
  console.log('→ set to MAIN slab');
  console.log('Azure product imageUrl now:', azure.imageUrl);
  console.log('→ set to azure slab:', AZURE_SLAB);

  if (!APPLY) {
    console.log('Dry-run only. Re-run with --apply.');
    return;
  }

  await db.collection('products').doc(LAYLA_LIB).update({
    imageUrl: LAYLA_MAIN,
    images: laylaImages,
    heroImageIndex: 0,
    updatedAt: now,
    _restoredMainImageAt: now
  });
  try {
    await db.collection('productLibrary').doc(LAYLA_LIB).set({
      imageUrl: LAYLA_MAIN,
      images: laylaImages,
      heroImageIndex: 0,
      updatedAt: now
    }, { merge: true });
  } catch (_e) {}

  await db.collection('boards').doc(BOARD).collection('clips').doc(LAYLA_CLIP).update({
    imageUrl: LAYLA_MAIN,
    images: laylaImages,
    updatedAt: now
  });

  images[PIN_MAIN] = Object.assign({}, pin, {
    imageUrl: LAYLA_MAIN,
    _restoredMainImageAt: now
  });
  await ibRef.update({ images: images, updatedAt: now });

  await db.collection('products').doc(AZURE_LIB).update({
    imageUrl: AZURE_SLAB,
    images: [AZURE_SLAB],
    updatedAt: now,
    _restoredAzureSlabAt: now
  });
  try {
    await db.collection('productLibrary').doc(AZURE_LIB).set({
      imageUrl: AZURE_SLAB,
      images: [AZURE_SLAB],
      updatedAt: now
    }, { merge: true });
  } catch (_e2) {}

  console.log('DONE. Hard-refresh: Inspiration Layla middle pin = dark slab hero; Library Layla main = same; Azure = white/blue azure slab.');
}

main().catch((e) => { console.error(e); process.exit(1); });
