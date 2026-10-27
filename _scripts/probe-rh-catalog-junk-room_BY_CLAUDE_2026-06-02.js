#!/usr/bin/env node
'use strict';
const path = require('path');
const admin = require('firebase-admin');
const KEY = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
admin.initializeApp({ credential: admin.credential.cert(require(KEY)) });
const db = admin.firestore();
const PID = 'cloud-rolling-hills';
const PROJ = 'Cloud - Rolling Hills';

const JUNK_RE = [
  /weight\s*:/i,
  /provide satisfying/i,
  /total wattage/i,
  /top to center/i,
  /overall weight/i,
  /become a go-to/i,
  /illuminating vaudeville/i,
  /takes \d+x.*not included/i,
  /cm\)depth/i,
  /^licorice$/i,
  /cracked edge/i,
];

(async () => {
  const hits = [];
  const add = (coll, d) => {
    const p = d.data() || {};
    const room = String(p.room || '').trim();
    const title = String(p.title || p.name || '').trim();
    if (!room || !title) return;
    if (!JUNK_RE.some((re) => re.test(title))) return;
    hits.push({ coll, id: d.id, title: title.slice(0, 70), room, source: p.source });
  };
  let s = await db.collection('products').where('projectId', '==', PID).limit(500).get();
  s.forEach((d) => add('products', d));
  s = await db.collection('products').where('project', '==', PROJ).limit(500).get();
  s.forEach((d) => add('products', d));
  s = await db.collection('productLibrary').where('project', '==', PROJ).limit(500).get();
  s.forEach((d) => add('productLibrary', d));
  console.log('catalog rows with room + junk-like title:', hits.length);
  hits.slice(0, 20).forEach((h) => console.log(' ', h.coll, h.id, '|', h.room, '|', h.title));
})();
