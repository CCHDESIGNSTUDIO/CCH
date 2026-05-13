/**
 * Find the specific items visible in the May 9 screenshot.
 * These don't match legacy fragments — likely a recent dump.
 */
const path = require('path');
const admin = require('firebase-admin');

const SERVICE_ACCOUNT = path.join(__dirname, 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
admin.initializeApp({ credential: admin.credential.cert(require(SERVICE_ACCOUNT)) });
const db = admin.firestore();

const TARGETS = [
  'accents',
  'Add a touch of elegant style',
  'Added gate and landscape images',
  'Additional Plumbing & Elevation',
  'Additional Plumbing Proposal',
  'Adams & Westlake',
];

const matchesRH = (x) => {
  const candidates = [x.projectId, x.project, x.boardId, x.projectSlug, x.projectName].filter(Boolean).map(v => String(v).toLowerCase());
  return candidates.some(v => v === 'cloud-rolling-hills' || v === 'rolling hills' || v === 'cloud - rolling hills');
};

(async () => {
  // Walk all three collections, find entries whose title contains any TARGET substring
  async function searchColl(coll, label, scopeRH) {
    console.log(`\n=== ${label} ===`);
    const snap = await db.collection(coll).get();
    let scanned = 0, matched = 0;
    const hits = [];
    snap.forEach(d => {
      const x = d.data();
      if (scopeRH && !matchesRH(x)) return;
      scanned++;
      const t = String(x.title || x.name || x.productName || '').toLowerCase();
      for (const target of TARGETS) {
        if (t.includes(target.toLowerCase())) {
          hits.push({
            collection: coll,
            id: d.id,
            title: (x.title || x.name || x.productName || '').slice(0, 80),
            source: x.source || x.importedFrom || x._source || '(none)',
            createdAt: x.createdAt || x._createdAt || x.importedAt || '',
            updatedAt: x.updatedAt || x._updatedAt || '',
            project: x.projectId || x.project || x.boardId || x.projectName || '(none)',
            hasImage: !!(x.imageUrl || x.image || x.imageFilename),
            houzzId: x.houzzId || '',
          });
          matched++;
          break;
        }
      }
    });
    console.log(`  scanned: ${scanned}  matched: ${matched}`);
    return hits;
  }

  const all = [];
  all.push(...await searchColl('products', 'GLOBAL /products/ (RH only)', true));
  all.push(...await searchColl('productLibrary', 'GLOBAL /productLibrary/ (RH only)', true));

  // Also search clips
  console.log(`\n=== boards/cloud-rolling-hills/clips ===`);
  const clipsSnap = await db.collection('boards').doc('cloud-rolling-hills').collection('clips').get();
  let scanned = 0, matched = 0;
  clipsSnap.forEach(d => {
    scanned++;
    const x = d.data();
    const t = String(x.title || x.name || '').toLowerCase();
    for (const target of TARGETS) {
      if (t.includes(target.toLowerCase())) {
        all.push({
          collection: 'clips',
          id: d.id,
          title: (x.title || x.name || '').slice(0, 80),
          source: x.source || '(none)',
          createdAt: x.createdAt || x._createdAt || '',
          updatedAt: x.updatedAt || x._updatedAt || '',
          project: 'cloud-rolling-hills',
          hasImage: !!(x.imageUrl || x.image || x.imageFilename),
          houzzId: x.houzzId || '',
        });
        matched++;
        break;
      }
    }
  });
  console.log(`  scanned: ${scanned}  matched: ${matched}`);

  console.log(`\n=== ALL HITS (${all.length}) ===`);
  // Group by title prefix to show duplicates
  const byTitle = {};
  for (const h of all) {
    const key = h.title.toLowerCase().slice(0, 40);
    if (!byTitle[key]) byTitle[key] = [];
    byTitle[key].push(h);
  }
  for (const [t, hits] of Object.entries(byTitle).sort((a, b) => b[1].length - a[1].length)) {
    console.log(`\n  "${t}..." × ${hits.length}`);
    for (const h of hits) {
      console.log(`    [${h.collection.padEnd(15)}] id=${h.id.slice(0, 24).padEnd(26)} src=${String(h.source).slice(0, 18).padEnd(20)} ca=${String(h.createdAt).slice(0, 19).padEnd(20)} ua=${String(h.updatedAt).slice(0, 19).padEnd(20)} img=${h.hasImage ? 'Y' : 'N'}`);
    }
  }

  // Also: what entries have createdAt in the LAST 14 DAYS in /products/ or /productLibrary/ for RH?
  console.log(`\n=== Entries created in last 14 days (RH) ===`);
  const cutoff = Date.now() - 14 * 24 * 3600 * 1000;
  for (const coll of ['products', 'productLibrary']) {
    let recent = 0, recentEmpty = 0;
    const recents = [];
    const snap = await db.collection(coll).get();
    snap.forEach(d => {
      const x = d.data();
      if (!matchesRH(x)) return;
      const ca = x.createdAt || x._createdAt || x.importedAt || '';
      if (!ca) return;
      const t = Date.parse(ca);
      if (!t || t < cutoff) return;
      recent++;
      const isEmpty = !(x.imageUrl || x.image || x.imageFilename || x.houzzId || x.sku);
      if (isEmpty) recentEmpty++;
      if (recents.length < 10) recents.push({ id: d.id, title: (x.title || x.name || '').slice(0, 50), source: x.source || '(none)', createdAt: ca });
    });
    console.log(`  ${coll}: ${recent} recent (${recentEmpty} empty)`);
    for (const r of recents) console.log(`    ca=${r.createdAt.slice(0,19)} src=${String(r.source).slice(0,15).padEnd(17)} "${r.title}"`);
  }

  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
