const path = require('path');
const admin = require('firebase-admin');
const SA = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
admin.initializeApp({ credential: admin.credential.cert(require(SA)) });
const db = admin.firestore();
(async () => {
  const d = await db.collection('boards').doc('holtz-hill').collection('ideabooks').doc('RtpypZEiUdKNIkuXijpp').get();
  if (!d.exists) { console.log('Doc not found'); process.exit(1); }
  const x = d.data();
  console.log('Top-level keys:', Object.keys(x));
  console.log('\ncolumns type:', typeof x.columns, Array.isArray(x.columns) ? '(array)' : '');
  if (Array.isArray(x.columns)) {
    console.log('columns length:', x.columns.length);
    console.log('First 5 columns:');
    x.columns.slice(0, 5).forEach((c, i) => {
      console.log(`  [${i}]:`, typeof c === 'object' ? JSON.stringify(c).slice(0, 200) : c);
    });
  } else if (typeof x.columns === 'object') {
    console.log('columns object keys:', Object.keys(x.columns).slice(0, 20));
    const firstKey = Object.keys(x.columns)[0];
    if (firstKey) console.log(`columns[${firstKey}]:`, JSON.stringify(x.columns[firstKey]).slice(0, 300));
  } else if (typeof x.columns === 'number') {
    console.log('columns numeric value:', x.columns);
  }
  // Also check if images have an index → section mapping anywhere
  console.log('\nsource:', x.source);
  console.log('\nFirst image full object (formatted):');
  console.log(JSON.stringify(x.images[0], null, 2).slice(0, 1000));
  // Check for any section-like field across ALL images
  const otherKeys = new Set();
  for (const img of x.images) {
    if (img && typeof img === 'object') {
      for (const k of Object.keys(img)) otherKeys.add(k);
    }
  }
  console.log('\nUnion of ALL keys across the 541 images:', Array.from(otherKeys).sort().join(', '));
  process.exit(0);
})();
