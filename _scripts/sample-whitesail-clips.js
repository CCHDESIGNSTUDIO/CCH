const path = require('path');
const admin = require('firebase-admin');
const SA = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
admin.initializeApp({ credential: admin.credential.cert(require(SA)) });
const db = admin.firestore();
(async () => {
  const clipsSnap = await db.collection('boards').doc('31-whitesail').collection('clips').limit(60).get();
  console.log('Whitesail clips total (capped at 60 sampled):', clipsSnap.size);
  let withImg = 0, noImg = 0;
  const sample = [];
  for (const d of clipsSnap.docs) {
    const x = d.data();
    const hasImg = !!(x.imageUrl || x.image || x.thumbnail);
    if (hasImg) withImg++; else noImg++;
    if (sample.length < 5) {
      sample.push({
        id: d.id,
        title: x.title || x.name || '',
        imageUrl: x.imageUrl || x.image || x.thumbnail || '(none)',
        vendor: x.vendor,
        room: x.room,
        category: x.category,
        source: x._source || x.source
      });
    }
  }
  console.log('With image:', withImg, '— Without image:', noImg);
  console.log('Sample (first 5):');
  for (const s of sample) {
    console.log('  ', s);
  }
  process.exit(0);
})();
