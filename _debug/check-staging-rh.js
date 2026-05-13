/** What's in staging cloud-rolling-hills right now? */
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, getDoc } = require('firebase/firestore');

const STAGING = {
  apiKey: 'AIzaSyBIwwo7uRij6Q0FZg-qmIS1LC8t2AjXrYo',
  authDomain: 'cch-studio-staging.firebaseapp.com',
  projectId: 'cch-studio-staging',
  storageBucket: 'cch-studio-staging.firebasestorage.app',
  messagingSenderId: '210388013080',
  appId: '1:210388013080:web:fcd520b30c0d50b149736d',
};
(async () => {
  const app = initializeApp(STAGING);
  const db = getFirestore(app);

  // Top-level board doc
  const bd = await getDoc(doc(db, 'boards', 'cloud-rolling-hills'));
  console.log(`board doc exists: ${bd.exists()}`);

  // Subcollections
  for (const sub of ['clips', 'proposals', 'invoices', 'purchaseOrders']) {
    try {
      const snap = await getDocs(collection(db, 'boards', 'cloud-rolling-hills', sub));
      console.log(`  ${sub}: ${snap.size} docs`);
      // Count any with images
      let withImg = 0;
      snap.forEach(d => {
        const x = d.data();
        if (x.imageUrl || (x.images && x.images.length) || x.image) withImg++;
      });
      if (snap.size > 0) console.log(`    of which have images: ${withImg}`);
    } catch (e) {
      console.log(`  ${sub}: error ${e.message}`);
    }
  }

  // Also list all boards in staging just to see
  console.log('\nAll boards in staging:');
  const allSnap = await getDocs(collection(db, 'boards'));
  allSnap.forEach(d => {
    const x = d.data();
    console.log(`  ${d.id}  name="${x.name || x.title || ''}"`);
  });

  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
