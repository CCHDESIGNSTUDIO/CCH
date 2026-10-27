/**
 * PRODUCTION read-only: INV-6064 / PRO-3037 / RH POs Matisse titles + dims.
 *   node _scripts\dump-inv-6064-matisse_BY_CURSOR_2026-09-11.js
 */
'use strict';
const path = require('path');
const admin = require('firebase-admin');
const KEY = path.join(__dirname, '..', '_debug', 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
const app = admin.initializeApp({ credential: admin.credential.cert(require(KEY)) }, 'dump6064matisse');
const db = app.firestore();
const BOARD = 'cloud-rolling-hills';
const INV_ID = 'Kw4Dbyi6kdsyVCnSYGhb';

function slim(it, i) {
  if (!it) return null;
  const title = String(it.title || it.name || '');
  const hit = /matisse|matise|1\s*1\/4|3\/4/i.test(title + ' ' + String(it.description || '') + ' ' + String(it.sku || ''));
  return {
    i: i,
    hit: hit,
    room: it.room || '',
    title: title,
    sku: it.sku || it.model || '',
    dims: it.dimensions || it.dimension || it.size || it.dims || '',
    finish: it.finish || '',
    desc: String(it.description || '').slice(0, 120),
    libraryProductId: it.libraryProductId || it.linkedLibraryProductId || '',
    clipId: it.clipId || it.sourceClipId || '',
    updatedAt: it.updatedAt || it._updatedAt || ''
  };
}

function printLines(label, doc) {
  const items = Array.isArray(doc.items) ? doc.items : [];
  console.log('\n==== ' + label + ' items=' + items.length + ' status=' + (doc.status || '') + ' updated=' + (doc.updatedAt || doc.updated || ''));
  items.forEach(function (it, i) {
    const s = slim(it, i);
    if (!s) return;
    if (s.hit || /matisse|matise/i.test(s.title + s.desc)) {
      console.log(JSON.stringify(s));
    }
  });
}

(async function main() {
  const inv = await db.collection('boards').doc(BOARD).collection('invoices').doc(INV_ID).get();
  if (!inv.exists) {
    console.log('invoice doc missing', INV_ID);
  } else {
    const x = inv.data() || {};
    console.log('INV meta', {
      id: inv.id,
      num: x.invoiceNum || x.number,
      status: x.status,
      published: x.published,
      updatedAt: x.updatedAt,
      linkedProposalId: x.linkedProposalId,
      linkedProposalNum: x.linkedProposalNum,
      linkedPOs: x.linkedPOIds || x.poIds || x.purchaseOrderIds || ''
    });
    printLines('INV-6064 ' + inv.id, x);
  }

  const props = await db.collection('boards').doc(BOARD).collection('proposals').get();
  props.forEach(function (d) {
    const x = d.data() || {};
    const num = String(x.proposalNum || x.number || '');
    if (num === 'PRO-3037' || d.id === 'PRO-3037') printLines('PRO-3037 ' + d.id, x);
  });

  const pos = await db.collection('boards').doc(BOARD).collection('purchaseOrders').get();
  const poHits = [];
  pos.forEach(function (d) {
    const x = d.data() || {};
    const num = String(x.number || x.poNum || '');
    const items = Array.isArray(x.items) ? x.items : [];
    const matisse = items.filter(function (it) {
      return /matisse|matise/i.test(String((it && (it.title || it.name || it.description)) || ''));
    });
    if (matisse.length || num === 'PO-9047') {
      poHits.push({ id: d.id, num: num, vendor: x.vendor || '', status: x.status || x.procurementStatus || '', n: matisse.length });
      printLines((num || d.id) + ' vendor=' + (x.vendor || ''), x);
    }
  });
  console.log('\n==== PO Matisse summary', JSON.stringify(poHits));

  const libSnap = await db.collection('productLibrary').get();
  const libHits = [];
  libSnap.forEach(function (d) {
    const x = d.data() || {};
    const t = String(x.title || x.name || '');
    const sku = String(x.sku || x.houzzId || d.id);
    if (/matisse|matise/i.test(t) || sku === '4465' || sku === '4220' || sku === '75: APC3CMP') {
      libHits.push({
        id: d.id,
        sku: x.sku || '',
        houzzId: x.houzzId || '',
        title: t,
        dims: x.dimensions || x.dimension || x.size || '',
        finish: x.finish || '',
        vendor: x.vendor || '',
        updatedAt: x.updatedAt || ''
      });
    }
  });
  console.log('\n==== productLibrary Matisse', JSON.stringify(libHits, null, 2));

  const clips = await db.collection('boards').doc(BOARD).collection('clips').get();
  const clipHits = [];
  clips.forEach(function (d) {
    const c = d.data() || {};
    const t = String(c.title || c.name || '');
    if (!/matisse|matise/i.test(t)) return;
    clipHits.push({
      id: d.id,
      room: c.room || '',
      title: t,
      sku: c.sku || '',
      dims: c.dimensions || c.size || '',
      libraryProductId: c.libraryProductId || c.linkedLibraryProductId || '',
      invoiceNum: c.invoiceNum || c.houzzInvoice || '',
      poNum: c.poNum || c.purchaseOrderNum || '',
      proposalNum: c.proposalNum || c.houzzProposal || '',
      updatedAt: c.updatedAt || '',
      createdAt: c.createdAt || ''
    });
  });
  console.log('\n==== clips Matisse', JSON.stringify(clipHits, null, 2));

  const libIds = [
    '1_1_4_slab_calacatta_matisse_polished__walker_zanger__stone___tile__polished',
    '3_4_slab_calacatta_matisse_polished__walker_zanger__stone___tile__finish_polished'
  ];
  for (var ci = 0; ci < 2; ci++) {
    var col = ci === 0 ? 'productLibrary' : 'products';
    for (var li = 0; li < libIds.length; li++) {
      var ls = await db.collection(col).doc(libIds[li]).get();
      if (!ls.exists) {
        console.log(col, libIds[li], 'MISSING');
        continue;
      }
      var lx = ls.data() || {};
      console.log(col, JSON.stringify({
        id: ls.id,
        title: lx.title || lx.name,
        sku: lx.sku || '',
        dims: lx.dimensions || lx.size || '',
        finish: lx.finish || '',
        updatedAt: lx.updatedAt || ''
      }));
    }
  }
  process.exit(0);
})().catch(function (e) {
  console.error(e);
  process.exit(1);
});
