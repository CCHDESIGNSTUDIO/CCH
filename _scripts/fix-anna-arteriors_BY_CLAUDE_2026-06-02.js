#!/usr/bin/env node
'use strict';
/**
 * Fix Anna Semi-Flush Mount (SKU 44764) on Cloud - Rolling Hills.
 * Library row 93WNGh4hetTjLelYY9Xy was Moers; restore Anna on clip + products + invoice.
 *
 *   node _scripts/fix-anna-arteriors_BY_CLAUDE_2026-06-02.js
 *   node _scripts/fix-anna-arteriors_BY_CLAUDE_2026-06-02.js --apply
 */
const path = require('path');
const fs = require('fs');
const admin = require('firebase-admin');

const APPLY = process.argv.includes('--apply');
const PROJECT_ID = 'cloud-rolling-hills';
const CLIP_ID = 'RHcPR9xep5IdBZEKUAK5';
const LIB_ID = '93WNGh4hetTjLelYY9Xy';
const INVOICE_NUM = 'INV-6017';

const ANNA = {
  title: 'Anna Semi-Flush Mount',
  sku: '44764',
  vendor: 'Arteriors',
  category: 'Lighting',
  productUrl: 'https://www.arteriorshome.com/anna-semi-flush-mount-44764',
  vendorUrl: 'https://www.arteriorshome.com/anna-semi-flush-mount-44764',
  pageUrl: 'https://www.arteriorshome.com/anna-semi-flush-mount-44764',
  clippedFromUrl: 'https://www.arteriorshome.com/anna-semi-flush-mount-44764',
  clientPrice: 555,
  costPrice: 555,
  sellPrice: 555,
  qty: 1,
  markupPct: 35,
  clientDescription:
    'L70\r\nTaking a design tip from the Arteriors archives, this semi-flush mount echoes Hollywood Regency style with its classic form and antique brass finish. View Details\r\n$925 $555',
  imageFilename: 'wytfj_44764.jpeg',
  houzzId: '58307313',
  imageUrl:
    'https://firebasestorage.googleapis.com/v0/b/cch-design-boards.firebasestorage.app/o/houzz-products%2F58307313%2F1.jpeg?alt=media&token=8caf3a7c-e454-41ad-8794-ad3afa7e8ad6',
  images: [
    'https://firebasestorage.googleapis.com/v0/b/cch-design-boards.firebasestorage.app/o/houzz-products%2F58307313%2F1.jpeg?alt=media&token=8caf3a7c-e454-41ad-8794-ad3afa7e8ad6',
    'https://firebasestorage.googleapis.com/v0/b/cch-design-boards.firebasestorage.app/o/houzz-products%2F58307313%2F2.jpeg?alt=media&token=c0a2196d-b2ff-49d3-80a3-0738d5e799e1',
    'https://firebasestorage.googleapis.com/v0/b/cch-design-boards.firebasestorage.app/o/houzz-products%2F58307313%2F3.jpeg?alt=media&token=8957548f-e40b-4a4a-8b9e-a418387a0f85',
    'https://firebasestorage.googleapis.com/v0/b/cch-design-boards.firebasestorage.app/o/houzz-products%2F58307313%2F4.jpeg?alt=media&token=9b0ad6d0-5a48-42ce-8060-a3a621d30be6',
    'https://firebasestorage.googleapis.com/v0/b/cch-design-boards.firebasestorage.app/o/houzz-products%2F58307313%2F5.jpeg?alt=media&token=8ebf3406-7468-4982-aee0-419e82620a84',
  ],
  source: 'cch-studio-clipper',
  isClipperMaster: true,
  libraryItemKind: 'product',
  productLifecycle: 'active',
};

const KEY = path.join(
  __dirname,
  '..',
  '_debug',
  'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json'
);

function noMoersHouzz(obj) {
  const o = Object.assign({}, obj);
  const isDelete = (v) => v && typeof v === 'object' && typeof v.isEqual === 'function';
  if (!isDelete(o.houzzId)) delete o.houzzId;
  if (!isDelete(o.houzzProductId)) delete o.houzzProductId;
  if (!isDelete(o.catalogId)) delete o.catalogId;
  return o;
}

const HOUZZ_DELETE = {
  houzzId: admin.firestore.FieldValue.delete(),
  houzzProductId: admin.firestore.FieldValue.delete(),
  catalogId: admin.firestore.FieldValue.delete(),
};

