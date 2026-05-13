/**
 * NIICE PATH B PILOT — single project, single board
 *
 * Reads ONE Niice board folder from:
 *   C:\Users\cindy\Dropbox\Claude - CCH studio\Niice board downloads\Niice\{BOARD_NAME}\*.{jpg,png,...}
 *
 * Creates ONE ideabook in:
 *   boards/{PROJECT_ID}/ideabooks/{newAutoId}
 *
 * Uploads each image to Storage at:
 *   {PROJECT_ID}/inspiration/{board-slug}/{timestamp-N-filename}
 *
 * Idempotent: skips if an ideabook with name === BOARD_NAME and source === SOURCE_MARKER already exists.
 *
 * Default DRY RUN. --execute to write.
 *
 * Override defaults with --board= and --project=.
 */
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const SERVICE_ACCOUNT = path.join(__dirname, 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
const BUCKET = 'cch-design-boards.firebasestorage.app';
const NIICE_SRC_ROOT = String.raw`C:\Users\cindy\Dropbox\Claude - CCH studio\Niice board downloads\Niice`;
const SOURCE_MARKER = 'niice-import-may11-path-b';

// CLI / defaults
const args = Object.fromEntries(process.argv.slice(2).filter(a => a.startsWith('--')).map(a => {
  const [k, ...rest] = a.replace(/^--/, '').split('=');
  return [k, rest.join('=') || true];
}));
const BOARD_NAME = args.board || 'Tina Nieves';
const PROJECT_ID = args.project || 'nieves-3920-laguna-blanca-drive-sb';
const EXECUTE = !!args.execute;

const IMG_EXT = /\.(jpe?g|png|gif|webp|tiff?|bmp|heic|heif|jfif)$/i;

admin.initializeApp({
  credential: admin.credential.cert(require(SERVICE_ACCOUNT)),
  storageBucket: BUCKET,
});
const db = admin.firestore();
const bucket = admin.storage().bucket();

const slugify = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

(async () => {
  console.log(`NIICE PATH B PILOT  (${EXECUTE ? 'EXECUTE' : 'DRY RUN'})`);
  console.log(`Board folder:  ${BOARD_NAME}`);
  console.log(`Target project: boards/${PROJECT_ID}`);
  console.log('');

  // 0. Verify source folder exists
  const sourcePath = path.join(NIICE_SRC_ROOT, BOARD_NAME);
  if (!fs.existsSync(sourcePath)) {
    console.log(`ERROR: source folder not found: ${sourcePath}`);
    process.exit(1);
  }

  // 1. Verify project exists in Studio
  const projDoc = await db.collection('boards').doc(PROJECT_ID).get();
  if (!projDoc.exists) {
    console.log(`ERROR: project board not found: boards/${PROJECT_ID}`);
    process.exit(1);
  }
  const proj = projDoc.data();
  console.log(`Studio project: "${proj.name}"  (client: ${proj.clientName || proj.client || '(none)'})`);

  // 2. List image files
  const files = fs.readdirSync(sourcePath, { withFileTypes: true })
    .filter(e => e.isFile() && IMG_EXT.test(e.name))
    .map(e => e.name);
  console.log(`Found ${files.length} image files\n`);

  // 3. Idempotence check — existing ideabook for this board
  const existingSnap = await db.collection('boards').doc(PROJECT_ID).collection('ideabooks').get();
  let existingId = null;
  existingSnap.forEach(d => {
    const x = d.data();
    if (x.source === SOURCE_MARKER && String(x.name).toLowerCase() === BOARD_NAME.toLowerCase()) {
      existingId = d.id;
    }
  });
  console.log(`Existing ideabooks in project: ${existingSnap.size}`);
  if (existingId) {
    console.log(`⊘ Already imported (ideabook ${existingId} matches "${BOARD_NAME}" with ${SOURCE_MARKER}) — skipping.`);
    process.exit(0);
  }

  console.log('\n--- Sample of files to upload (first 8) ---');
  for (const f of files.slice(0, 8)) console.log(`  ${f}`);
  if (files.length > 8) console.log(`  ...and ${files.length - 8} more`);

  console.log('\n--- Plan ---');
  console.log(`  uploads to Storage:  ${files.length}  (path prefix: ${PROJECT_ID}/inspiration/${slugify(BOARD_NAME)}/)`);
  console.log(`  ideabook to create:  1  (name: "${BOARD_NAME}", source: ${SOURCE_MARKER})`);

  if (!EXECUTE) {
    console.log('\nDRY RUN. Add --execute to write.');
    process.exit(0);
  }

  // 4. EXECUTE — upload all images, build image entries
  console.log('\nWRITING...');
  const slug = slugify(BOARD_NAME);
  const imageEntries = [];
  let uploaded = 0, errors = 0;
  for (let i = 0; i < files.length; i++) {
    const filename = files[i];
    const localPath = path.join(sourcePath, filename);
    const destPath = `${PROJECT_ID}/inspiration/${slug}/${Date.now()}-${i}-${filename}`;
    try {
      await bucket.upload(localPath, {
        destination: destPath,
        metadata: { metadata: { source: SOURCE_MARKER, board: BOARD_NAME, originalFile: filename } },
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
      if ((i + 1) % 25 === 0 || i === files.length - 1) console.log(`  uploaded ${i + 1}/${files.length}`);
    } catch (e) {
      errors++;
      console.log(`  ✗ failed ${filename}: ${e.code || e.message}`);
    }
  }

  // 5. Create the ideabook doc
  const ideabookData = {
    name: BOARD_NAME,
    description: `${imageEntries.length} images imported from Niice — ${BOARD_NAME}`,
    source: SOURCE_MARKER,
    createdAt: new Date().toISOString(),
    order: 100,
    images: imageEntries,
  };
  const ref = await db.collection('boards').doc(PROJECT_ID).collection('ideabooks').add(ideabookData);
  console.log(`\nIdeabook created: ${ref.id}`);
  console.log(`  ${imageEntries.length} images attached`);
  console.log(`  upload errors: ${errors}`);
  console.log(`\nDONE.`);
  process.exit(0);
})().catch(e => { console.error('FAILED:', e); process.exit(1); });
