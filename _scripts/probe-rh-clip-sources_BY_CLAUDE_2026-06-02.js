#!/usr/bin/env node
'use strict';
const path = require('path');
const admin = require('firebase-admin');
const KEY = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
admin.initializeApp({ credential: admin.credential.cert(require(KEY)) });
const db = admin.firestore();
const PID = 'cloud-rolling-hills';

function isSpecTitle(t) {
  t = String(t || '').trim();
  return /^(weight|wattage|top to center|extension|height|width|provide satisfying)/i.test(t);
}

(async () => {
  const snap = await db.collection('boards').doc(PID).collection('clips').get();
  const bySource = {};
  const spec = [];
  let anna = null;
  snap.forEach((d) => {
    const x = d.data() || {};
    const src = x.source || '(none)';
    bySource[src] = (bySource[src] || 0) + 1;
    if (d.id === 'RHcPR9xep5IdBZEKUAK5') anna = { id: d.id, ...x };
    if (isSpecTitle(x.title)) {
      spec.push({
        id: d.id,
        title: x.title,
        vendor: x.vendor,
        source: x.source,
        createdAt: x.createdAt || x.savedAt || x.importedAt,
        updatedAt: x.updatedAt,
      });
    }
  });
  spec.sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
  console.log('clip count', snap.size);
  console.log('by source', bySource);
  console.log('spec-fragment clips', spec.length);
  console.log('spec sample (first 5)', spec.slice(0, 5));
  let hz = 0, hzSpec = 0, libN = 0, libSpec = 0;
  snap.forEach((d) => {
    const x = d.data() || {};
    const src = x.source || '';
    if (src === 'houzz-import') { hz++; if (isSpecTitle(x.title)) hzSpec++; }
    if (src === 'library') { libN++; if (isSpecTitle(x.title)) libSpec++; }
  });
  console.log('houzz-import clips', hz, 'with spec title', hzSpec);
  console.log('library-sourced clips', libN, 'with spec title', libSpec);
  console.log('anna clip', anna ? {
    title: anna.title,
    source: anna.source,
    savedAt: anna.savedAt,
    createdAt: anna.createdAt,
    updatedAt: anna.updatedAt,
    libraryProductId: anna.libraryProductId,
    _annaFixAt: anna._annaFixAt,
  } : null);
})();
