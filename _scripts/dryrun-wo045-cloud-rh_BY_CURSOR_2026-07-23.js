'use strict';
/**
 * WO-045 dry-run on STAGING for cloud-rolling-hills.
 * Mirrors cchEnsureClipsFromDocLines / cchDryRunDocLineClipSync (ZERO writes).
 */
const path = require('path');
const fs = require('fs');
const admin = require('firebase-admin');
const KEY = path.join(
  __dirname,
  '..',
  '_debug',
  'service-account.json',
  'cch-studio-staging-firebase-adminsdk-fbsvc-b93c6f1cf4.json'
);
const db = admin.initializeApp({ credential: admin.credential.cert(require(KEY)) }, 'wo045dry').firestore();
const PID = 'cloud-rolling-hills';
const str = (v) => String(v == null ? '' : v).trim();

const NON_PRODUCT_ET = [
  'service', 'shipping', 'sales_tax', 'handling', 'expense', 'discount', 'labor',
  'other_expense', 'freight', 'installation', 'retainer_credit'
];

function eligible(line) {
  if (!line) return false;
  if (line.isGroupHeader || line._groupHeader) return false;
  const et = str(line.expenseType || line.itemType).toLowerCase();
  if (et && NON_PRODUCT_ET.indexOf(et) >= 0) return false;
  const cat = str(line.category).toLowerCase();
  if (['time billing', 'time track', 'time tracking', 'service', 'services'].indexOf(cat) >= 0) return false;
  return !!str(line.title || line.name);
}

