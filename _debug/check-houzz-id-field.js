/**
 * Verify what fields staging products actually have, and check production
 * for any Houzz-ID-like field (so we use a name Studio's UI already understands).
 */
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, getDoc } = require('firebase/firestore');

const PROD = {
  apiKey: 'AIzaSyAd24U5ArVGrA24IxNcYD2NYiTVycyF4og',
  authDomain: 'cch-design-boards.firebaseapp.com',
  projectId: 'cch-design-boards',
  storageBucket: 'cch-design-boards.appspot.com',
  messagingSenderId: '210388013080',
  appId: '1:210388013080:web:cch-design-boards',
};
const STAGING = {
  apiKey: 'AIzaSyBIwwo7uRij6Q0FZg-qmIS1LC8t2AjXrYo',
  authDomain: 'cch-studio-staging.firebaseapp.com',
  projectId: 'cch-studio-staging',
  storageBucket: 'cch-studio-staging.firebasestorage.app',
  messagingSenderId: '210388013080',
  appId: '1:210388013080:web:fcd520b30c0d50b149736d',
};

(async () => {
  const prodApp = initializeApp(PROD, 'p');
  const stagingApp = initializeApp(STAGING, 's');
  const prodDb = getFirestore(prodApp);
  const stagingDb = getFirestore(stagingApp);

  console.log('=== STAGING /products/ ===');
  const sn = await getDocs(collection(stagingDb, 'products'));
  console.log(`  total: ${sn.size}`);
  let hasHouzzId = 0;
  let i = 0;
  sn.forEach(d => {
    if (d.data().houzzId) hasHouzzId++;
    if (i < 2) {
      console.log(`  --- staging doc ${d.id} ---`);
      const x = d.data();
      console.log(`    houzzId: ${x.houzzId || '(missing)'}`);
      console.log(`    title:   ${x.title}`);
      console.log(`    sku:     ${x.sku}`);
      console.log(`    fields:  ${Object.keys(x).filter(k => /houzz|id|external/i.test(k)).join(', ')}`);
      i++;
    }
  });
  console.log(`  staging products with houzzId populated: ${hasHouzzId}`);

  console.log('\n=== PRODUCTION /products/ ===');
  const pn = await getDocs(collection(prodDb, 'products'));
  console.log(`  total: ${pn.size}`);

  // Field frequency for any houzz-like field
  const fc = {};
  pn.forEach(d => {
    for (const k of Object.keys(d.data())) {
      if (/houzz/i.test(k) || /external/i.test(k) || /^houzzId$/i.test(k) || /houzz_id/i.test(k)) {
        fc[k] = (fc[k] || 0) + 1;
      }
    }
  });
  console.log('  fields containing "houzz" or "external":');
  if (Object.keys(fc).length === 0) console.log('    (none)');
  else for (const [k, v] of Object.entries(fc)) console.log(`    ${k}: ${v}`);

  // Two sample prod products with full schema
  console.log('\n  Two sample production products (relevant fields):');
  i = 0;
  pn.forEach(d => {
    if (i++ >= 2) return;
    const x = d.data();
    const relevant = {};
    for (const [k, v] of Object.entries(x)) {
      if (/id|sku|source|title|vendor|houzz|external|legacy|ref/i.test(k)) {
        relevant[k] = typeof v === 'string' && v.length > 80 ? v.slice(0, 80) + '...' : v;
      }
    }
    console.log(`    ${d.id}:`, JSON.stringify(relevant, null, 2).slice(0, 600));
  });

  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
