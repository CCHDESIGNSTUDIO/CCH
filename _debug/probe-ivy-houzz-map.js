'use strict';
const path = require('path');
const admin = require('firebase-admin');
const key = path.join(__dirname, 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
const app = admin.initializeApp({ credential: admin.credential.cert(require(key)) });
const db = app.firestore();
const bucket = app.storage().bucket('cch-design-boards.firebasestorage.app');

function ivyPath(url) {
  url = String(url || '').replace(/&amp;/g, '&');
  const m = url.match(/ivy-uploads[^/]*\/[^/]+\/image\/(\d+)\/([^?]+)/i);
  return m ? { imageId: m[1], filePart: m[2] } : null;
}

(async () => {
  const board = 'cloud-rolling-hills';
  const clip = await db.collection('boards').doc(board).collection('clips')
    .where('title', '==', 'Manhattan').limit(3).get();
  for (const d of clip.docs) {
    const c = d.data();
    const ivy = c.imageUrl || '';
    const hid = String(c.houzzId || c.houzzProductId || c.houzzProduct || '').trim();
    console.log('\nclip', d.id, c.title);
    console.log('  houzzId fields:', hid, c.houzzImageId, c.ivyImageId);
    console.log('  ivy:', ivy.slice(0, 100));
    console.log('  ivy parse:', ivyPath(ivy));
    if (hid) {
      const [files] = await bucket.getFiles({ prefix: `houzz-products/${hid}/`, maxResults: 10 });
      console.log('  storage houzz-products/' + hid + '/:', files.map((f) => f.name).slice(0, 5));
    }
  }
  const inv = await db.collection('boards').doc(board).collection('invoices').doc('17zvCe3CeU7fZIkkseGW').get();
  const line = (inv.data().items || []).find((it) => (it.title || '').indexOf('Manhattan') >= 0);
  if (line) {
    console.log('\ninvoice line Manhattan');
    console.log('  houzzId:', line.houzzId, line.houzzProductId);
    console.log('  ivy:', String(line.imageUrl || '').slice(0, 100));
    console.log('  ivy parse:', ivyPath(line.imageUrl));
  }
  const prod = await db.collection('products').where('title', '==', 'Manhattan').limit(2).get();
  prod.forEach((d) => {
    const p = d.data();
    const hid = String(p.houzzId || p.houzzProductId || '').trim();
    console.log('\nproduct', d.id, p.title, 'houzzId', hid);
    console.log('  imageUrl:', String(p.imageUrl || '').slice(0, 90));
  });
  for (const id of ['262813654', '33498350', '262813648']) {
    const [f] = await bucket.getFiles({ prefix: 'houzz-products/' + id + '/', maxResults: 8 });
    console.log('\nstorage prefix houzz-products/' + id + '/', f.length, f.map((x) => x.name));
  }
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
