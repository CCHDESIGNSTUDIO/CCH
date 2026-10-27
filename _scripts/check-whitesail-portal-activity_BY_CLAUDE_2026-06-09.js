'use strict';
/** READ-ONLY: find the 31 Whitesail board and surface any CLIENT-side activity (the only trace a portal
 *  view leaves, since passive views aren't logged): design-board stars/comments, approve/decline on clips,
 *  client-submitted proposals. No writes. */
const path = require('path');
const admin = require('firebase-admin');
const KEY = require(path.join(__dirname, '..', '_debug', 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json'));
const db = admin.initializeApp({ credential: admin.credential.cert(KEY) }, 'PROD').firestore();
const str = (v) => String(v == null ? '' : v).trim();
(async () => {
  const boards = await db.collection('boards').get();
  let target = null;
  boards.forEach((b) => { const d = b.data() || {}; if (/white\s*sail|31\s*white/i.test(str(d.name)) || /white/i.test(b.id)) target = { id: b.id, name: str(d.name) }; });
  if (!target) { console.log('No 31 Whitesail board found. Boards with "white":'); boards.forEach((b)=>{ if(/white/i.test(str((b.data()||{}).name))||/white/i.test(b.id)) console.log('  '+b.id+' — '+str((b.data()||{}).name)); }); process.exit(0); }
  console.log('Board:', target.id, '—', target.name, '\n');

  // 1. design-board interactions (stars/comments) — written only on client star/comment
  const dbs = await db.collection('boards').doc(target.id).collection('designBoards').get();
  let interactionHits = 0;
  for (const dbDoc of dbs.docs) {
    const inter = await db.collection('boards').doc(target.id).collection('designBoards').doc(dbDoc.id).collection('interactions').doc('data').get();
    if (inter.exists) {
      const di = inter.data() || {};
      const nStars = Object.values(di.stars || {}).filter(Boolean).length;
      const nComments = Array.isArray(di.comments) ? di.comments.length : Object.keys(di.comments || {}).length;
      if (nStars || nComments) { interactionHits++; console.log('  ★/💬 designBoard "' + (str(dbDoc.data().name) || dbDoc.id) + '": ' + nStars + ' stars, ' + nComments + ' comments, updated ' + str(di.updatedAt)); }
    }
  }
  if (!interactionHits) console.log('  design-board stars/comments: NONE');

  // 2. client approve/decline on clips
  const clips = await db.collection('boards').doc(target.id).collection('clips').get();
  let decided = [];
  clips.forEach((c) => { const d = c.data() || {}; const s = str(d.clientSelectionStatus || d.approvalStatus).toLowerCase(); if (s === 'approved' || s === 'declined') decided.push({ t: str(d.title), s: s, at: str(d.clientSelectionAt || d.updatedAt).slice(0,16) }); });
  console.log('\n  Client approve/decline on items: ' + (decided.length ? decided.length + ' decided' : 'NONE'));
  decided.slice(0, 12).forEach((x) => console.log('     ' + x.s.toUpperCase().padEnd(8) + ' "' + x.t.slice(0,40) + '"  ' + x.at));

  // 3. client-submitted proposals (portal "request" submissions)
  const props = await db.collection('boards').doc(target.id).collection('proposals').get();
  let clientProps = [];
  props.forEach((p) => { const d = p.data() || {}; if (/client|portal/i.test(str(d.source || d.createdBy || d.origin))) clientProps.push({ id: p.id, src: str(d.source || d.createdBy) }); });
  console.log('\n  Client-submitted proposals: ' + (clientProps.length ? clientProps.length : 'NONE'));

  console.log('\nNOTE: passive "opened the portal" views are NOT recorded anywhere — only the actions above leave a trace.');
  process.exit(0);
})().catch((e) => { console.error('ERROR', e.message || e); process.exit(1); });
