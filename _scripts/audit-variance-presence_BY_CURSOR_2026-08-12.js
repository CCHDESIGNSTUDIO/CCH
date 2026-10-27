'use strict';
const path = require('path');
const admin = require('firebase-admin');
const KEY = require(path.join(
  __dirname,
  '..',
  '_debug',
  'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json'
));
const db = admin.initializeApp({ credential: admin.credential.cert(KEY) }, 'var2').firestore();

(async () => {
  let withVar = 0;
  let withTaxBill = 0;
  let withLink = 0;
  let withResBillable = 0;
  const samples = [];
  const boards = await db.collection('boards').get();
  for (const b of boards.docs) {
    const pos = await db.collection('boards').doc(b.id).collection('purchaseOrders').get();
    for (const p of pos.docs) {
      const po = p.data() || {};
      const v = po.variance;
      if (!v || Math.abs(parseFloat(v.amount) || 0) < 0.01) continue;
      withVar++;
      if (v.linkedClientInvoiceId) withLink++;
      if (String(v.resolution || '') === 'billable_to_client') withResBillable++;
      const bill = po.bill || {};
      const taxAmt = parseFloat(bill.tax) || 0;
      const taxItems = (bill.items || []).filter((it) => String(it.source || '').toLowerCase() === 'tax');
      const hasTax = taxAmt > 0.01 || taxItems.length;
      if (hasTax) {
        withTaxBill++;
        if (samples.length < 15) {
          samples.push({
            proj: b.id,
            name: (b.data() || {}).name,
            po: po.number || po.num || p.id,
            amt: v.amount,
            reason: v.reason,
            res: v.resolution,
            link: v.linkedClientInvoiceId || null,
            tax: taxAmt || taxItems.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0)
          });
        }
      }
    }
  }
  let varLines = 0;
  const varLineSamples = [];
  for (const b of boards.docs) {
    const invs = await db.collection('boards').doc(b.id).collection('invoices').get();
    invs.forEach((d) => {
      const inv = d.data() || {};
      (inv.items || []).forEach((it) => {
        const id = String(it.id || '');
        const src = String(it.source || '');
        if (src === 'po_bill_variance' || id.startsWith('var_')) {
          varLines++;
          if (varLineSamples.length < 20) {
            varLineSamples.push({
              proj: b.id,
              inv: inv.number || d.id,
              status: inv.status,
              published: !!inv.published,
              title: it.title,
              amt: it.amount,
              src,
              taxable: it.taxable
            });
          }
        }
      });
    });
  }
  console.log(JSON.stringify({
    withVar,
    withTaxBill,
    withLink,
    withResBillable,
    varLines,
    samples,
    varLineSamples
  }, null, 2));
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
