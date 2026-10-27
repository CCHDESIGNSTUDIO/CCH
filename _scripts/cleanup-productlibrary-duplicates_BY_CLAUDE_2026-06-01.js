#!/usr/bin/env node
'use strict';
/**
 * Product Library quarantine — move junk to productLibrary_archive (Junk Library).
 * Before archive: disconnect libraryProductId (and related) on proposal/invoice/PO lines + clips.
 *
 * Touches:
 *   productLibrary/{id}  → productLibrary_archive/{id}  (Junk Library)
 *   products/{id}        → products_archive/{id}
 *   boards/{boardId}/proposals|invoices|purchaseOrders — clears library link fields on lines (not clipId)
 *   boards/{boardId}/clips — clears library link fields
 *
 * Usage (from cch-deploy/):
 *   node _scripts/cleanup-productlibrary-duplicates_BY_CLAUDE_2026-06-01.js
 *   node _scripts/cleanup-productlibrary-duplicates_BY_CLAUDE_2026-06-01.js --limit=50
 *   node _scripts/cleanup-productlibrary-duplicates_BY_CLAUDE_2026-06-01.js --apply --backup
 */
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const argv = process.argv.slice(2);
const APPLY = argv.includes('--apply');
const BACKUP = argv.includes('--backup') || APPLY;
const STAGING = argv.includes('--staging');
const STRICT = argv.includes('--strict');
const SKIP_DISCONNECT = argv.includes('--skip-disconnect');

