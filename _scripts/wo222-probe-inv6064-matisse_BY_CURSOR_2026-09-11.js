/**
 * PRODUCTION read-only: INV-6064 Matisse lines + 3/4 library identity.
 *   node _scripts\wo222-probe-inv6064-matisse_BY_CURSOR_2026-09-11.js
 */
'use strict';
const path = require('path');
const admin = require('firebase-admin');
const KEY = path.join(__dirname, '..', '_debug', 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
const db = admin.initializeApp({ credential: admin.credential.cert(require(KEY)) }, 'wo222probe').firestore();
const BOARD = 'cloud-rolling-hills';
const INV_ID = 'Kw4Dbyi6kdsyVCnSYGhb';
const LIB_34 = '3_4_slab_calacatta_matisse_polished__walker_zanger__stone___tile__finish_polished';

function moneyKeys(it) {
  return {
    qty: it.qty,
    cost: it.cost,
    markupPct: it.markupPct,
    amount: it.amount,
    shipping: it.shipping,
    taxable: it.taxable,
    unitPrice: it.unitPrice,
    sell: it.sell,
    retail: it.retail
  };
}

(async function main() {
  const inv = await db.collection('boards').doc(BOARD).collection('invoices').doc(INV_ID).get();
  const x = inv.data() || {};
  console.log('INV', {
    id: inv.id,
    num: x.invoiceNum || x.number,
    status: x.status,
    total: x.total,
    taxAmount: x.taxAmount,
    subtotal: x.subtotal,
    updatedAt: x.updatedAt
  });
  (x.items || []).forEach(function (it, i) {
    const t = String((it && (it.title || it.name)) || '');
    if (!/matisse|matise/i.test(t)) return;
    console.log('LINE', JSON.stringify({
      i: i,
      room: it.room || '',
      title: t,
      sku: it.sku || it.model || '',
      dims: it.dimensions || it.size || '',
      finish: it.finish || '',
      libraryProductId: it.libraryProductId || it.linkedLibraryProductId || '',
      clipId: it.clipId || '',
      imageUrl: it.imageUrl || it.image || '',
      images0: (it.images && it.images[0]) || '',
      desc: String(it.description || '').slice(0, 160),
      money: moneyKeys(it)
    }, null, 2));
  });

  const lib = await db.collection('productLibrary').doc(LIB_34).get();
  if (!lib.exists) {
    console.log('LIB MISSING', LIB_34);
  } else {
    const l = lib.data() || {};
    console.log('LIB34', JSON.stringify({
      id: lib.id,
      title: l.title || l.name,
      sku: l.sku,
      houzzId: l.houzzId,
      dims: l.dimensions || l.size,
      finish: l.finish,
      imageUrl: l.imageUrl || l.image || '',
      images0: (l.images && l.images[0]) || '',
      vendor: l.vendor
    }, null, 2));
  }
  process.exit(0);
})().catch(function (e) {
  console.error(e);
  process.exit(1);
});
