#!/usr/bin/env node
'use strict';
const path = require('path');
const admin = require('firebase-admin');
const KEY = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
admin.initializeApp({ credential: admin.credential.cert(require(KEY)) });
const db = admin.firestore();
const PID = 'cloud-rolling-hills';

function parseTs(v) {
  if (!v) return null;
  if (v.toDate) return v.toDate();
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

function bucket(d) {
  if (!d) return 'no-date';
  const t = d.getTime();
  if (t >= new Date('2026-06-01').getTime()) return '2026-06+';
  if (t >= new Date('2026-05-28').getTime()) return '2026-05-28..31';
  if (t >= new Date('2026-05-20').getTime()) return '2026-05-20..27';
  if (t >= new Date('2026-05-01').getTime()) return '2026-05-01..19';
  return 'before-2026-05';
}

(async () => {
  const snap = await db.collection('boards').doc(PID).collection('clips').get();
  const bySrcUpd = {};
  const bySrcAdd = {};
  const recent = [];
  const specRecent = [];
  const isSpec = (t) => /^(weight|wattage|top to center|provide satisfying|extension:|height:|width:)/i.test(String(t || '').trim());

  snap.forEach((d) => {
    const x = d.data() || {};
    const src = x.source || '(none)';
    const upd = parseTs(x.updatedAt) || parseTs(x._annaFixAt) || parseTs(x.savedAt);
    const add = parseTs(x.addedAt) || parseTs(x.createdAt) || parseTs(x.importedAt);
    const bu = bucket(upd);
    const ba = bucket(add);
    bySrcUpd[src] = bySrcUpd[src] || {};
    bySrcUpd[src][bu] = (bySrcUpd[src][bu] || 0) + 1;
    bySrcAdd[src] = bySrcAdd[src] || {};
    bySrcAdd[src][ba] = (bySrcAdd[src][ba] || 0) + 1;
    if (bu === '2026-06+' || bu === '2026-05-28..31') {
      recent.push({
        id: d.id,
        title: (x.title || '').slice(0, 50),
        source: src,
        updatedAt: upd && upd.toISOString(),
        addedAt: add && add.toISOString(),
        room: x.room,
      });
    }
    if (isSpec(x.title) && (bu === '2026-06+' || bu === '2026-05-28..31')) {
      specRecent.push({ id: d.id, title: x.title, source: src, updatedAt: upd && upd.toISOString(), addedAt: add && add.toISOString() });
    }
  });

  recent.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
  console.log('total clips', snap.size);
  console.log('\nby source × updatedAt bucket:', JSON.stringify(bySrcUpd, null, 2));
  console.log('\nby source × addedAt bucket:', JSON.stringify(bySrcAdd, null, 2));
  console.log('\nrecently updated (May 28+):', recent.length);
  console.log('sample last 25 updates:', recent.slice(0, 25));
  console.log('\nspec-fragment updated May 28+:', specRecent.length, specRecent);
  const junkLike = [];
  snap.forEach((d) => {
    const t = String(d.data().title || '');
    if (/weight:|wattage:|top to center|provide satisfying|total wattage|extension:/i.test(t) ||
        (t.length < 60 && /lbs\.?$/i.test(t)) || (t.length < 45 && /watts$/i.test(t))) {
      junkLike.push({
        id: d.id,
        title: t,
        source: d.data().source,
        updatedAt: d.data().updatedAt,
        addedAt: d.data().addedAt,
      });
    }
  });
  junkLike.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
  console.log('\njunk-like titles:', junkLike.length, junkLike);
})();
