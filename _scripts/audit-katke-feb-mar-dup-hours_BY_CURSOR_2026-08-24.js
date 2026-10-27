#!/usr/bin/env node
'use strict';
/** Read-only: Katke Feb–Mar 2026 time rows that look duplicated. */
const path = require('path');
const admin = require('firebase-admin');
const KEY = require(path.join(
  __dirname,
  '..',
  '_debug',
  'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json'
));
const db = admin.initializeApp({ credential: admin.credential.cert(KEY) }, 'katkeDup').firestore();

const str = (v) => String(v == null ? '' : v).trim();
const n = (v) => parseFloat(v) || 0;
const r2 = (v) => Math.round(n(v) * 100) / 100;

function looksKatke(t) {
  const pid = str(t.projectId).toLowerCase();
  const name = str(t.project).toLowerCase();
  return pid === 'katke-graceland-dr' || name.includes('katke') || name.includes('graceland');
}

(async () => {
  const all = [];
  (await db.collection('timeEntries').get()).forEach((d) => all.push({ id: d.id, ...d.data() }));
  const rows = all.filter((t) => {
    const d = str(t.date);
    return looksKatke(t) && d >= '2026-02-01' && d <= '2026-03-31';
  });
  rows.sort((a, b) => str(a.date).localeCompare(str(b.date)) || str(a.member).localeCompare(str(b.member)));

  console.log('Katke Feb–Mar 2026 rows:', rows.length);
  console.log('  hours', r2(rows.reduce((s, t) => s + n(t.hours), 0)), '$', r2(rows.reduce((s, t) => s + n(t.total), 0)));
  console.log('  invoiced', rows.filter((t) => str(t.invoiceId)).length);
  console.log('  uninvoiced', rows.filter((t) => !str(t.invoiceId)).length);

  const groups = {};
  rows.forEach((t) => {
    const key = [
      str(t.date),
      str(t.member).toLowerCase(),
      r2(t.hours),
      r2(t.total),
      str(t.service).toLowerCase(),
      str(t.notes || t.note || t.description).slice(0, 80).toLowerCase()
    ].join('|');
    if (!groups[key]) groups[key] = [];
    groups[key].push(t);
  });

  const dups = Object.keys(groups).filter((k) => groups[k].length > 1);
  console.log('\nExact duplicate groups (same date/member/hours/amount/service/note):', dups.length);
  dups.forEach((k) => {
    const g = groups[k];
    console.log('\n  x' + g.length, str(g[0].date), '|', str(g[0].member), '|', n(g[0].hours) + 'h', '|$'+r2(g[0].total), '|', str(g[0].service).slice(0, 40));
    console.log('   note:', str(g[0].notes || g[0].note || g[0].description).slice(0, 90));
    g.forEach((t) => {
      console.log(
        '   ',
        t.id,
        'inv',
        str(t.invoiceNumber || t.invoiceNum) || (str(t.invoiceId) ? t.invoiceId.slice(0, 8) : '—'),
        'src',
        str(t.source) || '—',
        'timely',
        str(t.timelyId || t.timely_id || t.externalId) || '—'
      );
    });
  });

  const byDay = {};
  rows.forEach((t) => {
    const k = str(t.date) + '|' + str(t.member).toLowerCase();
    if (!byDay[k]) byDay[k] = [];
    byDay[k].push(t);
  });
  const multiDay = Object.keys(byDay).filter((k) => byDay[k].length > 1);
  console.log('\nSame person same day (any hours, not necessarily exact dup):', multiDay.length, 'day-person groups');
  multiDay.slice(0, 25).forEach((k) => {
    const g = byDay[k];
    const hrs = r2(g.reduce((s, t) => s + n(t.hours), 0));
    console.log(' ', str(g[0].date), str(g[0].member), g.length + ' rows', hrs + 'h');
  });
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
