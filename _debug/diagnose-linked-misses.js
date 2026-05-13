/** Check staging clips for matches to specific test products. */
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

const TEST_TITLES = [
  '3 Shade Semi Flush',
  'New Town Sconce',
  'Tailor - Flush Leather two tone',
  'Vale Cascade Glass Chandelier',
  'Leather strapped Single sconce',
  'Lakeview Signature',
];

(async () => {
  const app = initializeApp(STAGING);
  const db = getFirestore(app);

  // Count clips across all boards in staging
  const boards = await getDocs(collection(db, 'boards'));
  console.log(`Staging boards: ${boards.size}`);
  let totalClips = 0;
  let clipsWithTitle = {};
  TEST_TITLES.forEach(t => clipsWithTitle[t.toLowerCase()] = []);

  for (const b of boards.docs) {
    try {
      const clips = await b.ref.collection('clips').get();
      totalClips += clips.size;
      clips.forEach(d => {
        const x = d.data();
        const t = (x.title || '').toLowerCase().trim();
        for (const test of TEST_TITLES) {
          const tl = test.toLowerCase();
          if (t === tl || t.includes(tl) || tl.includes(t)) {
            clipsWithTitle[tl].push({
              board: b.id,
              boardName: b.data().name,
              clipId: d.id,
              clipTitle: x.title,
              hasHouzzPO: !!x.houzzPO,
              hasHouzzInv: !!x.houzzInvoice,
              hasHouzzProp: !!x.houzzProposal,
              hasNativePo: !!x.poNum,
              hasNativeInv: !!x.invoiceNum,
              hasNativeProp: !!x.proposalNum,
              hasConnectedDocs: !!x.connectedDocs,
            });
          }
        }
      });
    } catch (e) {}
  }

  console.log(`Staging total clips: ${totalClips}\n`);

  for (const test of TEST_TITLES) {
    const matches = clipsWithTitle[test.toLowerCase()];
    console.log(`\n"${test}":`);
    if (matches.length === 0) {
      console.log(`  ZERO matching clips in staging — popover will show "no linked docs"`);
    } else {
      console.log(`  ${matches.length} matching clip(s) found:`);
      matches.slice(0, 3).forEach(m => {
        console.log(`    ${m.boardName} / ${m.clipId} (title="${m.clipTitle}")`);
        console.log(`      houzz: PO=${m.hasHouzzPO} Inv=${m.hasHouzzInv} Prop=${m.hasHouzzProp}`);
        console.log(`      native: PO=${m.hasNativePo} Inv=${m.hasNativeInv} Prop=${m.hasNativeProp} connectedDocs=${m.hasConnectedDocs}`);
      });
    }
  }
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
