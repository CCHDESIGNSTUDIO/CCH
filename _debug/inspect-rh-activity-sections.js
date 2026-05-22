/**
 * Read-only: activity log + storage path hints for empty RH ideabook sections.
 */
const { initializeApp } = require('firebase/app');
const {
  getFirestore, collection, getDocs, query, where, limit,
} = require('firebase/firestore');

const PROD = {
  apiKey: 'AIzaSyAd24U5ArVGrA24IxNcYD2NYiTVycyF4og',
  authDomain: 'cch-design-boards.firebaseapp.com',
  projectId: 'cch-design-boards',
  storageBucket: 'cch-design-boards.firebasestorage.app',
};
const BOARD_ID = 'cloud-rolling-hills';
const SECTION_IDS = ['dDnSNrYubEZVQpFzUmL2', 'ZtWVA4XCiTsKyDim1TFB'];
const SECTION_NAMES = ['Design Concepts', 'Room Inspirations'];

(async () => {
  const db = getFirestore(initializeApp(PROD));

  console.log('=== Activity (projectId filter) mentioning section ids or names ===\n');
  try {
    const actQ = query(
      collection(db, 'activity'),
      where('projectId', '==', BOARD_ID),
      limit(500),
    );
    const actSnap = await getDocs(actQ);
    console.log('activity docs for project (up to 500):', actSnap.size);
    const hits = [];
    actSnap.forEach((d) => {
      const x = d.data();
      const blob = JSON.stringify(x).toLowerCase();
      const match = SECTION_IDS.some((id) => blob.includes(id.toLowerCase()))
        || SECTION_NAMES.some((n) => blob.includes(n.toLowerCase()));
      if (match) hits.push({ id: d.id, ...x });
    });
    if (!hits.length) {
      console.log('  No activity rows reference those section ids or names.');
      const insp = [];
      actSnap.forEach((d) => {
        const x = d.data();
        if (String(x.type || '').toLowerCase() === 'inspiration') insp.push(x);
      });
      console.log('  inspiration-type activity in sample:', insp.length);
      insp.slice(0, 8).forEach((x) => console.log('   -', x.action, '|', (x.description || '').slice(0, 100)));
    } else {
      hits.forEach((x) => console.log(JSON.stringify(x, null, 2)));
    }
  } catch (e) {
    console.warn('activity query:', e.message || e);
  }

  console.log('\n=== Ideabooks with importedFrom niice (names only) ===\n');
  const ibSnap = await getDocs(collection(db, 'boards', BOARD_ID, 'ideabooks'));
  const niiceBoards = [];
  ibSnap.forEach((d) => {
    const x = d.data();
    const imgs = Array.isArray(x.images) ? x.images : [];
    const fromNiice = imgs.some((it) => String(it.importedFrom || '').toLowerCase() === 'niice');
    if (fromNiice || String(x.source || '').toLowerCase().includes('niice')) {
      niiceBoards.push({ name: x.name, count: imgs.length, created: x.createdAt, desc: (x.description || '').slice(0, 60) });
    }
  });
  niiceBoards.sort((a, b) => String(a.created).localeCompare(String(b.created)));
  niiceBoards.forEach((r) => console.log(' ', r.name, '|', r.count, 'imgs |', r.created, '|', r.desc));

  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
