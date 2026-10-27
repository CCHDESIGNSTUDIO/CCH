'use strict';
/** Read-only: inspect staging PRO-3017 items after room-sync wipe. No writes. */
const path = require('path');
const admin = require('firebase-admin');
const KEY = path.join(
  __dirname,
  '..',
  '_debug',
  'service-account.json',
  'cch-studio-staging-firebase-adminsdk-fbsvc-b93c6f1cf4.json'
);
const db = admin.initializeApp({ credential: admin.credential.cert(require(KEY)) }, 'pro3017insp').firestore();

function coerceItems(val) {
  if (val == null) return [];
  if (Array.isArray(val)) return val.filter(Boolean);
  if (typeof val === 'object') return Object.keys(val)
    .filter((k) => /^(0|[1-9]\d*)$/.test(k))
    .sort((a, b) => parseInt(a, 10) - parseInt(b, 10))
    .map((k) => val[k])
    .filter(Boolean);
  return [];
}

(async () => {
  const boards = await db.collection('boards').get();
  const hits = [];
  for (const d of boards.docs) {
    const byId = await db.collection('boards').doc(d.id).collection('proposals').doc('PRO-3017').get();
    if (byId.exists) hits.push({ pid: d.id, name: (d.data() || {}).name || (d.data() || {}).title, snap: byId });
    const snap = await db.collection('boards').doc(d.id).collection('proposals').get();
    for (const x of snap.docs) {
      const data = x.data() || {};
      const num = String(data.number || data.proposalNumber || x.id || '');
      if (num.includes('3017')) {
        if (!hits.some((h) => h.pid === d.id && h.snap.id === x.id)) {
          hits.push({ pid: d.id, name: (d.data() || {}).name || (d.data() || {}).title, snap: x });
        }
      }
    }
  }
  console.log('hits', hits.length);
  for (const h of hits) {
    const data = h.snap.data() || {};
    const items = coerceItems(data.items);
    console.log('---', h.pid, '|', h.name, '|', h.snap.id);
    console.log('number', data.number || data.proposalNumber, 'itemsLen', items.length, 'updatedAt', data.updatedAt);
    console.log('total', data.total || data.grandTotal, 'status', data.status);
    items.forEach((it, i) => {
      console.log(
        i,
        (it.title || it.name || '?'),
        '| room=',
        it.room || '',
        '| vendor=',
        it.vendor || '',
        '| amt=',
        it.amount || it.clientPrice || '',
        '| clipId=',
        it.clipId || ''
      );
    });
    console.log('documentTags', data.documentTags || data.tags || '');
    console.log('summary', (data.summary || '').slice(0, 120));
  }

  // Also scan invoices on same projects for mirror lines that might help restore
  for (const h of hits) {
    const invs = await db.collection('boards').doc(h.pid).collection('invoices').get();
    for (const inv of invs.docs) {
      const data = inv.data() || {};
      const items = coerceItems(data.items);
      const mirrorish = items.filter((it) => /mirror/i.test(String((it && (it.title || it.name)) || '')) || /mirror/i.test(String((it && it.category) || '')));
      const wallpaper = items.filter((it) => /floral charm|wallpaper/i.test(String((it && (it.title || it.name)) || '')));
      if (mirrorish.length || wallpaper.length) {
        console.log('invoice', h.pid, inv.id, 'mirrorLines', mirrorish.length, 'wallpaperLines', wallpaper.length);
        mirrorish.forEach((it) => console.log('  M', it.title || it.name, it.room, it.vendor, it.amount || it.clientPrice));
        wallpaper.forEach((it) => console.log('  W', it.title || it.name, it.room, it.vendor, it.amount || it.clientPrice));
      }
    }
  }
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
