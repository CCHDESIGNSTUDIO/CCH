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
  const target = 'alfonso marina';
  for (const colName of ['products', 'productLibrary']) {
    let total = 0, withImage = 0, withFb = 0, withAws = 0, empty = 0, withHouzzId = 0, enriched = 0, rehosted = 0;
    try {
      const snap = await getDocs(collection(db, colName));
      snap.forEach(d => {
        const x = d.data();
        const v = String(x.vendor || x.manufacturer || '').toLowerCase().trim();
        if (v !== target && !(v.length > 3 && (v.includes(target) || target.includes(v)))) return;
        total++;
        const u = String(x.imageUrl || '').trim();
        if (!u) empty++;
        else { withImage++; if (/firebasestorage\./i.test(u)) withFb++; else if (/s3.*amazon|hzcdn/i.test(u)) withAws++; }
        if (x.houzzId) withHouzzId++;
        if (x._enrichedFromHouzzApr27) enriched++;
        if (x._imagesRehostedAt) rehosted++;
      });
      console.log('/' + colName + '/ alfonso marina:');
      console.log('  total: ' + total);
      console.log('  with imageUrl: ' + withImage + ' (firebase:' + withFb + ' aws:' + withAws + ')');
      console.log('  empty imageUrl: ' + empty);
      console.log('  with houzzId: ' + withHouzzId);
      console.log('  _enrichedFromHouzzApr27: ' + enriched);
      console.log('  _imagesRehostedAt: ' + rehosted);
      console.log();
    } catch (e) { console.log(colName + ' error: ' + e.message); }
  }
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
