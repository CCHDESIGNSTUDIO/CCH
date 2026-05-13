/**
 * Read 10 sample Studio products to see what fields they actually have,
 * especially image-related fields. Read-only.
 */
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, query, limit } = require('firebase/firestore');

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

  // Pull all products to see field distribution
  const snap = await getDocs(collection(db, 'products'));
  const products = [];
  snap.forEach(d => products.push({ _id: d.id, ...d.data() }));
  console.log(`Total products: ${products.length}`);

  // Field frequency
  const fieldCounts = {};
  for (const p of products) {
    for (const k of Object.keys(p)) fieldCounts[k] = (fieldCounts[k] || 0) + 1;
  }
  const sortedFields = Object.entries(fieldCounts).sort((a,b) => b[1] - a[1]);
  console.log('\nField frequency (field: count of products with that field populated/present):');
  for (const [f, c] of sortedFields) console.log(`  ${f.padEnd(40)} ${c}`);

  // Look at any field name containing "image", "img", "photo", "pic", "thumb"
  console.log('\nImage-like fields and how many products have them populated (non-empty):');
  const imageLike = sortedFields.filter(([f]) =>
    /image|img|photo|pic|thumb|src|url/i.test(f)
  );
  for (const [f, _] of imageLike) {
    const populated = products.filter(p => {
      const v = p[f];
      if (v === null || v === undefined || v === '') return false;
      if (Array.isArray(v) && v.length === 0) return false;
      return true;
    }).length;
    console.log(`  ${f.padEnd(40)} populated: ${populated}`);
  }

  // Show 5 random products' full keys
  console.log('\n3 sample products (all fields):');
  const samples = products.slice(0, 3);
  for (const p of samples) {
    console.log(`\n--- product ${p._id} ---`);
    for (const [k, v] of Object.entries(p)) {
      let display = v;
      if (typeof v === 'string' && v.length > 120) display = v.slice(0, 120) + '...';
      if (Array.isArray(v)) display = `[Array ${v.length}: ${JSON.stringify(v).slice(0, 100)}...]`;
      if (typeof v === 'object' && v !== null && !Array.isArray(v)) display = `{${Object.keys(v).join(',')}}`;
      console.log(`  ${k}: ${display}`);
    }
  }

  process.exit(0);
})().catch(err => { console.error(err); process.exit(1); });
