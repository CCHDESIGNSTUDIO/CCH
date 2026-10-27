#!/usr/bin/env node
'use strict';
const path = require('path');
const admin = require('firebase-admin');
const KEY = path.join(__dirname, '..', '_debug', 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
const app = admin.initializeApp({ credential: admin.credential.cert(require(KEY)) }, 'sqDupScan');
const db = app.firestore();

function n(v) { return Math.round((parseFloat(v) || 0) * 100) / 100; }
function day(v) {
  if (!v) return '';
  if (typeof v.toDate === 'function') return v.toDate().toISOString().slice(0, 10);
  const s = String(v);
  const m = s.match(/(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  return s.slice(0, 10);
}
function counts(p) {
  if (!p) return false;
  if (p.countsTowardPaid === false) return false;
  if (String(p.confirmsPaymentId || '').trim()) return false;
  return n(p.amount) > 0;
}
function isQb(p) { return !!String(p && p.qbPaymentId || '').trim(); }
function isSquare(p) {
  if (!p || isQb(p)) return false;
  if (String(p.squarePaymentId || '').trim()) return true;
  if (/^pay_square_/i.test(String(p.id || ''))) return true;
  if (/square/i.test(String(p.source || '') + ' ' + String(p.method || ''))) return true;
  return false;
}
function isHouzz(p) {
  if (!p || isQb(p)) return false;
  const blob = (String(p.source || '') + ' ' + String(p.method || '')).toLowerCase();
  return blob.indexOf('houzz') >= 0;
}
function isStudioCash(p) { return isSquare(p) || isHouzz(p); }

(async () => {
  const boards = await db.collection('boards').get();
  const hits = [];
  for (const b of boards.docs) {
    const invs = await db.collection('boards').doc(b.id).collection('invoices').get();
    invs.forEach((d) => {
      const x = d.data() || {};
      const pays = Array.isArray(x.payments) ? x.payments : [];
      if (pays.length < 2) return;
      const total = n(x.total);
      const counted = pays.filter(counts);
      const sumCount = n(counted.reduce((s, p) => s + n(p.amount), 0));
      const studio = counted.filter(isStudioCash);
      const qb = counted.filter(isQb);
      const studioSum = n(studio.reduce((s, p) => s + n(p.amount), 0));
      const hasSq = pays.some(isSquare);
      const over = total > 0.01 && sumCount > total + 0.01;
      const wouldConfirm = qb.length && studio.length && (over || studioSum >= total - 0.02);
      if (!wouldConfirm && !(hasSq && qb.length && over)) return;
      hits.push({
        board: b.id,
        num: x.invoiceNum || x.number || d.id,
        id: d.id,
        status: x.status,
        total: total,
        sumCount: sumCount,
        studioSum: studioSum,
        qbSum: n(qb.reduce((s, p) => s + n(p.amount), 0)),
        square: studio.filter(isSquare).length,
        houzz: studio.filter(isHouzz).length,
        qb: qb.length,
        over: over
      });
    });
  }
  hits.sort((a, b) => a.board.localeCompare(b.board) || String(a.num).localeCompare(String(b.num)));
  console.log('HITS', hits.length);
  hits.forEach((h) => {
    console.log(h.board, h.num, 'total', h.total, 'counted', h.sumCount, 'studio', h.studioSum, 'qb', h.qbSum, 'sq', h.square, 'houzz', h.houzz, 'qbRows', h.qb, h.over ? 'OVER' : 'studio>=total');
  });
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
