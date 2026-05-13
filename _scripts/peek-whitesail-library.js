const path = require('path');
const admin = require('firebase-admin');
const SA = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
admin.initializeApp({ credential: admin.credential.cert(require(SA)) });
const db = admin.firestore();
(async () => {
  let libRows = [];
  let s = await db.collection('productLibrary').where('project', '==', '31 Whitesail').get();
  console.log('productLibrary where project="31 Whitesail":', s.size);
  s.forEach(d => libRows.push({ id: d.id, ...d.data() }));
  if (s.empty) {
    // Fallback — scan more broadly
    s = await db.collection('productLibrary').where('projectId', '==', '31-whitesail').get();
    console.log('productLibrary where projectId="31-whitesail":', s.size);
    s.forEach(d => libRows.push({ id: d.id, ...d.data() }));
  }
  let withImg = 0, noImg = 0;
  for (const r of libRows) {
    const url = r.imageUrl || r.image || r.hero || r.thumbnail || '';
    if (url && /^https?:/.test(url)) withImg++; else noImg++;
  }
  console.log('  With real http(s) image URL:', withImg);
  console.log('  Without (or bare filename) :', noImg);
  if (libRows.length) {
    console.log('  Sample (first 3):');
    for (const r of libRows.slice(0, 3)) {
      console.log('    title=' + (r.title || r.name || '').slice(0, 50));
      console.log('    vendor=' + (r.vendor || r.manufacturer || ''));
      console.log('    imageUrl=' + (r.imageUrl || r.image || r.hero || r.thumbnail || '(none)').slice(0, 120));
      console.log('    project=' + r.project + '  projectId=' + r.projectId);
      console.log('');
    }
  }
  process.exit(0);
})();
