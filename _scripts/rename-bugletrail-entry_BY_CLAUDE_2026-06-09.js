'use strict';
/** PRODUCTION: normalize the 1 stray Timely entry "7225 Bugle Trail" -> canonical "7225 Bugletrail"
 *  (board 7225-bugletrail). Backs up each touched doc. Cynthia GO given (Jun 9). */
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const KEY = require(path.join(__dirname, '..', '_debug', 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json'));
const db = admin.initializeApp({ credential: admin.credential.cert(KEY) }, 'PROD').firestore();
const str = (v) => String(v == null ? '' : v).trim();
const CANON = '7225 Bugletrail';
(async () => {
  const snap = await db.collection('timeEntries').get();
  const fix = [];
  snap.forEach((d) => { const t = d.data() || {}; const p = str(t.project || t.projectName); if (/bugle/i.test(p) && p !== CANON) fix.push({ id: d.id, prev: p, prevProjectId: str(t.projectId) }); });
  console.log('Stray Bugle variants to rename:', fix.length);
  fix.forEach((f) => console.log('  ' + f.id + '  "' + f.prev + '" -> "' + CANON + '"'));
  if (!fix.length) { console.log('Nothing to do.'); process.exit(0); }
  const outDir = path.join(__dirname, '..', '_backup', 'bugletrail-rename-2026-06-09'); fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'BACKUP.json'), JSON.stringify(fix, null, 2));
  for (const f of fix) {
    await db.collection('timeEntries').doc(f.id).update({ project: CANON, projectId: '7225-bugletrail', updatedAt: '2026-06-09T00:00:00.000Z' });
  }
  console.log('Renamed ' + fix.length + ' entry(ies) to "' + CANON + '". Backup saved.');
  process.exit(0);
})().catch((e) => { console.error('ERROR', e.message || e); process.exit(1); });
