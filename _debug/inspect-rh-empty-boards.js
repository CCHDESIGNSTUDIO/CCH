/**
 * Read-only: inspect Cloud Rolling Hills ideabooks named Design Concepts / Room Inspirations.
 */
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

const PROD = {
  apiKey: 'AIzaSyAd24U5ArVGrA24IxNcYD2NYiTVycyF4og',
  authDomain: 'cch-design-boards.firebaseapp.com',
  projectId: 'cch-design-boards',
  storageBucket: 'cch-design-boards.firebasestorage.app',
};
const BOARD_ID = 'cloud-rolling-hills';

(async () => {
  const db = getFirestore(initializeApp(PROD));
  const snap = await getDocs(collection(db, 'boards', BOARD_ID, 'ideabooks'));
  const all = [];
  snap.forEach((d) => {
    const x = d.data();
    const imgs = Array.isArray(x.images) ? x.images : [];
    all.push({ id: d.id, name: x.name || '', images: imgs.length, data: x });
  });
  console.log('Total ideabooks:', all.length);

  const hits = all.filter((r) => /design concepts|room inspirations/i.test(r.name));
  if (!hits.length) {
    console.log('\nNo name match. Similar:');
    all.filter((r) => /design|concept|room inspir/i.test(r.name)).forEach((r) => {
      console.log(' -', r.name, '|', r.images, 'imgs |', r.id);
    });
  }

  for (const h of hits) {
    const x = h.data;
    console.log('\n==========', h.name, '(' + h.id + ') ==========');
    for (const k of Object.keys(x).sort()) {
      if (k === 'images') {
        console.log('  images:', (x.images || []).length);
      } else {
        const v = x[k];
        console.log('  ' + k + ':', typeof v === 'object' ? JSON.stringify(v).slice(0, 300) : v);
      }
    }
  }

  console.log('\n--- Descriptions mentioning Design Concepts or Room Inspirations ---');
  all.forEach((r) => {
    const desc = String(r.data.description || '');
    if (/design concepts|room inspirations/i.test(desc)) {
      console.log(r.name, '|', r.images, 'imgs |', desc);
    }
  });

  console.log('\n--- All zero-image boards ---');
  all.filter((r) => r.images === 0).sort((a, b) => String(a.data.updatedAt || a.data.createdAt).localeCompare(String(b.data.updatedAt || b.data.createdAt)))
    .forEach((r) => {
      console.log(' ', r.name, '| id:', r.id, '| created:', r.data.createdAt, '| updated:', r.data.updatedAt, '| source:', r.data.source || '', '| desc:', (r.data.description || '').slice(0, 80));
    });

  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
