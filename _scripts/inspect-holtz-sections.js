const path = require('path');
const admin = require('firebase-admin');
const SA = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
admin.initializeApp({ credential: admin.credential.cert(require(SA)) });
const db = admin.firestore();
(async () => {
  const snap = await db.collection('boards').doc('holtz-hill').collection('ideabooks').get();
  console.log('Holtz Hill ideabooks:', snap.size);
  for (const d of snap.docs) {
    const x = d.data();
    console.log('\n-----------------------------------------');
    console.log('ID:', d.id);
    console.log('  name:', x.name || x.title);
    console.log('  imageCount:', Array.isArray(x.images) ? x.images.length : 'n/a');
    console.log('  hiddenInNav:', !!x.hiddenInNav);
    console.log('  type:', x.type || x.boardType || '');
    console.log('  parentBoard:', x.parentBoard || '');
    console.log('  order:', x.order);
    console.log('  All top-level keys:', Object.keys(x).join(', '));
    // Look for section indicators on images
    if (Array.isArray(x.images) && x.images.length) {
      const sample = x.images.slice(0, 3);
      console.log('  Sample image[0] keys:', typeof sample[0] === 'object' ? Object.keys(sample[0] || {}).join(', ') : typeof sample[0]);
      // Look for section / category / group identifiers
      const sectionKeys = ['section', 'sectionId', 'sectionName', 'group', 'category', 'tag', 'tags'];
      const distinctValues = {};
      for (const sk of sectionKeys) {
        const set = new Set();
        for (const img of x.images) {
          if (img && typeof img === 'object' && img[sk] != null) {
            set.add(typeof img[sk] === 'object' ? JSON.stringify(img[sk]) : String(img[sk]));
          }
        }
        if (set.size > 0) {
          distinctValues[sk] = Array.from(set).slice(0, 20);
          console.log(`  Distinct image[].${sk} values (${set.size} unique):`, distinctValues[sk].slice(0,10));
        }
      }
    }
    if (Array.isArray(x.sections)) {
      console.log('  sections[] count:', x.sections.length);
      console.log('  sections[0] keys:', x.sections[0] ? Object.keys(x.sections[0]).join(', ') : 'empty');
    }
  }
  process.exit(0);
})();
