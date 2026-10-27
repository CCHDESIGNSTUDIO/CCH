'use strict';
/**
 * WO-045 prod: dry-run / apply for cloud-rolling-hills (Rolling Hills).
 * Mirrors cchEnsureClipsFromDocLines + cchDryRunDocLineClipSync (proposals + invoices).
 * Includes WO-058 suppressions + _roomUnassignedFrom fill-blank guard.
 *
 * Usage:
 *   node _scripts/apply-wo045-cloud-rh-PROD_BY_CURSOR_2026-07-27.js
 *   node _scripts/apply-wo045-cloud-rh-PROD_BY_CURSOR_2026-07-27.js --apply
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
const db = admin.initializeApp({ credential: admin.credential.cert(require(KEY)) }, 'wo045prod').firestore();
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
function clipLocked(clip) {
  clip = clip || {};
  if (clip._docLinkedAt || clip._frozenOnDocAt) return true;
  if (str(clip.invoiceNum || clip.houzzInvoice || clip.proposalNum || clip.poNum
    || clip.invoiceId || clip.proposalId || clip.poId)) return true;
  return false;
}

async function loadSuppressions() {
  const map = Object.create(null);
  const snap = await db.collection('boards').doc(PID).collection('clipSuppressions').limit(2000).get();
  snap.forEach((d) => {
    const data = d.data() || {};
    const k = str(data.key || d.id);
    if (k) map[k] = true;
  });
  return map;
}

async function buildIndex() {
  const byLib = Object.create(null);
  const byLibRoom = Object.create(null);
  const byTV = Object.create(null);
  const byLibUnroomed = Object.create(null);
  const byTVUnroomed = Object.create(null);
  const snap = await db.collection('boards').doc(PID).collection('clips').get();
  snap.forEach((d) => {
    const c = d.data() || {};
    if (doNotReuse(c)) return;
    const lib = str(c.libraryProductId || c.libraryId);
    let rm = sanitizeRoom(c.room, c.category);
    if (lib) {
      byLib[lib] = d.id;
      if (rm) byLibRoom[lib + '|' + rm.toLowerCase()] = d.id;
      else byLibUnroomed[lib] = d.id;
    }
    const tv = str(c.title).toLowerCase() + '|' + str(c.vendor).toLowerCase();
    if (tv === '|') return;
    if (!byTV[tv]) byTV[tv] = [];
    byTV[tv].push({ id: d.id, room: rm });
    if (!rm) {
      if (!byTVUnroomed[tv]) byTVUnroomed[tv] = [];
      byTVUnroomed[tv].push(d.id);
    }
  });
  return { byLib, byLibRoom, byTV, byLibUnroomed, byTVUnroomed, clipCount: snap.size };
}

function resolveRoomed(index, line, room) {
  const lib = str(line.libraryProductId || line.linkedLibraryProductId);
  if (lib && room && index.byLibRoom[lib + '|' + room.toLowerCase()]) {
    return index.byLibRoom[lib + '|' + room.toLowerCase()];
  }
  const tv = str(line.title || line.name).toLowerCase() + '|' + str(line.vendor).toLowerCase();
  const matches = index.byTV[tv] || [];
  const tr = room.toLowerCase();
  for (let i = 0; i < matches.length; i++) {
    if (str(matches[i].room).toLowerCase() === tr) return matches[i].id;
  }
  return '';
}

function findUnroomed(index, line) {
  const lib = str(line.libraryProductId || line.linkedLibraryProductId);
  if (lib && index.byLibUnroomed[lib]) return index.byLibUnroomed[lib];
  const tv = str(line.title || line.name).toLowerCase() + '|' + str(line.vendor).toLowerCase();
  if (tv !== '|' && index.byTVUnroomed[tv] && index.byTVUnroomed[tv].length) {
    return index.byTVUnroomed[tv][0];
  }
  return '';
}

function remember(index, clipId, line, room) {
  const lib = str(line.libraryProductId || line.linkedLibraryProductId);
  if (lib) {
    index.byLib[lib] = clipId;
    if (room) index.byLibRoom[lib + '|' + room.toLowerCase()] = clipId;
    if (index.byLibUnroomed[lib] === clipId) delete index.byLibUnroomed[lib];
  }
  const tv = str(line.title || line.name).toLowerCase() + '|' + str(line.vendor).toLowerCase();
  if (tv !== '|') {
    if (!index.byTV[tv]) index.byTV[tv] = [];
    index.byTV[tv].push({ id: clipId, room: room });
    if (index.byTVUnroomed[tv]) {
      index.byTVUnroomed[tv] = index.byTVUnroomed[tv].filter((id) => id !== clipId);
    }
  }
}

async function ensureDoc(index, suppressSet, items, meta, dryRun) {
  const out = {
    collection: meta.collection,
    docId: meta.docId,
    num: meta.num,
    created: [],
    filledBlankRoom: [],
    alreadyMatched: [],
    linkedExisting: [],
    skippedNoRoom: [],
    skippedNonProduct: [],
    skippedGuard: [],
    skippedSuppressed: [],
    errors: []
  };
  let lineClipDirty = false;
  const ts = new Date().toISOString();

  for (let i = 0; i < items.length; i++) {
    const line = items[i];
    if (!line) continue;
    const title = str(line.title || line.name);
    if (!eligible(line)) {
      out.skippedNonProduct.push({ i, title });
      continue;
    }
    let room = sanitizeRoom(line.room, line.category);
    if (room && knownCat(room)) room = '';
    if (!room) {
      out.skippedNoRoom.push({ i, title, vendor: str(line.vendor) });
      continue;
    }

    const libId = str(line.libraryProductId || line.linkedLibraryProductId);
    const supKey = suppressionKey(libId, title, line.vendor || '', room);
    if (supKey && suppressSet[supKey]) {
      out.skippedSuppressed.push({ i, title, room, key: supKey, reason: 'clip-suppression' });
      continue;
    }

    const existingRoomed = resolveRoomed(index, line, room);
    if (existingRoomed) {
      if (str(line.clipId) === existingRoomed) {
        out.alreadyMatched.push({ i, title, room, clipId: existingRoomed });
      } else {
        line.clipId = existingRoomed;
        lineClipDirty = true;
        out.linkedExisting.push({ i, title, room, clipId: existingRoomed });
      }
      continue;
    }

    const unroomedId = findUnroomed(index, line);
    if (unroomedId) {
      const fillRow = { i, title, room, clipId: unroomedId, action: 'fill-blank-room' };
      try {
        const clipRef = db.collection('boards').doc(PID).collection('clips').doc(unroomedId);
        const snapPre = await clipRef.get();
        if (!snapPre.exists) {
          out.errors.push({ i, title, error: 'unroomed-clip-missing' });
          continue;
        }
        const clipDataPre = snapPre.data() || {};
        const clearedFrom = str(clipDataPre._roomUnassignedFrom);
        if (clearedFrom) {
          out.skippedSuppressed.push({ i, title, room, clipId: unroomedId, reason: 'user-cleared-room', clearedFrom });
          continue;
        }
        if (supKey && suppressSet[supKey]) {
          out.skippedSuppressed.push({ i, title, room, clipId: unroomedId, reason: 'clip-suppression' });
          continue;
        }
        if (dryRun) {
          out.filledBlankRoom.push(fillRow);
          remember(index, unroomedId, line, room);
          continue;
        }
        if (clipLocked(clipDataPre)) {
          // Locked blank clip can't be re-roomed — fall through and create a new room tile
          out.skippedGuard.push({ i, title, reason: 'clip-locked-on-doc-fallback-create', clipId: unroomedId });
        } else {
          const existingRoom = str(clipDataPre.room);
          if (existingRoom) {
            if (existingRoom.toLowerCase() === room.toLowerCase()) {
              line.clipId = unroomedId;
              lineClipDirty = true;
              out.linkedExisting.push({ i, title, room, clipId: unroomedId });
              continue;
            }
            // Index said unroomed but clip now has a different room — create for this room
            out.skippedGuard.push({ i, title, reason: 'unroomed-now-has-room-fallback-create', clipId: unroomedId });
          } else {
            await clipRef.update({
              room: room,
              updatedAt: ts,
              _roomFilledFromDocAt: ts,
              _roomUnassignedFrom: admin.firestore.FieldValue.delete(),
              _roomUnassignedAt: admin.firestore.FieldValue.delete()
            });
            line.clipId = unroomedId;
            lineClipDirty = true;
            remember(index, unroomedId, line, room);
            out.filledBlankRoom.push(fillRow);
            continue;
          }
        }
      } catch (eFill) {
        out.errors.push({ i, title, error: (eFill && eFill.message) || String(eFill) });
        continue;
      }
    }

    const qty = parseFloat(line.qty) || 1;
    const cost = parseFloat(line.cost || line.unitCost || line.costPrice) || 0;
    const sell = parseFloat(line.clientPrice || line.sellPrice || line.amount) || 0;
    const img = str(line.imageUrl || line.image);
    const newClip = {
      title: title,
      description: line.description || '',
      vendor: line.vendor || '',
      room: room,
      category: str(line.category) || 'General',
      cost: cost,
      clientPrice: qty > 0 && sell > 0 ? (sell / qty) : sell,
      qty: qty,
      imageUrl: img,
      sku: line.sku || '',
      source: libId ? 'library' : 'proposal',
      libraryProductId: libId || null,
      libraryProductIdLocked: !!libId,
      addedAt: ts,
      updatedAt: ts,
      _createdFromDocAt: ts,
      _createdFromCollection: meta.collection || '',
      _createdFromDocId: meta.docId || ''
    };
    const createRow = {
      i, title, room, vendor: str(line.vendor), libraryProductId: libId || null, action: 'create'
    };
    if (dryRun) {
      const phantomId = '_dry_' + meta.docId.slice(0, 6) + '_' + i + '_' + room.toLowerCase().replace(/\s+/g, '-');
      createRow.clipId = phantomId;
      remember(index, phantomId, line, room);
      out.created.push(createRow);
      continue;
    }
    try {
      const ref = await db.collection('boards').doc(PID).collection('clips').add(newClip);
      line.clipId = ref.id;
      lineClipDirty = true;
      remember(index, ref.id, line, room);
      createRow.clipId = ref.id;
      out.created.push(createRow);
    } catch (eAdd) {
      out.errors.push({ i, title, error: (eAdd && eAdd.message) || String(eAdd) });
    }
  }

  if (!dryRun && lineClipDirty) {
    try {
      await db.collection('boards').doc(PID).collection(meta.collection).doc(meta.docId).update({
        items: items,
        updatedAt: ts
      });
    } catch (ePers) {
      out.errors.push({ error: 'persist-line-clipIds: ' + ((ePers && ePers.message) || String(ePers)) });
    }
  }

  return out;
}

function summarize(res) {
  return {
    wouldCreate: (res.created || []).length,
    wouldFillBlank: (res.filledBlankRoom || []).length,
    alreadyMatched: (res.alreadyMatched || []).length,
    linkedExisting: (res.linkedExisting || []).length,
    skippedNoRoom: (res.skippedNoRoom || []).length,
    skippedNonProduct: (res.skippedNonProduct || []).length,
    skippedGuard: (res.skippedGuard || []).length,
    skippedSuppressed: (res.skippedSuppressed || []).length,
    errors: (res.errors || []).length
  };
}

async function runPass(dryRun) {
  const suppressSet = await loadSuppressions();
  const report = { projectId: PID, dryRun: dryRun, docs: [], totals: {}, suppressionsLoaded: Object.keys(suppressSet).length };
  const colls = ['proposals', 'invoices'];
  let clipCountStart = 0;

  for (const coll of colls) {
    const snap = await db.collection('boards').doc(PID).collection(coll).get();
    for (const d of snap.docs) {
      const data = d.data() || {};
      const items = (data.items || []).slice();
      if (!items.length) continue;
      // Rebuild index per doc (matches browser cchDryRunDocLineClipSync)
      const index = await buildIndex();
      if (!clipCountStart) clipCountStart = index.clipCount;
      const num = str(data.proposalNum || data.invoiceNum || data.num || d.id);
      const res = await ensureDoc(index, suppressSet, items, { collection: coll, docId: d.id, num }, dryRun);
      const summary = summarize(res);
      report.docs.push({
        collection: coll,
        docId: d.id,
        num,
        summary,
        sample: {
          created: res.created.slice(0, 5),
          filledBlankRoom: res.filledBlankRoom.slice(0, 5),
          skippedSuppressed: res.skippedSuppressed.slice(0, 5),
          errors: res.errors.slice(0, 5)
        }
      });
    }
  }

  const t = {
    wouldCreate: 0, wouldFillBlank: 0, alreadyMatched: 0, linkedExisting: 0,
    skippedNoRoom: 0, skippedNonProduct: 0, skippedGuard: 0, skippedSuppressed: 0, errors: 0
  };
  report.docs.forEach((row) => {
    const s = row.summary || {};
    Object.keys(t).forEach((k) => { t[k] += s[k] || 0; });
  });
  report.totals = t;
  const clipsEnd = (await buildIndex()).clipCount;
  report.clipCountStart = clipCountStart;
  report.clipCountEnd = clipsEnd;
  return report;
}

(async () => {
  console.log('WO-045', APPLY ? 'APPLY' : 'DRY-RUN', '· PROD ·', PID);
  console.log('Mode:', APPLY ? 'WRITES ON' : 'ZERO writes');

  const dry = await runPass(true);
  console.log('\n========== DRY-RUN TOTALS ==========');
  console.log(JSON.stringify(dry.totals, null, 2));
  console.log('clips now:', dry.clipCountEnd, '| suppressions:', dry.suppressionsLoaded);
  console.log('\nTop docs by wouldCreate:');
  dry.docs
    .slice()
    .sort((a, b) => (b.summary.wouldCreate + b.summary.wouldFillBlank) - (a.summary.wouldCreate + a.summary.wouldFillBlank))
    .slice(0, 15)
    .forEach((d) => {
      console.log(
        d.collection, d.num,
        'create=' + d.summary.wouldCreate,
        'fill=' + d.summary.wouldFillBlank,
        'matched=' + d.summary.alreadyMatched,
        'link=' + d.summary.linkedExisting,
        'suppressed=' + d.summary.skippedSuppressed,
        'noRoom=' + d.summary.skippedNoRoom,
        'err=' + d.summary.errors
      );
    });

  const outDry = path.join(__dirname, '..', '_backups', 'WO045_DRYRUN_cloud-rolling-hills_PROD_BY_CURSOR_2026-07-27.json');
  fs.mkdirSync(path.dirname(outDry), { recursive: true });
  fs.writeFileSync(outDry, JSON.stringify(dry, null, 2));
  console.log('\nDry-run report:', outDry);

  if (!APPLY) {
    console.log('\nRe-run with --apply to write (Cindy GO required).');
    process.exit(0);
  }

  if (dry.totals.errors > 0) {
    console.error('Aborting apply: dry-run has errors.');
    process.exit(2);
  }

  console.log('\n========== APPLYING ==========');
  const applied = await runPass(false);
  console.log(JSON.stringify(applied.totals, null, 2));
  console.log('clips:', applied.clipCountStart, '->', applied.clipCountEnd);

  const outApply = path.join(__dirname, '..', '_backups', 'WO045_APPLY_cloud-rolling-hills_PROD_BY_CURSOR_2026-07-27.json');
  fs.writeFileSync(outApply, JSON.stringify(applied, null, 2));
  console.log('Apply report:', outApply);

  console.log('\n========== RE-DRY-RUN ==========');
  const after = await runPass(true);
  console.log(JSON.stringify(after.totals, null, 2));
  console.log('clips after:', after.clipCountEnd);

  process.exit(after.totals.errors > 0 ? 3 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
