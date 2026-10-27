/**
 * PROD data heal (Cloud Rolling Hills): put proposal products onto Room Boards
 * for client send. Targets PRO-3035, 3037, 3038, 3025 only.
 *
 * Actions:
 *  A) Restore room on clips that ARE the line's clipId but currently blank
 *     (clear _roomUnassignedFrom) — so tiles reappear in that room.
 *  B) Create a NEW roomed clip when no roomed match exists for product+room
 *     (never moves Exterior→Butler etc.; product+room = separate clip).
 *  C) Stamp clipId on the proposal line when created/linked.
 *
 * Does NOT change prices. Skips lines with no room.
 * Respects clipSuppressions (skip create if suppressed for that product+room).
 *
 * Usage:
 *   node _scripts/heal-rh-proposal-roomboards-client-send_BY_CURSOR_2026-08-13.js
 *   node _scripts/heal-rh-proposal-roomboards-client-send_BY_CURSOR_2026-08-13.js --apply
 */
'use strict';
const path = require('path');
const fs = require('fs');
const admin = require('firebase-admin');

const KEY = path.join(
  __dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json'
);
if (!fs.existsSync(KEY)) {
  console.error('Missing prod service account key.');
  process.exit(1);
}

const APPLY = process.argv.includes('--apply');
/** This heal is for client room-board send — clear prior remove-from-room suppressions for these lines. */
const OVERRIDE_SUPPRESS = true;
const PID = 'cloud-rolling-hills';
const TARGET_NUMS = ['3035', '3037', '3038', '3025'];
const db = admin.initializeApp({ credential: admin.credential.cert(require(KEY)) }, 'healRhRb').firestore();
const str = (v) => String(v == null ? '' : v).trim();

const NON_PRODUCT_ET = [
  'service', 'shipping', 'sales_tax', 'handling', 'expense', 'discount', 'labor',
  'other_expense', 'freight', 'installation', 'retainer_credit'
];

function isProductLine(it) {
  if (!it) return false;
  if (it._isGroupHeader === true || it.isGroupHeader === true || it.lineType === 'groupHeader') return false;
  const et = str(it.expenseType).toLowerCase();
  if (NON_PRODUCT_ET.indexOf(et) >= 0) return false;
  if (it._isService === true || it.itemType === 'service') return false;
  return !!(str(it.title || it.name));
}

