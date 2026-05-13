const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');
const app = initializeApp({apiKey:'AIzaSyAd24U5ArVGrA24IxNcYD2NYiTVycyF4og',authDomain:'cch-design-boards.firebaseapp.com',projectId:'cch-design-boards',storageBucket:'cch-design-boards.firebasestorage.app',messagingSenderId:'210388013080',appId:'1:210388013080:web:cch-design-boards'});
const db = getFirestore(app);
(async () => {
  for (const c of ['products', 'productLibrary']) {
    const s = await getDocs(collection(db, c));
    let n = 0;
    s.forEach(d => {
      const x = d.data();
      const t = String(x.title||'').toLowerCase();
      if (t.includes('alouette') || t.includes('amer celadon')) {
        n++;
        console.log(c.padEnd(15), d.id.slice(0,16),
          '| title=' + (x.title||'').slice(0,30).padEnd(30),
          '| cat=' + (x.category || '(empty)').padEnd(15),
          '| room=' + (x.room || '(empty)').padEnd(12),
          '| project=' + (x.project || '(empty)').padEnd(20),
          '| vendor=' + (x.vendor || ''),
          '| cost=' + (x.cost || 0),
          '| cprice=' + (x.clientPrice || 0),
          '| source=' + (x.source || ''));
      }
    });
    console.log(c + ': ' + n + ' matches\n');
  }
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
