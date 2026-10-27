#!/usr/bin/env node
'use strict';
/**
 * Restore Guest 2 ceiling fan on Cloud Rolling Hills INV-6017 / PO-9036.
 *
 * Problem: Guest 2 was overwritten with the Guest 3/4 Maverick line (shared clipId
 * 0X3msVr4kqQhV1Ap4VX3). Original Guest 2 fan is Matthews Irene (tag L39) from
 * legacy IN-12980. Its room-board clip xyzWHUxDCJS19KptxmME exists on staging but
 * not production.
 *
 *   node fix-guest2-fan-inv6017_BY_CLAUDE_2026-05-19.js
 *   node fix-guest2-fan-inv6017_BY_CLAUDE_2026-05-19.js --apply
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
const INV_LINE_IDX = 3;
const PO_ID = '7lTOzx4fCVBCyKvLMFp7';
const PO_LINE_IDX = 3;
const ROOM = 'Guest 2';
const CLIP_ID = 'xyzWHUxDCJS19KptxmME';
const LIB_ID = 'RyB9EuFW0GGcFxrtc0xb';
const MAVERICK_CLIP = '0X3msVr4kqQhV1Ap4VX3';
const APPLY = process.argv.includes('--apply');
const BACKUP = path.join(__dirname, '..', '_backup', 'guest2-fan-fix-2026-05-19');

const RESTORE = {
  title: '52" Matthews Irene 3-Blade Walnut-Bronze Hugger Ceiling Fan',
  vendor: 'Lighting Innovation',
  cost: 490,
  unitCost: 490,
  markup: 35,
  qty: 1,
  houzzId: '33494372',
  libraryProductId: LIB_ID,
  clientDescription: 'L39 \r\nThis hugger ceiling fan features three walnut stained blades that handsomely complement the textured bronze finish motor.',
  category: 'Lighting',
  taxable: 'on',
  expenseType: 'product',
};

function lineTotal(line) {
  const cost = Number(line.cost || line.unitCost || 0);
  const markup = Number(line.markup != null ? line.markup : line.markupPct || 0);
  const qty = Number(line.qty || 1);
  return Math.round(cost * qty * (1 + markup / 100) * 100) / 100;
}

function heroFromLib(lib) {
  const u = String(lib.imageUrl || lib.image || '').trim();
  if (u) return u;
  if (Array.isArray(lib.images) && lib.images.length) {
    const im = lib.images[0];
    return String(typeof im === 'string' ? im : (im && (im.url || im.imageUrl)) || '').trim();
  }
  return '';
}

(async () => {
  fs.mkdirSync(BACKUP, { recursive: true });
  const ts = new Date().toISOString();

  const invRef = db.collection('boards').doc(PID).collection('invoices').doc(INV_ID);
  const poRef = db.collection('boards').doc(PID).collection('purchaseOrders').doc(PO_ID);
  const clipRef = db.collection('boards').doc(PID).collection('clips').doc(CLIP_ID);
  const libRef = db.collection('products').doc(LIB_ID);

  const [invSnap, poSnap, clipSnap, libSnap, maverickSnap] = await Promise.all([
    invRef.get(), poRef.get(), clipRef.get(), libRef.get(),
    db.collection('boards').doc(PID).collection('clips').doc(MAVERICK_CLIP).get(),
  ]);

  if (!invSnap.exists) throw new Error('INV-6017 not found');
  if (!poSnap.exists) throw new Error('PO-9036 not found');
  if (!libSnap.exists) throw new Error('Matthews Irene library product not found');

  const invItems = JSON.parse(JSON.stringify(invSnap.data().items || []));
  const poItems = JSON.parse(JSON.stringify(poSnap.data().items || []));
  const invLine = invItems[INV_LINE_IDX];
  const poLine = poItems[PO_LINE_IDX];
  if (!invLine || invLine.room !== ROOM) throw new Error('Expected Guest 2 line at invoice index 3');
  if (!poLine || poLine.room !== ROOM) throw new Error('Expected Guest 2 line at PO index 3');

  const lib = libSnap.data() || {};
  const imageUrl = heroFromLib(lib);
  if (!imageUrl) throw new Error('No image on library product ' + LIB_ID);

  const newInvLine = {
    ...invLine,
    ...RESTORE,
    room: ROOM,
    clipId: CLIP_ID,
    imageUrl,
    images: [imageUrl],
    total: lineTotal(RESTORE),
    clientPrice: lineTotal(RESTORE),
    amount: RESTORE.cost,
  };
  delete newInvLine._matchedClipId;

  const newPoLine = {
    ...poLine,
    title: RESTORE.title,
    vendor: RESTORE.vendor,
    cost: RESTORE.cost,
    unitCost: RESTORE.unitCost,
    amount: RESTORE.cost,
    room: ROOM,
    clipId: CLIP_ID,
    libraryProductId: LIB_ID,
    imageUrl,
    image: imageUrl,
    clientPrice: lineTotal(RESTORE),
  };

  const newClip = {
    title: RESTORE.title,
    vendor: RESTORE.vendor,
    room: ROOM,
    cost: RESTORE.cost,
    unitCost: RESTORE.cost,
    qty: 1,
    houzzId: RESTORE.houzzId,
    libraryProductId: LIB_ID,
    invoiceNum: 'INV-6017',
    imageUrl,
    images: [imageUrl],
    category: RESTORE.category,
    clientDescription: RESTORE.clientDescription,
    createdAt: ts,
    updatedAt: ts,
    _restoredFrom: 'IN-12980-line0',
    _fixScript: 'fix-guest2-fan-inv6017_BY_CLAUDE_2026-05-19.js',
  };

  const report = {
    mode: APPLY ? 'apply' : 'dry-run',
    ts,
    before: {
      invoiceLine: {
        title: invLine.title,
        vendor: invLine.vendor,
        clipId: invLine.clipId,
        cost: invLine.cost,
        total: invLine.total,
        clientDescription: String(invLine.clientDescription || '').slice(0, 40),
      },
      poLine: {
        title: poLine.title,
        clipId: poLine.clipId,
        cost: poLine.cost,
      },
      clipExists: clipSnap.exists,
      maverickClipRoom: maverickSnap.exists ? maverickSnap.data().room : null,
    },
    after: {
      invoiceLine: {
        title: newInvLine.title,
        vendor: newInvLine.vendor,
        clipId: newInvLine.clipId,
        cost: newInvLine.cost,
        total: newInvLine.total,
        tag: 'L39',
      },
      poLine: {
        title: newPoLine.title,
        clipId: newPoLine.clipId,
        cost: newPoLine.cost,
      },
      clipId: CLIP_ID,
      roomBoard: ROOM,
    },
    invoiceTotalDelta: Math.round((newInvLine.total - Number(invLine.total || 0)) * 100) / 100,
    warning: 'INV-6017 is Paid + QB-synced. Line total changes by invoiceTotalDelta; review QB balance after apply.',
  };

  fs.writeFileSync(path.join(BACKUP, APPLY ? 'apply-report.json' : 'dry-run-report.json'),
    JSON.stringify(report, null, 2));

  console.log(JSON.stringify(report, null, 2));

  if (!APPLY) {
    console.log('\nDry run only. Re-run with --apply after confirming Matthews Irene is the correct Guest 2 fan.');
    return;
  }

  fs.writeFileSync(path.join(BACKUP, 'backup-before.json'), JSON.stringify({
    invoice: invSnap.data(),
    po: poSnap.data(),
    clip: clipSnap.exists ? clipSnap.data() : null,
  }, null, 2));

  invItems[INV_LINE_IDX] = newInvLine;
  poItems[PO_LINE_IDX] = newPoLine;

  await clipRef.set(newClip, { merge: false });
  await invRef.update({ items: invItems, updatedAt: ts });
  await poRef.update({ items: poItems, updatedAt: ts });
  await libRef.set({ room: ROOM, updatedAt: ts }, { merge: true });

  console.log('\nApplied Guest 2 Matthews Irene to clip, INV-6017 line 3, PO-9036 line 3, library room.');
})();
