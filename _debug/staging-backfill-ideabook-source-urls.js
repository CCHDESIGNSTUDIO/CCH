/**
 * Backfill missing ideabook image source URLs in STAGING.
 *
 * For board ideabook images[] entries:
 * - if sourceUrl is missing, derive it from first valid URL among:
 *   source, pageUrl, productUrl, clippedFromUrl, url, vendorUrl
 * - also fill pageUrl/productUrl/clippedFromUrl when missing (same URL)
 *
 * Safe: only fills blanks, never overwrites non-empty values.
 */
const fs = require('fs');
const path = require('path');
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, writeBatch } = require('firebase/firestore');

const STAGING = {
  apiKey: 'AIzaSyBIwwo7uRij6Q0FZg-qmIS1LC8t2AjXrYo',
  authDomain: 'cch-studio-staging.firebaseapp.com',
  projectId: 'cch-studio-staging',
  storageBucket: 'cch-studio-staging.firebasestorage.app',
  messagingSenderId: '210388013080',
  appId: '1:210388013080:web:fcd520b30c0d50b149736d',
};
const PROD = {
  apiKey: 'AIzaSyAd24U5ArVGrA24IxNcYD2NYiTVycyF4og',
  authDomain: 'cch-design-boards.firebaseapp.com',
  projectId: 'cch-design-boards',
  storageBucket: 'cch-design-boards.appspot.com',
  messagingSenderId: '210388013080',
  appId: '1:210388013080:web:cch-design-boards',
};

function str(v) {
  return String(v || '').trim();
}
function isUrl(v) {
  return /^https?:\/\//i.test(str(v));
}
function firstUrl(item, keys) {
  for (const k of keys) {
    const v = item && item[k];
    if (isUrl(v)) return str(v);
  }
  return '';
}
function coerceImage(item) {
  if (!item) return { imageUrl: '' };
  if (typeof item === 'string') return { imageUrl: item };
  return { ...item };
}

async function main() {
  const target = String(process.argv[2] || 'staging').toLowerCase();
  const cfg = target === 'prod' || target === 'production' ? PROD : STAGING;
  const app = initializeApp(cfg);
  const db = getFirestore(app);

  const boardsSnap = await getDocs(collection(db, 'boards'));
  const boards = [];
  boardsSnap.forEach((d) => boards.push({ id: d.id, ...d.data() }));

  const report = {
    environment: cfg.projectId,
    script: 'staging-backfill-ideabook-source-urls.js',
    startedAt: new Date().toISOString(),
    boardsScanned: boards.length,
    ideabookDocsScanned: 0,
    imagesScanned: 0,
    imagesBackfilled: 0,
    docsUpdated: 0,
    examples: [],
  };

  const updates = [];
  for (const b of boards) {
    const ibSnap = await getDocs(collection(db, 'boards', b.id, 'ideabooks'));
    ibSnap.forEach((d) => {
      report.ideabookDocsScanned += 1;
      const data = d.data() || {};
      const arr = Array.isArray(data.images) ? data.images : [];
      if (!arr.length) return;

      let changed = false;
      const next = arr.map((raw) => {
        const item = coerceImage(raw);
        report.imagesScanned += 1;
        const existingSourceUrl = str(item.sourceUrl);
        if (existingSourceUrl) return item;

        const url = firstUrl(item, ['source', 'pageUrl', 'productUrl', 'clippedFromUrl', 'url', 'vendorUrl']);
        if (!url) return item;

        changed = true;
        report.imagesBackfilled += 1;
        const out = { ...item, sourceUrl: url };
        if (!str(out.pageUrl)) out.pageUrl = url;
        if (!str(out.productUrl)) out.productUrl = url;
        if (!str(out.clippedFromUrl)) out.clippedFromUrl = url;

        if (report.examples.length < 30) {
          report.examples.push({
            boardId: b.id,
            ideabookId: d.id,
            caption: str(out.caption || out.title || ''),
            sourceUrl: url,
          });
        }
        return out;
      });

      if (changed) {
        updates.push({
          boardId: b.id,
          ideabookId: d.id,
          images: next,
        });
      }
    });
  }

  const BATCH = 250;
  let committed = 0;
  for (let i = 0; i < updates.length; i += BATCH) {
    const batch = writeBatch(db);
    const slice = updates.slice(i, i + BATCH);
    for (const u of slice) {
      batch.update(doc(db, 'boards', u.boardId, 'ideabooks', u.ideabookId), {
        images: u.images,
        updatedAt: new Date().toISOString(),
        _sourceUrlBackfilledAt: new Date().toISOString(),
      });
    }
    await batch.commit();
    committed += slice.length;
  }

  report.docsUpdated = committed;
  report.finishedAt = new Date().toISOString();

  const outPath = path.join(__dirname, 'staging-backfill-ideabook-source-urls-report.json');
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');
  process.stdout.write(JSON.stringify({ ...report, writtenFile: outPath }, null, 2));
}

main().catch((e) => {
  console.error('BACKFILL_FAILED', e);
  process.exit(1);
});

