#!/usr/bin/env node
'use strict';
/**
 * Rolling Hills: delete spec-junk room-board clips + clear catalog room so they cannot respawn.
 *   node _scripts/cleanup-rh-junk-clips_BY_CLAUDE_2026-06-02.js           # dry-run
 *   node _scripts/cleanup-rh-junk-clips_BY_CLAUDE_2026-06-02.js --apply
 */
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const KEY = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
admin.initializeApp({ credential: admin.credential.cert(require(KEY)) });
const db = admin.firestore();

const PID = 'cloud-rolling-hills';
const APPLY = process.argv.includes('--apply');
const JUNK_THRESHOLD = 25;
const BACKUP_DIR = path.join(__dirname, '..', '_backup', 'rh-junk-cleanup-2026-06-02');

function junkScore(title) {
  const t = String(title || '').trim();
  if (!t) return 0;
  let score = 0;
  if (/^(weight|wattage|total wattage|top to center|extension|height|width|depth|overall weight)/i.test(t)) score += 50;
  if (/weight\s*:/i.test(t)) score += 40;
  if (/wattage|watts\b/i.test(t) && t.length < 80) score += 35;
  if (/provide satisfying|contrast\./i.test(t)) score += 45;
  if (/speak for itself|perfectly together|fluted brass body/i.test(t)) score += 45;
  if (/\d+(\.\d+)?["″'′]?\s*[x×]\s*\d+/i.test(t) && t.length < 55) score += 40;
  if (t.length < 55 && /\.\.\.|…/.test(t)) score += 35;
  if (/top to center/i.test(t)) score += 40;
  if (/cm\)|in \(\d|\blbs\.?\s*$/i.test(t) && t.length < 70) score += 25;
  if (/takes \d+x|not included|socket type|plug in no/i.test(t)) score += 30;
  if (/cracked edge\.?$/i.test(t) || /^licorice$/i.test(t)) score += 35;
  if (/illuminating |vaudeville|become a go-to/i.test(t)) score += 40;
  if (t.length < 12 && /lbs|watt|inch|cm/i.test(t)) score += 20;
  if (t.length > 120 && !/\b(pendant|sconce|chandelier|mirror|sofa|chair|table|lamp|fixture|mount)\b/i.test(t)) score += 15;
  return score;
}

function isJunkClip(data) {
  const src = String(data.source || '').trim().toLowerCase();
  if (src === 'cch-studio-clipper' || src === 'clipper') return false;
  return junkScore(data.title) >= JUNK_THRESHOLD;
}

function isJunkCatalog(data) {
  return junkScore(data.title || data.name) >= JUNK_THRESHOLD;
}

async function clearCatalogRoomForClip(projectId, projName, clipData) {
  const ts = new Date().toISOString();
  const patch = { room: admin.firestore.FieldValue.delete(), updatedAt: ts, _junkRoomClearedAt: ts, _junkRoomClearedBy: 'cleanup-rh-junk-clips_BY_CLAUDE_2026-06-02' };
  const libId = String(clipData.libraryProductId || clipData.libraryId || '').trim();
  const clipId = String(clipData._clipId || '').trim();
  if (libId && libId !== clipId) {
    try { await db.collection('products').doc(libId).update(patch); } catch (_e1) {}
    try { await db.collection('productLibrary').doc(libId).update(patch); } catch (_e2) {}
  }
  const title = String(clipData.title || '').trim();
  const vendor = String(clipData.vendor || '').trim();
  const room = String(clipData.room || '').trim();
  if (!title || !room) return 0;
  const titleLow = title.toLowerCase();
  const vendorLow = vendor.toLowerCase();
  let n = 0;
  async function clearMatching(snap) {
    for (const d of snap.docs) {
      const p = d.data() || {};
      if (String(p.room || '').trim() !== room) continue;
      if (String(p.title || '').trim().toLowerCase() !== titleLow) continue;
      if (String(p.vendor || '').trim().toLowerCase() !== vendorLow) continue;
      try {
        await d.ref.update(patch);
        n++;
      } catch (_e) {}
    }
  }
  const q1 = await db.collection('products').where('projectId', '==', projectId).limit(500).get();
  await clearMatching(q1);
  if (projName) {
    const q2 = await db.collection('products').where('project', '==', projName).limit(500).get();
    await clearMatching(q2);
  }
  return n;
}

async function loadProjectProducts(projectId, projName) {
  const byId = new Map();
  const addDoc = (d) => {
    if (!byId.has(d.id)) byId.set(d.id, { id: d.id, ref: d.ref, data: d.data() || {} });
  };
  let snap = await db.collection('products').where('projectId', '==', projectId).limit(500).get();
  snap.forEach(addDoc);
  if (projName) {
    snap = await db.collection('products').where('project', '==', projName).limit(500).get();
    snap.forEach(addDoc);
  }
  snap = await db.collection('productLibrary').where('projectId', '==', projectId).limit(500).get();
  snap.forEach(addDoc);
  if (projName) {
    snap = await db.collection('productLibrary').where('project', '==', projName).limit(500).get();
    snap.forEach(addDoc);
  }
  return [...byId.values()];
}

(async () => {
  const boardSnap = await db.collection('boards').doc(PID).get();
  const projName = boardSnap.exists ? String((boardSnap.data() || {}).name || '').trim() : '';

  const clipSnap = await db.collection('boards').doc(PID).collection('clips').get();
  const toDelete = [];
  clipSnap.forEach((d) => {
    const data = d.data() || {};
    if (!isJunkClip(data)) return;
    toDelete.push({ id: d.id, ref: d.ref, data });
  });

  const catalogRows = await loadProjectProducts(PID, projName);
  const catalogClear = catalogRows.filter((r) => {
    const room = String(r.data.room || '').trim();
    return room && isJunkCatalog(r.data);
  });

  const report = {
    generatedAt: new Date().toISOString(),
    projectId: PID,
    projectName: projName,
    mode: APPLY ? 'apply' : 'dry-run',
    clipsBefore: clipSnap.size,
    clipsToDelete: toDelete.map((c) => ({
      id: c.id,
      title: c.data.title,
      source: c.data.source,
      room: c.data.room,
      score: junkScore(c.data.title),
    })),
    catalogRoomClear: catalogClear.map((r) => ({
      id: r.id,
      collection: r.ref.parent.id,
      title: r.data.title,
      room: r.data.room,
      score: junkScore(r.data.title),
    })),
  };

  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const reportPath = path.join(BACKUP_DIR, APPLY ? 'apply-report.json' : 'dry-run-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log(APPLY ? '=== APPLY ===' : '=== DRY RUN ===');
  console.log('Clips before:', clipSnap.size);
  console.log('Junk clips to delete (score>=' + JUNK_THRESHOLD + ', not clipper):', toDelete.length);
  console.log('Catalog rows to clear room (junk title + room set):', catalogClear.length);
  console.log('Report:', reportPath);

  if (!APPLY) {
    console.log('\nRun with --apply to execute. Sample deletes:');
    toDelete.slice(0, 8).forEach((c, i) => console.log(' ', i + 1, c.id, '|', String(c.data.title).slice(0, 55)));
    return;
  }

  let deleted = 0;
  let catalogCleared = 0;
  for (const c of toDelete) {
    const payload = Object.assign({}, c.data, { _clipId: c.id });
    await clearCatalogRoomForClip(PID, projName, payload);
    await c.ref.delete();
    deleted++;
    if (deleted % 10 === 0) console.log('  deleted clips', deleted, '/', toDelete.length);
  }

  const ts = new Date().toISOString();
  const patch = {
    room: admin.firestore.FieldValue.delete(),
    updatedAt: ts,
    _junkRoomClearedAt: ts,
    _junkRoomClearedBy: 'cleanup-rh-junk-clips_BY_CLAUDE_2026-06-02',
  };
  for (const r of catalogClear) {
    try {
      await r.ref.update(patch);
      catalogCleared++;
    } catch (e) {
      console.warn('catalog clear failed', r.id, e.message);
    }
  }

  const after = await db.collection('boards').doc(PID).collection('clips').get();
  console.log('\nDone.');
  console.log('Clips deleted:', deleted);
  console.log('Catalog room fields cleared:', catalogCleared);
  console.log('Clips after:', after.size);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
