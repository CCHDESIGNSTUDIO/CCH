#!/usr/bin/env node
'use strict';
const path = require('path');
const admin = require('firebase-admin');
const KEY = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
admin.initializeApp({ credential: admin.credential.cert(require(KEY)) });
const db = admin.firestore();
const PID = 'cloud-rolling-hills';

const PATTERNS = [
  { name: 'spec-prefix', re: /^(weight|wattage|top to center|provide satisfying|extension:|height:|width:)/i },
  { name: 'weight-colon', re: /weight\s*:/i },
  { name: 'top-to-center', re: /top to center/i },
  { name: 'provide-satisfying', re: /provide satisfying/i },
  { name: 'wattage', re: /wattage/i },
  { name: 'contrast-sentence', re: /contrast\./i },
];

(async () => {
  const snap = await db.collection('boards').doc(PID).collection('clips').get();
  const all = [];
  snap.forEach((d) => {
    const x = d.data() || {};
    all.push({
      id: d.id,
      title: String(x.title || ''),
      source: x.source || '',
      room: x.room || '',
      addedAt: x.addedAt,
      updatedAt: x.updatedAt,
    });
  });
  console.log('total clips', all.length);
  for (const p of PATTERNS) {
    const m = all.filter((c) => p.re.test(c.title));
    console.log('\n' + p.name + ':', m.length);
    m.slice(0, 12).forEach((c) => console.log(' ', c.source, c.addedAt || '(no add)', '|', c.title.slice(0, 70)));
  }
  const may31 = all.filter((c) => String(c.addedAt || '').startsWith('2026-05-31'));
  console.log('\naddedAt 2026-05-31:', may31.length, 'by source:', Object.fromEntries(
    [...new Set(may31.map((x) => x.source))].map((s) => [s, may31.filter((x) => x.source === s).length])
  ));
  const houzzJunk = all.filter((c) => c.source === 'houzz-import' && PATTERNS.some((p) => p.re.test(c.title)));
  console.log('houzz-import with any junk pattern:', houzzJunk.length);
  houzzJunk.slice(0, 8).forEach((c) => console.log(' ', c.title.slice(0, 60), c.updatedAt));

  const may31Lib = may31.filter((c) => c.source === 'library');
  const junkInLib = may31Lib.filter((c) => PATTERNS.some((p) => p.re.test(c.title)));
  console.log('\nMay31 library clips:', may31Lib.length, 'junk-pattern:', junkInLib.length);
  console.log('sample May31 library (first 15):');
  may31Lib.slice(0, 15).forEach((c) => console.log(' ', c.addedAt, '|', (c.title || '').slice(0, 55), '|', c.room));
})();
