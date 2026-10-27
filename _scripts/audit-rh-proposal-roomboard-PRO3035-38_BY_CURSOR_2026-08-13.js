/**
 * READ-ONLY audit: PRO-3035 / 3037 / 3038 / 3025 product lines vs room-board clips.
 * Project: cloud-rolling-hills (production).
 * Does NOT write. Output: console + _debug JSON.
 *
 *   node _scripts/audit-rh-proposal-roomboard-PRO3035-38_BY_CURSOR_2026-08-13.js
 */
'use strict';
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

const PID = 'cloud-rolling-hills';
const TARGET_NUMS = ['3035', '3037', '3038', '3025'];
const db = admin.initializeApp({ credential: admin.credential.cert(require(KEY)) }, 'auditRhPropRb').firestore();

const str = (v) => String(v == null ? '' : v).trim();
const NON_PRODUCT_ET = [
  'service', 'shipping', 'sales_tax', 'handling', 'expense', 'discount', 'labor',
  'other_expense', 'freight', 'installation', 'retainer_credit'
];

function isGroupHeader(it) {
  if (!it) return true;
  if (it._isGroupHeader === true || it.isGroupHeader === true || it.lineType === 'groupHeader') return true;
  const t = str(it.title || it.name);
  return !t && !str(it.vendor) && !(parseFloat(it.cost) || parseFloat(it.amount) || parseFloat(it.qty));
}

function isProductLine(it) {
  if (!it || isGroupHeader(it)) return false;
  const et = str(it.expenseType).toLowerCase();
  if (NON_PRODUCT_ET.indexOf(et) >= 0) return false;
  if (it._isService === true || it.itemType === 'service') return false;
  const kind = str(it.libraryItemKind || it.itemKind).toLowerCase();
  if (kind === 'service' || kind === 'expense' || kind === 'labor') return false;
  return true;
}

function tvKey(it) {
  return (str(it.title || it.name).toLowerCase() + '|' + str(it.vendor).toLowerCase());
}

function buildClipIndex(clips) {
  const byId = {};
  const byLibRoom = {};
  const byTVRoom = {};
  const byLib = {};
  const byTV = {};
  clips.forEach((c) => {
    byId[c.id] = c;
    const lib = str(c.libraryProductId || c.linkedLibraryProductId);
    const room = str(c.room).toLowerCase();
    const tv = tvKey(c);
    if (lib) {
      byLib[lib] = c.id;
      if (room) byLibRoom[lib + '|' + room] = c.id;
    }
    if (tv !== '|') {
      if (!byTV[tv]) byTV[tv] = [];
      byTV[tv].push({ id: c.id, room: str(c.room) });
      if (room) byTVRoom[tv + '|' + room] = c.id;
    }
  });
  return { byId, byLibRoom, byTVRoom, byLib, byTV };
}

function resolveClip(index, line, room) {
  const cid = str(line.clipId || line.sourceClipId);
  if (cid && index.byId[cid]) return { id: cid, how: 'line.clipId', clip: index.byId[cid] };
  if (cid && !index.byId[cid]) return { id: cid, how: 'line.clipId-MISSING', clip: null };
  const lib = str(line.libraryProductId || line.linkedLibraryProductId);
  const roomL = str(room).toLowerCase();
  if (lib && roomL && index.byLibRoom[lib + '|' + roomL]) {
    const id = index.byLibRoom[lib + '|' + roomL];
    return { id, how: 'lib+room', clip: index.byId[id] };
  }
  const tv = tvKey(line);
  if (tv !== '|' && roomL && index.byTVRoom[tv + '|' + roomL]) {
    const id = index.byTVRoom[tv + '|' + roomL];
    return { id, how: 'titleVendor+room', clip: index.byId[id] };
  }
  // unroomed match (exists but not on a room board section)
  if (lib && index.byLib[lib]) {
    const id = index.byLib[lib];
    const clip = index.byId[id];
    if (clip && !str(clip.room)) return { id, how: 'lib-unroomed', clip };
  }
  if (tv !== '|' && index.byTV[tv]) {
    const hit = index.byTV[tv].find((x) => !str(x.room));
    if (hit) return { id: hit.id, how: 'titleVendor-unroomed', clip: index.byId[hit.id] };
  }
  // any-room same product (wrong room = still a gap for THIS line's room)
  if (tv !== '|' && index.byTV[tv] && index.byTV[tv].length) {
    return {
      id: index.byTV[tv][0].id,
      how: 'titleVendor-otherRoom',
      clip: index.byId[index.byTV[tv][0].id],
      otherRooms: index.byTV[tv].map((x) => x.room || '(blank)')
    };
  }
  return { id: '', how: 'none', clip: null };
}

