const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, getDoc } = require('firebase/firestore');
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
  // Try the specific doc first
  try {
    const ds = await getDoc(doc(db, 'productLibrary', '2eTEqBfQGKKEW6pqq4nA'));
    if (ds.exists()) {
      console.log('FOUND in /productLibrary/2eTEqBfQGKKEW6pqq4nA');
      const x = ds.data();
      const keys = Object.keys(x).sort();
      for (const k of keys) {
        let v = x[k];
        if (Array.isArray(v)) v = '[Array len=' + v.length + ']';
        else if (typeof v === 'object' && v !== null) v = JSON.stringify(v).slice(0, 200);
        else v = String(v).slice(0, 200);
        console.log('  ' + k + ': ' + v);
      }
    } else {
      console.log('NOT in /productLibrary/');
    }
  } catch (e) {
    console.log('Permission/error reading /productLibrary/' + ': ' + e.message);
  }

  // Count and stats
  console.log('\n--- Aggregate /productLibrary/ stats ---');
  try {
    const psnap = await getDocs(collection(db, 'productLibrary'));
    let total = 0, withHouzzId = 0, withFbStorageUrl = 0, withAwsUrl = 0, withEmptyUrl = 0,
        withEnriched = 0, withRehosted = 0, withVendorUrl = 0;
    psnap.forEach(d => {
      total++;
      const x = d.data();
      if (x.houzzId || x.houzzProductId) withHouzzId++;
      if (x._enrichedFromHouzzApr27) withEnriched++;
      if (x._imagesRehostedAt) withRehosted++;
      if (x.vendorUrl) withVendorUrl++;
      const u = String(x.imageUrl || '');
      if (!u) withEmptyUrl++;
      else if (/firebasestorage\./i.test(u)) withFbStorageUrl++;
      else if (/s3.*amazon|hzcdn|houzz/i.test(u)) withAwsUrl++;
    });
    console.log(`  Total docs in /productLibrary/: ${total}`);
    console.log(`  With houzzId:                  ${withHouzzId}`);
    console.log(`  With _enrichedFromHouzzApr27:  ${withEnriched}`);
    console.log(`  With _imagesRehostedAt:        ${withRehosted}`);
    console.log(`  With vendorUrl:                ${withVendorUrl}`);
    console.log(`  With imageUrl (firebase):      ${withFbStorageUrl}`);
    console.log(`  With imageUrl (aws/houzz):     ${withAwsUrl}`);
    console.log(`  With imageUrl (empty):         ${withEmptyUrl}`);
  } catch (e) {
    console.log('Could not list /productLibrary/: ' + e.message);
  }
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
