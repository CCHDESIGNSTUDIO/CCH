'use strict';
/**
 * READ-ONLY — Compare production vs staging for the 7 duplicate product ids
 * that still have doc/clip libraryProductId links on staging.
 */
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const PAIRS = [
  { dup: 'jmGM3Bxr3Rm0un4Wy2Ms', keeper: 'gNr9nvckttQxLwz75zjZ', title: 'PEONY/ PARROT TULIP IN SOSA BOWL' },
  { dup: 'gDA8VpouKWcpn4eedUl0', keeper: 'mySvhwfvmtDuW4FTzWIr', title: 'Otto Sphere Pendant' },
  { dup: 'YFjIJkyK9mQSKqnvomzq', keeper: 'xK0ZIsXekZt7nEOjEpKm', title: 'Bundt Convertible Pendant' },
  { dup: 'VYf6TtpBbOTjym5cDTvN', keeper: 'rtc9REjrdxemyUBp1zC6', title: 'MAC' },
  { dup: 'RyB9EuFW0GGcFxrtc0xb', keeper: 'dy8Xb5qkDEjskr80fysE', title: 'Matthews Irene fan' },
  { dup: '6MQ7JeFsfkeaM6GXDMTE', keeper: '9julC26hDFCOgeOLIt83', title: 'Ember Hand Blown Pendant' },
  { dup: 'glacier_hand_blown_pendant___elu', keeper: 'mjOWWAeIWY74getsCKHa', title: 'Glacier Hand Blown Pendant' },
];

const STAGING_LINKS = [
  { boardId: '7225-bugletrail', type: 'clip', id: 'GQX9wul6TZYBIZf7B1gy', productId: 'jmGM3Bxr3Rm0un4Wy2Ms' },
  { boardId: '7225-bugletrail', type: 'clip', id: 'bssGuxqiIhkTChpNHSLK', productId: 'jmGM3Bxr3Rm0un4Wy2Ms' },
  { boardId: 'cloud-rolling-hills', type: 'clip', id: '5bd3gvR1z8tGYCpZgFxq', productId: 'gDA8VpouKWcpn4eedUl0' },
  { boardId: 'cloud-rolling-hills', type: 'clip', id: 'Za6TjPVQfSankey3l7zF', productId: 'YFjIJkyK9mQSKqnvomzq' },
  { boardId: 'cloud-rolling-hills', type: 'clip', id: 'ayTnDmOE1i366HOaOrLM', productId: 'VYf6TtpBbOTjym5cDTvN' },
  { boardId: 'cloud-rolling-hills', type: 'clip', id: 'xyzWHUxDCJS19KptxmME', productId: 'RyB9EuFW0GGcFxrtc0xb' },
  { boardId: 'cloud-rolling-hills', collection: 'invoices', docId: 'IN-12980', lineIndex: 0, productId: 'RyB9EuFW0GGcFxrtc0xb' },
  { boardId: 'cloud-rolling-hills', collection: 'invoices', docId: 'IN-12980', lineIndex: 10, productId: '6MQ7JeFsfkeaM6GXDMTE' },
  { boardId: 'cloud-rolling-hills', collection: 'invoices', docId: 'woO4Doh3IHzRuUEXqIhW', lineIndex: 7, productId: '6MQ7JeFsfkeaM6GXDMTE' },
  { boardId: 'cloud-rolling-hills', collection: 'proposals', docId: 'PR-12951', lineIndex: 1, productId: 'YFjIJkyK9mQSKqnvomzq' },
  { boardId: 'cloud-rolling-hills', collection: 'proposals', docId: 'PR-12951', lineIndex: 4, productId: 'gDA8VpouKWcpn4eedUl0' },
  { boardId: 'cloud-rolling-hills', collection: 'proposals', docId: 'PR-12951', lineIndex: 5, productId: 'VYf6TtpBbOTjym5cDTvN' },
  { boardId: 'cloud-rolling-hills', collection: 'proposals', docId: 'PR-12951', lineIndex: 33, productId: 'glacier_hand_blown_pendant___elu' },
];

const KEY_DIR = path.join(__dirname, '..', '_debug', 'service-account.json');
const OUT_DIR = path.join(__dirname, '..', '_backup', 'products-firmwide-dedup-staging-2026-06-09');

const str = (v) => String(v == null ? '' : v).trim();
function libId(row) {
  return str(row && (row.libraryProductId || row.linkedLibraryProductId || row.libraryId || row._libDocId));
}

