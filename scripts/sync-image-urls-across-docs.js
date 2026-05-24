#!/usr/bin/env node
/**
 * sync-image-urls-across-docs.js
 *
 * Product Library has correct Firebase imageUrl values, but board clips,
 * invoice lines, proposal lines, and PO lines often have no URL or old Ivy URLs.
 *
 * This script copies Firebase imageUrl (and houzzId when present) from
 * productLibrary (preferred) or products into board documents.
 *
 * Usage:
 *   node scripts/sync-image-urls-across-docs.js
 *   node scripts/sync-image-urls-across-docs.js --boards=cloud-rolling-hills --dry-run
 *   node scripts/sync-image-urls-across-docs.js --boards=cloud-rolling-hills --dry-run --loose-match
 *   node scripts/sync-image-urls-across-docs.js --apply --yes
 *   node scripts/sync-image-urls-across-docs.js --apply --yes --loose-match
 */

'use strict';

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const admin = require('firebase-admin');

const PROD_KEY = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
const PROD_PROJECT = 'cch-design-boards';

const DEFAULT_BOARDS = ['cloud-rolling-hills'];
const BOARD_SUBCOLS = ['clips', 'invoices', 'proposals', 'purchaseOrders'];

const argv = process.argv.slice(2);
const DRY_RUN = !argv.includes('--apply');
const SKIP_CONFIRM = argv.includes('--yes');
const LOOSE_MATCH = argv.includes('--loose-match');
const BOARDS = (() => {
  const a = argv.find((x) => x.startsWith('--boards='));
  if (a) return a.split('=')[1].split(',').map((s) => s.trim()).filter(Boolean);
  return DEFAULT_BOARDS.slice();
})();

const prodKeyJson = require(PROD_KEY);
if (prodKeyJson.project_id !== PROD_PROJECT) {
  console.error('FATAL: expected prod project', PROD_PROJECT);
  process.exit(2);
}

const app = admin.initializeApp({
  credential: admin.credential.cert(prodKeyJson),
  projectId: PROD_PROJECT,
});
const db = app.firestore();

const stats = {
  docsScanned: 0,
  docsUpdated: 0,
  itemsChecked: 0,
  itemsFixed: 0,
  alreadyOk: 0,
  noLibraryMatch: 0,
  libraryNoFirebase: 0,
  matchVia: {},
  byBoard: {},
  bySource: {},
  samples: { fixed: [], noMatch: [] },
};

const libByTv = new Map();
const libByTitle = new Map();
const libByHouzzId = new Map();
const libById = new Map();
const libAllEntries = [];

function normKey(s) {
  return String(s || '').toLowerCase().trim().replace(/\s+/g, ' ');
}

const VENDOR_ALIASES = {
  concreti: 'concretti',
  concretti: 'concretti',
  visualcomfort: 'visualcomfort',
  visualcomfortco: 'visualcomfort',
  hubbardtonforge: 'hubbardtonforge',
  rejuvenation: 'rejuvenation',
  rj: 'rejuvenation',
};

function normVendor(v) {
  let s = normKey(v).replace(/[^a-z0-9]/g, '');
  s = s.replace(/(inc|llc|ltd|corp|co)$/, '');
  if (VENDOR_ALIASES[s]) s = VENDOR_ALIASES[s];
  if (s === 'concreti') s = 'concretti';
  return s;
}

function normTitleLoose(s) {
  return normKey(s).replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function levenshtein(a, b) {
  a = String(a || '');
  b = String(b || '');
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const row = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) row[j] = j;
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + cost);
      prev = tmp;
    }
  }
  return row[b.length];
}

function vendorMatches(want, have) {
  const a = normVendor(want);
  const b = normVendor(have);
  if (!a && !b) return true;
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.length >= 5 && b.length >= 5 && (a.includes(b) || b.includes(a))) return true;
  const minLen = Math.min(a.length, b.length);
  if (minLen >= 6 && levenshtein(a, b) <= 1) return true;
  return false;
}

function titleMatchesExact(want, have) {
  return normKey(want) === normKey(have);
}

function titleMatchesPartial(want, have) {
  const w = normTitleLoose(want);
  const h = normTitleLoose(have);
  if (!w || !h) return false;
  if (w === h) return true;
  if (w.length >= 4 && h.length >= 4 && (w.includes(h) || h.includes(w))) return true;
  const words = w.split(' ').filter((x) => x.length >= 4);
  if (words.length >= 1 && words.every((word) => h.includes(word))) return true;
  if (words.length >= 2) {
    const hit = words.filter((word) => h.includes(word)).length;
    if (hit >= Math.min(2, words.length)) return true;
  }
  const minLen = Math.min(w.length, h.length);
  if (minLen >= 8 && levenshtein(w.replace(/\s/g, ''), h.replace(/\s/g, '')) <= 2) return true;
  return false;
}

