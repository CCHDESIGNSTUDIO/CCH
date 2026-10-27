'use strict';
/**
 * WO-DRAFT-A v1.1 §6 — READ-ONLY audit
 * Variances already pushed to a client invoice whose reason / charge strip
 * involves a tax token (pre-paid tax double-charge risk).
 * Touches nothing. Production: cch-design-boards.
 */
const path = require('path');
const fs = require('fs');
const admin = require('firebase-admin');

const KEY = require(path.join(
  __dirname,
  '..',
  '_debug',
  'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json'
));
const db = admin.initializeApp({ credential: admin.credential.cert(KEY) }, 'varTaxAudit').firestore();

const TAX_RE = /\b(pre[- ]?paid\s*tax|prepaid\s*tax|tax\s+charged\s+by\s+vendor|\btax\b|vendor_tax|prepaid_tax)\b/i;

function str(v) {
  return String(v == null ? '' : v).trim();
}
function num(v) {
  return parseFloat(v) || 0;
}
function iso(v) {
  if (!v) return '';
  if (typeof v.toDate === 'function') return v.toDate().toISOString();
  return str(v);
}

function reasonStripFromBill(bill) {
  const items = (bill && bill.items) || [];
  if (!items.length) {
    const parts = [];
    if (num(bill && bill.freight)) parts.push('Freight ' + num(bill.freight).toFixed(2));
    if (num(bill && bill.tax)) parts.push('Pre-paid tax ' + num(bill.tax).toFixed(2));
    if (num(bill && bill.extras)) parts.push('Extra ' + num(bill.extras).toFixed(2));
    return parts.join('; ');
  }
  return items
    .filter((it) => Math.abs(num(it.amount)) > 0.009)
    .map((it) => {
      const src = str(it.source || it.label || it.title || 'line');
      const inv = str(it.vendorInvoiceNumber || '');
      return src + (inv ? ' #' + inv : '') + ' ' + num(it.amount).toFixed(2);
    })
    .join('; ');
}

function taxAmountOnBill(bill) {
  let t = num(bill && bill.tax);
  const items = (bill && bill.items) || [];
  items.forEach((it) => {
    const src = str(it.source).toLowerCase();
    if (src === 'tax' || TAX_RE.test(str(it.title) + ' ' + str(it.label))) {
      t += num(it.amount);
    }
  });
  // Prefer explicit bill.tax if items already summed into it — don't double
  if (num(bill && bill.tax) > 0.009 && items.some((it) => str(it.source).toLowerCase() === 'tax')) {
    t = num(bill.tax);
  }
  return Math.round(t * 100) / 100;
}

function hasTaxSignal(variance, bill, reasonStrip) {
  const reason = str(variance && variance.reason);
  const note = str(variance && variance.resolutionNote);
  const blob = [reason, note, reasonStrip].join(' | ');
  if (TAX_RE.test(blob) || reason.toLowerCase() === 'tax') return true;
  if (num(bill && bill.tax) > 0.009) return true;
  const items = (bill && bill.items) || [];
  return items.some((it) => {
    const src = str(it.source).toLowerCase();
    return src === 'tax' || TAX_RE.test(str(it.title) + ' ' + str(it.label));
  });
}

