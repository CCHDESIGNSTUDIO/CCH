#!/usr/bin/env node
'use strict';
const path = require('path');
const admin = require('firebase-admin');
const KEY = path.join(__dirname, '..', '_debug', 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
const db = admin.initializeApp({ credential: admin.credential.cert(require(KEY)) }, 'katkeToday').firestore();
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
  return new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true }).format(d);
}
function money(v) { return (parseFloat(v) || 0).toFixed(2); }
function isV(s) { return String(s || '').toLowerCase().includes('vanessa'); }

(async function main() {
  console.log('=== proposals/invoices/ideabooks lastEdited or updated TODAY ===');
  for (const col of ['proposals', 'invoices', 'ideabooks', 'clientDocuments']) {
    const snap = await db.collection('boards').doc(BOARD).collection(col).get();
    snap.forEach((d) => {
      const x = d.data() || {};
      const stamps = [x.lastEditedAt, x.updatedAt, x.publishedAt, x.clientPublishedAt];
      const today = stamps.some((t) => pacificDate(t) === DAY);
      if (!today) return;
      const log = (x.activityLog || []).filter((e) => pacificDate(e.timestamp) === DAY);
      const num = x.proposalNum || x.invoiceNum || x.number || x.name || d.id;
      console.log([
        col,
        num,
        '$' + money(x.total),
        'pub=' + (x.published === true || x.clientPublished === true),
        'status=' + (x.status || ''),
        'editedBy=' + (x.lastEditedByEmail || x.lastEditedBy || ''),
        'lastEdited=' + pacificTime(x.lastEditedAt),
        'updated=' + pacificTime(x.updatedAt),
        'items=' + (Array.isArray(x.items) ? x.items.length : ''),
        'todayLog=' + log.map((e) => e.action + '@' + pacificTime(e.timestamp) + '/' + (e.userEmail || '')).join(';')
      ].join(' | '));
    });
  }

  console.log('=== top-level activity today containing katke OR unpublish ===');
  let n = 0;
  const snap = await db.collection('activity').get();
  snap.forEach((d) => {
    const x = d.data() || {};
    const ts = x.timestamp || x.createdAt;
    if (pacificDate(ts) !== DAY) return;
    const blob = JSON.stringify(x).toLowerCase();
    if (!blob.includes('katke') && !blob.includes('unpublish') && x.projectId !== BOARD) return;
    if (x.projectId && x.projectId !== BOARD && !blob.includes('katke') && !blob.includes('unpublish')) return;
    if (x.projectId !== BOARD && !blob.includes('katke') && !blob.includes('unpublish')) return;
    n++;
    console.log([
      pacificTime(ts),
      x.projectId || '',
      x.projectName || '',
      x.type,
      x.action,
      String(x.description || '').slice(0, 120),
      x.user || x.authorEmail || '',
      isV(x.user) || isV(x.authorEmail) || isV(x.authorName) ? 'VANESSA' : ''
    ].join(' | '));
  });
  console.log('ACTIVITY_ROWS', n);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
