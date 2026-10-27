#!/usr/bin/env node
'use strict';
const path = require('path');
const admin = require('firebase-admin');
const KEY = path.join(__dirname, '..', '_debug', 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
const app = admin.initializeApp({ credential: admin.credential.cert(require(KEY)) }, 'inv6079c');
const db = app.firestore();
function str(v) { return String(v == null ? '' : v).trim(); }
function n(v) { return parseFloat(v) || 0; }
function day(v) {
  if (!v) return '';
  if (typeof v.toDate === 'function') return v.toDate().toISOString().slice(0, 10);
  const s = String(v);
  return s.slice(0, 10);
}
(async () => {
  const snap = await db.collection('boards').doc('cloud-rolling-hills').collection('invoices').doc('bCqEJW17QgBgGCDpUqqu').get();
  const x = snap.data() || {};
  console.log('item0 keys', Object.keys((x.items || [])[0] || {}).sort().join(','));
  console.log('item0', JSON.stringify((x.items || [])[0], null, 2).slice(0, 1200));
  const ids = Array.isArray(x.timeEntryIds) ? x.timeEntryIds : [];
  console.log('timeEntryIds', ids.length);
  const rows = [];
  for (let i = 0; i < ids.length; i++) {
    const t = await db.collection('timeEntries').doc(ids[i]).get();
    const d = t.exists ? t.data() : {};
    rows.push({
      id: ids[i],
      exists: t.exists,
      date: day(d.date || d.day),
      hours: n(d.hours),
      service: str(d.service),
      notes: str(d.notes || d.note || d.description).slice(0, 80)
    });
  }
  rows.sort((a, b) => a.date.localeCompare(b.date));
  rows.forEach((r) => console.log(r.date || 'NO-DATE', r.hours, '|', r.service, '|', r.notes));
  const may = rows.filter((r) => r.date >= '2026-05-01');
  const before = rows.filter((r) => r.date && r.date < '2026-04-01');
  console.log('MAY+', may.length, 'BEFORE APRIL', before.length);
  if (x.clientOutcomes) console.log('outcomes', JSON.stringify(x.clientOutcomes).slice(0, 1500));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