function tvKey(title, vendor) {
  return normKey(title) + '|' + normKey(vendor);
}

function decodeUrl(u) {
  return String(u || '').replace(/&amp;/g, '&').replace(/&#38;/g, '&').trim();
}

function isFirebaseUrl(u) {
  return /firebasestorage\.googleapis|\.firebasestorage\.app/i.test(String(u || ''));
}

function isIvyUrl(u) {
  return /ivy-uploads/i.test(String(u || ''));
}

function bump(bucket, key, n) {
  if (!bucket[key]) bucket[key] = 0;
  bucket[key] += n || 1;
}

function bestFirebaseFromDoc(data) {
  const urls = [];
  const push = (u) => {
    u = decodeUrl(u);
    if (u && isFirebaseUrl(u)) urls.push(u);
  };
  push(data.imageUrl);
  push(data.image);
  push(data.thumbnail);
  const imgs = data.images;
  if (Array.isArray(imgs)) {
    imgs.forEach((x) => {
      if (typeof x === 'string') push(x);
      else if (x && typeof x === 'object') push(x.url || x.imageUrl || x.src);
    });
  }
  return urls[0] || '';
}

function extractHouzzId(data) {
  return String(
    data.houzzId || data.houzzProductId || data.houzzProduct || data.catalogId || ''
  ).trim();
}

function registerLibraryEntry(docId, data, source) {
  const title = data.title || data.name || '';
  if (!normKey(title)) return;
  const vendor = data.vendor || '';
  const imageUrl = bestFirebaseFromDoc(data);
  if (!imageUrl) return;

  const entry = {
    libId: docId,
    title,
    vendor,
    imageUrl,
    houzzId: extractHouzzId(data),
    source,
  };

  const k = tvKey(title, vendor);
  const prev = libByTv.get(k);
  if (!prev || source === 'productLibrary') libByTv.set(k, entry);

  const kt = normKey(title);
  if (!libByTitle.has(kt)) libByTitle.set(kt, []);
  const arr = libByTitle.get(kt);
  if (!arr.find((e) => e.libId === docId)) arr.push(entry);

  libById.set(docId, entry);
  libAllEntries.push(entry);
  if (entry.houzzId) {
    const prevH = libByHouzzId.get(entry.houzzId);
    if (!prevH || source === 'productLibrary') libByHouzzId.set(entry.houzzId, entry);
  }
}

async function indexProductLibrary() {
  for (const col of ['productLibrary', 'products']) {
    const snap = await db.collection(col).get();
    console.log('Indexed', col + ':', snap.size, 'docs');
    snap.forEach((d) => {
      registerLibraryEntry(d.id, d.data() || {}, col);
    });
  }
  console.log('Lookup keys (title|vendor):', libByTv.size);
  console.log('Unique titles:', libByTitle.size);
  console.log('Houzz id index:', libByHouzzId.size);
  if (LOOSE_MATCH) console.log('Matching: loose (fuzzy title/vendor + houzzId)');
}

function pickBestFromCandidates(candidates, title, vendor) {
  const list = (candidates || []).filter((c) => c && isFirebaseUrl(c.imageUrl));
  if (!list.length) return null;
  if (list.length === 1) return list[0];

  const v = normKey(vendor);
  if (v) {
    const vendorHits = list.filter((c) => vendorMatches(vendor, c.vendor));
    if (vendorHits.length === 1) return vendorHits[0];
    if (vendorHits.length > 1) {
      return vendorHits.find((c) => c.source === 'productLibrary') || vendorHits[0];
    }
  }

  const libOnly = list.filter((c) => c.source === 'productLibrary');
  if (libOnly.length === 1) return libOnly[0];
  return list.find((c) => c.source === 'productLibrary') || list[0];
}

function lookupLibraryLooseScan(title, vendor) {
  const t = normKey(title);
  if (!t) return null;

  let best = null;
  let bestScore = 0;
  for (const rec of libAllEntries) {
    if (!isFirebaseUrl(rec.imageUrl)) continue;
    let score = 0;
    if (titleMatchesExact(title, rec.title)) score += 60;
    else if (titleMatchesPartial(title, rec.title)) score += 35;
    else continue;

    if (vendorMatches(vendor, rec.vendor)) score += 45;
    else if (!normKey(vendor) && !normKey(rec.vendor)) score += 15;
    else if (!normKey(vendor) || !normKey(rec.vendor)) score += 5;
    else continue;

    if (rec.source === 'productLibrary') score += 8;
    if (score > bestScore) {
      bestScore = score;
      best = rec;
    }
  }

  if (best && bestScore >= 75) return best;
  return null;
}

function lookupLibrary(title, vendor, item) {
  const t = normKey(title);
  if (!t && !(item && extractHouzzId(item))) return null;

  const lid = item
    ? String(item.libraryProductId || item.linkedLibraryProductId || '').trim()
    : '';
  if (lid && libById.has(lid)) {
    return { entry: libById.get(lid), via: 'libraryProductId' };
  }

  const hid = item ? extractHouzzId(item) : '';
  if (hid && libByHouzzId.has(hid)) {
    return { entry: libByHouzzId.get(hid), via: 'houzzId' };
  }

  const exact = libByTv.get(tvKey(title, vendor));
  if (exact) return { entry: exact, via: 'exact-title-vendor' };

  const nv = normVendor(vendor);
  if (nv) {
    for (const [k, rec] of libByTv) {
      if (!k.startsWith(t + '|')) continue;
      const kv = k.split('|')[1] || '';
      if (normVendor(kv) === nv) return { entry: rec, via: 'fuzzy-vendor' };
    }
  }

  const candidates = (libByTitle.get(t) || []).filter((c) => isFirebaseUrl(c.imageUrl));
  const titlePick = pickBestFromCandidates(candidates, title, vendor);
  if (titlePick) return { entry: titlePick, via: 'exact-title' };

  if (!LOOSE_MATCH) return null;

  const loose = lookupLibraryLooseScan(title, vendor);
  if (loose) return { entry: loose, via: 'loose-title-vendor' };

  if (hid) {
    for (const rec of libAllEntries) {
      if (rec.houzzId === hid && isFirebaseUrl(rec.imageUrl)) {
        return { entry: rec, via: 'houzzId-scan' };
      }
    }
  }

  return null;
}

function itemNeedsSync(item, libUrl) {
  const cur = decodeUrl(item.imageUrl || item.image || '');
  if (!libUrl) return false;
  if (!cur) return true;
  if (cur === libUrl) return false;
  if (isIvyUrl(cur)) return true;
  if (!isFirebaseUrl(cur)) return true;
  // Product Library is source of truth — replace a different Firebase URL too.
  if (isFirebaseUrl(cur) && cur !== libUrl) return true;
  return false;
}

function applyLibToItem(item, libResult, meta) {
  stats.itemsChecked++;
  const lib = libResult && libResult.entry ? libResult.entry : libResult;
  const matchVia = (libResult && libResult.via) || 'unknown';

  if (!lib || !lib.imageUrl) {
    if (lib && !lib.imageUrl) stats.libraryNoFirebase++;
    else stats.noLibraryMatch++;
    if (stats.samples.noMatch.length < 15 && (meta.title || meta.path)) {
      stats.samples.noMatch.push({
        board: meta.boardId,
        source: meta.source,
        title: meta.title || meta.path,
        vendor: meta.vendor,
        reason: lib ? 'no-firebase-in-library' : 'no-library-match',
      });
    }
    return null;
  }

  if (!itemNeedsSync(item, lib.imageUrl)) {
    stats.alreadyOk++;
    return null;
  }

  bump(stats.matchVia, matchVia);

  const patch = {
    imageUrl: lib.imageUrl,
  };
  if (lib.houzzId && !extractHouzzId(item)) patch.houzzId = lib.houzzId;
  if (lib.libId && !item.libraryProductId && !item.linkedLibraryProductId) {
    patch.libraryProductId = lib.libId;
  }
  const imgs = item.images;
  if (!Array.isArray(imgs) || !imgs.length || isIvyUrl(imgs[0]) || imgs[0] !== lib.imageUrl) {
    patch.images = [lib.imageUrl];
  }

  stats.itemsFixed++;
  bump(stats.bySource, meta.source);
  bump(stats.byBoard, meta.boardId);
  if (stats.samples.fixed.length < 25) {
    stats.samples.fixed.push({
      board: meta.boardId,
      source: meta.source,
      title: meta.title || meta.path || '(clip)',
      vendor: meta.vendor,
      via: matchVia + ' → ' + lib.source + '/' + lib.libId,
      old: decodeUrl(item.imageUrl || item.image || '').slice(0, 65) || '(empty)',
      new: lib.imageUrl.slice(0, 65),
    });
  }

  return patch;
}

function patchObject(target, patch) {
  Object.assign(target, patch);
}

async function processClipDoc(ref, data, meta) {
  const title = data.title || data.name || '';
  const vendor = data.vendor || '';
  const clipMeta = Object.assign({}, meta, { title, vendor });
  const lib = lookupLibrary(title, vendor, data);
  const patch = applyLibToItem(data, lib, clipMeta);
  if (!patch) return false;

  if (DRY_RUN) return true;
  await ref.set(patch, { merge: true });
  return true;
}

async function processLineItemsDoc(ref, data, meta) {
  const items = data.items;
  if (!Array.isArray(items) || !items.length) return false;

  let changed = false;
  const newItems = items.map((it, idx) => {
    if (!it || typeof it !== 'object') return it;
    const title = it.title || it.name || '';
    const vendor = it.vendor || '';
    if (!normKey(title)) return it;

    const lib = lookupLibrary(title, vendor, it);
    const patch = applyLibToItem(it, lib, Object.assign({}, meta, {
      path: 'items[' + idx + ']',
    }));
    if (!patch) return it;

    changed = true;
    return Object.assign({}, it, patch);
  });

  if (!changed) return false;
  if (DRY_RUN) return true;
  await ref.set({ items: newItems }, { merge: true });
  return true;
}

async function scanBoard(boardId) {
  console.log('\n▶ Board:', boardId);

  for (const sub of BOARD_SUBCOLS) {
    const snap = await db.collection('boards').doc(boardId).collection(sub).get();
    console.log('  ', sub + ':', snap.size, 'docs');

    for (const doc of snap.docs) {
      stats.docsScanned++;
      const data = doc.data() || {};
      const meta = {
        boardId,
        source: 'boards/' + boardId + '/' + sub,
      };

      let updated = false;
      if (sub === 'clips') {
        updated = await processClipDoc(doc.ref, data, meta);
      } else {
        updated = await processLineItemsDoc(doc.ref, data, meta);
      }

      if (updated) stats.docsUpdated++;
    }
  }
}

async function confirmApply() {
  if (DRY_RUN || SKIP_CONFIRM) return true;
  console.log('\nType YES-PROD-SYNC-LIBRARY to apply on production:\n');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ans = await new Promise((r) => rl.question('> ', (a) => { rl.close(); r(a.trim()); }));
  return ans === 'YES-PROD-SYNC-LIBRARY';
}

(async () => {
  console.log('\n=== sync-image-urls-across-docs (Product Library → board) ===');
  console.log('Mode:  ', DRY_RUN ? 'DRY-RUN' : 'APPLY');
  console.log('Boards:', BOARDS.join(', '));
  if (LOOSE_MATCH) console.log('Flags: --loose-match');
  console.log('============================================================\n');

  await indexProductLibrary();

  if (!(await confirmApply())) {
    await app.delete();
    process.exit(1);
  }

  for (const b of BOARDS) await scanBoard(b);

  console.log('\n=== summary ===================================================');
  console.log('docs scanned:       ', stats.docsScanned);
  console.log(DRY_RUN ? 'docs would update:  ' : 'docs updated:       ', stats.docsUpdated);
  console.log(DRY_RUN ? 'items would fix:    ' : 'items fixed:        ', stats.itemsFixed);
  console.log('items checked:      ', stats.itemsChecked);
  console.log('already ok:         ', stats.alreadyOk);
  console.log('no library match:   ', stats.noLibraryMatch);
  console.log('library w/o firebase:', stats.libraryNoFirebase);
  if (Object.keys(stats.matchVia).length) {
    console.log('\nMatch method (items fixed):');
    Object.keys(stats.matchVia).sort().forEach((k) => {
      console.log(' ', k + ':', stats.matchVia[k]);
    });
  }

  console.log('\nBy board:', stats.byBoard);
  console.log('\nBy source:', stats.bySource);

  if (stats.samples.fixed.length) {
    console.log('\nSample fixes:');
    stats.samples.fixed.forEach((s) => {
      console.log(' ', s.board, s.source);
      console.log('   ', s.title, '|', s.vendor || '(no vendor)');
      console.log('    via:', s.via);
      console.log('    old:', s.old);
      console.log('    new:', s.new);
    });
  }
  if (stats.samples.noMatch.length) {
    console.log('\nSample no match:');
    stats.samples.noMatch.slice(0, 10).forEach((s) => {
      console.log(' ', s.title, '|', s.vendor, '-', s.reason);
    });
  }

  const out = path.join(__dirname, '..', '_debug',
    'sync-image-urls-' + (DRY_RUN ? 'dryrun-' : 'apply-') + Date.now() + '.json');
  fs.writeFileSync(out, JSON.stringify({ dryRun: DRY_RUN, boards: BOARDS, stats }, null, 2));
  console.log('\nlog:', out);

  if (DRY_RUN) {
    console.log('\nDry run complete. To apply:');
    console.log('  node scripts/sync-image-urls-across-docs.js --boards=cloud-rolling-hills --apply');
  }

  await app.delete();
})().catch((err) => {
  console.error('FATAL:', err && err.stack || err);
  process.exit(1);
});
