'use strict';
/**
 * Remove stale Airtable Line Items that have no Source key but duplicate a keyed row
 * on the same PO with the same Item title (pre-upsert duplicates).
 *
 * Usage:
 *   node _scripts/cleanup-airtable-duplicate-lines_BY_CR_2026-07-09.js [--dry-run]
 *   node _scripts/cleanup-airtable-duplicate-lines_BY_CR_2026-07-09.js --apply
 */
const fs = require('fs');
const path = require('path');

const f = path.join(__dirname, '..', 'airtable-pat.env');
const raw = fs.readFileSync(f, 'utf8').trim();
const m = raw.match(/AIRTABLE_PAT\s*=\s*(.+)/);
const pat = (m ? m[1] : raw).trim().replace(/^["']|["']$/g, '');

const BASE = 'app8Je7Mpc81giBre';
const TBL_LINES = 'tblT1Bjq0Ur09bd8J';
const APPLY = process.argv.includes('--apply');
const DRY = !APPLY;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function listAll() {
  const out = [];
  let offset = '';
  do {
    const url = new URL('https://api.airtable.com/v0/' + BASE + '/' + TBL_LINES);
    url.searchParams.set('pageSize', '100');
    if (offset) url.searchParams.set('offset', offset);
    const res = await fetch(url, { headers: { Authorization: 'Bearer ' + pat } });
    const j = await res.json();
    if (!res.ok) throw new Error(res.status + ': ' + JSON.stringify(j).slice(0, 400));
    out.push(...(j.records || []));
    offset = j.offset || '';
    await sleep(220);
  } while (offset);
  return out;
}

function normItem(s) {
  return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

(async () => {
  const lines = await listAll();
  const keyed = new Set();
  lines.forEach((r) => {
    const key = String(r.fields['Source key'] || '').trim();
    const poIds = r.fields['Purchase Order'] || [];
    const poId = Array.isArray(poIds) ? poIds[0] : poIds;
    const item = normItem(r.fields.Item);
    if (key && poId && item) keyed.add(poId + '::' + item);
  });

  const toDelete = [];
  lines.forEach((r) => {
    const key = String(r.fields['Source key'] || '').trim();
    if (key) return;
    const poIds = r.fields['Purchase Order'] || [];
    const poId = Array.isArray(poIds) ? poIds[0] : poIds;
    const item = normItem(r.fields.Item);
    if (!poId || !item) return;
    if (keyed.has(poId + '::' + item)) toDelete.push(r);
  });

  console.log((DRY ? '[DRY RUN] ' : '') + 'Duplicate empty-key lines to delete:', toDelete.length);
  toDelete.forEach((r) => {
    console.log(' -', r.fields.Item, '| rec:', r.id);
  });

  if (DRY || !toDelete.length) return;

  for (const batch of chunk(toDelete, 10)) {
    const url = new URL('https://api.airtable.com/v0/' + BASE + '/' + TBL_LINES);
    batch.forEach((r) => url.searchParams.append('records[]', r.id));
    const res = await fetch(url.toString(), {
      method: 'DELETE',
      headers: { Authorization: 'Bearer ' + pat },
    });
    const text = await res.text();
    if (!res.ok) throw new Error('Delete ' + res.status + ': ' + text.slice(0, 400));
    await sleep(250);
  }
  console.log('Deleted', toDelete.length, 'duplicate line(s).');
})().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});

function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}
