/**
 * PRODUCTION — set vendor Walker Zanger on the 12 WZ slab pins added 2026-08-27.
 *
 *   node _scripts\set-wz-slabs-vendor-rh_BY_CURSOR_2026-08-27.js
 *   node _scripts\set-wz-slabs-vendor-rh_BY_CURSOR_2026-08-27.js --apply
 */
'use strict';
const path = require('path');
const admin = require('firebase-admin');

const APPLY = process.argv.includes('--apply');
const KEY = path.join(__dirname, '..', '_debug', 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
const BOARD = 'cloud-rolling-hills';
const SECTION = '5zLV53Y6IBMkPGDgKHaM';
const VENDOR = 'Walker Zanger';
const MARKER = 'wz-email-2026-08-27';

const app = admin.initializeApp({ credential: admin.credential.cert(require(KEY)) }, 'wzVendor');
const db = app.firestore();

(async function main() {
  const ibRef = db.collection('boards').doc(BOARD).collection('ideabooks').doc(SECTION);
  const snap = await ibRef.get();
  if (!snap.exists) throw new Error('Slabs ideabook missing');
  const images = (snap.data().images || []).slice();
  let n = 0;
  images.forEach(function (im, i) {
    if (!im || im.importedFrom !== MARKER) return;
    console.log(i, im.caption, 'vendor:', JSON.stringify(im.vendor || ''), '→', VENDOR);
    n++;
    if (APPLY) im.vendor = VENDOR;
  });
  console.log(APPLY ? 'MODE: APPLY' : 'MODE: dry-run', 'pins', n);
  if (!APPLY) {
    console.log('Pass --apply to write.');
    process.exit(0);
  }
  if (!n) throw new Error('no marked pins found');
  await ibRef.update({ images: images, updatedAt: new Date().toISOString() });
  console.log('DONE. Vendor set on', n, 'pins.');
  process.exit(0);
})().catch(function (e) {
  console.error(e);
  process.exit(1);
});
