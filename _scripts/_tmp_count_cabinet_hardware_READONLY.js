#!/usr/bin/env node
'use strict';
/** Read-only: count Product Library hardware categories on production. No writes. */
const path = require('path');
const admin = require('firebase-admin');
const KEY = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
const db = admin.initializeApp({ credential: admin.credential.cert(require(KEY)) }, 'hwcount').firestore();

function looksHardware(p) {
  const t = String(p.title || p.name || '').toLowerCase();
  return /\b(knob|pull|handle|hinge|latch|backplate|cup pull|bin pull|cabinet hardware|appliance pull|t-bar|t bar)\b/i.test(t);
}

async function loadAll(col) {
  const rows = [];
  let last = null;
  while (true) {
    let q = db.collection(col).limit(500);
    if (last) q = db.collection(col).startAfter(last).limit(500);
    const snap = await q.get();
    snap.forEach((d) => rows.push(Object.assign({ id: d.id, _col: col }, d.data() || {})));
    if (snap.docs.length < 500) break;
    last = snap.docs[snap.docs.length - 1];
  }
  return rows;
}

(async () => {
  const products = await loadAll('products');
  const lib = await loadAll('productLibrary');
  const byId = {};
  products.concat(lib).forEach((p) => {
    if (!byId[p.id]) byId[p.id] = p;
    else {
      const ex = byId[p.id];
      if (!String(ex.category || '').trim() && String(p.category || '').trim()) ex.category = p.category;
      if (!String(ex.title || '').trim()) ex.title = p.title;
    }
  });
  const all = Object.values(byId);
  const catCounts = {};
  all.forEach((p) => {
    const c = String(p.category || '').trim() || '(blank)';
    catCounts[c] = (catCounts[c] || 0) + 1;
  });
  const exactCH = all.filter((p) => String(p.category || '').trim() === 'Cabinet Hardware');
  const exactHw = all.filter((p) => String(p.category || '').trim() === 'Hardware');
  const otherHwish = all.filter((p) => {
    const c = String(p.category || '').trim();
    return c !== 'Cabinet Hardware' && looksHardware(p);
  });
  const longCH = all.filter((p) => {
    const title = String(p.title || p.name || '').trim();
    return title.length > 100 && (String(p.category || '').trim() === 'Cabinet Hardware' || looksHardware(p));
  });
  const hwCats = {};
  otherHwish.forEach((p) => {
    const c = String(p.category || '').trim() || '(blank)';
    hwCats[c] = (hwCats[c] || 0) + 1;
  });

  console.log(JSON.stringify({
    productsCount: products.length,
    productLibraryCount: lib.length,
    mergedCount: all.length,
    exactCabinetHardware: exactCH.length,
    exactHardware: exactHw.length,
    hardwareishOtherCategory: otherHwish.length,
    hardwareishOtherCategoryTop: Object.entries(hwCats).sort((a, b) => b[1] - a[1]).slice(0, 20),
    titleOver100Hardwareish: longCH.length,
    titleOver100Samples: longCH.slice(0, 8).map((p) => ({
      id: p.id,
      len: String(p.title || '').length,
      category: p.category || '',
      title: String(p.title || '').slice(0, 120)
    })),
    cabinetHardwareSamples: exactCH.slice(0, 5).map((p) => ({ title: p.title, vendor: p.vendor, category: p.category })),
    hardwareSamples: exactHw.slice(0, 8).map((p) => ({ title: p.title, vendor: p.vendor, category: p.category })),
    relatedCategoryCounts: Object.keys(catCounts)
      .filter((k) => /hardware|knob|pull|accessories|furniture/i.test(k))
      .map((k) => [k, catCounts[k]])
      .sort((a, b) => b[1] - a[1])
  }, null, 2));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
