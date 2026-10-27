/**
 * PRODUCTION — rename mislabeled Costa Mesa WZ email pins to Matise 3/4 2 CM.
 *
 *   node _scripts\rename-wz-costa-mesa-to-matise_BY_CURSOR_2026-08-28.js
 *   node _scripts\rename-wz-costa-mesa-to-matise_BY_CURSOR_2026-08-28.js --apply
 */
'use strict';
const path = require('path');
const admin = require('firebase-admin');

const APPLY = process.argv.includes('--apply');
const KEY = path.join(__dirname, '..', '_debug', 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
const BOARD = 'cloud-rolling-hills';
const SECTION = '5zLV53Y6IBMkPGDgKHaM';
const NEW_NAME = 'Matise 3/4 2 CM';
const MARKER = 'wz-email-2026-08-27';
const COSTA_FILES = [
  '6306771_27_2SLACPI2CMP_52435.jpg',
  '6306771_28_2SLACPI2CMP_52436.jpg',
  '6306771_29_2SLACPI2CMP_52437.jpg',
  '6306771_7_2slacpizcmp_52415.jpg',
  '6306771_8_2slacpizcmp_52416.jpg'
];

const app = admin.initializeApp({ credential: admin.credential.cert(require(KEY)) }, 'wzRenameMatise');
const db = app.firestore();

function fileOf(im) {
  const u = String((im && (im.sourceUrl || im.imageUrl || im.originalFile)) || '');
  return u.split('/').pop().split('?')[0];
}

function looksCostaOrMattise(cap) {
  const c = String(cap || '').toLowerCase();
  return /costa\s*mess?a/.test(c) || /mattise/.test(c) || /^matise\b/.test(c);
}

(async function main() {
  const ibRef = db.collection('boards').doc(BOARD).collection('ideabooks').doc(SECTION);
  const snap = await ibRef.get();
  if (!snap.exists) throw new Error('Slabs ideabook missing');
  const images = (snap.data().images || []).slice();
  let n = 0;
  images.forEach(function (im, i) {
    if (!im || typeof im !== 'object') return;
    const file = fileOf(im).toLowerCase();
    const hitFile = COSTA_FILES.some(function (f) { return file === f.toLowerCase(); });
    const hitCap = im.importedFrom === MARKER && looksCostaOrMattise(im.caption || im.title);
    if (!hitFile && !hitCap) return;
    const before = im.caption || im.title || '';
    console.log(i, JSON.stringify(before), '→', NEW_NAME, file);
    n++;
    if (APPLY) {
      im.caption = NEW_NAME;
      im.title = NEW_NAME;
    }
  });
  console.log(APPLY ? 'MODE: APPLY' : 'MODE: dry-run', 'pins', n, 'board total', images.length);
  if (!APPLY) {
    console.log('Pass --apply to write.');
    process.exit(0);
  }
  if (!n) throw new Error('no matching pins');
  await ibRef.update({ images: images, updatedAt: new Date().toISOString() });
  console.log('DONE. Renamed', n, 'pins to', NEW_NAME);
  process.exit(0);
})().catch(function (e) {
  console.error(e);
  process.exit(1);
});
