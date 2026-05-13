/**
 * Read-only staging validation snapshot after phase1.5/1.6.
 */
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

const STAGING = {
  apiKey: 'AIzaSyBIwwo7uRij6Q0FZg-qmIS1LC8t2AjXrYo',
  authDomain: 'cch-studio-staging.firebaseapp.com',
  projectId: 'cch-studio-staging',
  storageBucket: 'cch-studio-staging.firebasestorage.app',
  messagingSenderId: '210388013080',
  appId: '1:210388013080:web:fcd520b30c0d50b149736d',
};

const REAL_CATS_LOWER = new Set([
  'art', 'mirror', 'accessories', 'fabric & trim', 'furniture', 'stone & tile',
  'appliances & plumbing', 'hardware', 'floor covering', 'florals', 'wall',
  'bedding & pillows', 'wall covering', 'custom furniture', 'custom upholstery',
  'cabinets', 'custom bedding and pillows', 'custom window coverings', 'windows',
  'lighting', 'architectural', 'outdoor', 'tile & stone', 'plumbing & appliances',
  'window treatments', 'flooring', 'electrical', 'mirrors & accessories',
]);

function isAllCapsCategoryRoomboard(cat) {
  const cur = String(cat || '').trim();
  if (!cur) return false;
  if (cur !== cur.toUpperCase()) return false;
  if (!/[A-Z]/.test(cur)) return false;
  return REAL_CATS_LOWER.has(cur.toLowerCase());
}

(async () => {
  const app = initializeApp(STAGING);
  const db = getFirestore(app);
  const snap = await getDocs(collection(db, 'products'));

  let total = 0;
  let hasCategoryFixedAt = 0;
  let stillAllCapsRoomboard = 0;
  let stillTVCategory = 0;
  let stillS7Category = 0;
  let stillLowercaseMirror = 0;

  snap.forEach((d) => {
    total += 1;
    const x = d.data() || {};
    const category = String(x.category || '').trim();
    if (x._categoryFixedAt) hasCategoryFixedAt += 1;
    if (isAllCapsCategoryRoomboard(category)) stillAllCapsRoomboard += 1;
    if (category === 'TV') stillTVCategory += 1;
    if (category === 'S7 Bunk Bed') stillS7Category += 1;
    if (category === 'mirror') stillLowercaseMirror += 1;
  });

  console.log(
    JSON.stringify(
      {
        environment: 'staging',
        totalProducts: total,
        has_categoryFixedAt: hasCategoryFixedAt,
        remaining_problem_categories: {
          allcapsRoomboardCategories: stillAllCapsRoomboard,
          tvCategory: stillTVCategory,
          s7BunkBedCategory: stillS7Category,
          lowercaseMirrorCategory: stillLowercaseMirror,
        },
      },
      null,
      2
    )
  );
  process.exit(0);
})().catch((e) => {
  console.error('VALIDATION_FAILED', e);
  process.exit(1);
});
