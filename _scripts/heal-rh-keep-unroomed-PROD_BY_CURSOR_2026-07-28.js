'use strict';
/**
 * Rolling Hills (cloud-rolling-hills) — keep Selections-only clips out of rooms.
 *
 * After Cindy cleared rooms on Room Boards, proposal/invoice lines may still
 * carry rooms. Doc-line ensure (WO-045) would fill blank clips or create
 * room tiles unless clipSuppressions + _roomUnassignedFrom are set (WO-058).
 *
 * This heal:
 *  1. Finds blank-room clips
 *  2. Collects rooms to suppress: clip._roomUnassignedFrom + matching doc-line rooms
 *  3. Writes clipSuppressions (merge)
 *  4. Stamps _roomUnassignedFrom when missing and exactly one room candidate
 *
 * Usage:
 *   node _scripts/heal-rh-keep-unroomed-PROD_BY_CURSOR_2026-07-28.js
 *   node _scripts/heal-rh-keep-unroomed-PROD_BY_CURSOR_2026-07-28.js --apply
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
  console.error('Missing prod service account key at expected path (not printed).');
  process.exit(1);
}

const APPLY = process.argv.includes('--apply');
const PID = 'cloud-rolling-hills';
const db = admin.initializeApp({ credential: admin.credential.cert(require(KEY)) }, 'healRhUnroom').firestore();
const str = (v) => String(v == null ? '' : v).trim();

const NON_PRODUCT_ET = [
  'service', 'shipping', 'sales_tax', 'handling', 'expense', 'discount', 'labor',
  'other_expense', 'freight', 'installation', 'retainer_credit'
];
const CAT_AS_ROOM = [
  'accessories', 'architectural', 'art', 'bedding & pillows', 'fabric & trim', 'lighting',
  'cabinet hardware', 'window hardware', 'appliances & plumbing', 'floor covering', 'wall covering',
  'stone & tile', 'custom window treatments', 'custom pillows & bedding', 'mirrors & accessories',
  'rugs', 'cabinets', 'windows', 'florals', 'wall', 'inventory', 'tv', 'furniture & upholstery'
];

function knownCat(s) {
  const tl = str(s).toLowerCase();
  return !!tl && CAT_AS_ROOM.indexOf(tl) >= 0;
}
function sanitizeRoom(room, category) {
  let r = str(room);
  if (!r) return '';
  if (knownCat(r)) return '';
  const cat = str(category);
  if (cat && r.toLowerCase() === cat.toLowerCase()) return '';
  return r;
}
function eligible(line) {
  if (!line) return false;
  if (line.isGroupHeader || line._groupHeader) return false;
  const et = str(line.expenseType || line.itemType).toLowerCase();
  if (et && NON_PRODUCT_ET.indexOf(et) >= 0) return false;
  const cat = str(line.category).toLowerCase();
  if (['time billing', 'time track', 'time tracking', 'service', 'services'].indexOf(cat) >= 0) return false;
  return !!str(line.title || line.name);
}
function doNotReuse(c) {
  return !!(c && (c._doNotReuse === true || c.doNotReuse === true));
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
function productKey(libId, title, vendor) {
  const lib = str(libId);
  if (lib) return 'lib:' + lib;
  const t = str(title).toLowerCase();
  const v = str(vendor).toLowerCase();
  if (!t) return '';
  return 'tv:' + t + '|' + v;
}

async function main() {
  console.log(APPLY ? 'APPLY mode' : 'DRY-RUN (pass --apply to write)');
  console.log('Project:', PID);

  const suppressSnap = await db.collection('boards').doc(PID).collection('clipSuppressions').limit(5000).get();
  const existingSup = Object.create(null);
  suppressSnap.forEach((d) => {
    const data = d.data() || {};
    const k = str(data.key || d.id);
    if (k) existingSup[k] = true;
  });

  const clipsSnap = await db.collection('boards').doc(PID).collection('clips').get();
  const blankClips = [];
  clipsSnap.forEach((d) => {
    const c = d.data() || {};
    if (doNotReuse(c)) return;
    if (sanitizeRoom(c.room, c.category)) return;
    blankClips.push({ id: d.id, data: c });
  });

  const roomsByProduct = Object.create(null);
  async function scanColl(coll) {
    const snap = await db.collection('boards').doc(PID).collection(coll).get();
    snap.forEach((doc) => {
      const items = (doc.data() || {}).items || [];
      items.forEach((line) => {
        if (!eligible(line)) return;
        const room = sanitizeRoom(line.room, line.category);
        if (!room) return;
        const pk = productKey(
          line.libraryProductId || line.linkedLibraryProductId,
          line.title || line.name,
          line.vendor
        );
        if (!pk) return;
        if (!roomsByProduct[pk]) roomsByProduct[pk] = Object.create(null);
        roomsByProduct[pk][room] = true;
      });
    });
    return snap.size;
  }
  const propCount = await scanColl('proposals');
  const invCount = await scanColl('invoices');

  const report = {
    mode: APPLY ? 'apply' : 'dry-run',
    projectId: PID,
    clipCount: clipsSnap.size,
    blankClipCount: blankClips.length,
    proposalDocs: propCount,
    invoiceDocs: invCount,
    existingSuppressions: suppressSnap.size,
    wouldWriteSuppressions: [],
    alreadySuppressed: [],
    wouldStampUnassigned: [],
    skippedNoRooms: []
  };

  const ts = new Date().toISOString();
  let batch = db.batch();
  let ops = 0;
  async function commitIfNeeded(force) {
    if (ops === 0) return;
    if (!force && ops < 400) return;
    if (APPLY) await batch.commit();
    batch = db.batch();
    ops = 0;
  }

  for (let i = 0; i < blankClips.length; i++) {
    const { id, data } = blankClips[i];
    const lib = str(data.libraryProductId || data.libraryId);
    const title = str(data.title);
    const vendor = str(data.vendor);
    // Match rooms from docs by lib OR title|vendor — proposal lines often lack libraryProductId
    // while clips have one, so lib-only lookup misses rooms that ensure still tries to fill.
    const pks = [];
    const pkLib = lib ? ('lib:' + lib) : '';
    const pkTv = title ? ('tv:' + title.toLowerCase() + '|' + vendor.toLowerCase()) : '';
    if (pkLib) pks.push(pkLib);
    if (pkTv) pks.push(pkTv);
    const roomSet = Object.create(null);
    const stamped = str(data._roomUnassignedFrom);
    if (stamped && !knownCat(stamped)) roomSet[stamped] = true;
    pks.forEach((pk) => {
      if (pk && roomsByProduct[pk]) {
        Object.keys(roomsByProduct[pk]).forEach((r) => { roomSet[r] = true; });
      }
    });
    const rooms = Object.keys(roomSet);
    if (!rooms.length) {
      report.skippedNoRooms.push({ clipId: id, title, note: 'blank clip, no stamp, no roomed doc line' });
      continue;
    }

    if (!stamped && rooms.length === 1) {
      report.wouldStampUnassigned.push({ clipId: id, title, room: rooms[0] });
      if (APPLY) {
        const ref = db.collection('boards').doc(PID).collection('clips').doc(id);
        batch.update(ref, {
          _roomUnassignedFrom: rooms[0],
          _roomUnassignedAt: ts,
          updatedAt: ts
        });
        ops++;
        await commitIfNeeded(false);
      }
    }

    for (let ri = 0; ri < rooms.length; ri++) {
      const room = rooms[ri];
      // Write lib-key AND title|vendor key so ensure matches lines with/without libraryProductId
      const keySpecs = [];
      if (lib) keySpecs.push({ key: suppressionKey(lib, title, vendor, room), libraryProductId: lib });
      keySpecs.push({ key: suppressionKey('', title, vendor, room), libraryProductId: null });
      for (let ki = 0; ki < keySpecs.length; ki++) {
        const key = keySpecs[ki].key;
        if (!key) continue;
        const row = { clipId: id, title, vendor, lib: keySpecs[ki].libraryProductId || '', room, key };
        if (existingSup[key]) {
          report.alreadySuppressed.push(row);
          continue;
        }
        report.wouldWriteSuppressions.push(row);
        existingSup[key] = true;
        if (APPLY) {
          const sid = suppressionDocId(key);
          const sref = db.collection('boards').doc(PID).collection('clipSuppressions').doc(sid);
          batch.set(sref, {
            key: key,
            libraryProductId: keySpecs[ki].libraryProductId,
            title: title,
            vendor: vendor,
            room: room,
            createdAt: ts,
            source: 'heal-rh-keep-unroomed-2026-07-28',
            clipId: id
          }, { merge: true });
          ops++;
          await commitIfNeeded(false);
        }
      }
    }
  }

  await commitIfNeeded(true);

  const outPath = path.join(
    __dirname,
    '..',
    'Docs',
    'HEAL_RH_KEEP_UNROOMED_' + (APPLY ? 'APPLY' : 'DRYRUN') + '_BY_CURSOR_2026-07-28.json'
  );
  const summary = {
    ...report,
    wouldWriteSuppressionsCount: report.wouldWriteSuppressions.length,
    alreadySuppressedCount: report.alreadySuppressed.length,
    wouldStampUnassignedCount: report.wouldStampUnassigned.length,
    skippedNoRoomsCount: report.skippedNoRooms.length,
    sampleWouldWrite: report.wouldWriteSuppressions.slice(0, 40),
    sampleStamp: report.wouldStampUnassigned.slice(0, 20)
  };
  // Trim full arrays for console; keep full in JSON
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(summary, null, 2));
  console.log('Wrote', outPath);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
