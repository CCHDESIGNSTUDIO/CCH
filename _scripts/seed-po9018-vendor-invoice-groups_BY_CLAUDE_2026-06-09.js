'use strict';
/**
 * Seed vendorInvoiceGroups[] on PO-9018 (7225 Bugletrail / Etsy) — two vendor invoices, one combined bill.
 *
 *   node _scripts/seed-po9018-vendor-invoice-groups_BY_CLAUDE_2026-06-09.js
 *   node _scripts/seed-po9018-vendor-invoice-groups_BY_CLAUDE_2026-06-09.js --apply
 */
const path = require('path');
const admin = require('firebase-admin');

const APPLY = process.argv.includes('--apply');
const BOARD = '7225-bugletrail';
const PO_ID = 'Yfe4H9V4jBxJMGYRlcgO';

const sa = require(path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json'));
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}
const db = admin.firestore();

const GROUPS = [
  {
    id: 'vig_po9018_riser',
    vendorInvoiceNumber: '#5107148363 · Riser',
    vendorInvoiceDate: '2026-06-08',
    poLineIds: ['po_line_0'],
    status: 'Shipped',
    trackingNumber: '',
    trackingCarrier: '',
    etaDate: '',
    notes: '',
    attachmentName: 'Etsy PO9018_Riser_Order #4082197594 on Jun 8, 2026_Bugletrail.pdf',
    label: 'Rustic Wood Riser Tray'
  },
  {
    id: 'vig_po9018_breadboards',
    vendorInvoiceNumber: '#5107148363 · Breadboards',
    vendorInvoiceDate: '2026-06-08',
    poLineIds: ['po_line_1'],
    status: 'Shipped',
    trackingNumber: '',
    trackingCarrier: '',
    etaDate: '',
    notes: '',
    attachmentName: 'Etsy PO9018_Breadboards _Order #4082197594 on Jun 8, 2026_Bugletrail.pdf',
    label: 'Solid Wood Cutting Board Gift Set'
  }
];

(async () => {
  const ref = db.collection('boards').doc(BOARD).collection('purchaseOrders').doc(PO_ID);
  const snap = await ref.get();
  if (!snap.exists) {
    console.error('PO not found:', BOARD, PO_ID);
    process.exit(1);
  }
  const d = snap.data() || {};
  console.log('PO', d.poNum, '| bill received:', !!(d.bill && d.bill.received));
  console.log('Existing vendorInvoiceGroups:', (d.vendorInvoiceGroups || []).length);
  console.log(JSON.stringify(GROUPS, null, 2));
  if (!APPLY) {
    console.log('\nDry run — re-run with --apply to write vendorInvoiceGroups + procurementStatus.');
    process.exit(0);
  }
  await ref.update({
    vendorInvoiceGroups: GROUPS,
    procurementStatus: d.procurementStatus || 'Sent to Vendor',
    updatedAt: new Date().toISOString()
  });
  console.log('Saved vendorInvoiceGroups on PO-9018.');
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
