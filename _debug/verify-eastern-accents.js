/** READ-ONLY: check Eastern Accents products to see why no images. */
const https = require('https');
const { URL } = require('url');
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
function head(urlStr) {
  return new Promise((resolve) => {
    try {
      const u = new URL(urlStr);
      const req = https.request({ method: 'HEAD', host: u.host, path: u.pathname + u.search, timeout: 6000 }, (res) => resolve({ status: res.statusCode, ct: res.headers['content-type'] || '' }));
      req.on('error', (e) => resolve({ status: 0, error: e.message })); req.on('timeout', () => { req.destroy(); resolve({ status: 0, error: 'timeout' }); }); req.end();
    } catch (e) { resolve({ status: 0, error: e.message }); }
  });
}
(async () => {
  const app = initializeApp(PROD);
  const db = getFirestore(app);
  const psnap = await getDocs(collection(db, 'products'));
  const ea = [];
  psnap.forEach(d => {
    const x = d.data();
    const v = String(x.vendor || x.manufacturer || '').toLowerCase();
    if (v === 'eastern accents') ea.push({ id: d.id, ...x });
  });
  console.log(`Eastern Accents products in production: ${ea.length}`);
  let withFb = 0, withAws = 0, withOther = 0, withEmpty = 0, withHouzzId = 0, rehosted = 0;
  for (const p of ea) {
    const u = String(p.imageUrl || '');
    if (!u) withEmpty++;
    else if (/firebasestorage\./i.test(u)) withFb++;
    else if (/s3.*amazon|hzcdn|houzz/i.test(u)) withAws++;
    else withOther++;
    if (p.houzzId || p.houzzProductId) withHouzzId++;
    if (p._imagesRehostedAt) rehosted++;
  }
  console.log(`  with firebase URL:  ${withFb}`);
  console.log(`  with AWS/houzz URL: ${withAws}`);
  console.log(`  with other URL:     ${withOther}`);
  console.log(`  with empty URL:     ${withEmpty}`);
  console.log(`  with houzzId:       ${withHouzzId}`);
  console.log(`  rehosted by 2C:     ${rehosted}`);
  console.log('\nSample (first 5):');
  for (const p of ea.slice(0, 5)) {
    console.log(`\n  "${(p.title||'').slice(0,55)}"`);
    console.log(`    docId: ${p.id}`);
    console.log(`    houzzId: ${p.houzzId || '(none)'}`);
    console.log(`    sku: ${p.sku || '(none)'}`);
    console.log(`    source: ${p.source || '(none)'}`);
    console.log(`    rehosted: ${p._imagesRehostedAt || 'no'}`);
    console.log(`    _enrichedFromHouzzApr27: ${p._enrichedFromHouzzApr27 ? 'yes' : 'no'}`);
    console.log(`    imageUrl: ${(p.imageUrl||'(empty)').slice(0,110)}`);
    if (p.imageUrl) { const r = await head(p.imageUrl); console.log(`    HEAD => ${r.status}${r.error ? ' '+r.error : ''} ${r.ct}`); }
  }
  process.exit(0);
})().catch(e => { console.error('FAILED:', e); process.exit(1); });
