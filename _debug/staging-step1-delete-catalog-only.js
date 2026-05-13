/**
 * Step 1: Delete the 11,567 catalog-only docs in staging /products/.
 * Targets ONLY docs whose ID starts with 'houzz-' (my disposable upload).
 * Does NOT touch anything else — including the prod-mirrored 6,165.
 *
 * STAGING ONLY. firebaseConfig is hardcoded to cch-studio-staging.
 */
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, writeBatch } = require('firebase/firestore');

const STAGING = {
  apiKey: 'AIzaSyBIwwo7uRij6Q0FZg-qmIS1LC8t2AjXrYo',
  authDomain: 'cch-studio-staging.firebaseapp.com',
  projectId: 'cch-studio-staging',
  storageBucket: 'cch-studio-staging.firebasestorage.app',
  messagingSenderId: '210388013080',
  appId: '1:210388013080:web:fcd520b30c0d50b149736d',
};

(async () => {
  const start = Date.now();
  const app = initializeApp(STAGING);
  const db = getFirestore(app);

  console.log('[1/3] Reading staging /products/...');
  const snap = await getDocs(collection(db, 'products'));
  console.log(`  total docs: ${snap.size}`);

  const toDelete = [];
  let prodMirrored = 0, otherKept = 0;
  snap.forEach(d => {
    if (d.id.startsWith('houzz-')) {
      toDelete.push(d.id);
    } else {
      prodMirrored++;
    }
  });
  console.log(`  with 'houzz-' prefix (will delete): ${toDelete.length}`);
  console.log(`  other (will keep, prod-mirrored): ${prodMirrored}`);

  if (toDelete.length === 0) {
    console.log('\nNothing to delete. Done.');
    process.exit(0);
  }

  console.log('\n[2/3] Deleting in batches of 400...');
  const BATCH = 400;
  let deleted = 0;
  for (let i = 0; i < toDelete.length; i += BATCH) {
    const batch = writeBatch(db);
    const slice = toDelete.slice(i, i + BATCH);
    for (const id of slice) {
      batch.delete(doc(db, 'products', id));
    }
    await batch.commit();
    deleted += slice.length;
    if (deleted % 2000 === 0 || deleted === toDelete.length) {
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      console.log(`  ${deleted}/${toDelete.length} (${elapsed}s)`);
    }
  }

  console.log('\n[3/3] Verifying...');
  const snap2 = await getDocs(collection(db, 'products'));
  let leftHouzz = 0;
  snap2.forEach(d => { if (d.id.startsWith('houzz-')) leftHouzz++; });
  console.log(`  staging /products/ now has: ${snap2.size} docs`);
  console.log(`  remaining with 'houzz-' prefix: ${leftHouzz} (should be 0)`);

  const total = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\nDONE in ${total}s. Deleted ${deleted} catalog-only docs from staging /products/.`);
  console.log('Production untouched.');
  process.exit(0);
})().catch(e => { console.error('FAILED:', e); process.exit(1); });
