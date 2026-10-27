#!/usr/bin/env node
'use strict';
/**
 * PRODUCTION: list all Katke proposals, then optionally delete every Firestore
 * doc numbered PRO-3016 (including hidden duplicates).
 *
 *   node _scripts/list-delete-katke-pro3016_BY_CURSOR_2026-09-03.js
 *   node _scripts/list-delete-katke-pro3016_BY_CURSOR_2026-09-03.js --apply
 *
 * Default is dry-run. --apply writes a JSON backup then deletes PRO-3016 docs only.
 */
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const APPLY = process.argv.includes('--apply');
const BOARD = 'katke-graceland-dr';
const TARGET_NUM = 'PRO-3016';

const KEY = path.join(
  __dirname,
  '..',
  '_debug',
  'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json'
);
const db = admin.initializeApp({ credential: admin.credential.cert(require(KEY)) }, 'katkePro3016').firestore();

function n(v) { return parseFloat(v) || 0; }
function money(v) { return n(v).toFixed(2); }
function iso(v) {
  if (!v) return '';
  if (typeof v.toDate === 'function') return v.toDate().toISOString();
  if (v._seconds) return new Date(v._seconds * 1000).toISOString();
  return String(v);
}

(async function main() {
  const snap = await db.collection('boards').doc(BOARD).collection('proposals').get();
  const rows = [];
  snap.forEach((d) => {
    const x = d.data() || {};
    const items = Array.isArray(x.items) ? x.items : [];
    const num = String(x.proposalNum || x.number || x.docNumber || d.id).trim();
    rows.push({
      id: d.id,
      proposalNum: num,
      status: String(x.status || ''),
      published: !!x.published,
      items: items.length,
      total: money(x.total),
      createdAt: iso(x.createdAt).slice(0, 10),
      updatedAt: iso(x.updatedAt).slice(0, 10),
      qbDocId: String(x.qbDocId || x.qbId || ''),
      clientName: String(x.clientName || x.billToName || ''),
      title: String(x.title || x.name || '').slice(0, 60)
    });
  });
  rows.sort((a, b) => String(a.proposalNum).localeCompare(String(b.proposalNum)) || b.items - a.items);

  const byNum = {};
  rows.forEach((r) => {
    if (!byNum[r.proposalNum]) byNum[r.proposalNum] = [];
    byNum[r.proposalNum].push(r);
  });
  const dupHidden = rows.length - Object.keys(byNum).length;

  console.log('BOARD', BOARD);
  console.log('TOTAL_DOCS', rows.length, 'UNIQUE_NUMS', Object.keys(byNum).length, 'HIDDEN_DUPES', dupHidden);
  console.log('APPLY', APPLY);
  console.log('--- all proposals ---');
  rows.forEach((r) => {
    const extras = (byNum[r.proposalNum] || []).length > 1 ? ' DUP' + (byNum[r.proposalNum].length) : '';
    console.log([
      r.proposalNum.padEnd(12),
      r.id.padEnd(28),
      ('$' + r.total).padStart(12),
      String(r.items).padStart(5) + ' lines',
      String(r.status || '—').padEnd(14),
      r.published ? 'published' : 'unpublished',
      r.createdAt,
      r.updatedAt,
      r.qbDocId ? 'QB:' + r.qbDocId : '',
      extras
    ].join(' | '));
  });

  const targets = rows.filter((r) => r.proposalNum === TARGET_NUM || r.id === TARGET_NUM);
  console.log('--- ' + TARGET_NUM + ' docs to delete ---');
  if (!targets.length) {
    console.log('NONE FOUND');
    process.exit(1);
  }
  targets.forEach((t) => console.log(JSON.stringify(t, null, 2)));

  const qbHits = targets.filter((t) => t.qbDocId);
  if (qbHits.length) {
    console.log('STOP: one or more copies have qbDocId. Will not delete.');
    process.exit(2);
  }

  if (!APPLY) {
    console.log('DRY-RUN. Re-run with --apply to backup + delete the ' + targets.length + ' doc(s) above.');
    process.exit(0);
  }

  const backupDir = path.join(__dirname, '..', '_backup', 'katke-pro3016-' + new Date().toISOString().slice(0, 10));
  fs.mkdirSync(backupDir, { recursive: true });
  const targetIds = new Set(targets.map((t) => t.id));
  for (const t of targets) {
    const full = await db.collection('boards').doc(BOARD).collection('proposals').doc(t.id).get();
    const payload = { id: t.id, exists: full.exists, data: full.exists ? full.data() : null };
    fs.writeFileSync(path.join(backupDir, t.id + '.json'), JSON.stringify(payload, null, 2));
    await db.collection('boards').doc(BOARD).collection('proposals').doc(t.id).delete();
    console.log('DELETED', t.id, t.proposalNum, '$' + t.total, t.items + ' lines');
  }

  async function clearReverse(colName) {
    const snap = await db.collection('boards').doc(BOARD).collection(colName).get();
    for (const d of snap.docs) {
      const x = d.data() || {};
      const idHit = ['linkedProposalId', 'proposalId', 'sourceProposalId', 'convertedFromProposalId']
        .some((f) => targetIds.has(String(x[f] || '')));
      const numHit = [x.linkedProposalNum, x.proposalNum, x.sourceProposalNum]
        .some((v) => String(v || '') === TARGET_NUM);
      if (!idHit && !numHit) continue;
      const before = {
        linkedProposalId: x.linkedProposalId || null,
        linkedProposalNum: x.linkedProposalNum || null,
        proposalId: x.proposalId || null
      };
      fs.writeFileSync(
        path.join(backupDir, colName + '-' + d.id + '-link.json'),
        JSON.stringify({ id: d.id, before: before, data: { invoiceNum: x.invoiceNum, poNumber: x.poNumber, number: x.number, total: x.total } }, null, 2)
      );
      const patch = { updatedAt: new Date().toISOString() };
      if (targetIds.has(String(x.linkedProposalId || ''))) patch.linkedProposalId = admin.firestore.FieldValue.delete();
      if (String(x.linkedProposalNum || '') === TARGET_NUM) patch.linkedProposalNum = admin.firestore.FieldValue.delete();
      if (targetIds.has(String(x.proposalId || ''))) patch.proposalId = admin.firestore.FieldValue.delete();
      await d.ref.update(patch);
      console.log('CLEARED_LINK', colName, d.id, x.invoiceNum || x.poNumber || x.number || '');
    }
  }
  await clearReverse('invoices');
  await clearReverse('purchaseOrders');
  console.log('BACKUP', backupDir);
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
