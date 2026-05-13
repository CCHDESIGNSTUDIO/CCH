/** Audit production /products/ categories AFTER Phase 1.5. List all distinct values + flag suspicious ones. */
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

const REAL_CATS = new Set([
  'art','mirror','accessories','fabric & trim','furniture','stone & tile','appliances & plumbing','hardware',
  'floor covering','florals','wall','bedding & pillows','wall covering','custom furniture','custom upholstery',
  'cabinets','custom bedding and pillows','custom window coverings','windows','lighting','architectural',
  'outdoor','tile & stone','plumbing & appliances','window treatments','flooring','tv','electrical',
  'mirrors & accessories' // CCH extended
]);
function looksLikeRoom(s) {
  const t = String(s||'').trim();
  const re = /(\b(bedroom|bathroom|bath|kitchen|closet|pantry|laundry|mudroom|garage|office|den|nursery|suite|foyer|entry|lobby|walk-?in|powder|living|dining|game\s*room|family\s*room|great\s*room|family\b|great\b|lounge|library|study|music|theater|theatre|media|piano|cellar|wine\s*cellar|terrace|butler|master\b|guest|upstairs|downstairs|hallway|hall\b|\bL\d\b|second\s+floor|first\s+floor|basement|attic|porch|patio|deck|sunroom|playroom|nook|exterior|gym))/i;
  return re.test(t);
}
function isAllCaps(s) {
  if (!s || s.length < 3) return false;
  return s === s.toUpperCase() && /[A-Z]/.test(s);
}

(async () => {
  const app = initializeApp(PROD);
  const db = getFirestore(app);
  const snap = await getDocs(collection(db, 'products'));
  const counts = {};
  snap.forEach(d => {
    const c = String(d.data().category || '').trim();
    if (c) counts[c] = (counts[c] || 0) + 1;
  });

  const allCaps = [];
  const stillRooms = [];
  const real = [];
  const unknown = [];
  for (const [v, n] of Object.entries(counts)) {
    const lower = v.toLowerCase();
    if (REAL_CATS.has(lower)) {
      if (isAllCaps(v)) allCaps.push([v, n]);
      else real.push([v, n]);
    } else if (looksLikeRoom(v)) {
      stillRooms.push([v, n]);
    } else {
      unknown.push([v, n]);
    }
  }

  console.log(`Total distinct category values: ${Object.keys(counts).length}\n`);

  console.log(`ALL-CAPS values that match real categories (likely Houzz room boards, not real categories):`);
  for (const [v, n] of allCaps.sort((a,b) => b[1]-a[1])) console.log(`  ${v}: ${n}`);
  if (allCaps.length === 0) console.log('  (none)');

  console.log(`\nValues that still look like ROOMS (regex caught):`);
  for (const [v, n] of stillRooms.sort((a,b) => b[1]-a[1]).slice(0, 40)) console.log(`  ${v}: ${n}`);
  if (stillRooms.length === 0) console.log('  (none)');

  console.log(`\nUnknown values (not real category, not obvious room) — top 30:`);
  for (const [v, n] of unknown.sort((a,b) => b[1]-a[1]).slice(0, 30)) console.log(`  ${v}: ${n}`);

  console.log(`\nReal category values (top 30):`);
  for (const [v, n] of real.sort((a,b) => b[1]-a[1]).slice(0, 30)) console.log(`  ${v}: ${n}`);

  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
