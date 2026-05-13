/**
 * Audit RH /productLibrary/ entries with full timeline detail.
 * Cynthia recalls cleaning this ~2 weeks ago when Houzz library was loaded.
 * Find: when were entries created, what's the source, are they post- or pre-cleanup?
 */
const path = require('path');
const admin = require('firebase-admin');

const SERVICE_ACCOUNT = path.join(__dirname, 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
admin.initializeApp({ credential: admin.credential.cert(require(SERVICE_ACCOUNT)) });
const db = admin.firestore();

const matchesRH = (x) => {
  const candidates = [x.projectId, x.project, x.boardId, x.projectSlug, x.projectName].filter(Boolean).map(v => String(v).toLowerCase());
  return candidates.some(v => v === 'cloud-rolling-hills' || v === 'rolling hills' || v === 'cloud - rolling hills');
};

(async () => {
  console.log('Loading /productLibrary/ ... ');
  const snap = await db.collection('productLibrary').get();
  console.log(`  total docs: ${snap.size}`);

  const rh = [];
  snap.forEach(d => { const x = d.data(); if (matchesRH(x)) rh.push({ id: d.id, ...x }); });
  console.log(`  RH-tagged: ${rh.length}\n`);

  // Group by createdAt date (YYYY-MM-DD), then split by quality
  const byDate = {};
  function bucket(date) {
    if (!byDate[date]) byDate[date] = { total: 0, real: 0, empty: 0, sources: {} };
    return byDate[date];
  }

  let noDateCount = 0;
  for (const r of rh) {
    const ca = r.createdAt || r._createdAt || r.importedAt || r.updatedAt || '';
    const dateKey = ca ? String(ca).slice(0, 10) : '(no date)';
    if (dateKey === '(no date)') noDateCount++;
    const b = bucket(dateKey);
    b.total++;
    const hasImage = !!(r.imageUrl || r.image || r.imageFilename || r.coverImage);
    const hasIds = !!(r.houzzId || r.sku);
    const isReal = hasImage || hasIds;
    if (isReal) b.real++; else b.empty++;
    const src = r.source || r.importedFrom || r._source || '(none)';
    b.sources[src] = (b.sources[src] || 0) + 1;
  }

  console.log('--- /productLibrary/ RH by createdAt date (sorted by date) ---');
  const dates = Object.keys(byDate).sort();
  for (const d of dates) {
    const b = byDate[d];
    const sources = Object.entries(b.sources).map(([k, v]) => `${k}=${v}`).join(', ');
    console.log(`  ${d.padEnd(15)}  total=${String(b.total).padStart(5)}  real=${String(b.real).padStart(5)}  empty=${String(b.empty).padStart(5)}  | ${sources}`);
  }

  // Also group by source field (regardless of date)
  console.log('\n--- /productLibrary/ RH by SOURCE field ---');
  const bySource = {};
  for (const r of rh) {
    const src = r.source || r.importedFrom || r._source || '(none)';
    if (!bySource[src]) bySource[src] = { total: 0, real: 0, empty: 0, dates: {} };
    bySource[src].total++;
    const hasImage = !!(r.imageUrl || r.image || r.imageFilename || r.coverImage);
    const hasIds = !!(r.houzzId || r.sku);
    if (hasImage || hasIds) bySource[src].real++; else bySource[src].empty++;
    const ca = r.createdAt || r._createdAt || '';
    const dateKey = ca ? String(ca).slice(0, 10) : '(no date)';
    bySource[src].dates[dateKey] = (bySource[src].dates[dateKey] || 0) + 1;
  }
  for (const src of Object.keys(bySource).sort((a, b) => bySource[b].total - bySource[a].total)) {
    const s = bySource[src];
    const topDates = Object.entries(s.dates).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([d, n]) => `${d}=${n}`).join(', ');
    console.log(`  ${src.padEnd(35)}  total=${String(s.total).padStart(5)}  real=${String(s.real).padStart(5)}  empty=${String(s.empty).padStart(5)}  | top dates: ${topDates}`);
  }

  // Look for any markers indicating prior cleanup or re-import
  console.log('\n--- Marker fields scan ---');
  const markerCounts = {};
  for (const r of rh) {
    for (const k of Object.keys(r)) {
      if (k.startsWith('_') || k.includes('Backfill') || k.includes('cleaned') || k.includes('reimport') || k.includes('houzzImport') || k.includes('migrated')) {
        markerCounts[k] = (markerCounts[k] || 0) + 1;
      }
    }
  }
  for (const [k, n] of Object.entries(markerCounts).sort((a, b) => b[1] - a[1]).slice(0, 25)) {
    console.log(`  ${k.padEnd(40)}  ${n}`);
  }

  // 10 sample entries from each date bucket (the largest ones), to see what's actually there
  console.log('\n--- 10 sample entries from largest date bucket ---');
  const largestDate = dates.sort((a, b) => byDate[b].total - byDate[a].total)[0];
  console.log(`  largest date bucket: ${largestDate} (${byDate[largestDate].total} entries)`);
  const samples = rh.filter(r => {
    const ca = r.createdAt || r._createdAt || r.importedAt || r.updatedAt || '';
    const dateKey = ca ? String(ca).slice(0, 10) : '(no date)';
    return dateKey === largestDate;
  }).slice(0, 10);
  for (const s of samples) {
    const title = (s.title || s.name || s.productName || '(no title)').toString().slice(0, 60);
    const hasImg = !!(s.imageUrl || s.image || s.imageFilename);
    console.log(`  id=${s.id.slice(0, 22).padEnd(24)} src=${String(s.source || s.importedFrom || '?').slice(0, 18).padEnd(20)} img=${hasImg ? 'Y' : 'N'} title="${title}"`);
  }

  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
