/** Try multiple read approaches to settle whether staging has clips. */
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, getDoc, query, limit } = require('firebase/firestore');

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

  // Method 1: collection().get()
  const m1 = await getDocs(collection(db, 'boards', 'cloud-rolling-hills', 'clips'));
  console.log(`Method 1 (collection get): ${m1.size} clips`);

  // Method 2: query with limit
  const m2 = await getDocs(query(collection(db, 'boards', 'cloud-rolling-hills', 'clips'), limit(1000)));
  console.log(`Method 2 (query limit 1000): ${m2.size} clips`);

  // Method 3: try a known doc ID from prod
  const knownIds = ['05umcrfzCP8EKjjhMljy', '0FQe1NCPkJMFrbvBLjJH'];
  for (const id of knownIds) {
    const d = await getDoc(doc(db, 'boards', 'cloud-rolling-hills', 'clips', id));
    console.log(`Method 3 doc ${id}: exists=${d.exists()}, hasData=${!!d.data()}`);
    if (d.exists()) {
      const x = d.data();
      console.log(`  title: ${x.title}, imageUrl: ${(x.imageUrl||'').slice(0,60)}`);
    }
  }

  // List a few docs from method 1 if any found
  if (m1.size > 0) {
    console.log(`\nFirst 3 clip IDs from method 1:`);
    let i = 0;
    m1.forEach(d => { if (i++ < 3) console.log(`  ${d.id}: ${(d.data().title||'').slice(0,50)}`); });
  }

  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
