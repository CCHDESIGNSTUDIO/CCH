/**
 * Find library items that have been deleted but are still referenced by doc lines or clips.
 * Read-only.
 *
 * For RH:
 *  1. Collect every libraryProductId from doc lines and clips.
 *  2. Try to read each one from /productLibrary/.
 *  3. Missing ones = recently deleted.
 *  4. For each deleted, find any clip that mirrors it (same image / houzzId / title) —
 *     that's why it still shows in Selections.
 */
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, collectionGroup, getDocs, doc, getDoc, query, where } = require('firebase/firestore');

const PROD = {
  apiKey: 'AIzaSyAd24U5ArVGrA24IxNcYD2NYiTVycyF4og',
  authDomain: 'cch-design-boards.firebaseapp.com',
  projectId: 'cch-design-boards',
  storageBucket: 'cch-design-boards.firebasestorage.app',
  messagingSenderId: '210388013080',
  appId: '1:210388013080:web:cch-design-boards',
};
const BOARD_ID = 'cloud-rolling-hills';
const norm = (s) => String(s || '').toLowerCase().replace(/[\s\-_"'’″]+/g, ' ').replace(/\s+/g, ' ').trim();
const basename = (u) => { if (!u) return ''; const s = String(u).split('?')[0].split('#')[0]; return (s.split('/').pop() || '').toLowerCase(); };

(async () => {
  const app = initializeApp(PROD);
  const db = getFirestore(app);

  // Collect libraryProductId references from doc lines + clips
  const refs = new Map();   // libProdId -> [{ source: 'docline'|'clip', docNum, lineIdx, title, image, houzzId }]
  function addRef(id, ctx) {
    if (!id) return;
    if (!refs.has(id)) refs.set(id, []);
    refs.get(id).push(ctx);
  }

  for (const sub of ['invoices', 'proposals']) {
    const snap = await getDocs(collection(db, 'boards', BOARD_ID, sub));
    snap.forEach(d => {
      const x = d.data();
      const docNum = String(x.number || x.invoiceNum || x.proposalNum || d.id).trim();
      const items = x.items || x.lineItems || [];
      items.forEach((it, idx) => {
        if (it.libraryProductId) {
          addRef(it.libraryProductId, {
            source: 'docline',
            docNum,
            lineIdx: idx,
            title: it.title || it.name || '',
            image: (it.imageFilename || basename(it.imageUrl || it.image || '')).toLowerCase(),
            houzzId: String(it.houzzId || ''),
          });
        }
      });
    });
  }

  const clipsSnap = await getDocs(collection(db, 'boards', BOARD_ID, 'clips'));
  const clips = [];
  clipsSnap.forEach(d => {
    const x = d.data();
    const c = {
      docId: d.id,
      title: x.title || x.name || x.productName || '',
      image: (x.imageFilename || basename(x.imageUrl || x.image || x.coverImage || '')).toLowerCase(),
      houzzId: String(x.houzzId || x.houzzProductId || ''),
      libraryProductId: x.libraryProductId || '',
    };
    clips.push(c);
    if (c.libraryProductId) {
      addRef(c.libraryProductId, {
        source: 'clip',
        docNum: '(clip)',
        lineIdx: c.docId,
        title: c.title,
        image: c.image,
        houzzId: c.houzzId,
      });
    }
  });

  console.log(`Unique libraryProductId values referenced: ${refs.size}`);
  console.log(`(${[...refs.values()].filter(v => v.some(c => c.source === 'docline')).length} referenced by at least one doc line)`);

  // Try bulk read of productLibrary first (cheaper + permission may be different)
  let libraryIds = null;
  try {
    const libSnap = await getDocs(collection(db, 'productLibrary'));
    libraryIds = new Set();
    libSnap.forEach(d => libraryIds.add(d.id));
    console.log(`Bulk read /productLibrary/: ${libraryIds.size} docs visible`);
  } catch (e) {
    console.log(`Bulk read /productLibrary/ failed: ${e.code || e.message}`);
    // Try filtered read (only RH project) in case rules allow that
    try {
      const q = query(collection(db, 'productLibrary'), where('projectId', '==', BOARD_ID));
      const libSnap = await getDocs(q);
      libraryIds = new Set();
      libSnap.forEach(d => libraryIds.add(d.id));
      console.log(`Filtered read /productLibrary/ where projectId=${BOARD_ID}: ${libraryIds.size} docs`);
    } catch (e2) {
      console.log(`Filtered read also failed: ${e2.code || e2.message}`);
    }
  }

  let missing = [], present = [];
  if (libraryIds) {
    for (const [id, ctxs] of refs) {
      if (libraryIds.has(id)) present.push(id);
      else missing.push({ id, ctxs });
    }
  } else {
    // Fall back: per-doc reads (will fail same as before, but at least try)
    for (const [id, ctxs] of refs) {
      try {
        const ds = await getDoc(doc(db, 'productLibrary', id));
        if (ds.exists()) present.push(id);
        else missing.push({ id, ctxs });
      } catch (e) {
        console.log(`  permission denied on ${id}, cannot determine if deleted`);
      }
    }
  }
  console.log(`\nLibrary lookups complete: ${present.length} present, ${missing.length} MISSING (deleted).\n`);

  if (!missing.length) {
    console.log('No dangling libraryProductId references found.');
    process.exit(0);
  }

  console.log('=== DELETED LIBRARY ITEMS (still referenced by doc lines / clips) ===');
  for (const m of missing) {
    // Pick a representative context to display
    const ctx = m.ctxs[0];
    console.log(`\n  libraryProductId: ${m.id}`);
    console.log(`  representative: title="${ctx.title}" image="${ctx.image}" houzzId="${ctx.houzzId}"`);
    console.log(`  references (${m.ctxs.length}):`);
    for (const c of m.ctxs) {
      console.log(`    - ${c.source.padEnd(7)} ${c.docNum.padEnd(12)} [${c.lineIdx}] ${c.title.slice(0,50)}`);
    }

    // Find clips that mirror this deleted library item
    const mirrors = clips.filter(c => {
      if (c.docId === ctx.lineIdx) return false;   // skip self if context is a clip
      if (c.image && ctx.image && c.image === ctx.image) return true;
      if (c.houzzId && ctx.houzzId && c.houzzId === ctx.houzzId) return true;
      if (norm(c.title) === norm(ctx.title) && ctx.title) return true;
      return false;
    });
    if (mirrors.length) {
      console.log(`  STILL VISIBLE in Selections via these clips:`);
      for (const mc of mirrors) console.log(`    - clip ${mc.docId}  title="${mc.title}"`);
    } else {
      console.log('  (no mirror clips — should disappear from Selections after refresh)');
    }
  }

  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
