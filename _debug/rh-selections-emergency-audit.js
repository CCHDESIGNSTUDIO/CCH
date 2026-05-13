/**
 * EMERGENCY: RH Selections has 3,831 items. Was ~363 yesterday. Find what got added.
 * Group by source / createdAt / hour to identify the bad batch.
 */
const path = require('path');
const admin = require('firebase-admin');

const SERVICE_ACCOUNT = path.join(__dirname, 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
admin.initializeApp({ credential: admin.credential.cert(require(SERVICE_ACCOUNT)) });
const db = admin.firestore();

(async () => {
  // Selections page reads from clips/. Let's count.
  console.log('=== boards/cloud-rolling-hills/clips ===');
  const clipsSnap = await db.collection('boards').doc('cloud-rolling-hills').collection('clips').get();
  console.log(`  total clips: ${clipsSnap.size}`);

  const bySource = {}, byMarker = {};
  const byCreatedDate = {};
  let withHouzzId = 0, withImage = 0, withCost = 0, withSku = 0, totallyEmpty = 0;
  const sampleEmpty = [];

  clipsSnap.forEach(d => {
    const x = d.data();
    const src = x.source || '(none)';
    bySource[src] = (bySource[src] || 0) + 1;

    // Look for any _phase11* / _createdFrom* / _isService markers
    for (const k of Object.keys(x)) {
      if (k.startsWith('_phase') || k.startsWith('_created') || k.startsWith('_imported') || k.startsWith('_isService')) {
        byMarker[k] = (byMarker[k] || 0) + 1;
      }
    }

    if (x.houzzId) withHouzzId++;
    if (x.imageFilename || x.imageUrl || x.image) withImage++;
    if (parseFloat(x.cost) > 0 || parseFloat(x.clientPrice) > 0) withCost++;
    if (x.sku) withSku++;

    // Group by created date (just YYYY-MM-DD)
    const ca = x.createdAt || x._createdAt || '';
    const dateKey = String(ca).slice(0, 10) || '(no date)';
    byCreatedDate[dateKey] = (byCreatedDate[dateKey] || 0) + 1;

    if (!x.houzzId && !x.imageFilename && !x.imageUrl && !x.image && !x.sku) {
      totallyEmpty++;
      if (sampleEmpty.length < 15) sampleEmpty.push({ id: d.id, title: x.title || x.name || '(no title)', source: src, createdAt: ca });
    }
  });

  console.log(`\n--- Quality stats ---`);
  console.log(`  with houzzId:    ${withHouzzId}`);
  console.log(`  with image:      ${withImage}`);
  console.log(`  with cost > 0:   ${withCost}`);
  console.log(`  with sku:        ${withSku}`);
  console.log(`  TOTALLY EMPTY:   ${totallyEmpty}  (no houzzId, no image, no sku)`);

  console.log(`\n--- By source ---`);
  for (const k of Object.keys(bySource).sort((a, b) => bySource[b] - bySource[a])) {
    console.log(`  ${k.padEnd(40)} ${bySource[k]}`);
  }

  console.log(`\n--- By marker fields ---`);
  for (const k of Object.keys(byMarker).sort((a, b) => byMarker[b] - byMarker[a])) {
    console.log(`  ${k.padEnd(40)} ${byMarker[k]}`);
  }

  console.log(`\n--- By createdAt date (top 15) ---`);
  const sorted = Object.entries(byCreatedDate).sort((a, b) => b[1] - a[1]).slice(0, 15);
  for (const [date, count] of sorted) console.log(`  ${date.padEnd(15)} ${count}`);

  console.log(`\n--- Sample TOTALLY EMPTY clips (first 15) ---`);
  for (const s of sampleEmpty) {
    console.log(`  id=${s.id.slice(0, 20).padEnd(20)} src=${String(s.source).slice(0, 25).padEnd(27)} created=${String(s.createdAt).slice(0, 19).padEnd(20)} title="${String(s.title).slice(0, 50)}"`);
  }

  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