function initDb(keyFile, name) {
  const key = require(path.join(KEY_DIR, keyFile));
  return admin.initializeApp({ credential: admin.credential.cert(key) }, name).firestore();
}

async function productStatus(db, id) {
  const out = { id, products: false, productLibrary: false, products_archive: false, productLibrary_archive: false, title: '' };
  for (const col of ['products', 'productLibrary', 'products_archive', 'productLibrary_archive']) {
    const snap = await db.collection(col).doc(id).get();
    if (snap.exists) {
      out[col] = true;
      if (!out.title) out.title = str((snap.data() || {}).title || (snap.data() || {}).name).slice(0, 60);
    }
  }
  return out;
}

async function countRefs(db, targetIds) {
  const dupSet = new Set(targetIds);
  const counts = { clipsDup: 0, clipsKeeper: 0, clipsOther: 0, docsDup: 0, docsKeeper: 0, docsOther: 0, hits: [] };
  const boards = await db.collection('boards').get();
  for (const b of boards.docs) {
    const boardId = b.id;
    const boardName = str((b.data() || {}).name || boardId);
    const clipSnap = await db.collection('boards').doc(boardId).collection('clips').get();
    for (const d of clipSnap.docs) {
      const lid = libId(d.data());
      if (!lid || !dupSet.has(lid)) continue;
      const kind = lid === targetIds[0] ? 'dup' : (lid === targetIds[1] ? 'keeper' : 'other');
      if (kind === 'dup') counts.clipsDup++;
      else if (kind === 'keeper') counts.clipsKeeper++;
      else counts.clipsOther++;
      counts.hits.push({ env: '', boardId, boardName, type: 'clip', id: d.id, libraryProductId: lid, title: str((d.data() || {}).title).slice(0, 50) });
    }
    for (const col of ['invoices', 'proposals', 'purchaseOrders']) {
      const docSnap = await db.collection('boards').doc(boardId).collection(col).get();
      for (const d of docSnap.docs) {
        const data = d.data() || {};
        const items = Array.isArray(data.items) ? data.items : [];
        items.forEach((it, idx) => {
          if (!it || it.lineKind === 'group') return;
          const lid = libId(it);
          if (!lid || !dupSet.has(lid)) return;
          if (lid === targetIds[0]) counts.docsDup++;
          else if (lid === targetIds[1]) counts.docsKeeper++;
          else counts.docsOther++;
          counts.hits.push({
            env: '', boardId, boardName, type: col, docId: d.id,
            docNum: str(data.invoiceNum || data.proposalNum || data.poNum || data.number || d.id),
            lineIndex: idx, libraryProductId: lid,
            lineTitle: str(it.title || it.description).slice(0, 50),
          });
        });
      }
    }
  }
  return counts;
}

async function checkStagingLink(db, link, dupId, keeperId) {
  const base = { stagingRef: link, production: null };
  if (link.type === 'clip') {
    const snap = await db.collection('boards').doc(link.boardId).collection('clips').doc(link.id).get();
    if (!snap.exists) return Object.assign(base, { production: { exists: false } });
    const lid = libId(snap.data());
    return Object.assign(base, {
      production: {
        exists: true,
        libraryProductId: lid,
        status: lid === keeperId ? 'CORRECTED_TO_KEEPER' : lid === dupId ? 'STILL_ON_DUP' : lid ? 'OTHER_ID' : 'NO_LINK',
        title: str((snap.data() || {}).title).slice(0, 50),
      },
    });
  }
  const snap = await db.collection('boards').doc(link.boardId).collection(link.collection).doc(link.docId).get();
  if (!snap.exists) return Object.assign(base, { production: { exists: false } });
  const items = Array.isArray((snap.data() || {}).items) ? snap.data().items : [];
  const line = items[link.lineIndex];
  if (!line) return Object.assign(base, { production: { exists: true, lineMissing: true, itemCount: items.length } });
  const lid = libId(line);
  return Object.assign(base, {
    production: {
      exists: true,
      libraryProductId: lid,
      status: lid === keeperId ? 'CORRECTED_TO_KEEPER' : lid === dupId ? 'STILL_ON_DUP' : lid ? 'OTHER_ID' : 'NO_LINK',
      lineTitle: str(line.title || line.description).slice(0, 50),
    },
  });
}

