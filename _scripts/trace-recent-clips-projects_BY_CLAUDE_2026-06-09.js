'use strict';
/** READ-ONLY: for clipper products created since cutoff, show project link + whether a Room Board clip
 *  exists for them in that project (so we know if they'd appear in Selections / Room Board). No writes. */
const path = require('path');
const admin = require('firebase-admin');
const KEY = require(path.join(__dirname, '..', '_debug', 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json'));
const db = admin.initializeApp({ credential: admin.credential.cert(KEY) }, 'PROD').firestore();
const str = (v) => String(v == null ? '' : v).trim();
const CUT = '2026-06-07';
const nt = (s) => str(s).toLowerCase().replace(/[^a-z0-9]+/g, '');
(async () => {
  const ps = await db.collection('products').get();
  const recent = [];
  ps.forEach((d) => { const p = d.data() || {}; if (str(p.createdAt) >= CUT && /clipper/i.test(str(p.source))) recent.push(Object.assign({ _id: d.id }, p)); });
  console.log('Recent clipper products:', recent.length, '\n');
  // group by project id to scan each board's clips once
  for (const p of recent) {
    const pid = str(p.projectId);
    let clipMatch = 'n/a (no projectId)';
    if (pid) {
      try {
        const cs = await db.collection('boards').doc(pid).collection('clips').get();
        let found = null;
        cs.forEach((c) => { const cd = c.data() || {}; if (str(cd.libraryProductId) === p._id || nt(cd.title || cd.name) === nt(p.title || p.name)) found = c.id; });
        clipMatch = found ? ('YES clip ' + found) : 'NO board clip';
      } catch (e) { clipMatch = 'board read err'; }
    }
    console.log('• "' + str(p.title || p.name).slice(0, 36).padEnd(36) + '" vendor=' + str(p.vendor).padEnd(20) +
      '\n    projectId=' + (pid || '(none)') + '  project=' + (str(p.project) || '(none)') + '  libProdId=' + str(p.libraryProductId || '(self)') +
      '\n    roomBoardClip: ' + clipMatch + '  | lifecycle=' + (str(p.productLifecycle) || 'active') + '  created=' + str(p.createdAt).slice(0, 16));
  }
  process.exit(0);
})().catch((e) => { console.error('ERROR', e.message || e); process.exit(1); });
