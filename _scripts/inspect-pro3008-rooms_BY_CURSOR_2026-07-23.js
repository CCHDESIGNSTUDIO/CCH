'use strict';
/** READ-ONLY: PRO-3008 Echo Sconce rooms + matching clips on staging. */
const path = require('path');
const admin = require('firebase-admin');
const KEY = path.join(
  __dirname,
  '..',
  '_debug',
  'service-account.json',
  'cch-studio-staging-firebase-adminsdk-fbsvc-b93c6f1cf4.json'
);
const db = admin.initializeApp({ credential: admin.credential.cert(require(KEY)) }, 'pro3008').firestore();
const str = (v) => String(v == null ? '' : v).trim();

(async () => {
  const pid = 'cloud-rolling-hills';
  // Find PRO-3008
  const props = await db.collection('boards').doc(pid).collection('proposals').get();
  let found = null;
  props.forEach((d) => {
    const data = d.data() || {};
    const num = str(data.proposalNum || data.number || data.name || data.num);
    if (num === 'PRO-3008' || d.id.includes('3008')) found = { id: d.id, data };
  });
  if (!found) {
    // try scan all boards
    console.log('Not under cloud-rolling-hills by number — scanning boards…');
    const boards = await db.collection('boards').get();
    for (const b of boards.docs) {
      const qs = await db.collection('boards').doc(b.id).collection('proposals').get();
      qs.forEach((d) => {
        const data = d.data() || {};
        const num = str(data.proposalNum || data.number || data.name || data.num);
        if (num === 'PRO-3008') found = { id: d.id, boardId: b.id, data };
      });
      if (found) break;
    }
  } else {
    found.boardId = pid;
  }
  if (!found) {
    console.log('PRO-3008 not found on staging');
    process.exit(1);
  }
  console.log('Proposal', found.id, 'board', found.boardId);
  const items = found.data.items || [];
  console.log('item count', items.length);
  items.forEach((it, i) => {
    console.log(
      JSON.stringify({
        i,
        title: str(it.title || it.name).slice(0, 40),
        vendor: str(it.vendor),
        room: it.room,
        roomRaw: JSON.stringify(it.room),
        roomLocation: it.roomLocation,
        clipId: it.clipId || null,
        libraryProductId: it.libraryProductId || null,
      })
    );
  });

  const echoes = items.filter((it) => /echo\s*sconce/i.test(str(it.title || it.name)));
  console.log('\nEcho lines:', echoes.length);

  const clips = await db.collection('boards').doc(found.boardId).collection('clips').get();
  const echoClips = [];
  clips.forEach((d) => {
    const c = d.data() || {};
    if (/echo\s*sconce/i.test(str(c.title || c.name))) {
      echoClips.push({ id: d.id, room: c.room || '', title: c.title, vendor: c.vendor });
    }
  });
  console.log('Echo clips on board:', echoClips.length);
  console.log(JSON.stringify(echoClips, null, 2));
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