(async () => {
  const stgDb = initDb('cch-studio-staging-firebase-adminsdk-fbsvc-b93c6f1cf4.json', 'stg');
  const prodDb = initDb('cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json', 'prod');

  const report = { generatedAt: new Date().toISOString(), pairs: [], stagingLinksCompared: [] };

  for (const pair of PAIRS) {
    const ids = [pair.dup, pair.keeper];
    const [stgDup, stgKeep, prodDup, prodKeep] = await Promise.all([
      productStatus(stgDb, pair.dup),
      productStatus(stgDb, pair.keeper),
      productStatus(prodDb, pair.dup),
      productStatus(prodDb, pair.keeper),
    ]);
    const [stgRefs, prodRefs] = await Promise.all([
      countRefs(stgDb, ids),
      countRefs(prodDb, ids),
    ]);
    stgRefs.hits.forEach((h) => { h.env = 'staging'; });
    prodRefs.hits.forEach((h) => { h.env = 'production'; });

    report.pairs.push({
      title: pair.title,
      dupId: pair.dup,
      keeperId: pair.keeper,
      libraryDocs: {
        staging: { dup: stgDup, keeper: stgKeep },
        production: { dup: prodDup, keeper: prodKeep },
      },
      refs: {
        staging: { clipsToDup: stgRefs.clipsDup, clipsToKeeper: stgRefs.clipsKeeper, docsToDup: stgRefs.docsDup, docsToKeeper: stgRefs.docsKeeper },
        production: { clipsToDup: prodRefs.clipsDup, clipsToKeeper: prodRefs.clipsKeeper, docsToDup: prodRefs.docsDup, docsToKeeper: prodRefs.docsKeeper },
        productionHits: prodRefs.hits,
        stagingHits: stgRefs.hits,
      },
      prodCorrected: prodRefs.clipsDup === 0 && prodRefs.docsDup === 0 && (prodRefs.clipsKeeper + prodRefs.docsKeeper > 0 || prodRefs.hits.every((h) => h.libraryProductId !== pair.dup)),
    });
  }

  for (const link of STAGING_LINKS) {
    const pair = PAIRS.find((p) => p.dup === link.productId);
    const [stgCheck, prodCheck] = await Promise.all([
      checkStagingLink(stgDb, link, pair.dup, pair.keeper),
      checkStagingLink(prodDb, link, pair.dup, pair.keeper),
    ]);
    report.stagingLinksCompared.push({
      boardId: link.boardId,
      ref: link,
      staging: stgCheck.production,
      production: prodCheck.production,
    });
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const outPath = path.join(OUT_DIR, 'AUDIT_7linked_dups_PROD_vs_STAGING.json');
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));

  console.log('=== 7 linked dups: PRODUCTION vs STAGING ===\n');
  report.pairs.forEach((p) => {
    console.log(p.title);
    console.log('  dup:', p.dupId, '| prod products:', p.libraryDocs.production.dup.products, '| prod archive:', p.libraryDocs.production.dup.products_archive);
    console.log('  keeper:', p.keeperId, '| prod products:', p.libraryDocs.production.keeper.products);
    console.log('  staging refs → dup: clips', p.refs.staging.clipsToDup, 'docs', p.refs.staging.docsToDup, '| keeper: clips', p.refs.staging.clipsToKeeper, 'docs', p.refs.staging.docsToKeeper);
    console.log('  PROD refs    → dup: clips', p.refs.production.clipsToDup, 'docs', p.refs.production.docsToDup, '| keeper: clips', p.refs.production.clipsToKeeper, 'docs', p.refs.production.docsToKeeper);
    console.log('  prod corrected?', p.prodCorrected ? 'YES' : 'NO');
    if (p.refs.productionHits.length) {
      p.refs.productionHits.forEach((h) => console.log('    PROD hit:', h.type, h.boardId, h.docId || h.id, '→', h.libraryProductId));
    }
    console.log('');
  });

  console.log('--- Same doc/clip refs as staging audit ---');
  report.stagingLinksCompared.forEach((r) => {
    const st = r.staging && r.staging.status;
    const pr = r.production && r.production.status;
    const loc = r.ref.type === 'clip' ? 'clip ' + r.ref.id : r.ref.collection + ' ' + r.ref.docId + ' L' + r.ref.lineIndex;
    console.log(r.boardId, loc);
    console.log('  staging:', st || (r.staging && r.staging.exists === false ? 'MISSING' : JSON.stringify(r.staging)));
    console.log('  prod:   ', pr || (r.production && r.production.exists === false ? 'MISSING' : JSON.stringify(r.production)));
  });

  console.log('\nReport:', outPath);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
