/**
 * Compare Rolling Hills invoices/proposals/POs in Studio vs houzz_doc_links.json.
 * Lists every IN/PR/PO that Houzz shows for "Cloud - Rolling Hills" but Studio doesn't have.
 */
const fs = require('fs');
const path = require('path');
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
const DOC_LINKS = path.join(__dirname, '..', 'platform', 'houzz_doc_links.json');

function normNum(s, prefix) {
  const m = String(s||'').trim().toUpperCase().match(new RegExp('(' + prefix + ')[\\s-]?(\\d+)'));
  return m ? m[1] + '-' + m[2] : '';
}

(async () => {
  const dl = JSON.parse(fs.readFileSync(DOC_LINKS, 'utf-8'));
  // Houzz docs for Rolling Hills
  const houzzByPrefix = { IN: [], PR: [], PO: [] };
  for (const [k, v] of Object.entries(dl)) {
    const proj = String((v && v.project) || '').toLowerCase();
    if (!/rolling/.test(proj) && !/cloud/.test(proj)) continue;
    if (k.startsWith('IN-')) houzzByPrefix.IN.push({ num: k, info: v });
    else if (k.startsWith('PR-')) houzzByPrefix.PR.push({ num: k, info: v });
    else if (k.startsWith('PO-')) houzzByPrefix.PO.push({ num: k, info: v });
  }
  console.log('Houzz doc_links references for Rolling Hills:');
  console.log('  Invoices: ' + houzzByPrefix.IN.length);
  console.log('  Proposals: ' + houzzByPrefix.PR.length);
  console.log('  POs: ' + houzzByPrefix.PO.length);

  const app = initializeApp(PROD);
  const db = getFirestore(app);
  const studioByPrefix = { IN: new Set(), PR: new Set(), PO: new Set() };
  for (const [sub, prefix] of [['invoices', 'IN'], ['proposals', 'PR'], ['purchaseOrders', 'PO']]) {
    const snap = await getDocs(collection(db, 'boards', 'cloud-rolling-hills', sub));
    snap.forEach(d => {
      const x = d.data();
      const num = normNum(x.number || x.invoiceNum || x.proposalNum || x.poNumber || d.id, prefix);
      if (num) studioByPrefix[prefix].add(num);
    });
  }
  console.log('\nStudio (cloud-rolling-hills) has:');
  console.log('  Invoices: ' + studioByPrefix.IN.size);
  console.log('  Proposals: ' + studioByPrefix.PR.size);
  console.log('  POs: ' + studioByPrefix.PO.size);

  for (const prefix of ['IN', 'PR', 'PO']) {
    const houzzList = houzzByPrefix[prefix];
    const studioSet = studioByPrefix[prefix];
    const missing = houzzList.filter(h => !studioSet.has(h.num));
    console.log('\n=== Missing ' + prefix + ' (in Houzz, NOT in Studio): ' + missing.length + ' ===');
    missing.sort((a,b) => a.num.localeCompare(b.num)).forEach(m => {
      console.log('  ' + m.num.padEnd(12) + ' status=' + (m.info.status || '?').padEnd(15) + ' balance=$' + (m.info.balance || 0));
    });
  }
  // Also show Studio docs Houzz doesn't have (orphans)
  for (const prefix of ['IN', 'PR', 'PO']) {
    const houzzSet = new Set(houzzByPrefix[prefix].map(h => h.num));
    const orphans = [...studioByPrefix[prefix]].filter(s => !houzzSet.has(s));
    if (orphans.length > 0) {
      console.log('\n=== Studio ' + prefix + ' not in Houzz doc_links (likely Studio-native): ' + orphans.length + ' ===');
      orphans.forEach(o => console.log('  ' + o));
    }
  }
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
