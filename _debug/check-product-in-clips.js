/** Search staging clips for specific product titles. */
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

const TESTS = [
  'Daso Textured Bowl',
  'Maura Oval Bowl-Lg',
  'Pleated Bowl-Bronze Stripe-Lg',
  'Soft Rectangle Vase',
  'Square Tower Vase',
  '3 Shade Semi Flush',
];

(async () => {
  const app = initializeApp(STAGING);
  const db = getFirestore(app);
  const clips = await getDocs(collection(db, 'boards', 'cloud-rolling-hills', 'clips'));
  console.log(`Total cloud-rolling-hills clips: ${clips.size}\n`);

  for (const test of TESTS) {
    const tlow = test.toLowerCase();
    const matches = [];
    clips.forEach(d => {
      const t = (d.data().title || '').toLowerCase();
      if (t === tlow || t.includes(tlow) || tlow.includes(t)) {
        matches.push({ id: d.id, title: d.data().title, hasHouzz: !!(d.data().houzzInvoice || d.data().houzzPO || d.data().houzzProposal) });
      }
    });
    console.log(`"${test}": ${matches.length} clip match(es)`);
    matches.slice(0, 3).forEach(m => console.log(`  - ${m.id} "${m.title}"  hasHouzzRefs=${m.hasHouzz}`));
  }

  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
