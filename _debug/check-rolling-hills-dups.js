/**
 * READ-ONLY: scan Cloud-Rolling-Hills clips/selections for triplicate entries.
 * Group by normalized title; for each group, show source / houzzId / image / cost / clientPrice / markup applied.
 */
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');
const PROD = {
  apiKey: 'AIzaSyAd24U5ArVGrA24IxNcYD2NYiTVycyF4og',
  authDomain: 'cch-design-boards.firebaseapp.com',
  projectId: 'cch-design-boards',
  storageBucket: 'cch-design-boards.firebasestorage.app',
  messagingSenderId: '210388013080',
  appId: '1:210388013080:web:cch-design-boards',
};
function norm(s) { return String(s||'').toLowerCase().trim().replace(/\s+/g,' ').replace(/[^\w\s-]/g,''); }
(async () => {
  const app = initializeApp(PROD);
  const db = getFirestore(app);
  const bsnap = await getDocs(collection(db, 'boards'));
  let boardId = null;
  for (const bd of bsnap.docs) {
    const name = (bd.data().name || '').toLowerCase();
    if (name.includes('rolling hills') || bd.id.toLowerCase().includes('rolling-hills')) {
      boardId = bd.id;
      console.log('Board: ' + bd.id + ' name="' + bd.data().name + '"');
      break;
    }
  }
  if (!boardId) { console.log('No Rolling Hills board found'); process.exit(0); }

  // Try clips and selections
  const allItems = [];
  for (const sub of ['clips', 'selections']) {
    try {
      const s = await getDocs(collection(db, 'boards', boardId, sub));
      console.log('  ' + sub + ': ' + s.size);
      s.forEach(d => {
        const x = d.data();
        allItems.push({ sub, id: d.id,
          title: x.title || x.name || x.productName || '',
          vendor: x.vendor || x.manufacturer || '',
          sku: x.sku || '',
          source: x.source || x.dataSource || x.origin || '',
          houzzId: String(x.houzzId || x.houzzProductId || '').trim(),
          imageUrl: String(x.imageUrl || '').trim(),
          cost: parseFloat(x.cost || x.unitCost || x.costPrice) || 0,
          clientPrice: parseFloat(x.clientPrice || x.sellPrice || x.totalSelling) || 0,
          markup: parseFloat(x.markup || 0) || 0,
        });
      });
    } catch (_e) {}
  }

  console.log('\n  Total items: ' + allItems.length);

  // Group by normalized title
  const groups = new Map();
  for (const it of allItems) {
    const key = norm(it.title);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(it);
  }

  // Triplicates and beyond
  const dups = [...groups.entries()].filter(([k,v]) => v.length >= 2).sort((a,b) => b[1].length - a[1].length);
  console.log('  Distinct titles: ' + groups.size);
  console.log('  Titles with 2+ entries: ' + dups.length);
  console.log('  Titles with 3+ entries: ' + dups.filter(([k,v]) => v.length >= 3).length);

  // Markup analysis
  let withCostNoMarkup = 0, withMarkup = 0, withNeither = 0;
  for (const it of allItems) {
    if (it.cost > 0 && it.clientPrice > 0) {
      const ratio = it.clientPrice / it.cost;
      if (ratio >= 1.30 && ratio <= 1.40) withMarkup++;
      else if (Math.abs(ratio - 1.0) < 0.01) withCostNoMarkup++;
    } else if (it.cost === 0 && it.clientPrice === 0) withNeither++;
  }
  console.log('\n  Markup analysis (Studio CCH default = 35%, ratio 1.35):');
  console.log('    Items with cost AND clientPrice ratio 1.30-1.40: ' + withMarkup);
  console.log('    Items with cost === clientPrice (no markup applied): ' + withCostNoMarkup);
  console.log('    Items with cost=0 AND clientPrice=0:               ' + withNeither);

  // Show first 5 triplicate examples
  console.log('\n  --- First 5 triplicate entries ---');
  for (const [k, list] of dups.filter(([k,v]) => v.length >= 3).slice(0, 5)) {
    console.log('\n  TITLE: "' + list[0].title + '" (' + list.length + ' entries)');
    for (const it of list) {
      console.log('    [' + it.sub + '] id=' + it.id.slice(0,12) + '  src=' + (it.source||'?').padEnd(20) + ' houzz=' + (it.houzzId||'-').padEnd(10) + ' img=' + (it.imageUrl ? 'Y' : 'n') + '  cost=$' + it.cost.toFixed(0) + '  client=$' + it.clientPrice.toFixed(0));
    }
  }
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
