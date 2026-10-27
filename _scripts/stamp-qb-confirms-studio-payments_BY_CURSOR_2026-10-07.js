#!/usr/bin/env node
'use strict';
/**
 * PRODUCTION: When Square/Houzz already covers the invoice total, mark counting
 * QuickBooks rows as confirmation (countsTowardPaid: false). Same as WO-258, all projects.
 *
 *   node _scripts\stamp-qb-confirms-studio-payments_BY_CURSOR_2026-10-07.js
 *   node _scripts\stamp-qb-confirms-studio-payments_BY_CURSOR_2026-10-07.js --apply
 */
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const KEY = path.join(__dirname, '..', '_debug', 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
const app = admin.initializeApp({ credential: admin.credential.cert(require(KEY)) }, 'wo285stamp');
const db = app.firestore();
const APPLY = process.argv.indexOf('--apply') >= 0;

function n(v) { return Math.round((parseFloat(v) || 0) * 100) / 100; }
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

function stampPayments(pays, total) {
  const studio = (pays || []).filter((p) => counts(p) && isStudioCash(p));
  const studioSum = n(studio.reduce((s, p) => s + n(p.amount), 0));
  if (studioSum < 0.02) return { changed: false, pays: pays, studioSum: studioSum, stamped: 0 };
  if (total > 0.02 && studioSum < total - 0.02) return { changed: false, pays: pays, studioSum: studioSum, stamped: 0 };
  const confirmId = String((studio[0] && (studio[0].id || ('pay_square_' + (studio[0].squarePaymentId || '')))) || 'studio').trim();
  let stamped = 0;
  const next = (pays || []).map((p) => {
    if (!isQb(p) || !counts(p)) return p;
    stamped++;
    const kind = studio.some(isSquare) ? 'Square' : 'Houzz';
    return Object.assign({}, p, {
      countsTowardPaid: false,
      confirmsPaymentId: confirmId,
      note: 'QuickBooks confirmation of the ' + kind + ' payment'
    });
  });
  return { changed: stamped > 0, pays: next, studioSum: studioSum, stamped: stamped };
}

(async () => {
  const boards = await db.collection('boards').get();
  const work = [];
  for (const b of boards.docs) {
    const invs = await db.collection('boards').doc(b.id).collection('invoices').get();
    invs.forEach((d) => {
      const x = d.data() || {};
      const pays = Array.isArray(x.payments) ? x.payments : [];
      if (pays.length < 2) return;
      const total = n(x.total);
      const result = stampPayments(pays, total);
      if (!result.changed) return;
      const before = n(pays.reduce((s, p) => s + (counts(p) ? n(p.amount) : 0), 0));
      work.push({
        board: b.id,
        id: d.id,
        num: x.invoiceNum || x.number || d.id,
        total: total,
        before: before,
        after: result.studioSum,
        stamped: result.stamped,
        square: pays.filter(isSquare).length,
        houzz: pays.filter((p) => isHouzz(p) && counts(p)).length,
        payments: result.pays,
        paidAmountBefore: n(x.paidAmount)
      });
    });
  }
  const sq = work.filter((w) => w.square > 0);
  console.log('TO STAMP', work.length, 'Square invoices', sq.length, 'Houzz-only', work.length - sq.length);
  sq.forEach((w) => console.log(' SQUARE', w.board, w.num, w.before, '->', w.after, 'qbRows', w.stamped));
  work.filter((w) => !w.square).slice(0, 8).forEach((w) => console.log(' HOUZZ', w.board, w.num, w.before, '->', w.after));
  if (work.length > 8) console.log(' ...', work.length - sq.length, 'Houzz-style confirmations');

  const backupDir = path.join(__dirname, '..', '_backup', 'wo285-qb-confirm-' + new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19));
  fs.mkdirSync(backupDir, { recursive: true });
  fs.writeFileSync(path.join(backupDir, 'index.json'), JSON.stringify(work.map((w) => ({
    board: w.board, id: w.id, num: w.num, total: w.total, before: w.before, after: w.after, stamped: w.stamped, square: w.square
  })), null, 2));
  console.log('Index', backupDir);

  if (!APPLY) {
    console.log('DRY RUN — pass --apply to write production');
    process.exit(0);
  }

  let nOk = 0;
  for (let i = 0; i < work.length; i += 400) {
    const chunk = work.slice(i, i + 400);
    const batch = db.batch();
    chunk.forEach((w) => {
      const ref = db.collection('boards').doc(w.board).collection('invoices').doc(w.id);
      batch.update(ref, {
        payments: w.payments,
        paidAmount: w.after,
        updatedAt: new Date().toISOString(),
        _wo285QbConfirmAt: new Date().toISOString()
      });
    });
    await batch.commit();
    nOk += chunk.length;
    console.log('committed', nOk, '/', work.length);
  }
  console.log('APPLIED', nOk, 'invoices. Square', sq.length);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
