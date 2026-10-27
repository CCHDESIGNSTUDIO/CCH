'use strict';
/** READ-ONLY — Production Dorchester count matching Product Library UI (products + productLibrary merge). */
const path = require('path');
const admin = require('firebase-admin');

const PROD_KEY = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
const db = admin.initializeApp({ credential: admin.credential.cert(require(PROD_KEY)) }, 'prod-ui').firestore();

const str = (v) => String(v == null ? '' : v).trim();
const hz = (o) => str(o && (o.houzzId || o.houzzProductId || o.catalogId));
const cost = (p) => parseFloat(p.costPrice || p.unitCost || p.cost) || 0;
const hasImg = (p) => !!(str(p.imageUrl || p.image) || (Array.isArray(p.images) && p.images.length));

function titleMatchDorchester(p) {
  return /dorchester/i.test(str(p.title || p.name));
}

function searchMatchDorchester(p) {
  const t = str(p.title || p.name).toLowerCase();
  return t.indexOf('dorchester') >= 0;
}

async function loadCollection(name) {
  const out = [];
  let last = null;
  const batch = 500;
  while (true) {
    let q = db.collection(name).limit(batch);
    if (last) q = q.startAfter(last);
    const snap = await q.get();
    snap.forEach((d) => out.push({ id: d.id, col: name, ...d.data() }));
    if (snap.size < batch) break;
    last = snap.docs[snap.docs.length - 1];
  }
  return out;
}

(async () => {
  console.log('PRODUCTION — loading products/ + productLibrary/ (like Product Library UI)...\n');
  const [prods, libs] = await Promise.all([
    loadCollection('products'),
    loadCollection('productLibrary'),
  ]);

  const mergeMap = {};
  [...prods, ...libs].forEach((row) => {
    if (!mergeMap[row.id]) mergeMap[row.id] = { id: row.id, cols: new Set(), ...row };
    else {
      const m = mergeMap[row.id];
      m.cols.add(row.col);
      Object.assign(m, row, { cols: m.cols });
    }
  });
  prods.forEach((r) => { if (mergeMap[r.id]) mergeMap[r.id].cols = mergeMap[r.id].cols || new Set(['products']); mergeMap[r.id].cols.add('products'); });
  libs.forEach((r) => {
    if (!mergeMap[r.id]) mergeMap[r.id] = { id: r.id, cols: new Set(['productLibrary']), ...r };
    else mergeMap[r.id].cols.add('productLibrary');
  });

  const all = Object.values(mergeMap);
  const dorSearch = all.filter(searchMatchDorchester);
  const dorHz = all.filter((p) => hz(p) === '54119735' || hz(p) === '33494541');

  console.log('=== What Product Library search "dorchester" would list ===');
  console.log('Unique doc ids matching title:', dorSearch.length);
  console.log('With imageUrl/images:', dorSearch.filter(hasImg).length);
  console.log('Without image:', dorSearch.filter((p) => !hasImg(p)).length);

  const byHz = {};
  dorSearch.forEach((p) => {
    const h = hz(p) || '(no houzz id)';
    (byHz[h] = byHz[h] || []).push(p);
  });
  Object.keys(byHz).sort().forEach((h) => {
    console.log('\nhouzz ' + h + ' — ' + byHz[h].length + ' row(s)');
    byHz[h].forEach((p) => {
      const cols = p.cols ? [...p.cols].join('+') : '?';
      console.log('  ' + p.id + ' | ' + cols + ' | ' + str(p.vendor).slice(0, 18) + ' | $' + cost(p) + ' | img:' + (hasImg(p) ? 'yes' : 'no') + ' | "' + str(p.title || p.name).slice(0, 50) + '"');
    });
  });

  console.log('\n=== products/ ONLY (what quarantine script touches) ===');
  const dorProd = prods.filter(searchMatchDorchester);
  console.log('Active products/ title dorchester:', dorProd.length);
  dorProd.forEach((p) => console.log('  ' + p.id + ' | hz ' + hz(p) + ' | $' + cost(p) + ' | img:' + (hasImg(p) ? 'yes' : 'no')));

  console.log('\n=== productLibrary/ ONLY (NOT moved by quarantine script) ===');
  const dorLib = libs.filter(searchMatchDorchester);
  console.log('productLibrary/ title dorchester:', dorLib.length);
  dorLib.forEach((p) => console.log('  ' + p.id + ' | hz ' + hz(p) + ' | $' + cost(p) + ' | img:' + (hasImg(p) ? 'yes' : 'no')));

  console.log('\n=== Quarantine script scope (products/ duplicate groups only) ===');
  const META = new Set(['updatedAt', 'createdAt', 'owner', '_id', 'addedAt', '_houzzGalleryLinkedAt', '_categoryFixedAt', '_enrichedFromHouzzApr27', '_archiveMeta']);
  function meaningfulFields(p) {
    let n = 0;
    Object.keys(p || {}).forEach((k) => {
      if (META.has(k)) return;
      const v = p[k];
      if (v == null || v === '' || (typeof v === 'string' && !v.trim()) || (Array.isArray(v) && !v.length)) return;
      n++;
    });
    return n;
  }
  function imgCount(o) {
    const s = new Set();
    const add = (u) => { u = str(typeof u === 'string' ? u : (u && (u.url || u.imageUrl || u.src))); if (u) s.add(u); };
    add(o.imageUrl); add(o.image);
    ['images', 'imageUrls', 'gallery', 'photos'].forEach((k) => { if (Array.isArray(o[k])) o[k].forEach(add); });
    return s.size;
  }
  function score(p) {
    let s = meaningfulFields(p);
    if (str(p.sku)) s += 5;
    if (hz(p)) s += 5;
    if (cost(p) > 0) s += 10;
    return s + imgCount(p) * 2;
  }
  function groupKey(p) {
    const h = hz(p);
    if (h) return 'houzz:' + h;
    return 'tv:' + str(p.title || p.name).toLowerCase() + '|' + str(p.vendor).toLowerCase();
  }

  const scoped = prods.filter((p) => hz(p) === '54119735' || hz(p) === '33494541' || searchMatchDorchester(p));
  const groups = {};
  scoped.forEach((p) => { (groups[groupKey(p)] = groups[groupKey(p)] || []).push(p); });
  let move = 0;
  Object.entries(groups).forEach(([k, g]) => {
    if (g.length < 2) return;
    g.sort((a, b) => score(b) - score(a) || String(a.id).localeCompare(String(b.id)));
    const n = g.length - 1;
    move += n;
    console.log('  group ' + k + ': ' + g.length + ' in products/ → move ' + n + ' to archive');
    g.forEach((r, i) => console.log('    ' + (i === 0 ? 'KEEP' : 'JUNK') + ' ' + r.id + ' $' + cost(r)));
  });
  console.log('Total products/ rows quarantine would move:', move);
  console.log('productLibrary-only Dorchester rows (UI shows, script ignores):', dorLib.filter((p) => !prods.some((x) => x.id === p.id)).length);

  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
