/**
 * Add `vendorUrl` field to all staging products that have a catalog url.
 * Reads the Apr 27 catalog, joins to staging products by houzzId,
 * sets vendorUrl = the catalog `url` column. Nothing else is touched.
 *
 * STAGING ONLY.
 */
const fs = require('fs');
const path = require('path');
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, writeBatch } = require('firebase/firestore');

const STAGING = {
  apiKey: 'AIzaSyBIwwo7uRij6Q0FZg-qmIS1LC8t2AjXrYo',
  authDomain: 'cch-studio-staging.firebaseapp.com',
  projectId: 'cch-studio-staging',
  storageBucket: 'cch-studio-staging.firebasestorage.app',
  messagingSenderId: '210388013080',
  appId: '1:210388013080:web:fcd520b30c0d50b149736d',
};

const CATALOG = String.raw`C:\Users\cindy\Dropbox\Claude - CCH studio\Houzz FILES\cchdesign_0427\catalog-items-with-images_cchdesign_0427.csv`;

function decodeHtml(s) { return String(s||'').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>'); }
function unwrapHyperlink(c) { if(typeof c!=='string')return c; const m=c.match(/^=HYPERLINK\("([^"]+)"/i); return decodeHtml(m?m[1]:c); }
function parseCSV(text) {
  const rows=[]; let row=[]; let cur=''; let q=false;
  for (let i=0;i<text.length;i++){const c=text[i];
    if(q){if(c==='"'){if(text[i+1]==='"'){cur+='"';i++}else q=false}else cur+=c}
    else{if(c==='"')q=true;else if(c===',') {row.push(cur);cur=''}else if(c==='\r'){}else if(c==='\n'){row.push(cur);rows.push(row);row=[];cur=''}else cur+=c}
  }
  if(cur||row.length){row.push(cur);rows.push(row)}
  return rows;
}

(async () => {
  console.log('[1/3] Reading catalog for url column...');
  const txt = fs.readFileSync(CATALOG, 'utf-8');
  const rows = parseCSV(txt);
  const h = rows[0];
  const idIdx = h.indexOf('id');
  const urlIdx = h.indexOf('url');
  console.log(`  id col: ${idIdx}, url col: ${urlIdx}`);
  const idToUrl = new Map();
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r[idIdx]) continue;
    const url = unwrapHyperlink(r[urlIdx] || '').trim();
    if (url && url.startsWith('http')) idToUrl.set(r[idIdx], url);
  }
  console.log(`  catalog rows with valid url: ${idToUrl.size}`);

  console.log('[2/3] Reading staging products...');
  const app = initializeApp(STAGING);
  const db = getFirestore(app);
  const snap = await getDocs(collection(db, 'products'));
  const updates = [];
  snap.forEach(d => {
    const x = d.data();
    if (!x.houzzId) return;
    const url = idToUrl.get(String(x.houzzId));
    if (!url) return;
    if (x.vendorUrl === url) return; // already set
    updates.push({ id: d.id, url });
  });
  console.log(`  staging products needing vendorUrl: ${updates.length}`);

  console.log('[3/3] Writing in batches of 400...');
  const BATCH = 400;
  let written = 0;
  const start = Date.now();
  for (let i = 0; i < updates.length; i += BATCH) {
    const batch = writeBatch(db);
    const slice = updates.slice(i, i + BATCH);
    for (const u of slice) {
      batch.update(doc(db, 'products', u.id), { vendorUrl: u.url });
    }
    await batch.commit();
    written += slice.length;
    if (written % 2000 === 0 || written === updates.length) {
      const t = ((Date.now() - start) / 1000).toFixed(1);
      console.log(`  ${written}/${updates.length} (${t}s)`);
    }
  }
  console.log(`\nDone. ${written} staging products got vendorUrl set.`);
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
