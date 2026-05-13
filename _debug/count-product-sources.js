/** Read-only count of production product source values + Clipper indicators. */
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

(async () => {
  const app = initializeApp(PROD);
  const db = getFirestore(app);
  const snap = await getDocs(collection(db, 'products'));
  console.log(`Production /products/: ${snap.size} total\n`);

  const sourceCount = {};
  let withClippedFromUrl = 0;
  let withSourceClipId = 0;
  let withSourceUrl = 0;
  let withVendorUrl = 0;
  let withOnlyClipperSignals = 0;

  snap.forEach(d => {
    const x = d.data();
    const src = x.source || '(no source field)';
    sourceCount[src] = (sourceCount[src] || 0) + 1;
    if (x.clippedFromUrl) withClippedFromUrl++;
    if (x.sourceClipId) withSourceClipId++;
    if (x.sourceUrl) withSourceUrl++;
    if (x.vendorUrl) withVendorUrl++;
    // "Real" Clipper extension products likely have clippedFromUrl populated AND source pointing to a clip
    if (x.clippedFromUrl && (x.source === 'clip-sync' || x.source === 'clipper')) withOnlyClipperSignals++;
  });

  console.log('Distribution of `source` field values (top 15):');
  Object.entries(sourceCount).sort((a,b) => b[1]-a[1]).slice(0, 15).forEach(([k, v]) => {
    console.log(`  ${k.padEnd(30)} ${v}`);
  });

  console.log('\nClipper-indicator field counts:');
  console.log(`  clippedFromUrl populated:        ${withClippedFromUrl}  ← Chrome extension records this`);
  console.log(`  sourceClipId populated:          ${withSourceClipId}    (any clip-promoted, broad)`);
  console.log(`  sourceUrl populated:             ${withSourceUrl}`);
  console.log(`  vendorUrl populated:             ${withVendorUrl}`);
  console.log(`  clippedFromUrl + clip-related source: ${withOnlyClipperSignals}`);

  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
