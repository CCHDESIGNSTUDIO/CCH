#!/usr/bin/env node
'use strict';
/**
 * Restore Suite 2 (Guest 2) + Suite 4 (Guest 4) Maverick 52" on INV-6017 / PO-9036.
 *
 * Problem: Guest 2/3/4 share one clip (0X3msVr4kqQhV1Ap4VX3, room=Guest 3). Suite 2/4
 * lines were overwritten with Guest 3's houzz image + L43 notes. Cynthia's May 21
 * doc-line images still exist in prod storage but are no longer linked.
 *
 * Guest 3 is left unchanged (L43 / existing clip).
 *
 *   node fix-suite2-suite4-maverick-inv6017_BY_CLAUDE_2026-05-19.js
 *   node fix-suite2-suite4-maverick-inv6017_BY_CLAUDE_2026-05-19.js --apply
 */
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const KEY = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
admin.initializeApp({ credential: admin.credential.cert(require(KEY)) });
const db = admin.firestore();

const PID = 'cloud-rolling-hills';
const INV_ID = 'woO4Doh3IHzRuUEXqIhW';
const PO_ID = '7lTOzx4fCVBCyKvLMFp7';
const LIB_ID = 'LCmDNGhkRiMNO0dY4AqK';
const APPLY = process.argv.includes('--apply');
const BACKUP = path.join(__dirname, '..', '_backup', 'suite2-suite4-maverick-fix-2026-05-19');

const SUITE_MAVERICK = {
  title: 'Maverick 52" Ceiling Fan',
  vendor: 'Visual Comfort',
  sku: '3MAVR52BK',
  finish: 'Matte Black / wood blades',
  cost: 519.35,
  unitCost: 519.35,
  markup: 35,
  qty: 1,
  houzzId: '54554937',
  libraryProductId: LIB_ID,
  category: 'Lighting',
  taxable: 'on',
  expenseType: 'product',
  clientDescription: 'L39\r\nMaverick 52 — Matte Black motor with wood blades\r\nSKU: 3MAVR52BK\r\nDiameter: 52"\r\nWeight: 10.4 lbs\r\nRating: Damp Rated\r\nRemote Included: Hand Remote',
};

const TARGETS = [
  {
    room: 'Guest 2',
    suite: 'Suite 2',
    invLineIdx: 3,
    poLineIdx: 3,
    clipId: 'rhG2Maverick52L39',
    imageUrl: 'https://firebasestorage.googleapis.com/v0/b/cch-design-boards.firebasestorage.app/o/projects%2Fcloud-rolling-hills%2Fdoc-lines%2Finvoices%2FwoO4Doh3IHzRuUEXqIhW%2F1779372522460_0_0.png?alt=media&token=0c8a8a0d-b9a3-4320-9f24-0ccf809f759a',
  },
  {
    room: 'Guest 4',
    suite: 'Suite 4',
    invLineIdx: 2,
    poLineIdx: 2,
    clipId: 'rhG4Maverick52L39',
    imageUrl: 'https://firebasestorage.googleapis.com/v0/b/cch-design-boards.firebasestorage.app/o/projects%2Fcloud-rolling-hills%2Fdoc-lines%2Finvoices%2FwoO4Doh3IHzRuUEXqIhW%2F1779374300152_0_0.png?alt=media&token=de77936c-995e-4f38-861c-8c323806d7b3',
  },
];

function lineTotal(line) {
  const cost = Number(line.cost || line.unitCost || 0);
  const markup = Number(line.markup != null ? line.markup : line.markupPct || 0);
  const qty = Number(line.qty || 1);
  return Math.round(cost * qty * (1 + markup / 100) * 100) / 100;
}

function patchLine(existing, clipId, imageUrl) {
  const total = lineTotal(SUITE_MAVERICK);
  return {
    ...existing,
    ...SUITE_MAVERICK,
    room: existing.room,
    clipId,
    lineTag: 'L39',
    imageUrl,
    images: [imageUrl],
    image: imageUrl,
    total,
    clientPrice: total,
    amount: total,
    _imageLocked: true,
    _imageManual: true,
    selectionImageIndex: 0,
  };
}

(async () => {
  fs.mkdirSync(BACKUP, { recursive: true });
  const ts = new Date().toISOString();

  const invRef = db.collection('boards').doc(PID).collection('invoices').doc(INV_ID);
  const poRef = db.collection('boards').doc(PID).collection('purchaseOrders').doc(PO_ID);
  const [invSnap, poSnap] = await Promise.all([invRef.get(), poRef.get()]);
  if (!invSnap.exists || !poSnap.exists) throw new Error('INV-6017 or PO-9036 missing');

  const invItems = JSON.parse(JSON.stringify(invSnap.data().items || []));
  const poItems = JSON.parse(JSON.stringify(poSnap.data().items || []));
  const report = { mode: APPLY ? 'apply' : 'dry-run', ts, targets: [], guest3Untouched: invItems[1] && {
    room: invItems[1].room, sku: invItems[1].sku, clipId: invItems[1].clipId, tag: invItems[1].lineTag || 'L43',
  } };

  for (const t of TARGETS) {
    const invLine = invItems[t.invLineIdx];
    const poLine = poItems[t.poLineIdx];
    if (!invLine || invLine.room !== t.room) throw new Error('Invoice line room mismatch: ' + t.room);
    if (!poLine || poLine.room !== t.room) throw new Error('PO line room mismatch: ' + t.room);

    const clipRef = db.collection('boards').doc(PID).collection('clips').doc(t.clipId);
    const clipSnap = await clipRef.get();
    const newInv = patchLine(invLine, t.clipId, t.imageUrl);
    const newPo = patchLine(poLine, t.clipId, t.imageUrl);

    report.targets.push({
      suite: t.suite,
      room: t.room,
      clipId: t.clipId,
      clipExists: clipSnap.exists,
      sku: SUITE_MAVERICK.sku,
      tag: 'L39',
      imageRestoredFrom: t.imageUrl.split('/').pop().split('?')[0],
      before: { title: invLine.title, sku: invLine.sku, clipId: invLine.clipId, image: String(invLine.imageUrl || '').includes('177937') ? 'cynthia-upload' : 'houzz-default' },
      after: { sku: newInv.sku, clipId: newInv.clipId, tag: newInv.lineTag },
    });

    if (APPLY) {
      invItems[t.invLineIdx] = newInv;
      poItems[t.poLineIdx] = newPo;
      await clipRef.set({
        ...SUITE_MAVERICK,
        room: t.room,
        invoiceNum: 'INV-6017',
        poNum: 'PO-9036',
        imageUrl: t.imageUrl,
        images: [t.imageUrl],
        createdAt: ts,
        updatedAt: ts,
        _restoredFrom: 'cynthia-doc-line-upload-2026-05-21',
      }, { merge: false });
    }
  }

  report.note = 'Guest 4 room board still has Collins Smart clip piCh9SlfNzP8OAqPgnRE — remove manually if obsolete.';
  fs.writeFileSync(path.join(BACKUP, APPLY ? 'apply-report.json' : 'dry-run-report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));

  if (!APPLY) {
    console.log('\nDry run only. Confirm SKU 3MAVR52BK is correct for Suite 2 & 4, then --apply.');
    return;
  }

  fs.writeFileSync(path.join(BACKUP, 'backup-before.json'), JSON.stringify({ invoice: invSnap.data(), po: poSnap.data() }, null, 2));
  await invRef.update({ items: invItems, updatedAt: ts });
  await poRef.update({ items: poItems, updatedAt: ts });
  console.log('\nApplied Suite 2 + Suite 4 Maverick restore.');
})();
