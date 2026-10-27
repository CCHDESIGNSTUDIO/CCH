#!/usr/bin/env node
'use strict';
/**
 * PRICE EXPORT — everything on a project that needs a cost, into one CSV.
 * READ-ONLY. Fill the NEW_COST column in Excel, then run price-import (dry-run first).
 *
 * Usage:  node _scripts/price-export_BY_CLAUDE_2026-08-19.js [projectId]
 * Default project: cloud-rolling-hills
 */
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');
const KEY = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(require(KEY)) });
const db = admin.firestore();

const PROJECT = process.argv[2] || 'cloud-rolling-hills';
const OUT = path.join(__dirname, '..', '_debug', 'PRICE-EDIT-' + PROJECT + '.csv');

/** "$1,985.00" -> 1985.00 ; 0/null/'' -> null */
function money(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return isFinite(v) ? v : null;
  const n = parseFloat(String(v).replace(/[$,\s]/g, ''));
  return isNaN(n) ? null : n;
}
const q = s => '"' + String(s == null ? '' : s).replace(/"/g, '""').replace(/[\r\n]+/g, ' ') + '"';

(async () => {
  const rows = [];
  const board = db.collection('boards').doc(PROJECT);

  // 1. CLIPS
  const clips = await board.collection('clips').get();
  clips.forEach(d => {
    const c = d.data() || {};
    const cost = money(c.cost);
    const raw = c.cost;
    const isString = typeof raw === 'string' && /[$,]/.test(raw);
    if (cost && cost > 0 && !isString) return;          // already fine
    rows.push({
      kind: 'clip', docId: d.id, lineIdx: '',
      title: c.title || c.name || '', vendor: c.vendor || '', sku: c.sku || '',
      finish: c.finish || c.color || '', room: c.room || '',
      currentRaw: raw === undefined ? '' : String(raw),
      currentParsed: cost == null ? '' : cost,
      issue: isString ? 'STRING-ENCODED (recoverable)' : (cost === 0 ? 'zero' : 'missing'),
      newCost: isString && cost != null ? cost : ''       // pre-fill recoverable ones
    });
  });

  // 2. PROPOSAL + INVOICE LINES
  for (const col of ['proposals', 'invoices']) {
    const docs = await board.collection(col).get();
    for (const doc of docs.docs) {
      const d = doc.data() || {};
      const label = d.number || d.proposalNum || d.invoiceNum || d.name || doc.id;
      (Array.isArray(d.items) ? d.items : []).forEach((it, i) => {
        const cost = money(it.cost);
        const raw = it.cost;
        const isString = typeof raw === 'string' && /[$,]/.test(raw);
        if (cost && cost > 0 && !isString) return;
        rows.push({
          kind: col.slice(0, -1) + ':' + label, docId: doc.id, lineIdx: i,
          title: it.title || it.name || '', vendor: it.vendor || '', sku: it.sku || '',
          finish: it.finish || it.color || '', room: it.room || '',
          currentRaw: raw === undefined ? '' : String(raw),
          currentParsed: cost == null ? '' : cost,
          issue: isString ? 'STRING-ENCODED (recoverable)' : (cost === 0 ? 'zero' : 'missing'),
          newCost: isString && cost != null ? cost : ''
        });
      });
    }
  }

  rows.sort((a, b) => (a.vendor || '').localeCompare(b.vendor || '') ||
                      (a.title || '').localeCompare(b.title || ''));

  const head = ['KIND', 'DOC_ID', 'LINE_IDX', 'TITLE', 'VENDOR', 'SKU', 'FINISH', 'ROOM',
                'CURRENT_RAW', 'CURRENT_PARSED', 'ISSUE', 'NEW_COST'];
  const csv = [head.map(q).join(',')].concat(rows.map(r => [
    r.kind, r.docId, r.lineIdx, r.title, r.vendor, r.sku, r.finish, r.room,
    r.currentRaw, r.currentParsed, r.issue, r.newCost
  ].map(q).join(','))).join('\r\n');

  fs.writeFileSync(OUT, '﻿' + csv, 'utf8');

  const recoverable = rows.filter(r => r.issue.startsWith('STRING')).length;
  console.log('project: ' + PROJECT);
  console.log('rows needing a cost: ' + rows.length);
  console.log('  of those, already recoverable from a $-string: ' + recoverable + ' (NEW_COST pre-filled)');
  console.log('  you actually need to type: ' + (rows.length - recoverable));
  console.log('\nwrote: ' + OUT);
  console.log('\nFill the NEW_COST column, save as CSV, then the import script dry-runs it.');
})().catch(e => { console.error(e.message); process.exit(1); });
