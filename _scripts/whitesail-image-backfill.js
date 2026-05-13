/**
 * Whitesail clip image backfill (server-side port of
 * trialWhitesailBackfillSelectionImagesFromLibrary).
 *
 * For each Whitesail clip whose imageUrl is missing OR a bare filename
 * (no http(s)://), find a matching Product Library row by libraryProductId
 * or by normalized title+vendor, and copy the library row's hero URL onto
 * the clip.
 *
 * Default: dry-run.  Run with --apply to actually write.
 * Run with --force to overwrite all matched clips even if they have a real URL.
 */
const path = require('path');
const admin = require('firebase-admin');
const SA = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
admin.initializeApp({ credential: admin.credential.cert(require(SA)) });
const db = admin.firestore();

const APPLY = process.argv.includes('--apply');
const FORCE = process.argv.includes('--force');
const BOARD_ID = '31-whitesail';
const PROJ_LABEL = '31 Whitesail';

function norm(s) { return String(s || '').trim().toLowerCase().replace(/\s+/g, ' '); }
function key(title, vendor) { return norm(title) + '||' + norm(vendor); }
function pickHero(o) {
  return String(o.imageUrl || o.image || o.hero || o.thumbnail || o.imgUrl || '').trim();
}
function isWeakUrl(u) {
  u = String(u || '').trim();
  if (!u) return true;
  if (!/^https?:\/\//i.test(u)) return true; // bare filename or relative
  return false;
}

(async () => {
  console.log(`Mode: ${APPLY ? 'APPLY (writes)' : 'DRY-RUN'}  Force: ${FORCE ? 'YES' : 'no'}`);

  // 1. Load Product Library for Whitesail
  let libRows = [];
  let s = await db.collection('productLibrary').where('project', '==', PROJ_LABEL).get();
  s.forEach(d => libRows.push({ id: d.id, ...d.data() }));
  if (libRows.length === 0) {
    s = await db.collection('productLibrary').where('projectId', '==', BOARD_ID).get();
    s.forEach(d => libRows.push({ id: d.id, ...d.data() }));
  }
  const libById = {};
  const libByKey = {};
  for (const r of libRows) {
    libById[r.id] = r;
    const k = key(r.title || r.name, r.vendor || r.manufacturer);
    if (k !== '||') libByKey[k] = r;
  }
  console.log(`Product Library rows for Whitesail: ${libRows.length}`);

  // 2. Scan clips
  const clipSnap = await db.collection('boards').doc(BOARD_ID).collection('clips').get();
  console.log(`Whitesail clips: ${clipSnap.size}`);

  let scanned = 0, alreadyStrong = 0, weakNoMatch = 0, noLibImg = 0, willUpdate = 0, didUpdate = 0, errors = 0;
  const updates = [];

  for (const cdoc of clipSnap.docs) {
    const clip = cdoc.data() || {};
    if (!clip.title && !clip.name) continue;
    scanned++;
    const heroCur = pickHero(clip);
    const isWeak = isWeakUrl(heroCur);

    if (!isWeak && !FORCE) { alreadyStrong++; continue; }

    // Try libraryProductId first
    let libRec = null;
    const lid = String(clip.libraryProductId || clip.linkedLibraryProductId || clip.libraryId || '').trim();
    if (lid && libById[lid]) libRec = libById[lid];
    if (!libRec) {
      const k = key(clip.title || clip.name, clip.vendor || clip.manufacturer);
      if (libByKey[k]) libRec = libByKey[k];
    }
    if (!libRec) { weakNoMatch++; continue; }

    const heroLib = pickHero(libRec);
    if (isWeakUrl(heroLib)) { noLibImg++; continue; }

    willUpdate++;
    updates.push({
      clipId: cdoc.id,
      title: (clip.title || clip.name || '').slice(0, 50),
      from: heroCur || '(none)',
      to: heroLib,
      libId: libRec.id
    });

    if (APPLY) {
      const patch = {
        imageUrl: heroLib,
        _trialWhitesailImageBackfillAt: new Date().toISOString(),
        _imageBackfillSource: 'productLibrary'
      };
      if (!lid) patch.libraryProductId = libRec.id;
      try {
        await cdoc.ref.update(patch);
        didUpdate++;
      } catch (e) {
        errors++;
        console.error(`  × ${cdoc.id}: ${e.message}`);
      }
    }
  }

  console.log('\n=== Summary ===');
  console.log(`Clips scanned:               ${scanned}`);
  console.log(`Already had strong URL:      ${alreadyStrong}${FORCE ? ' (ignored due to --force)' : ''}`);
  console.log(`Weak but no library match:   ${weakNoMatch}`);
  console.log(`Matched but library had no usable image: ${noLibImg}`);
  console.log(`Would update / will update:  ${willUpdate}`);
  if (APPLY) {
    console.log(`Actually updated:            ${didUpdate}`);
    console.log(`Errors:                      ${errors}`);
  }
  console.log('\nFirst 10 updates:');
  for (const u of updates.slice(0, 10)) {
    console.log(`  ${u.clipId.padEnd(22)} ${u.title.padEnd(50)} from "${u.from.slice(0, 30)}" → lib ${u.libId}`);
  }
  if (updates.length > 10) console.log(`  ... and ${updates.length - 10} more`);

  if (!APPLY) console.log('\nDRY-RUN. Re-run with --apply to actually write.');
  process.exit(0);
})().catch(e => { console.error('FATAL:', e); process.exit(1); });
