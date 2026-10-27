/**
 * Read-only: list Rolling Hills Slabs pin names (production).
 *   node _scripts\list-rh-slabs-captions_BY_CURSOR_2026-08-28.js
 */
'use strict';
const path = require('path');
const admin = require('firebase-admin');
const KEY = path.join(__dirname, '..', '_debug', 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
const app = admin.initializeApp({ credential: admin.credential.cert(require(KEY)) }, 'listRhSlabs');
const db = app.firestore();

(async function main() {
  const snap = await db.collection('boards').doc('cloud-rolling-hills').collection('ideabooks').doc('5zLV53Y6IBMkPGDgKHaM').get();
  const images = snap.exists ? (snap.data().images || []) : [];
  images.forEach(function (im, i) {
    if (!im || typeof im !== 'object') {
      console.log(i, String(im).slice(0, 80));
      return;
    }
    const cap = im.caption || im.title || '';
    const notes = String(im.notes || im.description || '').slice(0, 60);
    const nCom = Array.isArray(im.comments) ? im.comments.length : 0;
    const file = String(im.sourceUrl || im.imageUrl || '').split('/').pop().split('?')[0];
    const vendor = im.vendor || '';
    const from = im.importedFrom || '';
    console.log([i, JSON.stringify(cap), 'notes=' + JSON.stringify(notes), 'comments=' + nCom, vendor, from, file].join(' | '));
  });
  console.log('TOTAL', images.length);
  process.exit(0);
})().catch(function (e) {
  console.error(e);
  process.exit(1);
});
