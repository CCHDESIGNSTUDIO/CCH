/**
 * NIICE PATH A IMPORTER — Style Library
 *
 * Reads CCH-Platform-Deploy/Niice_Organized/{Topic}/*.{jpg,png,webp,...}
 * Creates one ideabook per topic in boards/_lib_designer/ideabooks/{newId}
 * Uploads each image to Storage at _lib_designer/{topicSlug}/{filename}
 * Sets `topic` field on each ideabook (per Style Library handoff)
 *
 * Idempotent: skips topics that already have an ideabook with matching `topic` field
 * created from this importer (marker: source === 'niice-import-may9-path-a').
 *
 * Default DRY RUN. --execute to write.
 */
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const SERVICE_ACCOUNT = path.join(__dirname, 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
const BUCKET = 'cch-design-boards.firebasestorage.app';
const NIICE_ORGANIZED = String.raw`C:\Users\cindy\Dropbox\CCH-Platform-Deploy\Niice_Organized`;
const LIBRARY_BOARD = '_lib_designer';
const SOURCE_MARKER = 'niice-import-may9-path-a';
const EXECUTE = process.argv.includes('--execute');
const LIMIT_TOPICS = parseInt(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] || '0', 10);  // 0 = no limit

const IMG_EXT = /\.(jpe?g|png|gif|webp|tiff?|bmp|heic|heif|jfif)$/i;

admin.initializeApp({
  credential: admin.credential.cert(require(SERVICE_ACCOUNT)),
  storageBucket: BUCKET,
});
const db = admin.firestore();
const bucket = admin.storage().bucket();

const slugify = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  console.log(`NIICE PATH A IMPORTER  (${EXECUTE ? 'EXECUTE' : 'DRY RUN'})`);
  console.log(`Source: ${NIICE_ORGANIZED}`);
  console.log(`Dest:   boards/${LIBRARY_BOARD}/ideabooks/*\n`);

  // 1. Enumerate topics — skip _Unsorted (already imported via zips)
  const allEntries = fs.readdirSync(NIICE_ORGANIZED, { withFileTypes: true });
  let topics = allEntries
    .filter(e => e.isDirectory() && !e.name.startsWith('_Unsorted'))
    .map(e => e.name);
  if (LIMIT_TOPICS > 0) topics = topics.slice(0, LIMIT_TOPICS);

  // 2. Check existing ideabooks for idempotence
  const existingSnap = await db.collection('boards').doc(LIBRARY_BOARD).collection('ideabooks').get();
  const existingByTopic = new Map();
  existingSnap.forEach(d => {
    const x = d.data();
    if (x.source === SOURCE_MARKER && x.topic) existingByTopic.set(x.topic, d.id);
  });
  console.log(`Existing ideabooks from this importer: ${existingByTopic.size}\n`);

  // 3. Plan + per-topic image counts
  const plan = [];
  for (const topic of topics) {
    const topicPath = path.join(NIICE_ORGANIZED, topic);
    const files = fs.readdirSync(topicPath, { withFileTypes: true })
      .filter(e => e.isFile() && IMG_EXT.test(e.name))
      .map(e => e.name);
    plan.push({
      topic,
      slug: slugify(topic),
      images: files,
      alreadyImported: existingByTopic.has(topic),
      existingId: existingByTopic.get(topic) || null,
    });
  }

  console.log('--- Plan ---');
  let totalImages = 0, totalToImport = 0, alreadyDone = 0, totalNewIdeabooks = 0;
  for (const p of plan) {
    const status = p.alreadyImported ? '⊘ already-imported' : (p.images.length === 0 ? '· empty' : '+ NEW');
    console.log(`  ${status.padEnd(22)} ${p.topic.padEnd(35)} ${String(p.images.length).padStart(4)} images`);
    totalImages += p.images.length;
    if (p.alreadyImported) alreadyDone++;
    else if (p.images.length > 0) {
      totalToImport += p.images.length;
      totalNewIdeabooks++;
    }
  }
  console.log('');
  console.log(`Topics scanned:      ${plan.length}`);
  console.log(`Already imported:    ${alreadyDone}`);
  console.log(`New ideabooks:       ${totalNewIdeabooks}`);
  console.log(`Total images:        ${totalImages} (across all scanned topics)`);
  console.log(`Images to upload:    ${totalToImport} (only counts new ideabooks)`);

  // Sanity guard — don't exceed Firestore 1MB doc limit on huge topics
  for (const p of plan) {
    if (!p.alreadyImported && p.images.length > 800) {
      console.log(`\n⚠️  WARNING: topic "${p.topic}" has ${p.images.length} images. Firestore doc limit is 1MB; ~800+ image entries may exceed it. Consider splitting.`);
    }
  }

  if (!EXECUTE) {
    console.log('\nDRY RUN. --execute to perform writes (or --limit=N to test on first N topics).');
    process.exit(0);
  }

  // 4. EXECUTE per topic
  let processed = 0, uploaded = 0, errors = 0;
  for (const p of plan) {
    if (p.alreadyImported || p.images.length === 0) continue;
    processed++;
    console.log(`\n[${processed}/${totalNewIdeabooks}] Importing "${p.topic}" (${p.images.length} images)...`);

    const imageEntries = [];
    for (let i = 0; i < p.images.length; i++) {
      const filename = p.images[i];
      const localPath = path.join(NIICE_ORGANIZED, p.topic, filename);
      const destPath = `${LIBRARY_BOARD}/${p.slug}/${Date.now()}-${i}-${filename}`;
      try {
        await bucket.upload(localPath, {
          destination: destPath,
          metadata: { metadata: { source: SOURCE_MARKER, topic: p.topic, originalFile: filename } },
        });
        await bucket.file(destPath).makePublic();
        const publicUrl = `https://storage.googleapis.com/${BUCKET}/${encodeURI(destPath)}`;
        imageEntries.push({
          addedAt: new Date().toISOString(),
          caption: '',
          comments: [],
          imageUrl: publicUrl,
          importedFrom: 'niice',
          originalFile: filename,
          showPrice: true,
          showSource: true,
          sourceUrl: '',
          stars: 0,
          tags: [],
          vendor: '',
        });
        uploaded++;
        if ((i + 1) % 25 === 0) console.log(`    uploaded ${i + 1}/${p.images.length}`);
      } catch (e) {
        errors++;
        console.log(`    ✗ failed ${filename}: ${e.code || e.message}`);
      }
    }

    // Create the ideabook doc
    const ideabookData = {
      name: p.topic,
      topic: p.topic,
      description: `${imageEntries.length} images imported from Niice — ${p.topic}`,
      source: SOURCE_MARKER,
      createdAt: new Date().toISOString(),
      order: 100 + processed,   // place new imports after existing
      images: imageEntries,
    };
    const ref = await db.collection('boards').doc(LIBRARY_BOARD).collection('ideabooks').add(ideabookData);
    console.log(`    ideabook created: ${ref.id} (${imageEntries.length} images)`);
  }

  console.log(`\n=== DONE ===`);
  console.log(`  Ideabooks created: ${processed}`);
  console.log(`  Images uploaded:   ${uploaded}`);
  console.log(`  Upload errors:     ${errors}`);
  process.exit(0);
})().catch(e => { console.error('FAILED:', e); process.exit(1); });
