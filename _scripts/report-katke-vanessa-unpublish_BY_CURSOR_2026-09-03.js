#!/usr/bin/env node
'use strict';
/**
 * PRODUCTION read-only: what Vanessa unpublished on Katke today (Pacific).
 *   node _scripts/report-katke-vanessa-unpublish_BY_CURSOR_2026-09-03.js
 */
const path = require('path');
const admin = require('firebase-admin');
const KEY = path.join(
  __dirname,
  '..',
  '_debug',
  'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json'
);
const db = admin.initializeApp({ credential: admin.credential.cert(require(KEY)) }, 'katkeUnpub').firestore();
const BOARD = 'katke-graceland-dr';
const DAY = '2026-09-03';
const TZ = 'America/Los_Angeles';

function pacificDate(iso) {
  if (!iso) return '';
  const d = iso.toDate ? iso.toDate() : (iso._seconds ? new Date(iso._seconds * 1000) : new Date(iso));
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}
function pacificTime(iso) {
  if (!iso) return '';
  const d = iso.toDate ? iso.toDate() : (iso._seconds ? new Date(iso._seconds * 1000) : new Date(iso));
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit', hour12: true }).format(d);
}
function n(v) { return parseFloat(v) || 0; }
function money(v) { return n(v).toFixed(2); }
function isVanessa(entry, doc) {
  const blob = [
    entry && entry.userEmail,
    entry && entry.userName,
    entry && entry.authorEmail,
    entry && entry.authorName,
    entry && entry.member,
    doc && doc.lastEditedBy,
    doc && doc.lastEditedByEmail
  ].join(' ').toLowerCase();
  return blob.includes('vanessa');
}
function numOf(col, id, x) {
  if (col === 'proposals') return x.proposalNum || x.number || id;
  if (col === 'invoices') return x.invoiceNum || x.number || id;
  if (col === 'purchaseOrders') return x.poNumber || x.number || id;
  return x.name || x.title || id;
}

(async function main() {
  const hits = [];
  const cols = ['proposals', 'invoices', 'purchaseOrders', 'clientDocuments', 'ideabooks', 'designBoards'];
  for (const col of cols) {
    const snap = await db.collection('boards').doc(BOARD).collection(col).get();
    snap.forEach((d) => {
      const x = d.data() || {};
      const log = Array.isArray(x.activityLog) ? x.activityLog : [];
      log.forEach((e) => {
        if (!e) return;
        const act = String(e.action || e.type || '').toLowerCase();
        if (act !== 'unpublished' && !String(e.details || '').toLowerCase().includes('unpublished')) return;
        if (pacificDate(e.timestamp || e.createdAt) !== DAY) return;
        hits.push({
          source: 'activityLog',
          col,
          id: d.id,
          num: numOf(col, d.id, x),
          total: money(x.total),
          publishedNow: x.published === true || x.clientPublished === true,
          who: e.userEmail || e.userName || '',
          vanessa: isVanessa(e, x),
          time: pacificTime(e.timestamp || e.createdAt),
          ts: e.timestamp || e.createdAt || '',
          items: Array.isArray(x.items) ? x.items.length : (Array.isArray(x.images) ? x.images.length : 0),
          status: x.status || ''
        });
      });
    });
  }

  // Inspiration unpublish is logged to top-level activity, not activityLog
  const actSnaps = [];
  try {
    actSnaps.push(await db.collection('activity').where('projectId', '==', BOARD).get());
  } catch (e) {
    console.log('activity query by projectId failed', e.message);
  }
  try {
    actSnaps.push(await db.collection('boards').doc(BOARD).collection('activity').get());
  } catch (e) {
    console.log('board activity subcol failed', e.message);
  }
  actSnaps.forEach((snap) => {
    if (!snap) return;
    snap.forEach((d) => {
      const x = d.data() || {};
      const blob = JSON.stringify(x).toLowerCase();
      if (!blob.includes('unpublish')) return;
      const ts = x.timestamp || x.createdAt || x.date;
      if (pacificDate(ts) !== DAY) return;
      hits.push({
        source: 'activity',
        col: x.type || x.boardKind || 'activity',
        id: d.id,
        num: x.boardName || x.name || x.whatChanged || d.id,
        total: '',
        publishedNow: '',
        who: x.userEmail || x.userName || x.authorEmail || x.member || '',
        vanessa: isVanessa(x, x),
        time: pacificTime(ts),
        ts: ts,
        items: 0,
        status: x.whatChanged || x.action || ''
      });
    });
  });

  const vanessa = hits.filter((h) => h.vanessa);
  const others = hits.filter((h) => !h.vanessa);
  console.log('DAY', DAY, 'Pacific');
  console.log('HITS_TOTAL', hits.length, 'VANESSA', vanessa.length, 'OTHER', others.length);
  console.log('--- VANESSA ---');
  vanessa.sort((a, b) => String(a.ts).localeCompare(String(b.ts)));
  vanessa.forEach((h) => {
    console.log([
      h.time,
      h.col,
      h.num,
      h.total ? '$' + h.total : '—',
      h.items ? h.items + ' lines' : '',
      h.status,
      h.who,
      'now=' + (h.publishedNow === true ? 'published' : h.publishedNow === false ? 'unpublished' : ''),
      h.source
    ].join(' | '));
  });
  if (others.length) {
    console.log('--- OTHER PEOPLE TODAY ---');
    others.forEach((h) => {
      console.log([h.time, h.col, h.num, h.total ? '$' + h.total : '', h.who, h.source].join(' | '));
    });
  }

  const sum = vanessa.reduce((s, h) => s + n(h.total), 0);
  console.log('VANESSA_AMOUNT_SUM', sum.toFixed(2));
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
