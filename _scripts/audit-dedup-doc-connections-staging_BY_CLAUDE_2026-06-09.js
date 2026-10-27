'use strict';
/**
 * READ-ONLY — For firm-wide duplicate quarantine plan: which proposed-archive rows
 * have doc/clip connection information (libraryProductId, libraryUsageRefs, clipId)?
 */
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const STG_KEY = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-studio-staging-firebase-adminsdk-fbsvc-b93c6f1cf4.json');
const OUT_DIR = path.join(__dirname, '..', '_backup', 'products-firmwide-dedup-staging-2026-06-09');

const db = admin.initializeApp({ credential: admin.credential.cert(require(STG_KEY)) }, 'audit').firestore();

const str = (v) => String(v == null ? '' : v).trim();
const hz = (o) => str(o && (o.houzzId || o.houzzProductId || o.catalogId));
const META = new Set(['updatedAt', 'createdAt', 'owner', '_id', 'addedAt', '_houzzGalleryLinkedAt', '_categoryFixedAt', '_enrichedFromHouzzApr27', '_archiveMeta']);

function meaningfulFields(p) {
  let n = 0;
  Object.keys(p || {}).forEach((k) => {
    if (META.has(k)) return;
    const v = p[k];
    if (v == null || v === '' || (typeof v === 'string' && !v.trim()) || (Array.isArray(v) && !v.length)) return;
    n++;
  });
  return n;
}
function imgCount(o) {
  const s = new Set();
  const add = (u) => { u = str(typeof u === 'string' ? u : (u && (u.url || u.imageUrl || u.src))); if (u) s.add(u); };
  add(o.imageUrl); add(o.image);
  ['images', 'imageUrls', 'gallery', 'photos'].forEach((k) => { if (Array.isArray(o[k])) o[k].forEach(add); });
  return s.size;
}
function descriptorTitle(t) {
  t = str(t).toLowerCase();
  return /\broom\b/.test(t) || /^(black forest|lack forest|ebony|vanilla bean)/.test(t);
}
function score(p) {
  let s = meaningfulFields(p);
  if (str(p.sku)) s += 5;
  if (hz(p)) s += 5;
  if (!descriptorTitle(p.title || p.name)) s += 20;
  if (parseFloat(p.costPrice || p.unitCost || p.cost) > 0) s += 10;
  if (parseFloat(p.sellPrice || p.price || p.clientPrice) > 0) s += 5;
  return s + imgCount(p) * 2;
}
function groupKey(p) {
  const h = hz(p);
  if (h) return 'houzz:' + h;
  const sk = str(p.sku);
  if (sk) return 'sku:' + sk.toLowerCase();
  return 'tv:' + str(p.title || p.name).toLowerCase() + '|' + str(p.vendor).toLowerCase();
}
function libIdsOnRow(row) {
  const ids = [];
  [row.libraryProductId, row.linkedLibraryProductId, row.libraryId, row._libDocId].forEach((v) => {
    const s = str(v);
    if (s) ids.push(s);
  });
  return ids;
}

