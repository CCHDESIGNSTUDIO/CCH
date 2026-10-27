'use strict';
/** READ-ONLY: for each Somerset Bay duplicate group, show the KEY fields per copy (cost, price, sku,
 *  date, image, desc length) across products/ + productLibrary/ — to see whether copies hold DIFFERENT
 *  data (so a pick-one dedup would lose data). No writes. */
const path = require('path');
const admin = require('firebase-admin');
const KEY = require(path.join(__dirname, '..', '_debug', 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json'));
const db = admin.initializeApp({ credential: admin.credential.cert(KEY) }, 'PROD').firestore();
const str = (v) => String(v == null ? '' : v).trim();
const num = (v) => { const n = parseFloat(v); return isFinite(n) && n > 0 ? n : ''; };
const hz = (o) => str(o && (o.houzzId || o.houzzProductId || o.catalogId));
const RE = /somerset\s*bay/i;
const cost = (p) => num(p.costPrice) || num(p.unitCost) || num(p.cost) || num(p.tradeCost) || '';
const sell = (p) => num(p.sellPrice) || num(p.clientPrice) || num(p.price) || num(p.sell) || '';
const img = (p) => str(p.imageUrl || p.image || (Array.isArray(p.images) && p.images[0])) ? 'Y' : '-';
async function rows(coll) { const s = await db.collection(coll).get(); const o = []; s.forEach((d) => { const p = d.data() || {}; if (RE.test(str(p.vendor))) o.push(Object.assign({ _id: d.id, _coll: coll }, p)); }); return o; }
(async () => {
  const all = (await rows('products')).concat(await rows('productLibrary'));
  const groups = {}; all.forEach((r) => { const k = hz(r) ? 'hz:' + hz(r) : 't:' + str(r.title || r.name).toLowerCase(); (groups[k] = groups[k] || []).push(r); });
  const dup = Object.entries(groups).filter(([, g]) => g.length > 1).sort((a, b) => b[1].length - a[1].length);
  console.log('Per-copy field comparison for duplicate groups (does a pick-one dedup lose data?)\n');
  dup.forEach(([k, g]) => {
    console.log(k + '  (' + g.length + ' copies):');
    console.log('   COLL            TITLE                              COST     SELL     SKU     IMG  DESCLEN  UPDATED');
    g.forEach((r) => console.log('   ' + r._coll.padEnd(14) + '  ' + str(r.title || r.name).slice(0, 32).padEnd(32) + '  ' + String(cost(r) || '—').padEnd(7) + '  ' + String(sell(r) || '—').padEnd(7) + '  ' + str(r.sku).padEnd(6) + '  ' + img(r) + '    ' + String(str(r.description).length).padEnd(6) + '  ' + str(r.updatedAt).slice(0, 10)));
    // does any non-keeper-candidate hold data the products/ copy lacks?
    const prod = g.find((r) => r._coll === 'products');
    if (prod) { const libWithCost = g.find((r) => r._coll === 'productLibrary' && cost(r) && !cost(prod)); const libWithSell = g.find((r) => r._coll === 'productLibrary' && sell(r) && !sell(prod)); if (libWithCost || libWithSell) console.log('   >>> WARNING: products/ copy is MISSING ' + [libWithCost ? 'COST' : '', libWithSell ? 'SELL' : ''].filter(Boolean).join('+') + ' that a productLibrary copy HAS — pick-products-keeper would lose it.'); }
    console.log('');
  });
  process.exit(0);
})().catch((e) => { console.error('ERROR', e.message || e); process.exit(1); });
