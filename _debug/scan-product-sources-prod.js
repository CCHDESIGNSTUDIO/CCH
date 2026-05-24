#!/usr/bin/env node
'use strict';
const path = require('path');
const admin = require('firebase-admin');
const key = path.join(__dirname, 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
admin.initializeApp({ credential: admin.credential.cert(require(key)) });
const db = admin.firestore();

(async () => {
  const sources = {};
  const copySources = [];
  let n = 0;
  let hasHouzz = 0;
  let hasSkuL = 0;
  let slugIds = 0;
  let autoIds = 0;

  const snap = await db.collection('products').get();
  snap.forEach((d) => {
    n++;
    const p = d.data() || {};
    const s = String(p.source || p.dataSource || p.origin || '(empty)').trim();
    sources[s] = (sources[s] || 0) + 1;
    if (/copy/i.test(s)) copySources.push({ id: d.id.slice(0, 50), source: s, title: p.title });
    if (String(p.houzzId || '').trim()) hasHouzz++;
    if (/^L\d+$/i.test(String(p.sku || p.lineCode || '').trim())) hasSkuL++;
    if (d.id.includes('__')) slugIds++;
    else autoIds++;
  });

  console.log('products total:', n);
  console.log('houzzId populated:', hasHouzz);
  console.log('L#### sku/lineCode:', hasSkuL);
  console.log('slug-style doc ids (contains __):', slugIds);
  console.log('auto-style doc ids:', autoIds);
  console.log('\nsource field counts (top 20):');
  Object.entries(sources).sort((a, b) => b[1] - a[1]).slice(0, 20).forEach(([k, v]) => console.log(' ', v, k));
  console.log('\nsource contains copy:', copySources.length);
  copySources.slice(0, 20).forEach((x) => console.log(' ', JSON.stringify(x)));

  const plSources = {};
  const plSnap = await db.collection('productLibrary').get();
  plSnap.forEach((d) => {
    const p = d.data() || {};
    const s = String(p.source || p.dataSource || p.origin || '(empty)').trim();
    plSources[s] = (plSources[s] || 0) + 1;
  });
  console.log('\nproductLibrary source counts (top 15):');
  Object.entries(plSources).sort((a, b) => b[1] - a[1]).slice(0, 15).forEach(([k, v]) => console.log(' ', v, k));

  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