(async () => {
  console.log('Loading products/ and building duplicate quarantine set…');
  const snap = await db.collection('products').get();
  const docs = [];
  snap.forEach((d) => docs.push(Object.assign({ _id: d.id }, d.data() || {})));

  const groups = {};
  docs.forEach((p) => { (groups[groupKey(p)] = groups[groupKey(p)] || []).push(p); });

  const dupToCanon = new Map();
  const retireIds = new Set();
  Object.entries(groups).forEach(([, rows]) => {
    if (rows.length < 2) return;
    rows.sort((a, b) => score(b) - score(a) || String(a._id).localeCompare(String(b._id)));
    const keep = rows[0];
    rows.slice(1).forEach((r) => {
      retireIds.add(r._id);
      dupToCanon.set(r._id, { keeperId: keep._id, keeperTitle: str(keep.title || keep.name), dup: r });
    });
  });

  // libraryUsageRefs on the duplicate product doc itself
  const usageOnDup = [];
  retireIds.forEach((id) => {
    const p = dupToCanon.get(id).dup;
    const refs = p.libraryUsageRefs;
    if (refs && typeof refs === 'object' && Object.keys(refs).length) {
      usageOnDup.push({ productId: id, title: str(p.title || p.name).slice(0, 50), refCount: Object.keys(refs).length, refs: Object.keys(refs).slice(0, 5) });
    }
  });

  // Scan all boards for clip + doc line links
  const clipLinks = [];
  const docLinks = [];
  const boardsSnap = await db.collection('boards').get();

  for (const b of boardsSnap.docs) {
    const boardId = b.id;
    const boardName = str((b.data() || {}).name || boardId);

    const clipSnap = await db.collection('boards').doc(boardId).collection('clips').get();
    for (const d of clipSnap.docs) {
      const c = d.data() || {};
      libIdsOnRow(c).forEach((lid) => {
        if (!retireIds.has(lid)) return;
        const info = dupToCanon.get(lid);
        clipLinks.push({
          productId: lid,
          keeperId: info.keeperId,
          boardId,
          boardName,
          clipId: d.id,
          clipTitle: str(c.title || c.name).slice(0, 60),
          room: str(c.room),
          source: str(c.source),
        });
      });
    }

    for (const col of ['invoices', 'proposals', 'purchaseOrders']) {
      const docSnap = await db.collection('boards').doc(boardId).collection(col).get();
      for (const d of docSnap.docs) {
        const data = d.data() || {};
        const docNum = str(data.invoiceNum || data.proposalNum || data.poNum || data.number || d.id);
        const items = Array.isArray(data.items) ? data.items : [];
        items.forEach((it, idx) => {
          if (!it || it.lineKind === 'group') return;
          libIdsOnRow(it).forEach((lid) => {
            if (!retireIds.has(lid)) return;
            const info = dupToCanon.get(lid);
            docLinks.push({
              productId: lid,
              keeperId: info.keeperId,
              boardId,
              boardName,
              collection: col,
              docId: d.id,
              docNum,
              lineIndex: idx,
              lineTitle: str(it.title || it.description).slice(0, 60),
              clipId: str(it.clipId),
            });
          });
        });
      }
    }
  }

  const linkedDupIds = new Set();
  clipLinks.forEach((r) => linkedDupIds.add(r.productId));
  docLinks.forEach((r) => linkedDupIds.add(r.productId));
  usageOnDup.forEach((r) => linkedDupIds.add(r.productId));

  const keeperAlsoLinked = { clips: 0, docs: 0 };
  const keeperIds = new Set([...dupToCanon.values()].map((v) => v.keeperId));

  for (const b of boardsSnap.docs) {
    const boardId = b.id;
    const clipSnap = await db.collection('boards').doc(boardId).collection('clips').get();
    for (const d of clipSnap.docs) {
      libIdsOnRow(d.data() || {}).forEach((lid) => { if (keeperIds.has(lid)) keeperAlsoLinked.clips++; });
    }
    for (const col of ['invoices', 'proposals', 'purchaseOrders']) {
      const docSnap = await db.collection('boards').doc(boardId).collection(col).get();
      for (const d of docSnap.docs) {
        const items = Array.isArray((d.data() || {}).items) ? d.data().items : [];
        items.forEach((it) => {
          if (!it || it.lineKind === 'group') return;
          libIdsOnRow(it).forEach((lid) => { if (keeperIds.has(lid)) keeperAlsoLinked.docs++; });
        });
      }
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    env: 'STAGING',
    quarantineSet: {
      totalDuplicates: retireIds.size,
      withAnyDocConnection: linkedDupIds.size,
      withoutAnyDocConnection: retireIds.size - linkedDupIds.size,
      pctWithConnections: Math.round((linkedDupIds.size / retireIds.size) * 1000) / 10,
    },
    connectionBreakdown: {
      clipLibraryProductId: clipLinks.length,
      docLineLibraryProductId: docLinks.length,
      libraryUsageRefsOnProductDoc: usageOnDup.length,
      uniqueDupsInClips: new Set(clipLinks.map((r) => r.productId)).size,
      uniqueDupsInDocLines: new Set(docLinks.map((r) => r.productId)).size,
    },
    keeperBaseline: {
      note: 'How often the proposed KEEPER id is already linked (repoint target exists)',
      clipRefsToKeeper: keeperAlsoLinked.clips,
      docLineRefsToKeeper: keeperAlsoLinked.docs,
    },
    dupsWithConnections: [...linkedDupIds].map((id) => {
      const info = dupToCanon.get(id);
      return {
        productId: id,
        title: str(info.dup.title || info.dup.name).slice(0, 50),
        houzzId: hz(info.dup),
        keeperId: info.keeperId,
        keeperTitle: info.keeperTitle.slice(0, 50),
        clipRefs: clipLinks.filter((r) => r.productId === id).length,
        docLineRefs: docLinks.filter((r) => r.productId === id).length,
        hasLibraryUsageRefs: usageOnDup.some((r) => r.productId === id),
      };
    }).sort((a, b) => (b.clipRefs + b.docLineRefs) - (a.clipRefs + a.docLineRefs)),
    sampleClipLinks: clipLinks.slice(0, 40),
    sampleDocLinks: docLinks.slice(0, 40),
    sampleUsageRefs: usageOnDup.slice(0, 30),
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const outPath = path.join(OUT_DIR, 'AUDIT_doc_connections_on_quarantine_dups.json');
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));

  console.log('\n=== Doc connections on proposed QUARANTINE (duplicate) rows ===');
  console.log('Duplicates to quarantine:', retireIds.size);
  console.log('With ANY doc/clip connection:', linkedDupIds.size, '(' + report.quarantineSet.pctWithConnections + '%)');
  console.log('With NO connections (safe to quarantine from link perspective):', report.quarantineSet.withoutAnyDocConnection);
  console.log('\nBreakdown:');
  console.log('  clip libraryProductId refs:', clipLinks.length, '| unique dups:', report.connectionBreakdown.uniqueDupsInClips);
  console.log('  doc line libraryProductId refs:', docLinks.length, '| unique dups:', report.connectionBreakdown.uniqueDupsInDocLines);
  console.log('  libraryUsageRefs on dup product doc:', usageOnDup.length);
  console.log('\nKeeper already linked (repoint targets exist):');
  console.log('  clip refs to keeper:', keeperAlsoLinked.clips);
  console.log('  doc line refs to keeper:', keeperAlsoLinked.docs);
  if (report.dupsWithConnections.length) {
    console.log('\nDups WITH connections (all ' + report.dupsWithConnections.length + '):');
    report.dupsWithConnections.forEach((r) => {
      console.log('  ' + r.productId + '  clips=' + r.clipRefs + ' docs=' + r.docLineRefs +
        (r.hasLibraryUsageRefs ? ' usageRefs' : '') + '  keeper=' + r.keeperId);
    });
  }
  console.log('\nFull report:', outPath);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