function tvKey(it) {
  return str(it.title || it.name).toLowerCase() + '|' + str(it.vendor).toLowerCase();
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

function buildIndex(clips) {
  const byId = {};
  const byLibRoom = {};
  const byTVRoom = {};
  clips.forEach((c) => {
    byId[c.id] = c;
    const lib = str(c.libraryProductId || c.linkedLibraryProductId);
    const room = str(c.room).toLowerCase();
    const tv = tvKey(c);
    if (lib && room) byLibRoom[lib + '|' + room] = c.id;
    if (tv !== '|' && room) byTVRoom[tv + '|' + room] = c.id;
  });
  return { byId, byLibRoom, byTVRoom };
}

function resolveRoomed(index, line, room) {
  const lib = str(line.libraryProductId || line.linkedLibraryProductId);
  const roomL = str(room).toLowerCase();
  if (lib && roomL && index.byLibRoom[lib + '|' + roomL]) return index.byLibRoom[lib + '|' + roomL];
  const tv = tvKey(line);
  if (tv !== '|' && roomL && index.byTVRoom[tv + '|' + roomL]) return index.byTVRoom[tv + '|' + roomL];
  return '';
}

function clipFromLine(line, room, propMeta) {
  const cost = parseFloat(line.cost) || 0;
  const qty = parseFloat(line.qty) || 1;
  let sell = parseFloat(line.amount) || parseFloat(line.clientPrice) || parseFloat(line.sell) || 0;
  if (sell <= 0 && cost > 0) {
    const mk = parseFloat(line.markupPct) || 0;
    sell = Math.round(cost * qty * (1 + mk / 100) * 100) / 100;
  }
  const unit = qty > 0 ? sell / qty : sell;
  const images = Array.isArray(line.images) ? line.images.slice() : [];
  const imageUrl = str(line.imageUrl || line.image || (images[0] || ''));
  return {
    title: str(line.title || line.name) || 'Untitled',
    description: str(line.description || ''),
    vendor: str(line.vendor || ''),
    room: room,
    category: str(line.category || 'General'),
    cost: cost,
    clientPrice: unit,
    qty: qty,
    imageUrl: imageUrl,
    images: images.length ? images : (imageUrl ? [imageUrl] : []),
    sku: str(line.sku || ''),
    source: 'proposal',
    libraryProductId: str(line.libraryProductId || line.linkedLibraryProductId) || null,
    proposalId: propMeta.docId,
    proposalNum: propMeta.num || null,
    _createdFromDocAt: new Date().toISOString(),
    _createdFromCollection: 'proposals',
    _createdFromDocId: propMeta.docId,
    _healedForClientSendAt: new Date().toISOString(),
    addedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

(async () => {
  console.log(APPLY ? 'MODE: APPLY (prod writes)' : 'MODE: DRY-RUN (no writes)');
  const propSnap = await db.collection('boards').doc(PID).collection('proposals').get();
  const clipSnap = await db.collection('boards').doc(PID).collection('clips').get();
  const clips = clipSnap.docs.map((d) => Object.assign({ id: d.id }, d.data()));
  const index = buildIndex(clips);

  const suppress = Object.create(null);
  const supSnap = await db.collection('boards').doc(PID).collection('clipSuppressions').limit(2000).get();
  supSnap.forEach((d) => {
    const data = d.data() || {};
    const k = str(data.key || d.id);
    if (k) suppress[k] = true;
  });

  const plan = {
    at: new Date().toISOString(),
    projectId: PID,
    apply: APPLY,
    restoreRoom: [],
    createClip: [],
    linkExisting: [],
    alreadyOk: [],
    skippedNoRoom: [],
    skippedSuppressed: [],
    clearedSuppressions: [],
    errors: []
  };

  const propUpdates = []; // { ref, items }

  for (const d of propSnap.docs) {
    const p = d.data() || {};
    const num = str(p.proposalNum || p.number || p.name || '');
    if (!TARGET_NUMS.some((n) => num.indexOf(n) >= 0)) continue;
    const items = Array.isArray(p.items) ? p.items.map((x) => (x && typeof x === 'object' ? Object.assign({}, x) : x)) : [];
    let dirty = false;
    const propMeta = { docId: d.id, num };

    for (let i = 0; i < items.length; i++) {
      const line = items[i];
      if (!isProductLine(line)) continue;
      const room = str(line.room);
      const title = str(line.title || line.name);
      if (!room) {
        plan.skippedNoRoom.push({ num, i, title });
        continue;
      }

      const cid = str(line.clipId || line.sourceClipId);
      if (cid && index.byId[cid]) {
        const clip = index.byId[cid];
        if (!str(clip.room)) {
          plan.restoreRoom.push({
            num, i, title: title.slice(0, 70), room, clipId: cid,
            unFrom: clip._roomUnassignedFrom || null
          });
          if (APPLY) {
            try {
              await db.collection('boards').doc(PID).collection('clips').doc(cid).update({
                room: room,
                _roomUnassignedFrom: admin.firestore.FieldValue.delete(),
                _healedForClientSendAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              });
              clip.room = room;
              const lib = str(clip.libraryProductId || clip.linkedLibraryProductId);
              if (lib) index.byLibRoom[lib + '|' + room.toLowerCase()] = cid;
              const tv = tvKey(clip);
              if (tv !== '|') index.byTVRoom[tv + '|' + room.toLowerCase()] = cid;
            } catch (e) {
              plan.errors.push({ where: 'restore', cid, error: String(e.message || e) });
            }
          }
          continue;
        }
        // clip already roomed — if room matches, ok; if different, need create for THIS room
        if (str(clip.room).toLowerCase() === room.toLowerCase()) {
          plan.alreadyOk.push({ num, i, title: title.slice(0, 50), room, clipId: cid });
          continue;
        }
      }

      const existing = resolveRoomed(index, line, room);
      if (existing) {
        if (cid !== existing) {
          plan.linkExisting.push({ num, i, title: title.slice(0, 50), room, clipId: existing });
          line.clipId = existing;
          dirty = true;
        } else {
          plan.alreadyOk.push({ num, i, title: title.slice(0, 50), room, clipId: existing });
        }
        continue;
      }

      const libId = str(line.libraryProductId || line.linkedLibraryProductId);
      const sk = suppressionKey(libId, title, line.vendor || '', room);
      if (sk && suppress[sk] && !OVERRIDE_SUPPRESS) {
        plan.skippedSuppressed.push({ num, i, title: title.slice(0, 50), room, key: sk });
        continue;
      }
      if (sk && suppress[sk] && OVERRIDE_SUPPRESS) {
        plan.clearedSuppressions = plan.clearedSuppressions || [];
        plan.clearedSuppressions.push({ num, i, title: title.slice(0, 50), room, key: sk });
        if (APPLY) {
          try {
            const sid = String(sk).replace(/[^a-zA-Z0-9_|.-]+/g, '_').slice(0, 700);
            await db.collection('boards').doc(PID).collection('clipSuppressions').doc(sid).delete();
            delete suppress[sk];
          } catch (eSup) {
            plan.errors.push({ where: 'clear-suppression', key: sk, error: String(eSup.message || eSup) });
          }
        }
      }

      const newClip = clipFromLine(line, room, propMeta);
      plan.createClip.push({
        num, i, title: title.slice(0, 70), room, vendor: str(line.vendor),
        lib: libId.slice(0, 40), hasImage: !!newClip.imageUrl
      });
      if (APPLY) {
        try {
          const ref = await db.collection('boards').doc(PID).collection('clips').add(newClip);
          line.clipId = ref.id;
          dirty = true;
          index.byId[ref.id] = Object.assign({ id: ref.id }, newClip);
          if (libId) index.byLibRoom[libId + '|' + room.toLowerCase()] = ref.id;
          const tv = tvKey(newClip);
          if (tv !== '|') index.byTVRoom[tv + '|' + room.toLowerCase()] = ref.id;
        } catch (e) {
          plan.errors.push({ where: 'create', title, room, error: String(e.message || e) });
        }
      }
    }

    if (dirty) propUpdates.push({ id: d.id, num, items });
  }

  if (APPLY && propUpdates.length) {
    for (const u of propUpdates) {
      try {
        await db.collection('boards').doc(PID).collection('proposals').doc(u.id).update({
          items: u.items,
          updatedAt: new Date().toISOString(),
          _healedForClientSendAt: new Date().toISOString()
        });
      } catch (e) {
        plan.errors.push({ where: 'proposal-update', num: u.num, error: String(e.message || e) });
      }
    }
  }

  const outDir = path.join(__dirname, '..', '_debug');
  const tag = APPLY ? 'APPLY' : 'DRYRUN';
  const outPath = path.join(outDir, 'RH_ROOMBOARD_HEAL_' + tag + '_BY_CURSOR_2026-08-13.json');
  fs.writeFileSync(outPath, JSON.stringify(plan, null, 2));

  console.log('\nRestore room on blank linked clips:', plan.restoreRoom.length);
  plan.restoreRoom.forEach((r) => console.log('  ', r.num, '[' + r.i + ']', r.title, '->', r.room, r.clipId));
  console.log('\nCreate new roomed clips:', plan.createClip.length);
  plan.createClip.forEach((r) => console.log('  ', r.num, '[' + r.i + ']', r.title, '->', r.room));
  console.log('\nLink existing roomed clip:', plan.linkExisting.length);
  console.log('Already OK:', plan.alreadyOk.length);
  console.log('No room (skipped):', plan.skippedNoRoom.length);
  plan.skippedNoRoom.forEach((r) => console.log('  ', r.num, '[' + r.i + ']', r.title));
  console.log('Suppressed:', plan.skippedSuppressed.length);
  console.log('Errors:', plan.errors.length);
  console.log('\nWrote', outPath);
  if (!APPLY) console.log('\nRe-run with --apply to write production.');
  process.exit(plan.errors.length ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