(async () => {
  const boardsSnap = await db.collection('boards').get();
  const hits = [];
  const invoiceLineHits = [];
  let posScanned = 0;
  let linkedVariances = 0;

  for (const b of boardsSnap.docs) {
    const projectId = b.id;
    const projectName = str((b.data() || {}).name) || projectId;
    const poSnap = await db.collection('boards').doc(projectId).collection('purchaseOrders').get();
    for (const p of poSnap.docs) {
      posScanned++;
      const po = p.data() || {};
      const variance = po.variance || null;
      if (!variance || !variance.linkedClientInvoiceId) continue;
      linkedVariances++;
      const bill = po.bill || {};
      const reasonStrip = reasonStripFromBill(bill);
      if (!hasTaxSignal(variance, bill, reasonStrip)) continue;

      const invId = str(variance.linkedClientInvoiceId);
      let inv = null;
      try {
        const invSnap = await db.collection('boards').doc(projectId).collection('invoices').doc(invId).get();
        if (invSnap.exists) inv = invSnap.data() || {};
      } catch (e) { /* */ }

      const status = str(inv && (inv.status || inv.invoiceStatus));
      const published = !!(inv && inv.published);
      const sentAt = iso(inv && (inv.sentAt || inv.emailedAt || inv.publishedAt));
      const invNumber = str(inv && (inv.number || inv.invoiceNumber || inv.num)) || invId;

      hits.push({
        projectId,
        projectName,
        poId: p.id,
        poNumber: str(po.number || po.num || po.poNum || po.name),
        vendor: str(po.vendor),
        varianceAmount: num(variance.amount),
        varianceReason: str(variance.reason),
        resolution: str(variance.resolution),
        taxComponentAmt: taxAmountOnBill(bill),
        reasonStrip,
        linkedClientInvoiceId: invId,
        invoiceNumber: invNumber,
        invoiceStatus: status,
        invoicePublished: published,
        invoiceSentAt: sentAt,
        invoiceCreatedAt: iso(inv && inv.createdAt),
        likelySentToClient: /sent|paid|partial|emailed|published/i.test(status) || published || !!sentAt
      });
    }

    // Also catch invoice lines stamped as variance that look tax-related
    const invSnap = await db.collection('boards').doc(projectId).collection('invoices').get();
    invSnap.forEach((d) => {
      const inv = d.data() || {};
      const items = inv.items || [];
      items.forEach((it, idx) => {
        if (str(it.source) !== 'po_bill_variance' && str(it.id).indexOf('var_') !== 0) return;
        const blob = [it.title, it.description, it.category, it.expenseType].map(str).join(' ');
        if (!TAX_RE.test(blob) && str(it.category).toLowerCase() !== 'tax') return;
        invoiceLineHits.push({
          projectId,
          projectName,
          invoiceId: d.id,
          invoiceNumber: str(inv.number || inv.invoiceNumber || inv.num) || d.id,
          invoiceStatus: str(inv.status || inv.invoiceStatus),
          invoicePublished: !!inv.published,
          invoiceSentAt: iso(inv.sentAt || inv.emailedAt || inv.publishedAt),
          lineId: str(it.id) || String(idx),
          title: str(it.title),
          amount: num(it.amount),
          taxable: it.taxable,
          poNumber: str(it.poNumber),
          poId: str(it.poId)
        });
      });
    });
  }

  const outDir = path.join(__dirname, '..', '_debug');
  const stamp = '2026-08-12';
  const jsonPath = path.join(outDir, `VARIANCE_TAX_ON_INVOICES_AUDIT_BY_CURSOR_${stamp}.json`);
  const csvPath = path.join(outDir, `VARIANCE_TAX_ON_INVOICES_AUDIT_BY_CURSOR_${stamp}.csv`);

  const payload = {
    generatedAt: new Date().toISOString(),
    wo: 'WO-DRAFT-A_variance-breakout-by-reason_CW_Aug11_v1.1 §6',
    readOnly: true,
    boardsScanned: boardsSnap.size,
    purchaseOrdersScanned: posScanned,
    linkedVariancesTotal: linkedVariances,
    taxLinkedVarianceHits: hits.length,
    taxInvoiceLineHits: invoiceLineHits.length,
    sentOrPublishedHits: hits.filter((h) => h.likelySentToClient).length,
    hits,
    invoiceLineHits
  };
  fs.writeFileSync(jsonPath, JSON.stringify(payload, null, 2));

  const cols = [
    'projectName', 'poNumber', 'vendor', 'varianceAmount', 'taxComponentAmt', 'varianceReason',
    'invoiceNumber', 'invoiceStatus', 'invoicePublished', 'invoiceSentAt', 'likelySentToClient', 'reasonStrip'
  ];
  const esc = (v) => {
    const s = String(v == null ? '' : v);
    return /["\n,]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const lines = [cols.join(',')].concat(
    hits.map((h) => cols.map((c) => esc(h[c])).join(','))
  );
  fs.writeFileSync(csvPath, lines.join('\n'));

  console.log(JSON.stringify({
    boardsScanned: payload.boardsScanned,
    purchaseOrdersScanned: payload.purchaseOrdersScanned,
    linkedVariancesTotal: payload.linkedVariancesTotal,
    taxLinkedVarianceHits: payload.taxLinkedVarianceHits,
    sentOrPublishedHits: payload.sentOrPublishedHits,
    taxInvoiceLineHits: payload.taxInvoiceLineHits,
    jsonPath,
    csvPath,
    sampleHits: hits.slice(0, 15).map((h) => ({
      project: h.projectName,
      po: h.poNumber,
      inv: h.invoiceNumber,
      status: h.invoiceStatus,
      sent: h.likelySentToClient,
      varAmt: h.varianceAmount,
      taxAmt: h.taxComponentAmt,
      reason: h.varianceReason
    }))
  }, null, 2));
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
