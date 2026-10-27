#!/usr/bin/env node
'use strict';
/** READ-ONLY. FINDING room-board card prices. No writes. */
const admin = require('firebase-admin');
const path = require('path');
const KEY = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(require(KEY)) });
const db = admin.firestore();

const MONEY_KEYS = [
  'clientPrice', 'sellPrice', 'unitSellingPrice', 'unitPrice', 'price', 'amount',
  'totalSelling', 'cost', 'costPrice', 'unitCost', 'tradeCost', 'tax', 'shipping',
  'qty', 'quantity', 'markupPct', 'markupPercent', 'libraryProductId', 'linkedLibraryProductId',
  '_priceHealedFrom', 'proposalNum', 'houzzProposal', 'proposalId', 'invoiceNum'
];

function pickMoney(obj) {
  const out = {};
  MONEY_KEYS.forEach(function(k) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') out[k] = obj[k];
  });
  return out;
}

(async () => {
  const snap = await db.collection('boards').doc('cloud-rolling-hills').collection('clips').get();
  const want = /vela sconce|antasia|echo sconce/i;
  const hits = [];
  let implausible = 0;
  snap.forEach(function(d) {
    const c = d.data() || {};
    const title = String(c.title || c.name || '');
    const cp = parseFloat(c.clientPrice || c.totalSelling) || 0;
    const vendor = String(c.vendor || c.manufacturer || '');
    if (want.test(title) && /hubbardton/i.test(vendor + ' ' + title)) {
      hits.push({ id: d.id, title: title, room: c.room || '', money: pickMoney(c), rawClientPrice: c.clientPrice, rawTotalSelling: c.totalSelling });
    }
    if (cp > 0 && cp < 120 && /sconce|chandelier|pendant|hubbardton|visual comfort|urban electric/i.test(title + ' ' + vendor)) {
      implausible++;
    }
  });
  console.log('matching clips:', hits.length);
  hits.forEach(function(h) {
    console.log('\n=== ' + h.title + '  room=' + h.room + '  id=' + h.id);
    console.log(JSON.stringify(h.money, null, 2));
  });
  console.log('\ncount lighting-ish clips with clientPrice/totalSelling in (0,120):', implausible);
  var libIds = {};
  hits.forEach(function(h) {
    var lid = h.money.libraryProductId || h.money.linkedLibraryProductId;
    if (lid) libIds[lid] = true;
  });
  for (var lid of Object.keys(libIds)) {
    var ls = await db.collection('productLibrary').doc(lid).get();
    var ld = ls.exists ? (ls.data() || {}) : {};
    console.log('\nLIB ' + lid + ' exists=' + ls.exists);
    console.log(JSON.stringify({
      title: ld.title,
      clientPrice: ld.clientPrice,
      sellPrice: ld.sellPrice,
      cost: ld.cost,
      unitCost: ld.unitCost,
      price: ld.price
    }));
  }
  process.exit(0);
})().catch(function(e) { console.error(e); process.exit(1); });
