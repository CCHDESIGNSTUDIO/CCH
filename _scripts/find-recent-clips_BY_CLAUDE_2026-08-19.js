#!/usr/bin/env node
'use strict';
/** Every clip created in the last 3 days, across all boards. READ-ONLY. */
const admin = require('firebase-admin');
const path = require('path');
const KEY = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(require(KEY)) });
const db = admin.firestore();

const CUTOFF = Date.now() - 3 * 24 * 60 * 60 * 1000;

function ms(v) {
  if (!v) return 0;
  if (typeof v === 'object' && typeof v.toDate === 'function') return v.toDate().getTime();
  if (typeof v === 'object' && v._seconds) return v._seconds * 1000;
  const t = Date.parse(v);
  return isNaN(t) ? 0 : t;
}
function stamp(it) {
  return Math.max(ms(it.createdAt), ms(it.clippedAt), ms(it.addedAt), ms(it.updatedAt), ms(it.savedAt));
}

(async () => {
  const boards = await db.collection('boards').get();
  const rows = [];
  for (const b of boards.docs) {
    let cs;
    try { cs = await b.ref.collection('clips').get(); } catch (e) { continue; }
    cs.forEach(d => {
      const c = d.data() || {};
      const t = stamp(c);
      if (t >= CUTOFF) {
        rows.push({
          board: b.id, id: d.id, t,
          when: new Date(t).toISOString().replace('T', ' ').slice(0, 16),
          title: String(c.title || c.name || '(untitled)').slice(0, 52),
          vendor: c.vendor || '—',
          sku: c.sku || '—',
          cost: c.cost ?? '—',
          room: c.room || '—',
          lib: c.libraryProductId || c.linkedLibraryProductId || '—',
          src: c.source || c._source || '—'
        });
      }
    });
  }
  rows.sort((a, b) => b.t - a.t);
  console.log('clips created/updated in the last 3 days: ' + rows.length + '\n');
  rows.forEach(r => {
    console.log(r.when + '  [' + r.board + ']');
    console.log('   ' + r.title);
    console.log('   vendor:' + r.vendor + '  sku:' + r.sku + '  cost:' + r.cost +
                '  room:' + r.room + '  lib:' + (r.lib === '—' ? 'NOT LINKED' : r.lib) +
                '  src:' + r.src);
  });
  if (!rows.length) console.log('NONE. No clip on any board has a recent timestamp.');
  console.log('\ndone — nothing was written.');
})().catch(e => { console.error(e.message); process.exit(1); });
