#!/usr/bin/env node
'use strict';
const path = require('path');
const admin = require('firebase-admin');
const KEY = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
admin.initializeApp({ credential: admin.credential.cert(require(KEY)) });
const db = admin.firestore();
const PID = 'cloud-rolling-hills';

function junkScore(title) {
  const t = String(title || '').trim();
  if (!t) return 0;
  let s = 0;
  if (/^(weight|wattage|overall weight)/i.test(t)) s += 50;
  if (/weight\s*:/i.test(t)) s += 40;
  if (/provide satisfying|become a go-to|vaudeville|illuminating /i.test(t)) s += 40;
  if (/takes \d+x|not included/i.test(t)) s += 30;
  if (/cm\)|in \(\d|\blbs\.?\s*$/i.test(t) && t.length < 70) s += 25;
  return s;
}

(async () => {
  const snap = await db.collection('boards').doc(PID).collection('clips').get();
  const recent = [];
  const libMay31 = [];
  const junk = [];
  snap.forEach((d) => {
    const x = d.data() || {};
    const add = String(x.addedAt || '');
    const upd = String(x.updatedAt || '');
    const js = junkScore(x.title);
    if (js >= 25) junk.push({ id: d.id, title: x.title, source: x.source, room: x.room, addedAt: add });
    if (add.startsWith('2026-06-03') || add.startsWith('2026-06-04')) {
      recent.push({ id: d.id, title: (x.title || '').slice(0, 50), source: x.source, addedAt: add });
    }
    if (x.source === 'library' && add.startsWith('2026-05-31')) libMay31.push(d.id);
  });
  recent.sort((a, b) => String(b.addedAt).localeCompare(a.addedAt));
  console.log('total', snap.size, 'junk>=25', junk.length, 'library May31 addedAt', libMay31.length);
  console.log('\nadded June 3+:', recent.length);
  recent.slice(0, 20).forEach((r) => console.log(' ', r.addedAt, r.source, r.id, r.title));
  console.log('\njunk now:', junk.length);
  junk.slice(0, 15).forEach((j) => console.log(' ', j.id, j.source, j.title));
})();
