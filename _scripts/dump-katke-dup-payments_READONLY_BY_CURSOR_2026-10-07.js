#!/usr/bin/env node
'use strict';
const path = require('path');
const admin = require('firebase-admin');
const KEY = path.join(__dirname, '..', '_debug', 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
const app = admin.initializeApp({ credential: admin.credential.cert(require(KEY)) }, 'katkeDupPay');
const db = app.firestore();
const BOARD = 'katke-graceland-dr';

function n(v) { return Math.round((parseFloat(v) || 0) * 100) / 100; }
function day(v) {
  if (!v) return '';
  if (typeof v.toDate === 'function') return v.toDate().toISOString().slice(0, 10);
  return String(v).slice(0, 10);
}
function isSquare(p) {
  if (!p) return false;
  if (String(p.qbPaymentId || '').trim()) return false;
  if (String(p.squarePaymentId || '').trim()) return true;
  return /^pay_square_/i.test(String(p.id || ''));
}
function counts(p) {
  if (!p) return false;
  if (p.countsTowardPaid === false) return false;
  if (String(p.confirmsPaymentId || '').trim()) return false;
  return true;
}

(async () => {
  const snap = await db.collection('boards').doc(BOARD).collection('invoices').get();
  console.log('invoices', snap.size);
  snap.forEach((d) => {
    const x = d.data() || {};
    const pays = Array.isArray(x.payments) ? x.payments : [];
    const total = n(x.total);
    const paidAmt = n(x.paidAmount);
    const sumAll = n(pays.reduce((s, p) => s + n(p.amount), 0));
    const sumCount = n(pays.reduce((s, p) => s + (counts(p) ? n(p.amount) : 0), 0));
    const warn = sumCount > total + 0.01 && total > 0.01;
    if (!pays.length && paidAmt <= total + 0.01) return;
    if (!warn && pays.length < 2) return;
    const hasSq = pays.some(isSquare);
    const hasQb = pays.some((p) => String(p.qbPaymentId || '').trim());
    if (!warn && !(hasSq && hasQb)) return;
    console.log('\n===', x.invoiceNum || x.number, d.id, 'status', x.status, 'total', total, 'paidAmount', paidAmt, 'sumAll', sumAll, 'sumCount', sumCount, warn ? 'WARN' : '');
    pays.forEach((p, i) => {
      console.log(' ', i + 1,
        'amt', n(p.amount),
        'date', day(p.date || p.paidAt),
        'src', p.source || '',
        'method', p.method || p.paymentMethod || '',
        'square', p.squarePaymentId || '',
        'qb', p.qbPaymentId || '',
        'id', p.id || '',
        'count', counts(p),
        'confirm', p.confirmsPaymentId || '',
        'note', String(p.note || '').slice(0, 80)
      );
    });
  });
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
