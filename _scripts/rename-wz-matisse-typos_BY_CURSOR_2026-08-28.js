/**
 * PRODUCTION — rename remaining Matisse / MAttise pins to Matise 3/4 2 CM.
 * Does NOT touch North Hills or other WZ names.
 *
 *   node _scripts\rename-wz-matisse-typos_BY_CURSOR_2026-08-28.js
 *   node _scripts\rename-wz-matisse-typos_BY_CURSOR_2026-08-28.js --apply
 */
'use strict';
const path = require('path');
const admin = require('firebase-admin');

const APPLY = process.argv.includes('--apply');
const KEY = path.join(__dirname, '..', '_debug', 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
const NEW_NAME = 'Matise 3/4 2 CM';

const app = admin.initializeApp({ credential: admin.credential.cert(require(KEY)) }, 'wzRenameMatisseTypos');
const db = app.firestore();

function looksMatisseTypo(cap) {
  const c = String(cap || '').trim().toLowerCase().replace(/["']/g, '');
  if (!c) return false;
  if (c === 'matise 3/4 2 cm') return false;
  return /^ma+t+i+s+e\b/.test(c);
}

(async function main() {
  const ibRef = db.collection('boards').doc('cloud-rolling-hills').collection('ideabooks').doc('5zLV53Y6IBMkPGDgKHaM');
  const snap = await ibRef.get();
  if (!snap.exists) throw new Error('Slabs ideabook missing');
  const images = (snap.data().images || []).slice();
  let n = 0;
  images.forEach(function (im, i) {
    if (!im || typeof im !== 'object') return;
    const before = im.caption || im.title || '';
    if (!looksMatisseTypo(before)) return;
    const file = String(im.sourceUrl || im.imageUrl || '').split('/').pop().split('?')[0].slice(0, 80);
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
