'use strict';
/**
 * RH: unassign orphan Houzz lighting from rooms (Selections only).
 * KEEP roomed: any clip linked to a Studio proposal / invoice / PO
 *   (by clipId or title|vendor match on a line).
 *
 * Usage:
 *   node _scripts/unassign-rh-orphan-houzz-lights-PROD_BY_CURSOR_2026-07-29.js
 *   node _scripts/unassign-rh-orphan-houzz-lights-PROD_BY_CURSOR_2026-07-29.js --apply
 */
const path = require('path');
const fs = require('fs');
const admin = require('firebase-admin');

const KEY = path.join(
  __dirname,
  '..',
  '_debug',
  'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json'
);
if (!fs.existsSync(KEY)) {
  console.error('Missing prod service account key.');
  process.exit(1);
}

const APPLY = process.argv.includes('--apply');
const PID = 'cloud-rolling-hills';
const db = admin.initializeApp({ credential: admin.credential.cert(require(KEY)) }, 'unassignOrphanLights').firestore();
const str = (v) => String(v == null ? '' : v).trim();

function isHouzzImport(c) {
  return str(c.source).toLowerCase() === 'houzz-import';
}
function isLighting(c) {
  const t = str(c.title).toLowerCase();
  const cat = str(c.category).toLowerCase();
  if (cat === 'lighting' || cat.indexOf('lighting') >= 0) return true;
  return /sconce|pendant|lantern|chandelier|flush|ceiling fan|\bfan\b|lamp|shade|picture light|wall light|salsify|semi.?flush|task sconce|stem pendant|articulating/.test(t);
}
function suppressionKey(libId, title, vendor, room) {
  const rm = str(room).toLowerCase();
  if (!rm) return '';
  const lib = str(libId);
  if (lib) return lib + '|' + rm;
  const t = str(title).toLowerCase();
  const v = str(vendor).toLowerCase();
  if (!t) return '';
  return t + '|' + v + '|' + rm;
}
function suppressionDocId(key) {
  return String(key || '').replace(/[^a-zA-Z0-9_|.-]+/g, '_').slice(0, 700);
}

async function loadDocProductIndex() {
  const byClip = Object.create(null);
  const byTV = Object.create(null);
  async function scan(coll) {
    const snap = await db.collection('boards').doc(PID).collection(coll).get();
    snap.forEach((doc) => {
      const items = (doc.data() || {}).items || [];
      items.forEach((line) => {
        const cid = str(line.clipId);
        if (cid) byClip[cid] = true;
        const tv = str(line.title || line.name).toLowerCase() + '|' + str(line.vendor).toLowerCase();
        if (tv !== '|') byTV[tv] = true;
        const lib = str(line.libraryProductId || line.linkedLibraryProductId);
        if (lib) byClip['lib:' + lib] = true; // reuse map for lib presence via prefix
      });
    });
    return snap.size;
  }
  const props = await scan('proposals');
  const invs = await scan('invoices');
  const pos = await scan('purchaseOrders');
  return { byClip, byTV, props, invs, pos };
}

function onStudioDoc(index, clipId, c) {
  if (index.byClip[clipId]) return true;
  const lib = str(c.libraryProductId || c.libraryId);
  // title|vendor match is the main orphan gate; also clipId
  const tv = str(c.title).toLowerCase() + '|' + str(c.vendor).toLowerCase();
  if (tv !== '|' && index.byTV[tv]) return true;
  return false;
}

