/**
 * EMERGENCY 2: Find the 3,831 items source.
 * Selections page = union(clips + /products + /productLibrary)
 * clips has 367. The other 3,464 are in /products or /productLibrary.
 */
const path = require('path');
const admin = require('firebase-admin');

const SERVICE_ACCOUNT = path.join(__dirname, 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
admin.initializeApp({ credential: admin.credential.cert(require(SERVICE_ACCOUNT)) });
const db = admin.firestore();

async function profileCollection(coll, label, filterFn) {
  console.log(`\n=== ${label} ===`);
  const snap = await db.collection(coll).get();
  console.log(`  total docs: ${snap.size}`);

  let matchingProject = 0;
  const bySource = {}, byCreatedHour = {}, byImportFlag = {};
  const samples = [];

  snap.forEach(d => {
    const x = d.data();
    if (!filterFn(x)) return;
    matchingProject++;

    const src = x.source || x.importedFrom || x._source || '(none)';
    bySource[src] = (bySource[src] || 0) + 1;

    const ca = x.createdAt || x._createdAt || x.importedAt || '';
    const hourKey = String(ca).slice(0, 13) || '(no date)';   // YYYY-MM-DDTHH
    byCreatedHour[hourKey] = (byCreatedHour[hourKey] || 0) + 1;

    // Marker fields
    for (const k of Object.keys(x)) {
      if (k.startsWith('_phase') || k.startsWith('_imported') || k.startsWith('_created') || k.startsWith('_houzz')) {
        byImportFlag[k] = (byImportFlag[k] || 0) + 1;
      }
    }

    if (samples.length < 12) {
      const isEmpty = !x.imageUrl && !x.image && !x.imageFilename && !x.houzzId && !x.sku;
      if (isEmpty) {
        samples.push({
          id: d.id,
          title: (x.title || x.name || x.productName || '(no title)').toString().slice(0, 60),
          source: src,
          createdAt: ca,
        });
      }
    }
  });

  console.log(`  matching cloud-rolling-hills project: ${matchingProject}`);
  console.log(`\n  --- by source ---`);
  for (const k of Object.keys(bySource).sort((a, b) => bySource[b] - bySource[a]).slice(0, 12)) {
    console.log(`    ${k.padEnd(35)} ${bySource[k]}`);
  }
  console.log(`\n  --- by createdAt hour (top 10) ---`);
  for (const [hr, n] of Object.entries(byCreatedHour).sort((a, b) => b[1] - a[1]).slice(0, 10)) {
    console.log(`    ${hr.padEnd(20)} ${n}`);
  }
  console.log(`\n  --- by import marker (top 10) ---`);
  for (const [k, n] of Object.entries(byImportFlag).sort((a, b) => b[1] - a[1]).slice(0, 10)) {
    console.log(`    ${k.padEnd(35)} ${n}`);
  }
  console.log(`\n  --- 12 sample EMPTY items (no image / no IDs) ---`);
  for (const s of samples) {
    console.log(`    src=${String(s.source).slice(0, 22).padEnd(24)} ca=${String(s.createdAt).slice(0, 19).padEnd(20)} "${s.title}"`);
  }

  return matchingProject;
}

(async () => {
  const matchesProject = (x) => {
    const candidates = [
      x.projectId, x.project, x.projectSlug,
      x.boardId, x.board,
      x.projectName,
    ].filter(Boolean).map(v => String(v).toLowerCase());
    if (candidates.some(v => v === 'cloud-rolling-hills')) return true;
    if (candidates.some(v => v === 'cloud - rolling hills' || v === 'rolling hills')) return true;
    return false;
  };

  let total = 0;
  total += await profileCollection('products', 'GLOBAL /products/', matchesProject);
  total += await profileCollection('productLibrary', 'GLOBAL /productLibrary/', matchesProject);

  // Also count clips for reference
  const clipsSnap = await db.collection('boards').doc('cloud-rolling-hills').collection('clips').get();
  console.log(`\n=== TOTALS ===`);
  console.log(`  clips:          ${clipsSnap.size}`);
  console.log(`  /products/ RH:  in result above`);
  console.log(`  /productLibrary/ RH: in result above`);
  console.log(`  Selections page shows ~3,831 — should match union of these three`);

  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
