/**
 * NIICE PATH B MULTI — one folder → one ideabook, batch run.
 *
 * Reads every Niice folder matching --prefix= (case-insensitive) or --folders=A,B,C
 * from:  C:\Users\cindy\Dropbox\Claude - CCH studio\Niice board downloads\Niice\{FOLDER}\
 *
 * For each folder, creates one ideabook in boards/{PROJECT_ID}/ideabooks/{newAutoId}
 * (so 8 PV folders → 8 separate ideabooks, NEVER consolidated).
 *
 * Uploads each image to Storage at:
 *   {PROJECT_ID}/inspiration/{folder-slug}/{timestamp-N-filename}
 *
 * Idempotent per-folder: skips if an ideabook with matching name and SOURCE_MARKER exists.
 * Skips folders with 0 images.
 *
 * Default DRY RUN. --execute to write.
 *
 * Args:
 *   --project=<projectId>     (required)
 *   --prefix=<string>          (case-insensitive folder name prefix, e.g. PV)
 *   --folders=A,B,C            (explicit folder list, comma-separated)
 *   --execute                  (perform writes)
 */
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const SERVICE_ACCOUNT = path.join(__dirname, 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
const BUCKET = 'cch-design-boards.firebasestorage.app';
const NIICE_SRC_ROOT = String.raw`C:\Users\cindy\Dropbox\Claude - CCH studio\Niice board downloads\Niice`;
const SOURCE_MARKER = 'niice-import-may11-path-b';

const args = Object.fromEntries(process.argv.slice(2).filter(a => a.startsWith('--')).map(a => {
  const [k, ...rest] = a.replace(/^--/, '').split('=');
  return [k, rest.join('=') || true];
}));
const PROJECT_ID = args.project;
const PREFIX = args.prefix || null;
const FOLDERS = args.folders ? String(args.folders).split(',').map(s => s.trim()).filter(Boolean) : null;
const EXECUTE = !!args.execute;

if (!PROJECT_ID) {
  console.log('ERROR: --project=<projectId> is required.');
  process.exit(1);
}
if (!PREFIX && !FOLDERS) {
  console.log('ERROR: must pass --prefix=X or --folders=A,B,C');
  process.exit(1);
}

const IMG_EXT = /\.(jpe?g|png|gif|webp|tiff?|bmp|heic|heif|jfif)$/i;

admin.initializeApp({
  credential: admin.credential.cert(require(SERVICE_ACCOUNT)),
  storageBucket: BUCKET,
});
const db = admin.firestore();
const bucket = admin.storage().bucket();

const slugify = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

(async () => {
  console.log(`NIICE PATH B MULTI  (${EXECUTE ? 'EXECUTE' : 'DRY RUN'})`);
  console.log(`Target project: boards/${PROJECT_ID}`);
  if (PREFIX) console.log(`Prefix filter:  "${PREFIX}" (case-insensitive)`);
  if (FOLDERS) console.log(`Folder list:    ${FOLDERS.length} folder(s)`);
  console.log('');

  // Verify project
  const projDoc = await db.collection('boards').doc(PROJECT_ID).get();
  if (!projDoc.exists) { console.log(`ERROR: project not found: boards/${PROJECT_ID}`); process.exit(1); }
  const proj = projDoc.data();
  console.log(`Studio project: "${proj.name}"  (client: ${proj.clientName || proj.client || '(none)'})`);

  // Enumerate matching folders
  const allEntries = fs.readdirSync(NIICE_SRC_ROOT, { withFileTypes: true });
  let candidateFolders;
  if (FOLDERS) {
    candidateFolders = FOLDERS;
  } else {
    const re = new RegExp('^' + PREFIX.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    candidateFolders = allEntries
      .filter(e => e.isDirectory() && re.test(e.name))
      .map(e => e.name);
  }
  console.log(`Folders matched: ${candidateFolders.length}`);

  // Existing ideabooks in target project
  const existingSnap = await db.collection('boards').doc(PROJECT_ID).collection('ideabooks').get();
  const existingByName = new Map();
  existingSnap.forEach(d => {
    const x = d.data();
    if (x.source === SOURCE_MARKER && x.name) existingByName.set(String(x.name).toLowerCase(), d.id);
  });
  console.log(`Existing ideabooks in project: ${existingSnap.size}  (${existingByName.size} from this importer)\n`);

  // Plan
  const plan = [];
  for (const folder of candidateFolders) {
    const fp = path.join(NIICE_SRC_ROOT, folder);
    if (!fs.existsSync(fp) || !fs.statSync(fp).isDirectory()) {
      plan.push({ folder, status: 'missing-folder', files: [] });
      continue;
    }
    const files = fs.readdirSync(fp, { withFileTypes: true })
      .filter(e => e.isFile() && IMG_EXT.test(e.name))
      .map(e => e.name);
    if (files.length === 0) {
      plan.push({ folder, status: 'empty', files: [] });
      continue;
    }
    if (existingByName.has(folder.toLowerCase())) {
      plan.push({ folder, status: 'already-imported', files });
      continue;
    }
    plan.push({ folder, status: 'will-import', files });
  }

  console.log('--- Plan ---');
  let totalUploads = 0, willImport = 0, alreadyDone = 0, empty = 0;
  for (const p of plan) {
    const tag = p.status === 'will-import' ? '+ NEW' :
                p.status === 'already-imported' ? '⊘ already-imported' :
                p.status === 'empty' ? '· empty' : '⚠ missing';
    console.log(`  ${tag.padEnd(22)} ${p.folder.padEnd(35)} ${String(p.files.length).padStart(4)} images`);
    if (p.status === 'will-import') { willImport++; totalUploads += p.files.length; }
    else if (p.status === 'already-imported') alreadyDone++;
    else if (p.status === 'empty') empty++;
  }
  console.log('');
  console.log(`  Folders scanned:     ${plan.length}`);
  console.log(`  Will import (new):   ${willImport}`);
  console.log(`  Already imported:    ${alreadyDone}`);
  console.log(`  Empty (skipped):     ${empty}`);
  console.log(`  Total uploads:       ${totalUploads}`);

  if (!EXECUTE) { console.log('\nDRY RUN. Add --execute to write.'); process.exit(0); }

  // Execute per-folder
  let processed = 0, totalUploaded = 0, totalErrors = 0;
  for (const p of plan) {
    if (p.status !== 'will-import') continue;
    processed++;
    console.log(`\n[${processed}/${willImport}] Importing "${p.folder}" (${p.files.length} images)...`);
    const slug = slugify(p.folder);
    const imageEntries = [];
    for (let i = 0; i < p.files.length; i++) {
      const filename = p.files[i];
      const localPath = path.join(NIICE_SRC_ROOT, p.folder, filename);
      const destPath = `${PROJECT_ID}/inspiration/${slug}/${Date.now()}-${i}-${filename}`;
      try {
        await bucket.upload(localPath, {
          destination: destPath,
          metadata: { metadata: { source: SOURCE_MARKER, board: p.folder, originalFile: filename } },
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
        totalUploaded++;
        if ((i + 1) % 25 === 0 || i === p.files.length - 1) console.log(`    uploaded ${i + 1}/${p.files.length}`);
      } catch (e) {
        totalErrors++;
        console.log(`    ✗ failed ${filename}: ${e.code || e.message}`);
      }
    }
    const ref = await db.collection('boards').doc(PROJECT_ID).collection('ideabooks').add({
      name: p.folder,
      description: `${imageEntries.length} images imported from Niice — ${p.folder}`,
      source: SOURCE_MARKER,
      createdAt: new Date().toISOString(),
      order: 100 + processed,
      images: imageEntries,
    });
    console.log(`    ideabook: ${ref.id}`);
  }

  console.log(`\n=== DONE ===`);
  console.log(`  Ideabooks created: ${processed}`);
  console.log(`  Images uploaded:   ${totalUploaded}`);
  console.log(`  Upload errors:     ${totalErrors}`);
  process.exit(0);
})().catch(e => { console.error('FAILED:', e); process.exit(1); });
