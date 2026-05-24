'use strict';
const path = require('path');
const admin = require('firebase-admin');
const key = path.join(__dirname, 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
admin.initializeApp({ credential: admin.credential.cert(require(key)) });
const db = admin.firestore();

(async () => {
  const inv = (await db.collection('boards').doc('cloud-rolling-hills').collection('invoices').doc('17zvCe3CeU7fZIkkseGW').get()).data();
  const it = (inv.items || [])[3];
  console.log('invoice updatedAt:', inv.updatedAt);
  console.log(JSON.stringify({
    title: it.title,
    libraryProductId: it.libraryProductId,
    houzzId: it.houzzId,
    _imageManual: it._imageManual,
    heroImageIndex: it.heroImageIndex,
    imagesLen: (it.images || []).length,
    imageUrl: it.imageUrl,
    images: it.images
  }, null, 2));
  const prod = await db.collection('products').doc('zX6oqf7VjqpfowxFR1QJ').get();
  if (prod.exists) {
    const p = prod.data();
    console.log('\nproducts/zX6oqf7VjqpfowxFR1QJ imageUrl:', (p.imageUrl || '').slice(0, 120));
    console.log('products title:', p.title);
  } else {
    console.log('\nproducts/zX6oqf7VjqpfowxFR1QJ: NOT FOUND');
  }
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
