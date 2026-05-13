/**
 * Step 1: Find Rolling Hills board in production, list its subcollections,
 * sample selections to understand schema. READ-ONLY.
 */
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

const PROD_CONFIG = {
  apiKey: 'AIzaSyAd24U5ArVGrA24IxNcYD2NYiTVycyF4og',
  authDomain: 'cch-design-boards.firebaseapp.com',
  projectId: 'cch-design-boards',
  storageBucket: 'cch-design-boards.appspot.com',
  messagingSenderId: '210388013080',
  appId: '1:210388013080:web:cch-design-boards',
};

(async () => {
  const app = initializeApp(PROD_CONFIG);
  const db = getFirestore(app);

  // Find Rolling Hills board
  const snap = await getDocs(collection(db, 'boards'));
  const allBoards = [];
  snap.forEach(d => allBoards.push({ id: d.id, ...d.data() }));
  const rh = allBoards.filter(b =>
    /rolling.?hills/i.test(b.name || '') ||
    /rolling.?hills/i.test(b.title || '') ||
    /rolling.?hills/i.test(b.id || '')
  );
  console.log(`Found ${rh.length} Rolling Hills board candidates:`);
  for (const b of rh) {
    console.log(`  id=${b.id}  name="${b.name}"  client="${b.clientName || ''}"  status="${b.status || ''}"`);
  }

  if (rh.length === 0) {
    console.log('\nNo match. First 20 boards:');
    for (const b of allBoards.slice(0, 20)) {
      console.log(`  id=${b.id}  name="${b.name || b.title || ''}"`);
    }
    process.exit(1);
  }

  // Pick the first match (or biggest if multiple)
  const board = rh[0];
  console.log(`\nUsing board: ${board.id}`);

  // Try common subcollection names — Firestore client SDK can't list subcollections,
  // so we have to probe known names.
  const candidates = ['selections', 'clips', 'products', 'items', 'roomBoards', 'proposals', 'invoices', 'purchaseOrders', 'rooms'];
  const found = {};
  for (const sub of candidates) {
    try {
      const s = await getDocs(collection(db, 'boards', board.id, sub));
      if (s.size > 0) found[sub] = s.size;
    } catch (e) {
      // ignore
    }
  }
  console.log('\nSubcollections under this board (with doc count):');
  for (const [k, v] of Object.entries(found)) console.log(`  ${k}: ${v}`);

  // Most likely "selections" lives in clips (room board items) given Studio code shape we saw.
  // Read a few sample docs from each likely subcollection.
  for (const sub of ['selections', 'clips', 'products']) {
    if (!found[sub]) continue;
    console.log(`\n--- Sample doc from boards/${board.id}/${sub} ---`);
    const s = await getDocs(collection(db, 'boards', board.id, sub));
    let i = 0;
    s.forEach(d => {
      if (i++ >= 2) return;
      const data = d.data();
      console.log(`  doc id: ${d.id}`);
      for (const [k, v] of Object.entries(data)) {
        let display = v;
        if (typeof v === 'string' && v.length > 100) display = v.slice(0, 100) + '...';
        if (Array.isArray(v)) display = `[Array ${v.length}]`;
        if (typeof v === 'object' && v !== null && !Array.isArray(v)) display = `{${Object.keys(v).slice(0,8).join(',')}}`;
        console.log(`    ${k}: ${display}`);
      }
    });
  }

  // Field frequency for the largest-seeming subcollection
  const target = found.clips ? 'clips' : (found.selections ? 'selections' : Object.keys(found)[0]);
  if (target) {
    const s = await getDocs(collection(db, 'boards', board.id, target));
    const fc = {};
    let total = 0;
    s.forEach(d => {
      total++;
      for (const k of Object.keys(d.data())) fc[k] = (fc[k] || 0) + 1;
    });
    console.log(`\nField frequency in boards/${board.id}/${target} (${total} docs):`);
    Object.entries(fc).sort((a,b) => b[1] - a[1]).forEach(([k, v]) => {
      console.log(`  ${k.padEnd(35)} ${v}`);
    });

    // Check for duplicate signatures
    console.log(`\nDuplicate detection in ${target}:`);
    const sig = new Map();
    s.forEach(d => {
      const x = d.data();
      const key = (x.title || x.name || '') + '||' + (x.vendor || x.manufacturer || '') + '||' + (x.sku || '');
      if (!sig.has(key)) sig.set(key, []);
      sig.get(key).push(d.id);
    });
    let dupGroups = 0; let dupExtras = 0;
    for (const [k, ids] of sig) {
      if (ids.length > 1) { dupGroups++; dupExtras += ids.length - 1; }
    }
    console.log(`  total docs: ${total}`);
    console.log(`  unique (title|vendor|sku): ${sig.size}`);
    console.log(`  duplicate groups: ${dupGroups}`);
    console.log(`  duplicate extras (would be removed): ${dupExtras}`);
  }

  process.exit(0);
})().catch(err => { console.error(err); process.exit(1); });
