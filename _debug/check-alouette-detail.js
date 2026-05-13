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
(async () => {
  const app = initializeApp(PROD);
  const db = getFirestore(app);
  const boardId = 'cloud-rolling-hills';
  // Check all subcollections
  const subs = ['clips', 'selections', 'roomBoards', 'rooms'];
  for (const sub of subs) {
    try {
      const s = await getDocs(collection(db, 'boards', boardId, sub));
      const matches = [];
      s.forEach(d => {
        const x = d.data();
        const t = (x.title || x.name || x.productName || '').toLowerCase();
        if (t.includes('alouette') || t.includes('amer celadon')) matches.push({ id: d.id, ...x });
      });
      if (matches.length) {
        console.log('\n=== ' + sub + ': ' + matches.length + ' matches');
        for (const m of matches) {
          console.log('  id=' + m.id);
          console.log('    title:    "' + (m.title||'')+ '"');
          console.log('    vendor:   ' + (m.vendor || ''));
          console.log('    sku:      ' + (m.sku || ''));
          console.log('    category: ' + (m.category || ''));
          console.log('    room:     ' + (m.room || ''));
          console.log('    rooms[]:  ' + JSON.stringify(m.rooms || []));
          console.log('    cost:     ' + (m.cost || 0));
          console.log('    cprice:   ' + (m.clientPrice || 0));
          console.log('    source:   ' + (m.source || ''));
          console.log('    houzzId:  ' + (m.houzzId || ''));
          console.log('    proposal: ' + (m.houzzProposal || m.proposalNum || m.proposal || ''));
        }
      } else {
        console.log(sub + ': 0 matches (size=' + s.size + ')');
      }
    } catch (e) { console.log(sub + ': error ' + e.message); }
  }
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
