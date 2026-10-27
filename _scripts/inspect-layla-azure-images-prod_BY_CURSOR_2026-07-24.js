'use strict';
const path = require('path');
const admin = require('firebase-admin');
const KEY = path.join(__dirname, '..', '_debug', 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
const app = admin.initializeApp({ credential: admin.credential.cert(require(KEY)) }, 'imgChk');
const db = app.firestore();
const BOARD = 'cloud-rolling-hills';
const SECTION = '5zLV53Y6IBMkPGDgKHaM';
const LAYLA = 'NAZpQO7lTCCQveuCvGxm';
const AZURE = 'LKdoHDhwDE9B3WyFrOJW';

function short(u) { return String(u || '').trim(); }

(async () => {
  const ib = (await db.collection('boards').doc(BOARD).collection('ideabooks').doc(SECTION).get()).data() || {};
  const images = ib.images || [];
  console.log('=== Inspiration Slabs pins 35-42 ===');
  for (let i = 35; i <= 42 && i < images.length; i++) {
    const im = images[i] || {};
    console.log(i, {
      caption: im.caption || im.title || '',
      vendor: im.vendor || '',
      lib: im.libraryProductId || '',
      imageUrl: short(im.imageUrl)
    });
  }
  console.log('\n=== products/Layla ===');
  const lp = (await db.collection('products').doc(LAYLA).get()).data() || {};
  console.log({ title: lp.title, imageUrl: short(lp.imageUrl), images: lp.images, heroImageIndex: lp.heroImageIndex });
  console.log('\n=== products/Azure ===');
  const ap = (await db.collection('products').doc(AZURE).get()).data() || {};
  console.log({ title: ap.title, imageUrl: short(ap.imageUrl), images: ap.images, heroImageIndex: ap.heroImageIndex });
  console.log('\n=== clip Layla ===');
  const lc = (await db.collection('boards').doc(BOARD).collection('clips').doc('2du9GVAtZcZ4cZQpObJQ').get()).data() || {};
  console.log({ title: lc.title, imageUrl: short(lc.imageUrl), images: lc.images });
  console.log('\n=== clip Azure ===');
  const ac = (await db.collection('boards').doc(BOARD).collection('clips').doc('LSawd8kLmPuLX92p15qm').get()).data() || {};
  console.log({ title: ac.title, imageUrl: short(ac.imageUrl), images: ac.images });
})().catch((e) => { console.error(e); process.exit(1); });
