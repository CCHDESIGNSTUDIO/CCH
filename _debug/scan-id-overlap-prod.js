#!/usr/bin/env node
'use strict';
const path = require('path');
const admin = require('firebase-admin');
const key = path.join(__dirname, 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
admin.initializeApp({ credential: admin.credential.cert(require(key)) });
const db = admin.firestore();

(async () => {
  let pl = 0;
  let plSlug = 0;
  let plAuto = 0;
  let plHz = 0;
  const plSnap = await db.collection('productLibrary').get();
  const prodSnap = await db.collection('products').get();
  const prodIds = new Set(prodSnap.docs.map((d) => d.id));
  let both = 0;
  let plOnly = 0;
  plSnap.forEach((d) => {
    pl++;
    if (d.id.includes('__')) plSlug++;
    else plAuto++;
    if (String((d.data() || {}).houzzId || '').trim()) plHz++;
    if (prodIds.has(d.id)) both++;
    else plOnly++;
  });
  console.log('productLibrary total:', pl);
  console.log('  auto-style doc ids:', plAuto);
  console.log('  slug-style doc ids:', plSlug);
  console.log('  houzzId populated:', plHz);
  console.log('  same doc id also in products:', both);
  console.log('  productLibrary-only doc ids:', plOnly);
  console.log('products-only (id not in productLibrary):', prodSnap.size - both);
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