(async () => {
  const propSnap = await db.collection('boards').doc(PID).collection('proposals').get();
  const clipSnap = await db.collection('boards').doc(PID).collection('clips').get();
  const clips = clipSnap.docs.map((d) => Object.assign({ id: d.id }, d.data()));
  const index = buildClipIndex(clips);

  const report = {
    at: new Date().toISOString(),
    projectId: PID,
    clipCount: clips.length,
    proposals: []
  };

  for (const d of propSnap.docs) {
    const p = d.data() || {};
    const num = str(p.proposalNum || p.number || p.name || '');
    const hit = TARGET_NUMS.find((n) => num.indexOf(n) >= 0 || d.id.indexOf(n) >= 0);
    if (!hit) continue;

    const items = Array.isArray(p.items) ? p.items : [];
    const productLines = [];
    const gaps = [];
    const ok = [];
    const skipNoRoom = [];
    const skipNonProduct = [];
    const orphanClipId = [];

    items.forEach((it, i) => {
      if (!isProductLine(it)) {
        skipNonProduct.push({ i, title: str(it && it.title).slice(0, 60), expenseType: it && it.expenseType });
        return;
      }
      const room = str(it.room);
      const row = {
        i,
        title: str(it.title || it.name).slice(0, 80),
        vendor: str(it.vendor).slice(0, 40),
        room,
        libraryProductId: str(it.libraryProductId || it.linkedLibraryProductId),
        clipId: str(it.clipId || it.sourceClipId),
        category: str(it.category)
      };
      productLines.push(row);
      if (!room) {
        skipNoRoom.push(row);
        return;
      }
      const res = resolveClip(index, it, room);
      const entry = Object.assign({}, row, {
        matchHow: res.how,
        matchedClipId: res.id || '',
        matchedClipRoom: res.clip ? str(res.clip.room) : '',
        otherRooms: res.otherRooms || null
      });
      if (res.how === 'line.clipId-MISSING') {
        orphanClipId.push(entry);
        gaps.push(Object.assign({}, entry, { gap: 'clipId points to missing clip' }));
      } else if (res.how === 'none') {
        gaps.push(Object.assign({}, entry, { gap: 'no clip for product+room' }));
      } else if (res.how === 'lib-unroomed' || res.how === 'titleVendor-unroomed') {
        gaps.push(Object.assign({}, entry, { gap: 'clip exists but unroomed — not on room board tile' }));
      } else if (res.how === 'titleVendor-otherRoom') {
        gaps.push(Object.assign({}, entry, { gap: 'product on board in other room(s) only', otherRooms: res.otherRooms }));
      } else {
        ok.push(entry);
      }
    });

    const block = {
      docId: d.id,
      proposalNum: num,
      status: p.status || null,
      itemCount: items.length,
      productLineCount: productLines.length,
      onBoardOk: ok.length,
      gaps: gaps.length,
      noRoom: skipNoRoom.length,
      nonProduct: skipNonProduct.length,
      orphanClipId: orphanClipId.length,
      gapRows: gaps,
      noRoomRows: skipNoRoom,
      okSample: ok.slice(0, 5)
    };
    report.proposals.push(block);

    console.log('\n======== ' + num + ' (' + d.id + ') ========');
    console.log('items=' + items.length + ' products=' + productLines.length +
      ' ON_BOARD=' + ok.length + ' GAPS=' + gaps.length +
      ' noRoom=' + skipNoRoom.length + ' nonProduct=' + skipNonProduct.length);
    if (gaps.length) {
      console.log('--- GAPS (need room-board clip for this room) ---');
      gaps.forEach((g) => {
        console.log('  [' + g.i + '] ' + g.title + ' | room=' + g.room + ' | ' + g.gap +
          (g.otherRooms ? ' otherRooms=' + g.otherRooms.join(',') : '') +
          (g.clipId ? ' lineClip=' + g.clipId : '') +
          (g.libraryProductId ? ' lib=' + g.libraryProductId.slice(0, 40) : ''));
      });
    }
    if (skipNoRoom.length) {
      console.log('--- NO ROOM (cannot place on room board until room set) ---');
      skipNoRoom.forEach((g) => console.log('  [' + g.i + '] ' + g.title));
    }
  }

  const outDir = path.join(__dirname, '..', '_debug');
  const outPath = path.join(outDir, 'RH_PROPOSAL_ROOMBOARD_AUDIT_BY_CURSOR_2026-08-13.json');
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log('\nWrote ' + outPath);

  const totals = report.proposals.reduce((a, p) => {
    a.gaps += p.gaps;
    a.ok += p.onBoardOk;
    a.noRoom += p.noRoom;
    return a;
  }, { gaps: 0, ok: 0, noRoom: 0 });
  console.log('\nTOTAL across targets: ON_BOARD=' + totals.ok + ' GAPS=' + totals.gaps + ' NO_ROOM=' + totals.noRoom);
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
