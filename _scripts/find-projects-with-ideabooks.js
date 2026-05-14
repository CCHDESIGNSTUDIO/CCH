const path = require('path');
const admin = require('firebase-admin');
const SA = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
admin.initializeApp({ credential: admin.credential.cert(require(SA)) });
const db = admin.firestore();

(async () => {
  // Pull every ideabook across all boards
  const cg = await db.collectionGroup('ideabooks').get();
  const byProject = {};
  cg.forEach(d => {
    const parts = d.ref.path.split('/');
    const proj = parts[1];
    if (!byProject[proj]) byProject[proj] = [];
    const x = d.data();
    const imgs = Array.isArray(x.images) ? x.images.length : 0;
    byProject[proj].push({ id: d.id, name: x.name || x.title || '(unnamed)', images: imgs, published: !!x.published, source: x.source || '' });
  });

  console.log('Projects with ideabooks (only those with at least one ideabook containing images):\n');
  const ranked = Object.entries(byProject)
    .map(([proj, bs]) => ({ proj, total: bs.length, withImgs: bs.filter(b => b.images > 0).length, totalImgs: bs.reduce((s, b) => s + b.images, 0), boards: bs }))
    .filter(p => p.totalImgs > 0)
    .sort((a, b) => b.totalImgs - a.totalImgs);

  for (const p of ranked) {
    console.log(`  ${p.proj.padEnd(35)} ${String(p.total).padStart(3)} boards, ${String(p.withImgs).padStart(3)} with images, ${String(p.totalImgs).padStart(5)} total images`);
  }

  console.log('\nTotal projects with at least one image-containing ideabook:', ranked.length);
  console.log('Total ideabook docs across all projects:', cg.size);

  // Specifically Bugletrail-adjacent: did Niice content land somewhere else?
  console.log('\n=== Bugletrail-specific checks ===');
  const altSlugs = ['7225-bugletrail', 'bugletrail', '7225-bugle-trail', 'bugle-trail'];
  for (const s of altSlugs) {
    const ref = db.collection('boards').doc(s);
    const snap = await ref.get();
    if (snap.exists) {
      const ib = await ref.collection('ideabooks').get();
      console.log(`  boards/${s}: exists, ${ib.size} ideabooks`);
    }
  }
  process.exit(0);
})();
