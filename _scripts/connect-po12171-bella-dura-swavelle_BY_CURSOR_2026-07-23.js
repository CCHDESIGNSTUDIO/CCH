'use strict';
/**
 * Connect PO-12171 (Cloud - Mustang, vendor "Swavelle") to the Vendors page
 * account Cindy updated (Bella Dura / Swavelle family).
 *
 * Default: DRY RUN. Set APPLY=1 to write.
 * Usage:
 *   node _scripts/connect-po12171-bella-dura-swavelle_BY_CURSOR_2026-07-23.js
 *   $env:APPLY=1; node _scripts/connect-po12171-bella-dura-swavelle_BY_CURSOR_2026-07-23.js
 */
const path = require('path');
const fs = require('fs');
const admin = require('firebase-admin');

const KEY = path.join(
  __dirname,
  '..',
  '_debug',
  'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json'
);
const db = admin.initializeApp({ credential: admin.credential.cert(require(KEY)) }, 'po12171').firestore();
const APPLY = process.env.APPLY === '1';
const str = (v) => String(v == null ? '' : v).trim();

(async () => {
  console.log(APPLY ? 'MODE: APPLY' : 'MODE: DRY RUN (set APPLY=1 to write)');

  // 1) Vendor docs that look like Bella Dura / Swavelle
  const vendSnap = await db.collection('vendors').get();
  const vendorHits = [];
  vendSnap.forEach((d) => {
    const data = d.data() || {};
    const name = str(data.name || data.company || data.vendorName);
    const n = name.toLowerCase();
    if (
      n.includes('swavelle') ||
      n.includes('bella dura') ||
      n.includes('belladura')
    ) {
      vendorHits.push({
        id: d.id,
        name,
        email: str(data.email || data.contactEmail),
        phone: str(data.phone || data.contactPhone),
        contact: str(data.contact || data.contactName || data.primaryContact),
        type: str(data.type || data.vendorType),
      });
    }
  });
  console.log('\nVendor docs (Bella Dura / Swavelle):');
  console.log(JSON.stringify(vendorHits, null, 2));

  if (!vendorHits.length) {
    console.error('No matching vendor doc found. Abort.');
    process.exit(1);
  }

  // Prefer exact "Bella Dura/Swavelle" or name containing both; else first hit.
  let target =
    vendorHits.find((v) => /bella\s*dura/i.test(v.name) && /swavelle/i.test(v.name)) ||
    vendorHits.find((v) => /swavelle/i.test(v.name)) ||
    vendorHits[0];
  console.log('\nTarget vendor name for PO:', JSON.stringify(target.name), 'id=', target.id);

  // 2) Find PO-12171
  const boards = await db.collection('boards').get();
  let found = null;
  for (const b of boards.docs) {
    const poRef = db.collection('boards').doc(b.id).collection('purchaseOrders').doc('PO-12171');
    const poSnap = await poRef.get();
    if (poSnap.exists) {
      const data = poSnap.data() || {};
      found = {
        boardId: b.id,
        boardName: str((b.data() || {}).name || (b.data() || {}).title || b.id),
        ref: poRef,
        data,
      };
      break;
    }
  }
  // Also scan by number field if doc id differs
  if (!found) {
    for (const b of boards.docs) {
      const qs = await db
        .collection('boards')
        .doc(b.id)
        .collection('purchaseOrders')
        .where('number', '==', 'PO-12171')
        .limit(5)
        .get();
      if (!qs.empty) {
        const d = qs.docs[0];
        found = {
          boardId: b.id,
          boardName: str((b.data() || {}).name || (b.data() || {}).title || b.id),
          ref: d.ref,
          data: d.data() || {},
        };
        break;
      }
    }
  }

  if (!found) {
    console.error('PO-12171 not found on any board. Abort.');
    process.exit(1);
  }

  const po = found.data;
  const oldVendor = str(po.vendor || po.vendorName);
  console.log('\nPO-12171:');
  console.log('  board:', found.boardName, '(' + found.boardId + ')');
  console.log('  path:', found.ref.path);
  console.log('  current vendor:', JSON.stringify(oldVendor));
  console.log('  status:', str(po.status));
  console.log('  total:', po.total ?? po.grandTotal);

  const items = Array.isArray(po.items) ? po.items : Array.isArray(po.lines) ? po.lines : [];
  const lineVendors = items.map((it, i) => ({
    i,
    vendor: str(it && (it.vendor || it.vendorName)),
    title: str(it && (it.title || it.name || it.description)).slice(0, 60),
  }));
  console.log('  line vendors:', JSON.stringify(lineVendors, null, 2));

  if (oldVendor === target.name) {
    const needsLine =
      lineVendors.some((l) => l.vendor && l.vendor !== target.name && /swavelle|bella/i.test(l.vendor));
    if (!needsLine) {
      console.log('\nAlready connected — header vendor matches. No write needed.');
      process.exit(0);
    }
  }

  const patch = {
    vendor: target.name,
    vendorName: target.name,
    _vendorLinkedAt: new Date().toISOString(),
    _vendorLinkedFrom: oldVendor || null,
    _vendorLinkedNote: 'Linked to vendors/' + target.id + ' (Cindy Bella Dura/Swavelle update 2026-07-23)',
  };

  // Align line vendors that are Swavelle / Bella Dura variants
  let newItems = null;
  if (items.length) {
    newItems = items.map((it) => {
      if (!it || typeof it !== 'object') return it;
      const lv = str(it.vendor || it.vendorName);
      if (!lv) return it;
      const low = lv.toLowerCase();
      if (low.includes('swavelle') || low.includes('bella dura') || low.includes('belladura')) {
        return { ...it, vendor: target.name, vendorName: target.name };
      }
      return it;
    });
    if (Array.isArray(po.items)) patch.items = newItems;
    else if (Array.isArray(po.lines)) patch.lines = newItems;
  }

  console.log('\nProposed patch:', JSON.stringify(patch, null, 2).slice(0, 2000));

  const backupDir = path.join(__dirname, '..', '_backups');
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
  const backupPath = path.join(
    backupDir,
    'PO-12171_before_vendor_link_BY_CURSOR_2026-07-23.json'
  );
  fs.writeFileSync(
    backupPath,
    JSON.stringify(
      { path: found.ref.path, boardId: found.boardId, before: po, targetVendor: target },
      null,
      2
    )
  );
  console.log('Backup written:', backupPath);

  if (!APPLY) {
    console.log('\nDry run only. Re-run with APPLY=1 to update PO vendor string.');
    process.exit(0);
  }

  await found.ref.update(patch);
  console.log('\nUPDATED', found.ref.path, '→ vendor =', JSON.stringify(target.name));
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
