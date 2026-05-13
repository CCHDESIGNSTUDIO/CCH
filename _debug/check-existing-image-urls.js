/**
 * Check what kind of URLs are actually in Studio's imageUrl field.
 * Are they Houzz S3 (expiring), Clipper-grabbed (durable), or other?
 */
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

const PROD_CONFIG = {
  apiKey: 'AIzaSyAd24U5ArVGrA24IxNcYD2NYiTVycyF4og',
  authDomain: 'cch-design-boards.firebaseapp.com',
  projectId: 'cch-design-boards',
  storageBucket: 'cch-design-boards.appspot.com',
  messagingSenderId: '210388013080',
  appId: '1:210388013080:web:cch-design-boards',
};

(async () => {
  const app = initializeApp(PROD_CONFIG);
  const db = getFirestore(app);
  const snap = await getDocs(collection(db, 'products'));
  const products = [];
  snap.forEach(d => products.push({ _id: d.id, ...d.data() }));

  let empty = 0, houzzS3 = 0, expiredHouzzS3 = 0, firebaseStorage = 0, retail = 0, other = 0;
  const now = Math.floor(Date.now() / 1000);
  const samples = { houzzS3: [], retail: [], other: [], firebaseStorage: [] };

  for (const p of products) {
    const url = (p.imageUrl || '').trim();
    if (!url) { empty++; continue; }

    if (/ivy-(prod|uploads)\.s3/i.test(url) || /amazonaws\.com/i.test(url)) {
      houzzS3++;
      // Check Expires param
      const m = url.match(/[?&]Expires=(\d+)/);
      if (m && Number(m[1]) < now) expiredHouzzS3++;
      if (samples.houzzS3.length < 3) samples.houzzS3.push(url);
    } else if (/firebasestorage\.googleapis\.com/i.test(url)) {
      firebaseStorage++;
      if (samples.firebaseStorage.length < 3) samples.firebaseStorage.push(url);
    } else if (/^https?:\/\//.test(url)) {
      // Heuristic: retail vendor sites (not S3, not Firebase)
      retail++;
      if (samples.retail.length < 3) samples.retail.push(url);
    } else {
      other++;
      if (samples.other.length < 3) samples.other.push(url);
    }
  }

  console.log(`Total products:          ${products.length}`);
  console.log(`  imageUrl empty:        ${empty}`);
  console.log(`  imageUrl Houzz S3:     ${houzzS3} (of which ${expiredHouzzS3} EXPIRED)`);
  console.log(`  imageUrl Firebase:     ${firebaseStorage}`);
  console.log(`  imageUrl retail/other: ${retail}`);
  console.log(`  imageUrl misc:         ${other}`);
  console.log();
  console.log('Sample Houzz S3 URLs:');
  for (const u of samples.houzzS3) console.log(`  ${u.slice(0, 130)}...`);
  console.log();
  console.log('Sample retail URLs:');
  for (const u of samples.retail) console.log(`  ${u.slice(0, 130)}...`);
  console.log();
  console.log('Sample Firebase Storage URLs:');
  for (const u of samples.firebaseStorage) console.log(`  ${u.slice(0, 130)}...`);

  process.exit(0);
})().catch(err => { console.error(err); process.exit(1); });
