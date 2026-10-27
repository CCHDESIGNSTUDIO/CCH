/**
 * Detail follow-up for RH proposal/room-board audit (read-only).
 */
'use strict';
const path = require('path');
const admin = require('firebase-admin');
const KEY = path.join(
  __dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json'
);
const db = admin.initializeApp({ credential: admin.credential.cert(require(KEY)) }, 'rhDetail2').firestore();
const PID = 'cloud-rolling-hills';
const str = (v) => String(v == null ? '' : v).trim();

(async () => {
  const prop = await db.collection('boards').doc(PID).collection('proposals').doc('PPJ3cJ99AjQ8okpQl7Nv').get();
  const items = (prop.data() || {}).items || [];
  const interesting = [];
  items.forEach((it, i) => {
    const title = str(it.title);
    if (/artillo|arcilla|villa|classica/i.test(title)) {
      interesting.push({
        i,
        title: title.slice(0, 80),
        room: str(it.room),
        clipId: str(it.clipId || it.sourceClipId),
        lib: str(it.libraryProductId)
      });
    }
  });
  console.log('PRO-3035 interesting lines:\n', JSON.stringify(interesting, null, 2));

  const clips = await db.collection('boards').doc(PID).collection('clips').get();
  const hits = [];
  clips.forEach((d) => {
    const c = d.data() || {};
    const t = str(c.title);
    if (/artillo|arcilla|villa classica/i.test(t)) {
      hits.push({
        id: d.id,
        title: t.slice(0, 70),
        room: str(c.room) || '(blank)',
        lib: str(c.libraryProductId).slice(0, 50),
        unassignedFrom: c._roomUnassignedFrom || null
      });
    }
  });
  console.log('Matching clips:\n', JSON.stringify(hits, null, 2));

  const p37 = await db.collection('boards').doc(PID).collection('proposals').doc('9ONwDe1zIaUsSqWtYm1h').get();
  const items37 = (p37.data() || {}).items || [];
  for (const idx of [14, 15, 16, 17]) {
    const it = items37[idx];
    const cid = str(it.clipId || it.sourceClipId);
    let clipRoom = 'NOCLIP';
    let un = null;
    if (cid) {
      const s = await db.collection('boards').doc(PID).collection('clips').doc(cid).get();
      if (s.exists) {
        const c = s.data() || {};
        clipRoom = str(c.room) || '(blank)';
        un = c._roomUnassignedFrom || null;
      }
    }
    console.log(
      '3037[' + idx + ']',
      str(it.title).slice(0, 48),
      'wantRoom=' + str(it.room),
      'clipId=' + cid,
      'clipRoom=' + clipRoom,
      'unassignedFrom=' + JSON.stringify(un)
    );
  }
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
