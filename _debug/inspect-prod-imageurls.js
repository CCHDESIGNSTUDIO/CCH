/**
 * READ-ONLY: inspect production imageUrl values.
 * - Categorize by URL host (firebase / houzz S3 / houzz CDN / other)
 * - Sample 5 URLs and HEAD-check whether they currently respond 200
 * - Report any expired-looking URLs
 * NO writes.
 */
const https = require('https');
const { URL } = require('url');
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

const PROD = {
  apiKey: 'AIzaSyAd24U5ArVGrA24IxNcYD2NYiTVycyF4og',
  authDomain: 'cch-design-boards.firebaseapp.com',
  projectId: 'cch-design-boards',
  storageBucket: 'cch-design-boards.appspot.com',
  messagingSenderId: '210388013080',
  appId: '1:210388013080:web:cch-design-boards',
};

function classify(url) {
  if (!url) return 'empty';
  const u = String(url).trim();
  if (!u) return 'empty';
  if (u.startsWith('data:')) return 'data-uri';
  if (/firebasestorage\.googleapis\.com|firebasestorage\.app/i.test(u)) return 'firebase-storage';
  if (/s3.*amazonaws\.com|st\.hzcdn\.com|houzz/i.test(u)) {
    if (/X-Amz-Expires|X-Amz-Date|X-Amz-Signature/i.test(u)) return 'houzz-aws-presigned';
    if (/st\.hzcdn\.com/i.test(u)) return 'houzz-cdn';
    return 'houzz-other';
  }
  if (/^https?:\/\//i.test(u)) return 'other-http';
  return 'unknown';
}

function expiryFromUrl(url) {
  // AWS pre-signed URLs have X-Amz-Date + X-Amz-Expires
  try {
    const u = new URL(url);
    const date = u.searchParams.get('X-Amz-Date');
    const expSec = u.searchParams.get('X-Amz-Expires');
    if (!date || !expSec) return null;
    const yyyy = date.slice(0, 4), mm = date.slice(4, 6), dd = date.slice(6, 8);
    const hh = date.slice(9, 11), mi = date.slice(11, 13), ss = date.slice(13, 15);
    const startMs = Date.UTC(+yyyy, +mm - 1, +dd, +hh, +mi, +ss);
    const expiresMs = startMs + parseInt(expSec, 10) * 1000;
    return new Date(expiresMs);
  } catch (_e) { return null; }
}

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
  console.log('READ-ONLY production imageUrl inspection\n');
  const app = initializeApp(PROD);
  const db = getFirestore(app);
  const psnap = await getDocs(collection(db, 'products'));
  console.log(`  ${psnap.size} total /products/ docs\n`);

  const byClass = new Map();
  const samples = new Map();   // class → first 5 sample URLs (with id + title)
  let expiringSoon = 0, expired = 0, expiryUnknown = 0;
  const now = new Date();

  psnap.forEach(d => {
    const x = d.data();
    const url = String(x.imageUrl || '').trim();
    const cls = classify(url);
    byClass.set(cls, (byClass.get(cls) || 0) + 1);
    if (!samples.has(cls)) samples.set(cls, []);
    if (samples.get(cls).length < 5 && url) samples.get(cls).push({ id: d.id, title: x.title || '(no title)', url });
    if (cls === 'houzz-aws-presigned') {
      const exp = expiryFromUrl(url);
      if (!exp) expiryUnknown++;
      else if (exp < now) expired++;
      else if ((exp - now) < 7 * 24 * 3600 * 1000) expiringSoon++;
    }
  });

  console.log('--- imageUrl classification ---');
  for (const [cls, n] of [...byClass.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${cls.padEnd(28)} ${String(n).padStart(6)}`);
  }
  console.log(`\n  AWS pre-signed expiry status:`);
  console.log(`    Already expired:  ${expired}`);
  console.log(`    Expires < 7 days: ${expiringSoon}`);
  console.log(`    Unknown expiry:   ${expiryUnknown}`);

  console.log('\n--- Sample URLs per class (HEAD check first one) ---');
  for (const [cls, list] of samples.entries()) {
    if (cls === 'empty') continue;
    console.log(`\n  ${cls}:`);
    for (let i = 0; i < list.length; i++) {
      const s = list[i];
      console.log(`    [${i + 1}] ${s.id} | ${s.title.slice(0, 60)}`);
      console.log(`        ${s.url.slice(0, 130)}${s.url.length > 130 ? '...' : ''}`);
      if (i === 0) {
        const r = await head(s.url);
        console.log(`        HEAD -> ${r.status}${r.error ? ' (' + r.error + ')' : ''}${r.contentType ? ' ' + r.contentType : ''}${r.contentLength ? ' ' + r.contentLength + 'B' : ''}`);
      }
    }
  }

  process.exit(0);
})().catch(e => { console.error('FAILED:', e); process.exit(1); });
