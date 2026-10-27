#!/usr/bin/env node
'use strict';
const path = require('path');
const admin = require('firebase-admin');
const KEY = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
admin.initializeApp({ credential: admin.credential.cert(require(KEY)) });
const db = admin.firestore();
const PID = 'cloud-rolling-hills';

const BROAD = [
  [/provide satisfying/i, 'provide satisfying'],
  [/total wattage/i, 'total wattage'],
  [/top to center/i, 'top to center'],
  [/weight\s*:/i, 'weight:'],
  [/^\s*extension:/i, 'extension:'],
  [/^\s*height:/i, 'height:'],
  [/overall weight/i, 'overall weight'],
  [/become a go-to/i, 'become a go-to'],
  [/illuminating /i, 'illuminating'],
  [/cm\)depth/i, 'cm)depth'],
  [/cracked edge/i, 'cracked edge'],
  [/takes \d+x/i, 'takes 1x'],
  [/^licorice$/i, 'licorice alone'],
  [/^\d+["']?\s*(watt|watts)\b/i, 'N watts title'],
  [/^[^a-z]{0,3}$/i, 'too short'],
];

(async () => {
  const snap = await db.collection('boards').doc(PID).collection('clips').get();
  const counts = {};
  BROAD.forEach(([, k]) => { counts[k] = 0; });
  const samples = [];
  snap.forEach((d) => {
    const t = String(d.data().title || '');
    for (const [re, key] of BROAD) {
      if (re.test(t)) {
        counts[key]++;
        if (samples.length < 25) samples.push({ key, id: d.id, title: t.slice(0, 60), source: d.data().source });
      }
    }
  });
  console.log('total clips', snap.size);
  Object.entries(counts).forEach(([k, v]) => { if (v) console.log(k + ':', v); });
  console.log('\nsamples:');
  samples.forEach((s) => console.log(s.key, s.source, s.id, '|', s.title));
})();
