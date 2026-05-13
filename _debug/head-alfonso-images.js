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
    const v = String(x.vendor || x.manufacturer || '').toLowerCase().trim();
    if (v === 'alfonso marina' || (v.includes('alfonso') && v.includes('marina'))) ea.push({ id: d.id, ...x });
  });
  console.log(`Alfonso Marina products in /products/: ${ea.length}\n`);
  // Check first 6 with imageUrl
  let i = 0;
  for (const p of ea) {
    if (!p.imageUrl) continue;
    if (i++ >= 6) break;
    const r = await head(p.imageUrl);
    console.log(`${p.id}  "${(p.title||'').slice(0,40)}"`);
    console.log(`  url: ${p.imageUrl.slice(0,120)}`);
    console.log(`  HEAD => ${r.status}${r.error ? ' '+r.error : ''} ${r.ct}`);
    console.log();
  }
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
