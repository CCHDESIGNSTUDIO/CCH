#!/usr/bin/env node
'use strict';
/** Probe: list Cloud Rolling Hills PO lines that look like Basalt Black / Neolith. READ-ONLY. */
const path = require('path');
const admin = require('firebase-admin');
const KEY = path.join(__dirname, '..', '_debug', 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
const db = admin.initializeApp({ credential: admin.credential.cert(require(KEY)) }, 'wo204Probe').firestore();
const BOARD = 'cloud-rolling-hills';
const LIB = 'basalt_black__neolith__stone___tile';
const KNOWN_PO = 'WGLHOWcZgbgYG7oz2fmL';

function str(v) { return String(v == null ? '' : v).trim(); }
function low(v) { return str(v).toLowerCase(); }

(async function main() {
  const snap = await db.collection('boards').doc(BOARD).collection('purchaseOrders').get();
  console.log('PO_DOCS', snap.size);
  snap.forEach((d) => {
    const x = d.data() || {};
    const items = Array.isArray(x.items) ? x.items : [];
    const num = str(x.poNum || x.number || d.id);
    if (d.id === KNOWN_PO) {
      console.log('\n=== KNOWN PO', num, d.id, 'locked=', x.poLocked, 'vendor=', str(x.vendor || x.billToName), 'lines=', items.length, '===');
      items.forEach((it, i) => {
        const t = str(it.title || it.name);
        const lid = str(it.libraryProductId || it.linkedLibraryProductId);
        const blob = low([t, it.productUrl, it.pageUrl, lid, it.sku].join(' '));
        const mark = (blob.includes('basalt') || blob.includes('neolith') || lid === LIB) ? ' <<<' : '';
        console.log(String(i).padStart(3), t.slice(0, 70), '| lib', lid || '—', '| fin', JSON.stringify(str(it.finish || it.color)), '| dim', JSON.stringify(str(it.dimensions || it.size)), mark);
      });
    }
    items.forEach((it, i) => {
      if (!it) return;
      const t = str(it.title || it.name);
      const lid = str(it.libraryProductId || it.linkedLibraryProductId);
      const blob = low([t, it.productUrl, it.pageUrl, it.vendorUrl, lid, it.sku, it.description].join(' '));
      if (!(blob.includes('basalt') || lid === LIB || blob.includes('neolith'))) return;
      if (d.id === KNOWN_PO) return;
      console.log(num, d.id, 'line', i, t.slice(0, 70), '| lib', lid || '—', '| fin', JSON.stringify(str(it.finish || it.color)), '| dim', JSON.stringify(str(it.dimensions || it.size)));
    });
  });
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