async function main() {
  if (!fs.existsSync(KEY)) {
    console.error('Missing service account:', KEY);
    process.exit(1);
  }
  admin.initializeApp({ credential: admin.credential.cert(require(KEY)) });
  const db = admin.firestore();
  const ts = new Date().toISOString();

  const clipSnap = await db.collection('boards').doc(PROJECT_ID).collection('clips').doc(CLIP_ID).get();
  if (!clipSnap.exists) {
    console.error('Clip missing:', CLIP_ID);
    process.exit(1);
  }
  const clipBefore = clipSnap.data() || {};
  const moersUrl = /33491972|49786/;
  const clipImgOk =
    clipBefore.imageUrl &&
    !moersUrl.test(String(clipBefore.imageUrl)) &&
    String(clipBefore.imageFilename || '') === 'wytfj_44764.jpeg';
  const img = clipImgOk ? clipBefore.imageUrl : ANNA.imageUrl;
  const imgs =
    clipImgOk && Array.isArray(clipBefore.images) && clipBefore.images.length
      ? clipBefore.images
      : ANNA.images;

  const clipPatch = noMoersHouzz({
    title: ANNA.title,
    sku: ANNA.sku,
    vendor: ANNA.vendor,
    category: ANNA.category,
    productUrl: ANNA.productUrl,
    vendorUrl: ANNA.vendorUrl,
    pageUrl: ANNA.pageUrl,
    clippedFromUrl: ANNA.clippedFromUrl,
    clientPrice: ANNA.clientPrice,
    cost: ANNA.costPrice,
    unitCost: ANNA.costPrice,
    clientDescription: ANNA.clientDescription,
    imageUrl: img,
    images: imgs,
    heroImageIndex: 0,
    imageFilename: ANNA.imageFilename,
    houzzId: ANNA.houzzId,
    _imageLocked: true,
    _clipSourceTruth: true,
    libraryProductId: LIB_ID,
    linkedLibraryProductId: LIB_ID,
    source: ANNA.source,
    _annaFixAt: ts,
    updatedAt: ts,
  });
  const libPatch = noMoersHouzz(
    Object.assign({}, ANNA, {
      projectId: PROJECT_ID,
      project: 'Cloud - Rolling Hills',
      room: clipBefore.room || 'Guest 4',
      imageUrl: img,
      images: imgs,
      heroImageIndex: 0,
      costPrice: ANNA.costPrice,
      unitCost: ANNA.costPrice,
      updatedAt: ts,
      _annaFixAt: ts,
      _annaWasMoers: true,
    })
  );
  const plPatch = Object.assign({}, libPatch, { unitCost: libPatch.costPrice });

  const invHits = [];
  const invSnap = await db.collection('boards').doc(PROJECT_ID).collection('invoices').get();
  for (const d of invSnap.docs) {
    const data = d.data() || {};
    const items = Array.isArray(data.items) ? data.items : [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i] || {};
      if (String(it.clipId || it.sourceClipId || '') !== CLIP_ID &&
          String(it.libraryProductId || '') !== LIB_ID &&
          !(String(it.sku || '') === '44764' && String(it.title || '').toLowerCase().indexOf('anna') >= 0)) continue;
      invHits.push({ ref: d.ref, items: items.slice(), lineIdx: i, item: it, invId: d.id, num: data.number || data.invoiceNum });
    }
  }

  const report = {
    mode: APPLY ? 'apply' : 'dry-run',
    clip: { id: CLIP_ID, before: { title: clipBefore.title, sku: clipBefore.sku, lib: clipBefore.libraryProductId }, patch: clipPatch },
    library: { id: LIB_ID, patch: { title: libPatch.title, sku: libPatch.sku, source: libPatch.source } },
    invoices: invHits.map((h) => ({ id: h.invId, num: h.num, lineIdx: h.lineIdx, before: { title: h.item.title, sku: h.item.sku } })),
  };
  console.log(JSON.stringify(report, null, 2));

  if (!APPLY) {
    console.log('\nDry-run. Run with --apply to write.');
    return;
  }

  await clipSnap.ref.set(clipPatch, { merge: true });
  await clipSnap.ref.update(HOUZZ_DELETE);
  await db.collection('products').doc(LIB_ID).set(libPatch, { merge: true });
  await db.collection('products').doc(LIB_ID).update(HOUZZ_DELETE);
  await db.collection('productLibrary').doc(LIB_ID).set(plPatch, { merge: true });
  await db.collection('productLibrary').doc(LIB_ID).update(HOUZZ_DELETE);
  for (const inv of invHits) {
    const items = inv.items.slice();
    items[inv.lineIdx] = noMoersHouzz(
      Object.assign({}, items[inv.lineIdx], {
        title: ANNA.title,
        sku: ANNA.sku,
        vendor: ANNA.vendor,
        category: ANNA.category,
        clipId: CLIP_ID,
        sourceClipId: CLIP_ID,
        libraryProductId: LIB_ID,
        libraryProductIdLocked: true,
        _clipSourceTruth: true,
        _imageLocked: true,
        clientDescription: ANNA.clientDescription,
        productUrl: ANNA.productUrl,
        imageUrl: img,
        images: imgs,
        imageFilename: ANNA.imageFilename,
        houzzId: ANNA.houzzId,
        _imageLocked: true,
        _clipSourceTruth: true,
      })
    );
    await inv.ref.update({ items, updatedAt: ts });
  }

  const props = await db.collection('boards').doc(PROJECT_ID).collection('proposals').get();
  for (const d of props.docs) {
    const items = d.data().items;
    if (!Array.isArray(items)) continue;
    let ch = false;
    const next = items.map((it) => {
      if (String(it.clipId || '') !== CLIP_ID && String(it.libraryProductId || '') !== LIB_ID) return it;
      ch = true;
      return noMoersHouzz(
        Object.assign({}, it, {
          title: ANNA.title,
          sku: ANNA.sku,
          vendor: ANNA.vendor,
          category: ANNA.category,
          libraryProductId: LIB_ID,
          libraryProductIdLocked: true,
          _clipSourceTruth: true,
        })
      );
    });
    if (ch) await d.ref.update({ items: next, updatedAt: ts });
  }

  const backupDir = path.join(__dirname, '..', '_backup', 'anna-fix-2026-06-02');
  fs.mkdirSync(backupDir, { recursive: true });
  fs.writeFileSync(
    path.join(backupDir, 'apply-report.json'),
    JSON.stringify({ at: ts, report }, null, 2)
  );
  console.log('\nApplied. Backup log:', backupDir);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
