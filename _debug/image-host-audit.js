/**
 * Tally hostnames of imageUrl across RH clips, products, and ideabook image entries.
 * Tells us how much is hotlinked vs Firebase-hosted.
 */
const path = require('path');
const admin = require('firebase-admin');

const SERVICE_ACCOUNT = path.join(__dirname, 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
admin.initializeApp({ credential: admin.credential.cert(require(SERVICE_ACCOUNT)) });
const db = admin.firestore();

function host(url) {
  if (!url) return '(empty)';
  try { return new URL(String(url)).hostname; } catch { return '(unparseable)'; }
}

(async () => {
  const tally = {};
  function bump(h) { tally[h] = (tally[h] || 0) + 1; }

  // 1. RH clips
  console.log('=== RH clips imageUrl hosts ===');
  const t1 = {};
  const clipsSnap = await db.collection('boards').doc('cloud-rolling-hills').collection('clips').get();
  clipsSnap.forEach(d => {
    const x = d.data();
    const url = x.imageUrl || x.image || '';
    const h = host(url);
    t1[h] = (t1[h] || 0) + 1;
  });
  for (const [h, n] of Object.entries(t1).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(4)}  ${h}`);
  }

  // 2. RH ideabook images (across all ideabooks under cloud-rolling-hills)
  console.log(`\n=== RH ideabook image entries ===`);
  const t2 = {};
  const ibSnap = await db.collection('boards').doc('cloud-rolling-hills').collection('ideabooks').get();
  let totalImages = 0;
  ibSnap.forEach(d => {
    const imgs = d.data().images || [];
    for (const it of imgs) {
      totalImages++;
      const h = host(it.imageUrl || it.image || '');
      t2[h] = (t2[h] || 0) + 1;
    }
  });
  console.log(`  ${ibSnap.size} ideabooks, ${totalImages} image entries total`);
  for (const [h, n] of Object.entries(t2).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(4)}  ${h}`);
  }

  // 3. /products with project=cloud-rolling-hills
  console.log(`\n=== GLOBAL /products/ where project = cloud-rolling-hills ===`);
  const t3 = {};
  let n3 = 0;
  const pSnap = await db.collection('products').get();
  pSnap.forEach(d => {
    const x = d.data();
    const candidates = [x.projectId, x.project, x.boardId, x.projectSlug].filter(Boolean).map(v => String(v).toLowerCase());
    if (!candidates.some(v => v === 'cloud-rolling-hills' || v === 'rolling hills' || v === 'cloud - rolling hills')) return;
    n3++;
    const h = host(x.imageUrl || x.image || x.coverImage || '');
    t3[h] = (t3[h] || 0) + 1;
  });
  console.log(`  ${n3} matching docs`);
  for (const [h, n] of Object.entries(t3).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(4)}  ${h}`);
  }

  // 4. /productLibrary with project=cloud-rolling-hills  — sample, this is huge
  console.log(`\n=== GLOBAL /productLibrary/ where project = cloud-rolling-hills (first 5000) ===`);
  const t4 = {};
  let n4 = 0;
  const plSnap = await db.collection('productLibrary').get();
  plSnap.forEach(d => {
    const x = d.data();
    const candidates = [x.projectId, x.project, x.boardId, x.projectSlug].filter(Boolean).map(v => String(v).toLowerCase());
    if (!candidates.some(v => v === 'cloud-rolling-hills' || v === 'rolling hills' || v === 'cloud - rolling hills')) return;
    n4++;
    const h = host(x.imageUrl || x.image || x.coverImage || '');
    t4[h] = (t4[h] || 0) + 1;
  });
  console.log(`  ${n4} matching docs`);
  for (const [h, n] of Object.entries(t4).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(4)}  ${h}`);
  }

  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