async function main() {
  console.log(APPLY ? 'APPLY' : 'DRY-RUN', '·', PID);
  const index = await loadDocProductIndex();
  const clips = await db.collection('boards').doc(PID).collection('clips').get();

  const wouldUnassign = [];
  const keptOnDoc = [];
  const skippedNotLighting = [];
  const skippedBlank = [];

  clips.forEach((d) => {
    const c = d.data() || {};
    if (!isHouzzImport(c)) return;
    const room = str(c.room);
    if (!room) {
      skippedBlank.push(d.id);
      return;
    }
    if (!isLighting(c)) {
      skippedNotLighting.push({ id: d.id, title: str(c.title), room });
      return;
    }
    if (onStudioDoc(index, d.id, c)) {
      keptOnDoc.push({ id: d.id, title: str(c.title), room, vendor: str(c.vendor) });
      return;
    }
    wouldUnassign.push({
      id: d.id,
      title: str(c.title),
      vendor: str(c.vendor),
      room,
      lib: str(c.libraryProductId || c.libraryId),
      category: str(c.category)
    });
  });

  const report = {
    mode: APPLY ? 'apply' : 'dry-run',
    projectId: PID,
    docsScanned: { proposals: index.props, invoices: index.invs, purchaseOrders: index.pos },
    wouldUnassignCount: wouldUnassign.length,
    keptOnDocLightingHouzz: keptOnDoc.length,
    skippedNotLightingRoomedHouzz: skippedNotLighting.length,
    wouldUnassign,
    keptOnDoc
  };

  const outPath = path.join(
    __dirname,
    '..',
    'Docs',
    'UNASSIGN_RH_ORPHAN_HOUZZ_LIGHTS_' + (APPLY ? 'APPLY' : 'DRYRUN') + '_BY_CURSOR_2026-07-29.json'
  );
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({
    mode: report.mode,
    docsScanned: report.docsScanned,
    wouldUnassignCount: report.wouldUnassignCount,
    keptOnDocLightingHouzz: report.keptOnDocLightingHouzz,
    skippedNotLightingRoomedHouzz: report.skippedNotLightingRoomedHouzz,
    sampleUnassign: wouldUnassign.slice(0, 20),
    sampleKept: keptOnDoc.slice(0, 15)
  }, null, 2));
  console.log('Wrote', outPath);

  if (!APPLY) {
    console.log('\nRe-run with --apply to write.');
    return;
  }

  const ts = new Date().toISOString();
  let batch = db.batch();
  let ops = 0;
  async function flush(force) {
    if (ops === 0) return;
    if (!force && ops < 400) return;
    await batch.commit();
    batch = db.batch();
    ops = 0;
  }

  for (let i = 0; i < wouldUnassign.length; i++) {
    const row = wouldUnassign[i];
    const ref = db.collection('boards').doc(PID).collection('clips').doc(row.id);
    batch.update(ref, {
      room: '',
      updatedAt: ts,
      _roomUnassignedFrom: row.room,
      _roomUnassignedAt: ts
    });
    ops++;
    const key = suppressionKey(row.lib, row.title, row.vendor, row.room);
    if (key) {
      const sid = suppressionDocId(key);
      const sref = db.collection('boards').doc(PID).collection('clipSuppressions').doc(sid);
      batch.set(sref, {
        key,
        libraryProductId: row.lib || null,
        title: row.title,
        vendor: row.vendor,
        room: row.room,
        createdAt: ts,
        source: 'unassign-orphan-houzz-lights-2026-07-29',
        clipId: row.id
      }, { merge: true });
      // also title|vendor key when lib present
      if (row.lib) {
        const key2 = suppressionKey('', row.title, row.vendor, row.room);
        if (key2 && key2 !== key) {
          batch.set(
            db.collection('boards').doc(PID).collection('clipSuppressions').doc(suppressionDocId(key2)),
            {
              key: key2,
              libraryProductId: null,
              title: row.title,
              vendor: row.vendor,
              room: row.room,
              createdAt: ts,
              source: 'unassign-orphan-houzz-lights-2026-07-29',
              clipId: row.id
            },
            { merge: true }
          );
          ops++;
        }
      }
      ops++;
    }
    await flush(false);
  }
  await flush(true);
  console.log('Applied unassign + suppress for', wouldUnassign.length, 'orphan Houzz lights.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
