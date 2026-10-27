'use strict';
/** READ-ONLY: locate recently-clipped Global Views items across products/, productLibrary/, and both
 *  archives. Reports key fields + whether the active-catalog filter (isRealProduct) would hide them. No writes. */
const path = require('path');
const admin = require('firebase-admin');
const KEY = require(path.join(__dirname, '..', '_debug', 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json'));
const db = admin.initializeApp({ credential: admin.credential.cert(KEY) }, 'PROD').firestore();
const str = (v) => String(v == null ? '' : v).trim();
const GV = /global\s*views/i;
const RECENT = '2026-06-07';           // yesterday-ish cutoff (ISO string compare)
const hasImg = (p) => !!(str(p.imageUrl) || str(p.image) || (Array.isArray(p.images) && p.images.length));
// lightweight echo of isRealProduct's decisive gates (to explain why something is hidden from active catalog)
function realProductVerdict(p) {
  const t = str(p.title || p.name).toLowerCase();
  if (!t || t === 'untitled' || t === 'clip') return 'HIDDEN: no/!weak title';
  const kind = str(p.libraryItemKind || p.itemKind).toLowerCase();
  if (['design_service','expense','labor','service'].includes(kind)) return 'HIDDEN: service kind';
  const hasMoneyId = !!(str(p.vendor) || str(p.manufacturer) || str(p.sku) || parseFloat(p.costPrice) > 0 || parseFloat(p.sellPrice) > 0 || parseFloat(p.cost) > 0);
  if (hasMoneyId) return 'shows (has vendor/sku/cost)';
  if (hasImg(p) && t.length >= 3) return 'shows (image+title)';
  return 'HIDDEN: no vendor/sku/cost AND no image';
}
async function scan(coll) {
  const snap = await db.collection(coll).get();
  const hits = [];
  snap.forEach((d) => {
    const p = d.data() || {};
    const recent = str(p.createdAt) >= RECENT || str(p.updatedAt) >= RECENT || str(p.addedAt) >= RECENT;
    if (GV.test(str(p.vendor)) || GV.test(str(p.manufacturer)) || (recent && GV.test(str(p.title || p.name)))) {
      hits.push({ coll, id: d.id, title: str(p.title || p.name), vendor: str(p.vendor), source: str(p.source), clipperMaster: p.isClipperMaster === true, lifecycle: str(p.productLifecycle), projectId: str(p.projectId), project: str(p.project), img: hasImg(p), created: str(p.createdAt).slice(0, 16), verdict: realProductVerdict(p) });
    }
  });
  return hits;
}
(async () => {
  let all = [];
  for (const c of ['products', 'productLibrary', 'products_archive', 'productLibrary_archive']) {
    const h = await scan(c); all = all.concat(h);
    console.log(c + ': ' + h.length + ' Global Views matches');
  }
  // also: ANY product created since cutoff (in case vendor field didn't save)
  const recentAny = [];
  const ps = await db.collection('products').get();
  ps.forEach((d) => { const p = d.data() || {}; if (str(p.createdAt) >= RECENT) recentAny.push({ id: d.id, title: str(p.title || p.name), vendor: str(p.vendor), source: str(p.source), created: str(p.createdAt).slice(0, 16) }); });
  console.log('\n=== Global Views matches (all collections) ===');
  if (!all.length) console.log('  NONE found in any product collection.');
  all.sort((a, b) => b.created.localeCompare(a.created)).forEach((h) => {
    console.log('  [' + h.coll.padEnd(14) + '] "' + h.title.slice(0, 34).padEnd(34) + '" src=' + (h.source || '-').padEnd(18) + ' clip=' + h.clipperMaster + ' life=' + (h.lifecycle || '-') + ' proj=' + (h.project || h.projectId || '-') + ' img=' + h.img + ' created=' + h.created + '  → ' + h.verdict);
  });
  console.log('\n=== ALL products/ created since ' + RECENT + ' (' + recentAny.length + ') — regardless of vendor ===');
  recentAny.sort((a, b) => b.created.localeCompare(a.created)).slice(0, 30).forEach((h) => console.log('  "' + h.title.slice(0, 38).padEnd(38) + '" vendor=' + (h.vendor || '-').padEnd(18) + ' src=' + (h.source || '-') + ' created=' + h.created));
  process.exit(0);
})().catch((e) => { console.error('ERROR', e.message || e); process.exit(1); });
