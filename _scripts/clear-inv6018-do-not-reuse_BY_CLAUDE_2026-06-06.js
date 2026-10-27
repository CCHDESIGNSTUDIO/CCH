#!/usr/bin/env node
'use strict';
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const KEY = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
admin.initializeApp({ credential: admin.credential.cert(require(KEY)) });
const db = admin.firestore();

const PID = 'cloud-rolling-hills';
const APPLY = process.argv.includes('--apply');

const CLEAR_FIELDS = {
  _doNotReuse: admin.firestore.FieldValue.delete(),
  _doNotReuseAt: admin.firestore.FieldValue.delete(),
  _doNotReuseReason: admin.firestore.FieldValue.delete(),
  _doNotReuseSource: admin.firestore.FieldValue.delete(),
};

function str(v) { return String(v == null ? '' : v).trim(); }

(async () => {
  const clipSnap = await db.collection('boards').doc(PID).collection('clips').get();
  const toClear = [];

  clipSnap.forEach((d) => {
    const c = d.data() || {};
    if (c._doNotReuse !== true) return;
    toClear.push({
      clipId: d.id,
      title: str(c.title).slice(0, 60),
      room: str(c.room),
      libraryProductId: str(c.libraryProductId || c.linkedLibraryProductId),
      source: str(c._doNotReuseSource),
    });
  });

  console.log('Clips with _doNotReuse on', PID + ':', toClear.length);
  toClear.forEach((r) => console.log(' ', r.room, '|', r.title, '|', r.clipId));

  const libIds = [...new Set(toClear.map((r) => r.libraryProductId).filter(Boolean))];
  console.log('Linked library ids:', libIds.length);

  if (!APPLY) {
    console.log('\nDry-run only. Run with --apply to clear flags.');
    process.exit(0);
  }

  const ts = new Date().toISOString();
  const backupDir = path.join(__dirname, '..', '_backup', 'clear-do-not-reuse-' + ts.slice(0, 10));
  fs.mkdirSync(backupDir, { recursive: true });

  for (const row of toClear) {
    const ref = db.collection('boards').doc(PID).collection('clips').doc(row.clipId);
    const before = (await ref.get()).data() || {};
    await ref.update(CLEAR_FIELDS);
    row.clearedAt = ts;
    row.before = {
      _doNotReuse: before._doNotReuse,
      _doNotReuseSource: before._doNotReuseSource,
      _doNotReuseReason: before._doNotReuseReason,
    };
  }

  const libCleared = [];
  for (const libId of libIds) {
    for (const coll of ['products', 'productLibrary']) {
      const ref = db.collection(coll).doc(libId);
      const snap = await ref.get();
      if (!snap.exists || snap.data()._doNotReuse !== true) continue;
      await ref.update(CLEAR_FIELDS);
      libCleared.push(coll + '/' + libId);
    }
  }

  const manifest = { projectId: PID, clearedClips: toClear, clearedLibrary: libCleared, appliedAt: ts };
  const manifestPath = path.join(backupDir, 'manifest-clear-do-not-reuse_BY_CLAUDE_2026-06-06.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log('\nCleared', toClear.length, 'clips,', libCleared.length, 'library rows.');
  console.log('Manifest:', manifestPath);
})().catch((e) => { console.error(e); process.exit(1); });
