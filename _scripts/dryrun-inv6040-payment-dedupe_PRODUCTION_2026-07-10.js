'use strict';
/** READ-ONLY dry-run: INV-6040 duplicate payment rows on production. */
const path = require('path');
const admin = require('firebase-admin');

const PROD_KEY = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');

const PROJECT_ID = 'shimano-westridge-lane';
const INVOICE_IDS = ['R28tYM0LWqdgyWVmNfaa', 'R28tYM0UWqdgyWVmMfaa'];

function dedupeLikeStudio(payments) {
  if (!Array.isArray(payments) || payments.length <= 1) return payments || [];
  const seenQb = {};
  const seen = {};
  const out = [];
  for (let i = 0; i < payments.length; i++) {
    const p = payments[i] || {};
    const qb = String(p.qbPaymentId || '').trim();
    if (qb) {
      const amt = Math.round((parseFloat(p.amount) || 0) * 100) / 100;
      const inv = String(p.qbInvoiceTxnId || '').trim();
      const d = String(p.date || '').trim().slice(0, 10);
      const qbKey = 'qb:' + qb + ':' + (inv || '-') + ':' + amt + ':' + d;
      if (seenQb[qbKey]) continue;
      seenQb[qbKey] = true;
      out.push(p);
      continue;
    }
    const qk = String(p.qbPaymentLineKey || '').trim();
    const id = String(p.id || '').trim();
    const amt = Math.round((parseFloat(p.amount) || 0) * 100) / 100;
    const d = String(p.date || '').trim();
    const note = String(p.note || p.reference || '').trim().slice(0, 120);
    const key = qk || (id ? 'id:' + id : '') || ('fp:' + d + '|' + amt + '|' + note);
    if (seen[key]) continue;
    seen[key] = true;
    out.push(p);
  }
  return out;
}

function proposeFix(payments, total) {
  const rows = Array.isArray(payments) ? payments.slice() : [];
  const qbRows = rows.filter((p) => String(p.qbPaymentId || p.qbPaymentLineKey || '').trim());
  const manualRows = rows.filter((p) => !String(p.qbPaymentId || p.qbPaymentLineKey || '').trim());
  const keepQb = qbRows.find((p) => String(p.qbPaymentId) === '75411') || qbRows[0] || null;
  if (keepQb) {
    return {
      strategy: 'keep_qb_drop_manual_dupes',
      payments: [keepQb],
      paidAmount: parseFloat(keepQb.amount) || total,
      paymentCount: 1
    };
  }
  if (manualRows.length === 1) {
    return {
      strategy: 'keep_single_manual',
      payments: manualRows,
      paidAmount: parseFloat(manualRows[0].amount) || total,
      paymentCount: 1
    };
  }
  const deduped = dedupeLikeStudio(rows);
  const sum = Math.round(deduped.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0) * 100) / 100;
  return {
    strategy: 'studio_dedupe_only',
    payments: deduped,
    paidAmount: sum,
    paymentCount: deduped.length
  };
}

async function main() {
  const db = admin.initializeApp({ credential: admin.credential.cert(require(PROD_KEY)) }, 'prod-inv6040').firestore();
  let found = null;
  for (const id of INVOICE_IDS) {
    const ref = db.collection('boards').doc(PROJECT_ID).collection('invoices').doc(id);
    const snap = await ref.get();
    if (!snap.exists) continue;
    found = { id, data: snap.data() || {} };
    break;
  }
  if (!found) {
    const invSnap = await db.collection('boards').doc(PROJECT_ID).collection('invoices')
      .where('invoiceNum', '==', 'INV-6040').limit(3).get();
    if (!invSnap.empty) {
      const d = invSnap.docs[0];
      found = { id: d.id, data: d.data() || {} };
    }
  }
  if (!found) {
    console.log('NOT FOUND: INV-6040 on', PROJECT_ID);
    process.exit(1);
  }

  const inv = found.data;
  const total = parseFloat(inv.total) || 0;
  const payments = inv.payments || [];
  const paidSum = Math.round(payments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0) * 100) / 100;
  const studioDedupe = dedupeLikeStudio(payments);
  const studioDedupeSum = Math.round(studioDedupe.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0) * 100) / 100;
  const fix = proposeFix(payments, total);

  console.log('=== INV-6040 PRODUCTION DRY-RUN (read-only) ===');
  console.log('path: boards/' + PROJECT_ID + '/invoices/' + found.id);
  console.log('invoiceNum:', inv.invoiceNum || inv.number);
  console.log('status:', inv.status, '| qbDocId:', inv.qbDocId, '| qbStatus:', inv.qbStatus);
  console.log('total:', total);
  console.log('paidAmount field:', inv.paidAmount);
  console.log('balance field:', inv.balance);
  console.log('payment rows:', payments.length, '| sum(amount):', paidSum);
  console.log('');
  payments.forEach((p, i) => {
    console.log('  [' + i + ']', {
      amount: p.amount,
      date: p.date,
      method: p.method,
      qbPaymentId: p.qbPaymentId,
      qbPaymentLineKey: p.qbPaymentLineKey,
      note: p.note || p.reference || ''
    });
  });
  console.log('');
  console.log('_dedupeInvoicePaymentRows would keep:', studioDedupe.length, 'rows, sum:', studioDedupeSum);
  console.log('Proposed fix (' + fix.strategy + '):', fix.paymentCount, 'row(s), paidAmount:', fix.paidAmount);
  fix.payments.forEach((p, i) => {
    console.log('  keep[' + i + ']', {
      amount: p.amount,
      date: p.date,
      method: p.method,
      qbPaymentId: p.qbPaymentId
    });
  });
  console.log('');
  console.log('Outstanding impact: over-collected by', Math.max(0, paidSum - total), '→ after fix:', Math.max(0, fix.paidAmount - total));
  console.log('Would update:', fix.paymentCount !== payments.length || Math.abs((parseFloat(inv.paidAmount) || 0) - fix.paidAmount) > 0.02 ? 'YES' : 'NO (already clean)');
}

main().catch((e) => { console.error(e); process.exit(1); });
