/**
 * READ-ONLY verification: did Phase 2C actually update imageUrl on production /products/?
 * Sample 5 docs from the manifest, fetch their current imageUrl from Firestore,
 * and HEAD-test one to confirm it returns 200.
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const { URL } = require('url');
const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc, collection, getDocs, query, where } = require('firebase/firestore');

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
      const req = https.request({ method: 'HEAD', host: u.host, path: u.pathname + u.search, timeout: 8000 }, (res) => {
        resolve({ status: res.statusCode, contentType: res.headers['content-type'] || '', contentLength: res.headers['content-length'] || '' });
      });
      req.on('error', (e) => resolve({ status: 0, error: e.message }));
      req.on('timeout', () => { req.destroy(); resolve({ status: 0, error: 'timeout' }); });
      req.end();
    } catch (e) { resolve({ status: 0, error: e.message }); }
  });
}

(async () => {
  const app = initializeApp(PROD);
  const db = getFirestore(app);

  console.log('Verifying Phase 2C writes landed on production /products/\n');

  // Read manifest, sample 5 ids
  const csvText = fs.readFileSync(path.join(__dirname, 'phase2b-repoint-manifest.csv'), 'utf-8');
  const lines = csvText.split('\n').slice(1).filter(l => l.trim()).slice(0, 5);
  const samples = lines.map(line => {
    const cells = line.split(',').map(c => c.replace(/^"|"$/g, ''));
    return { id: cells[0], title: cells[1], houzzId: cells[2], oldUrl: cells[3], newUrl: cells[4] };
  });

  for (const s of samples) {
    const dref = doc(db, 'products', s.id);
    const dsnap = await getDoc(dref);
    if (!dsnap.exists()) { console.log(`  ${s.id}: doc missing!`); continue; }
    const x = dsnap.data();
    const cur = String(x.imageUrl || '');
    const isNew = cur === s.newUrl;
    const onFirebase = /firebasestorage\.googleapis\.com|firebasestorage\.app/i.test(cur);
    console.log(`  ${s.id}  "${(x.title || '').slice(0, 40)}"  houzzId=${x.houzzId || ''}`);
    console.log(`    expected (manifest): ${s.newUrl.slice(0, 100)}`);
    console.log(`    actual   (firestore): ${cur.slice(0, 100)}`);
    console.log(`    matches manifest:    ${isNew ? 'YES' : 'NO'}`);
    console.log(`    is firebase storage: ${onFirebase ? 'YES' : 'NO'}`);
    console.log(`    has _imagesRehostedAt: ${x._imagesRehostedAt ? 'YES (' + x._imagesRehostedAt + ')' : 'NO'}`);
    console.log(`    has _imageUrlPrevApr27: ${x._imageUrlPrevApr27 ? 'YES' : 'NO'}`);
    if (cur) {
      const r = await head(cur);
      console.log(`    HEAD ${cur.slice(0, 80)}... -> ${r.status}${r.error ? ' (' + r.error + ')' : ''}${r.contentType ? ' ' + r.contentType : ''}`);
    }
    console.log('');
  }

  // Aggregate: count docs with _imagesRehostedAt marker
  console.log('--- Aggregate count from production ---');
  const psnap = await getDocs(collection(db, 'products'));
  let withRehostMarker = 0, withFbStorageUrl = 0, withAwsUrl = 0, withEmptyUrl = 0;
  psnap.forEach(d => {
    const x = d.data();
    if (x._imagesRehostedAt) withRehostMarker++;
    const u = String(x.imageUrl || '');
    if (!u) withEmptyUrl++;
    else if (/firebasestorage\.googleapis\.com|firebasestorage\.app/i.test(u)) withFbStorageUrl++;
    else if (/s3.*amazonaws|st\.hzcdn|houzz/i.test(u)) withAwsUrl++;
  });
  console.log(`  Docs with _imagesRehostedAt marker: ${withRehostMarker}`);
  console.log(`  Docs with Firebase Storage imageUrl: ${withFbStorageUrl}`);
  console.log(`  Docs with Houzz/AWS imageUrl:        ${withAwsUrl}`);
  console.log(`  Docs with empty imageUrl:            ${withEmptyUrl}`);
  process.exit(0);
})().catch(e => { console.error('FAILED:', e); process.exit(1); });