const LIMIT = (function () {
  const m = argv.find((a) => a.startsWith('--limit='));
  if (!m) return 0;
  const n = parseInt(m.split('=')[1], 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
})();

const PROD_KEY = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
const STAGING_KEY = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-studio-staging-firebase-adminsdk-fbsvc-b93c6f1cf4.json');

const KEY_PATH = STAGING ? STAGING_KEY : PROD_KEY;
const ARCHIVE_LIB = 'productLibrary_archive';
const ARCHIVE_PROD = 'products_archive';
const DOC_SUBS = ['proposals', 'invoices', 'purchaseOrders'];
const BATCH_SIZE = 400;
const SCRIPT_TAG = 'cleanup-productlibrary-duplicates_BY_CLAUDE_2026-06-01.js';
const BACKUP_TAG = 'productlibrary-quarantine-prod-2026-06-02';

function str(v) {
  return String(v == null ? '' : v).trim();
}

function hasHttpImage(data) {
  const u = str(data.imageUrl || data.image || data.thumbnail || data.hero);
  return !!(u && /^https?:\/\//i.test(u));
}

function meaningfulFieldCount(data) {
  const skip = new Set([
    'updatedAt', 'createdAt', 'owner', 'archivedAt', 'reason', '_archiveMeta',
    'productLifecycle', 'libraryItemKind', 'source'
  ]);
  let n = 0;
  Object.keys(data || {}).forEach((k) => {
    if (skip.has(k)) return;
    const v = data[k];
    if (v == null || v === '') return;
    if (typeof v === 'string' && !v.trim()) return;
    if (Array.isArray(v) && !v.length) return;
    n++;
  });
  return n;
}

function classifyJunk(data) {
  const title = str(data.title || data.name);
  const vendor = str(data.vendor || data.manufacturer);
  const hasHouzz = !!(str(data.houzzId || data.houzzProductId || data.catalogId));
  const hasProductCode = !!str(data.productCode);
  const hasSku = !!str(data.sku);
  const hasUrl = !!str(data.productUrl || data.vendorUrl || data.pageUrl || data.clippedFromUrl);
  const hasCost = parseFloat(data.costPrice || data.unitCost || data.cost) > 0;
  const hasSell = parseFloat(data.sellPrice || data.price || data.clientPrice) > 0;
  const hasImage = hasHttpImage(data);
  const fields = meaningfulFieldCount(data);

  const hasUsefulIdentity = title.length >= 3 && vendor.length >= 2;
  const hasUsefulCommerce = hasSku || hasUrl || hasCost || hasSell;

  let isJunk = !hasHouzz && !hasProductCode;
  if (isJunk) {
    if (!hasUsefulIdentity) isJunk = true;
    else if (!hasImage && !hasUsefulCommerce && fields < 8) isJunk = true;
    else if (fields < 6) isJunk = true;
  }

  if (STRICT && isJunk && hasUsefulIdentity && (hasSku || hasUrl)) {
    isJunk = false;
  }

  const reasons = [];
  if (!hasHouzz) reasons.push('no-houzz');
  if (!hasProductCode) reasons.push('no-productCode');
  if (!hasUsefulIdentity) reasons.push('weak-title-vendor');
  if (!hasImage) reasons.push('no-http-image');
  if (!hasUsefulCommerce) reasons.push('no-sku-url-price');
  if (fields < 8) reasons.push('few-fields:' + fields);

  return { isJunk, reasons, hasHouzz, hasProductCode, title, vendor };
}

function libIdsOnRow(row) {
  const ids = [];
  [row.libraryProductId, row.linkedLibraryProductId, row.libraryId, row._libDocId].forEach((v) => {
    const s = str(v);
    if (s) ids.push(s);
  });
  return ids;
}

function rowTouchesQuarantine(row, quarantineIds) {
  return libIdsOnRow(row).some((id) => quarantineIds.has(id));
}

function stripLibraryLinksFromRow(row, quarantineIds, ts) {
  if (!row || typeof row !== 'object') return { row, changed: false };
  if (!rowTouchesQuarantine(row, quarantineIds)) return { row, changed: false };
  const out = Object.assign({}, row);
  let changed = false;
  ['libraryProductId', 'linkedLibraryProductId', 'libraryId', '_libDocId'].forEach((k) => {
    const v = str(out[k]);
    if (v && quarantineIds.has(v)) {
      delete out[k];
      changed = true;
    }
  });
  if (out.libraryProductIdLocked === true || out._libraryProductIdLocked === true) {
    delete out.libraryProductIdLocked;
    delete out._libraryProductIdLocked;
    changed = true;
  }
  if (changed) {
    out._libraryLinkDisconnectedAt = ts;
    out._libraryQuarantineDisconnect = true;
  }
  return { row: out, changed };
}

function stripLibraryLinksFromClipData(data, quarantineIds, ts) {
  const patch = {};
  let changed = false;
  ['libraryProductId', 'linkedLibraryProductId', 'libraryId', '_libDocId'].forEach((k) => {
    const v = str(data[k]);
    if (v && quarantineIds.has(v)) {
      patch[k] = admin.firestore.FieldValue.delete();
      changed = true;
    }
  });
  if (data.libraryProductIdLocked === true || data._libraryProductIdLocked === true) {
    patch.libraryProductIdLocked = admin.firestore.FieldValue.delete();
    patch._libraryProductIdLocked = admin.firestore.FieldValue.delete();
    changed = true;
  }
  if (changed) {
    patch._libraryLinkDisconnectedAt = ts;
    patch._libraryQuarantineDisconnect = true;
    patch.updatedAt = ts;
  }
  return { patch, changed };
}

/**
 * Count + optionally disconnect library links pointing at quarantined ids.
 */
async function disconnectQuarantinedLibraryLinks(db, quarantineIds, opts) {
  opts = opts || {};
  const apply = !!opts.apply;
  const ts = new Date().toISOString();
  const manifest = [];
  let docLines = 0;
  let clips = 0;
  let docsUpdated = 0;

  const boards = await db.collection('boards').get();
  console.log('Scanning boards for library links to quarantine…', boards.size);

  for (const b of boards.docs) {
    const boardId = b.id;
    for (const sub of DOC_SUBS) {
      const snap = await db.collection('boards').doc(boardId).collection(sub).get();
      for (const doc of snap.docs) {
        const data = doc.data() || {};
        const items = Array.isArray(data.items) ? data.items : [];
        let docChanged = false;
        const newItems = items.map((it, idx) => {
          if (!it || it.lineKind === 'group') return it;
          const res = stripLibraryLinksFromRow(it, quarantineIds, ts);
          if (res.changed) {
            docChanged = true;
            docLines++;
            manifest.push({
              kind: 'docLine',
              boardId,
              collection: sub,
              docId: doc.id,
              docNum: str(data.proposalNum || data.invoiceNum || data.number || data.poNum || ''),
              lineIndex: idx,
              lineTitle: str(it.title || '').slice(0, 80),
              libraryIds: libIdsOnRow(it).filter((id) => quarantineIds.has(id)).join(';')
            });
          }
          return res.row;
        });
        if (docChanged && apply) {
          await doc.ref.update({ items: newItems, updatedAt: ts });
          docsUpdated++;
        }
      }
    }

    const clipSnap = await db.collection('boards').doc(boardId).collection('clips').get();
    let batch = db.batch();
    let batchN = 0;
    for (const cd of clipSnap.docs) {
      const cdata = cd.data() || {};
      const res = stripLibraryLinksFromClipData(cdata, quarantineIds, ts);
      if (!res.changed) continue;
      clips++;
      manifest.push({
        kind: 'clip',
        boardId,
        clipId: cd.id,
        lineTitle: str(cdata.title || '').slice(0, 80),
        libraryIds: libIdsOnRow(cdata).filter((id) => quarantineIds.has(id)).join(';')
      });
      if (apply) {
        batch.update(cd.ref, res.patch);
        batchN++;
        if (batchN >= BATCH_SIZE) {
          await batch.commit();
          batch = db.batch();
          batchN = 0;
        }
      }
    }
    if (apply && batchN) await batch.commit();
  }

  return { manifest, docLines, clips, docsUpdated };
}

function countRefsForPlan(db, quarantineIds) {
  return disconnectQuarantinedLibraryLinks(db, quarantineIds, { apply: false });
}

async function main() {
  if (!fs.existsSync(KEY_PATH)) {
    console.error('Missing service account:', KEY_PATH);
    process.exit(2);
  }
  const keyJson = require(KEY_PATH);
  admin.initializeApp({ credential: admin.credential.cert(keyJson) });
  const db = admin.firestore();
  const projectId = keyJson.project_id || '(unknown)';
  console.log('Project:', projectId, STAGING ? '(staging)' : '(production)');
  console.log('Mode:', APPLY ? 'APPLY' : 'DRY-RUN');
  if (LIMIT) console.log('Limit:', LIMIT, 'junk rows max');
  console.log('');

  const libSnap = await db.collection('productLibrary').get();
  console.log('productLibrary docs:', libSnap.size);

  const plan = [];
  let kept = 0;

  for (const doc of libSnap.docs) {
    const data = doc.data() || {};
    const cls = classifyJunk(data);
    if (!cls.isJunk) {
      kept++;
      continue;
    }
    plan.push({
      id: doc.id,
      title: cls.title || '(no title)',
      vendor: cls.vendor || '',
      reasons: cls.reasons.join(', '),
      fieldCount: meaningfulFieldCount(data)
    });
    if (LIMIT && plan.length >= LIMIT) break;
  }

  const quarantineIds = new Set(plan.map((p) => p.id));
  let disconnectSummary = { docLines: 0, clips: 0, docsUpdated: 0, manifest: [] };

  if (quarantineIds.size && !SKIP_DISCONNECT) {
    disconnectSummary = await countRefsForPlan(db, quarantineIds);
    const refsByLib = {};
    disconnectSummary.manifest.forEach((m) => {
      (m.libraryIds || '').split(';').filter(Boolean).forEach((lid) => {
        refsByLib[lid] = (refsByLib[lid] || 0) + 1;
      });
    });
    plan.forEach((p) => {
      p.linkRefsToDisconnect = refsByLib[p.id] || 0;
    });
  }

  const backupDir = path.join(__dirname, '..', '_backup', BACKUP_TAG);
  const report = {
    script: SCRIPT_TAG,
    projectId,
    at: new Date().toISOString(),
    mode: APPLY ? 'apply' : 'dry-run',
    archiveCollections: { library: ARCHIVE_LIB, products: ARCHIVE_PROD },
    totals: {
      productLibrary: libSnap.size,
      junkCandidates: plan.length,
      kept,
      docLinesToDisconnect: disconnectSummary.docLines,
      clipsToDisconnect: disconnectSummary.clips
    },
    plan
  };

  if (BACKUP) {
    fs.mkdirSync(backupDir, { recursive: true });
    const suffix = APPLY ? 'applied' : 'dryrun';
    fs.writeFileSync(
      path.join(backupDir, 'quarantine-plan-' + suffix + '_BY_CLAUDE_2026-06-02.json'),
      JSON.stringify(report, null, 2)
    );
    if (disconnectSummary.manifest.length) {
      const csvLines = ['kind,boardId,collection,docId,docNum,lineIndex,clipId,lineTitle,libraryIds'];
      disconnectSummary.manifest.forEach((m) => {
        csvLines.push([
          m.kind, m.boardId, m.collection || '', m.docId || '', m.docNum || '',
          m.lineIndex != null ? m.lineIndex : '', m.clipId || '',
          '"' + String(m.lineTitle || '').replace(/"/g, '""') + '"',
          m.libraryIds || ''
        ].join(','));
      });
      fs.writeFileSync(
        path.join(backupDir, 'library-link-disconnect-manifest_BY_CLAUDE_2026-06-02.csv'),
        csvLines.join('\n')
      );
    }
    console.log('Report:', backupDir);
  }

  console.log('\n--- Summary ---');
  console.log('Kept (not junk):', kept);
  console.log('To quarantine (Junk Library):', plan.length);
  console.log('Doc lines that will lose library link:', disconnectSummary.docLines);
  console.log('Clips that will lose library link:', disconnectSummary.clips);
  if (plan.length) {
    console.log('\nSample junk (up to 12):');
    plan.slice(0, 12).forEach((p) => {
      console.log(' ', p.id, '|', p.title.slice(0, 45), '| refs:', p.linkRefsToDisconnect || 0, '|', p.reasons);
    });
  }

  if (!APPLY) {
    console.log('\nDry-run only. Re-run with --apply --backup to:');
    console.log('  1) Disconnect doc/clip library links');
    console.log('  2) Move rows to', ARCHIVE_LIB, '(browse in Studio → Product Library → Junk Library)');
    return;
  }

  if (!plan.length) {
    console.log('Nothing to apply.');
    return;
  }

  if (!SKIP_DISCONNECT) {
    console.log('\nDisconnecting library links…');
    const disc = await disconnectQuarantinedLibraryLinks(db, quarantineIds, { apply: true });
    console.log('Disconnected doc lines:', disc.docLines, '| clips:', disc.clips, '| docs updated:', disc.docsUpdated);
    if (BACKUP && disc.manifest.length) {
      const csvLines = ['kind,boardId,collection,docId,docNum,lineIndex,clipId,lineTitle,libraryIds'];
      disc.manifest.forEach((m) => {
        csvLines.push([
          m.kind, m.boardId, m.collection || '', m.docId || '', m.docNum || '',
          m.lineIndex != null ? m.lineIndex : '', m.clipId || '',
          '"' + String(m.lineTitle || '').replace(/"/g, '""') + '"',
          m.libraryIds || ''
        ].join(','));
      });
      fs.writeFileSync(
        path.join(backupDir, 'library-link-disconnect-applied_BY_CLAUDE_2026-06-02.csv'),
        csvLines.join('\n')
      );
    }
  }

  const preDump = [];
  let moved = 0;
  let errors = 0;
  const ts = new Date().toISOString();

  for (let i = 0; i < plan.length; i += BATCH_SIZE) {
    const chunk = plan.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    for (const row of chunk) {
      try {
        const libRef = db.collection('productLibrary').doc(row.id);
        const libDoc = await libRef.get();
        if (!libDoc.exists) continue;
        const data = libDoc.data() || {};
        preDump.push({ id: row.id, collection: 'productLibrary', data });

        const archivePayload = Object.assign({}, data, {
          productLifecycle: 'junk',
          libraryItemKind: 'junk',
          _archiveMeta: {
            archivedAt: ts,
            archivedBy: SCRIPT_TAG,
            reason: row.reasons,
            sourceCollection: 'productLibrary',
            projectId,
            junkLibrary: true
          }
        });
        batch.set(db.collection(ARCHIVE_LIB).doc(row.id), archivePayload, { merge: false });
        batch.delete(libRef);

        const prodRef = db.collection('products').doc(row.id);
        const prodDoc = await prodRef.get();
        if (prodDoc.exists) {
          const pdata = prodDoc.data() || {};
          preDump.push({ id: row.id, collection: 'products', data: pdata });
          batch.set(db.collection(ARCHIVE_PROD).doc(row.id), Object.assign({}, pdata, {
            productLifecycle: 'junk',
            _archiveMeta: archivePayload._archiveMeta
          }), { merge: false });
          batch.delete(prodRef);
        }
        moved++;
      } catch (e) {
        errors++;
        console.warn('Error preparing', row.id, e.message || e);
      }
    }
    await batch.commit();
    console.log('Archived batch', Math.min(i + BATCH_SIZE, plan.length), '/', plan.length);
  }

  if (BACKUP) {
    fs.writeFileSync(
      path.join(backupDir, 'quarantine-pre-images_BY_CLAUDE_2026-06-02.json'),
      JSON.stringify(preDump, null, 2)
    );
  }

  console.log('\nApply complete.');
  console.log('Moved to Junk Library (' + ARCHIVE_LIB + '):', moved);
  console.log('Errors:', errors);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