function buildIndex(snap) {
  const byLib = Object.create(null);
  const byLibRoom = Object.create(null);
  const byTV = Object.create(null);
  const byLibUnroomed = Object.create(null);
  const byTVUnroomed = Object.create(null);
  snap.forEach((d) => {
    const c = d.data() || {};
    if (c._doNotReuse === true) return;
    const lib = str(c.libraryProductId || c.libraryId);
    const rm = str(c.room);
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
  return { byLib, byLibRoom, byTV, byLibUnroomed, byTVUnroomed };
}

/** Match like ensure: omit line.clipId from key (product+room only). */
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

function ensureDry(index, items, meta) {
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
    errors: []
  };
  for (let i = 0; i < items.length; i++) {
    const line = items[i];
    const title = str(line.title || line.name);
    if (!eligible(line)) {
      out.skippedNonProduct.push({ i, title });
      continue;
    }
    const room = str(line.room);
    if (!room) {
      out.skippedNoRoom.push({ i, title, vendor: str(line.vendor) });
      continue;
    }
    const existingRoomed = resolveRoomed(index, line, room);
    if (existingRoomed) {
      if (str(line.clipId) === existingRoomed) {
        out.alreadyMatched.push({ i, title, room, clipId: existingRoomed });
      } else {
        out.linkedExisting.push({ i, title, room, clipId: existingRoomed, hadClipId: str(line.clipId) || null });
      }
      continue;
    }
    const unroomedId = findUnroomed(index, line);
    if (unroomedId) {
      out.filledBlankRoom.push({ i, title, room, clipId: unroomedId, action: 'fill-blank-room' });
      remember(index, unroomedId, line, room);
      continue;
    }
    const phantom = '_dry_' + meta.docId.slice(0, 6) + '_' + i + '_' + room.toLowerCase().replace(/\s+/g, '-');
    out.created.push({
      i,
      title,
      room,
      vendor: str(line.vendor),
      libraryProductId: str(line.libraryProductId) || null,
      action: 'create',
      clipId: phantom
    });
    remember(index, phantom, line, room);
  }
  return out;
}

(async () => {
  console.log('WO-045 DRY-RUN staging ·', PID, '· ZERO writes\n');
  const clipSnap = await db.collection('boards').doc(PID).collection('clips').get();
  console.log('clips on board:', clipSnap.size);

  const report = { projectId: PID, dryRun: true, docs: [], totals: {} };
  const colls = ['proposals', 'invoices', 'purchaseOrders'];
  // Shared index across docs (same as sequential project dry-run would mutate per-doc in browser;
  // browser rebuilds index per ensure call — we rebuild per doc to match cchDryRunDocLineClipSync).
  for (const coll of colls) {
    let snap;
    try {
      snap = await db.collection('boards').doc(PID).collection(coll).get();
    } catch (e) {
      console.log('skip coll', coll, e.message);
      continue;
    }
    for (const d of snap.docs) {
      const data = d.data() || {};
      const items = data.items || [];
      if (!items.length) continue;
      const index = buildIndex(clipSnap);
      const num = str(data.proposalNum || data.invoiceNum || data.poNum || data.number || data.name || d.id);
      const res = ensureDry(index, items, { collection: coll, docId: d.id, num });
      const summary = {
        wouldCreate: res.created.length,
        wouldFillBlank: res.filledBlankRoom.length,
        alreadyMatched: res.alreadyMatched.length,
        linkedExisting: res.linkedExisting.length,
        skippedNoRoom: res.skippedNoRoom.length,
        skippedNonProduct: res.skippedNonProduct.length
      };
      if (
        summary.wouldCreate ||
        summary.wouldFillBlank ||
        summary.linkedExisting ||
        summary.skippedNoRoom ||
        summary.alreadyMatched
      ) {
        report.docs.push({ collection: coll, docId: d.id, num, summary, sample: {
          created: res.created.slice(0, 8),
          filledBlankRoom: res.filledBlankRoom.slice(0, 8),
          skippedNoRoom: res.skippedNoRoom.slice(0, 8),
          linkedExisting: res.linkedExisting.slice(0, 5)
        } });
      }
    }
  }

  const t = {
    wouldCreate: 0,
    wouldFillBlank: 0,
    alreadyMatched: 0,
    linkedExisting: 0,
    skippedNoRoom: 0,
    skippedNonProduct: 0,
    docsTouched: report.docs.length
  };
  report.docs.forEach((row) => {
    const s = row.summary;
    t.wouldCreate += s.wouldCreate;
    t.wouldFillBlank += s.wouldFillBlank;
    t.alreadyMatched += s.alreadyMatched;
    t.linkedExisting += s.linkedExisting;
    t.skippedNoRoom += s.skippedNoRoom;
    t.skippedNonProduct += s.skippedNonProduct;
  });
  report.totals = t;

  // Highlight PRO-3008 Echo
  const pro3008 = report.docs.find((x) => x.num === 'PRO-3008' || /3008/.test(x.num));
  console.log('========== TOTALS (proposals + invoices + POs) ==========');
  console.log(JSON.stringify(t, null, 2));
  console.log('\n========== PRO-3008 (if present) ==========');
  console.log(pro3008 ? JSON.stringify(pro3008, null, 2) : '(not in report — no matching lines?)');

  console.log('\n========== Top docs by wouldCreate ==========');
  report.docs
    .slice()
    .sort((a, b) => b.summary.wouldCreate - a.summary.wouldCreate)
    .slice(0, 12)
    .forEach((d) => {
      console.log(
        d.collection,
        d.num,
        'create=' + d.summary.wouldCreate,
        'fill=' + d.summary.wouldFillBlank,
        'matched=' + d.summary.alreadyMatched,
        'link=' + d.summary.linkedExisting,
        'noRoom=' + d.summary.skippedNoRoom
      );
    });

  const outPath = path.join(
    __dirname,
    '..',
    '_backups',
    'WO045_DRYRUN_cloud-rolling-hills_STAGING_BY_CURSOR_2026-07-23.json'
  );
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log('\nFull report:', outPath);

  console.log('\n========== WIRING CHECK (code, not dry-run) ==========');
  console.log('cchRunDocLineClipEnsureAfterSave: proposals + invoices only (NOT purchaseOrders)');
  console.log('Writes still require window._cchDocLineClipEnsureApply === true (session-only)');
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
