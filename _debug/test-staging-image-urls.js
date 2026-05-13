/** Sample imageUrls from staging clips, test if they actually load. */
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');
const https = require('https');

const STAGING = {
  apiKey: 'AIzaSyBIwwo7uRij6Q0FZg-qmIS1LC8t2AjXrYo',
  authDomain: 'cch-studio-staging.firebaseapp.com',
  projectId: 'cch-studio-staging',
  storageBucket: 'cch-studio-staging.firebasestorage.app',
  messagingSenderId: '210388013080',
  appId: '1:210388013080:web:fcd520b30c0d50b149736d',
};

function head(url) {
  return new Promise(resolve => {
    try {
      const u = new URL(url);
      const req = https.request({
        method: 'HEAD',
        hostname: u.hostname,
        path: u.pathname + u.search,
        headers: { 'User-Agent': 'cch-debug' },
      }, res => {
        resolve({ status: res.statusCode, contentType: res.headers['content-type'] || '', host: u.hostname });
      });
      req.on('error', e => resolve({ status: 'ERR', error: e.message, host: u.hostname }));
      req.setTimeout(8000, () => { req.destroy(); resolve({ status: 'TIMEOUT', host: u.hostname }); });
      req.end();
    } catch (e) { resolve({ status: 'BADURL', error: e.message }); }
  });
}

(async () => {
  const app = initializeApp(STAGING);
  const db = getFirestore(app);
  const snap = await getDocs(collection(db, 'boards', 'cloud-rolling-hills', 'clips'));
  const clips = [];
  snap.forEach(d => clips.push({ id: d.id, ...d.data() }));
  console.log(`Total clips in staging: ${clips.length}`);
  console.log(`Clips with imageUrl populated: ${clips.filter(c => c.imageUrl).length}`);

  // Categorize by URL host
  const byHost = {};
  for (const c of clips) {
    if (!c.imageUrl) continue;
    try {
      const h = new URL(c.imageUrl).hostname;
      byHost[h] = (byHost[h] || 0) + 1;
    } catch { byHost['(invalid)'] = (byHost['(invalid)'] || 0) + 1; }
  }
  console.log('\nImage URL host distribution:');
  for (const [h, n] of Object.entries(byHost).sort((a,b) => b[1]-a[1])) {
    console.log(`  ${n.toString().padStart(4)}  ${h}`);
  }

  // Sample 2 URLs from each host and test them
  console.log('\nLive HEAD requests on samples (status 200 = loads, 403/404 = broken):');
  const seen = {};
  for (const c of clips) {
    if (!c.imageUrl) continue;
    const h = (() => { try { return new URL(c.imageUrl).hostname; } catch { return '(invalid)'; } })();
    seen[h] = seen[h] || 0;
    if (seen[h] >= 2) continue;
    seen[h]++;
    const r = await head(c.imageUrl);
    console.log(`  [${r.status}] ${h}  ${c.imageUrl.slice(0, 100)}...`);
  }

  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
