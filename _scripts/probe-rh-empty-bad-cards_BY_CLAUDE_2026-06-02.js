#!/usr/bin/env node
'use strict';
const path = require('path');
const admin = require('firebase-admin');
const KEY = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
admin.initializeApp({ credential: admin.credential.cert(require(KEY)) });
const db = admin.firestore();
const PID = 'cloud-rolling-hills';

function hasImg(x) {
  return !!(String(x.imageUrl || x.image || '').trim() || (Array.isArray(x.images) && x.images.length));
}

(async () => {
  const snap = await db.collection('boards').doc(PID).collection('clips').get();
  let noImg = 0, libMay31 = 0, houzzNoImg = 0;
  const samples = [];
  snap.forEach((d) => {
    const x = d.data() || {};
    if (!hasImg(x)) {
      noImg++;
      if (x.source === 'houzz-import') houzzNoImg++;
      if (samples.length < 15) samples.push({ id: d.id, source: x.source, title: (x.title || '').slice(0, 55), room: x.room });
    }
    if (x.source === 'library' && String(x.addedAt || '').startsWith('2026-05-31')) libMay31++;
  });
  console.log('total', snap.size, 'no image', noImg, 'houzz-import no image', houzzNoImg, 'library May31 still on board', libMay31);
  console.log('sample no-image cards:');
  samples.forEach((s) => console.log(' ', s.source, s.id, '|', s.room, '|', s.title));
})();
