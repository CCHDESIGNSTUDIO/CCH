#!/usr/bin/env node
'use strict';
const admin = require('firebase-admin');
const path = require('path');
const KEY = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
admin.initializeApp({ credential: admin.credential.cert(require(KEY)) });
const db = admin.firestore();
const PID = 'cloud-rolling-hills';
const INV_NUM = 'INV-6018';

function str(v) { return String(v == null ? '' : v).trim(); }

function isProduct(r) {
  if (!r || r.lineKind === 'group') return false;
  const et = str(r.expenseType).toLowerCase();
  if (['service', 'sales_tax', 'shipping', 'handling', 'expense', 'other_expense', 'discount', 'labor'].includes(et)) return false;
  if (r._isService === true || r.itemType === 'service') return false;
  return !!str(r.title || r.name || r.description);
}

function buildClipIndex(clipDocs) {
  const byLib = Object.create(null);
  const byLibRoom = Object.create(null);
  const byTV = Object.create(null);
  const byId = Object.create(null);
  clipDocs.forEach(({ id, data }) => {
    const c = data || {};
    byId[id] = { id, ...c };
    const lib = str(c.libraryProductId || c.linkedLibraryProductId);
    const rm = str(c.room);
    if (lib) {
      byLib[lib] = id;
      if (rm) byLibRoom[lib + '|' + rm.toLowerCase()] = id;
    }
    const tv = (str(c.title).toLowerCase() + '|' + str(c.vendor).toLowerCase());
    if (tv !== '|') {
      if (!byTV[tv]) byTV[tv] = [];
      byTV[tv].push({ id, room: rm });
    }
  });
  return { byLib, byLibRoom, byTV, byId };
}

function resolveClipId(index, r, targetRoom) {
  const existing = str(r.clipId || r.sourceClipId);
  if (existing) return existing;
  targetRoom = str(targetRoom || r.room);
  const lib = str(r.libraryProductId || r.linkedLibraryProductId);
  if (lib && targetRoom && index.byLibRoom[lib + '|' + targetRoom.toLowerCase()]) {
    return index.byLibRoom[lib + '|' + targetRoom.toLowerCase()];
  }
  if (lib && index.byLib[lib] && !targetRoom) return index.byLib[lib];
  const tv = (str(r.title || r.name).toLowerCase() + '|' + str(r.vendor).toLowerCase());
  const matches = index.byTV[tv];
  if (!matches || !matches.length) return '';
  if (targetRoom) {
    for (let i = 0; i < matches.length; i++) {
      if (matches[i].room === targetRoom) return matches[i].id;
    }
    return '';
  }
  return matches[0].id;
}

function auditLine(line, idx, index) {
  if (!isProduct(line)) return null;
  const title = str(line.title || line.name).slice(0, 100);
  const room = str(line.room);
  const clipId = str(line.clipId || line.sourceClipId);
  const suggested = resolveClipId(index, line, room);
  let status = 'ok';
  let detail = '';
  if (!clipId) {
    if (suggested) { status = 'fix_link'; detail = 'add clipId ' + suggested; }
    else { status = 'fix_create'; detail = 'no matching room-board clip — need new clip or pick room'; }
  } else if (!index.byId[clipId]) {
    status = 'fix_missing_clip';
    detail = 'clipId ' + clipId + ' does not exist';
    if (suggested) detail += '; suggest ' + suggested;
  } else {
    const clipRoom = str(index.byId[clipId].room);
    if (room && clipRoom && room !== clipRoom) {
      status = 'fix_room';
      detail = 'line room "' + room + '" vs clip "' + clipRoom + '"';
      if (suggested && suggested !== clipId) detail += '; alt in line room: ' + suggested;
    } else {
      status = 'ok';
      detail = 'linked';
    }
  }
  return { idx, title, room, vendor: str(line.vendor), clipId, suggested, status, detail,
    amount: line.amount || line.clientPrice, qty: line.qty };
}

(async () => {
  const snap = await db.collection('boards').doc(PID).collection('invoices').get();
  let invDoc = null;
  snap.forEach((d) => {
    const x = d.data() || {};
    const num = str(x.invoiceNum || x.number);
    if (num === INV_NUM || d.id === INV_NUM) invDoc = { id: d.id, ...x };
  });
  if (!invDoc) {
    console.log('Invoice not found:', INV_NUM);
    process.exit(1);
  }

  const clipSnap = await db.collection('boards').doc(PID).collection('clips').get();
  const clipDocs = clipSnap.docs.map((d) => ({ id: d.id, data: d.data() || {} }));
  const index = buildClipIndex(clipDocs);

  const items = invDoc.items || [];
  const rows = [];
  items.forEach((line, idx) => {
    const r = auditLine(line, idx, index);
    if (r) rows.push(r);
  });

  const byStatus = {};
  rows.forEach((r) => { byStatus[r.status] = (byStatus[r.status] || 0) + 1; });

  console.log('=== INV-6018 ===');
  console.log('docId:', invDoc.id);
  console.log('status:', invDoc.status, '| total:', invDoc.total);
  console.log('product lines:', rows.length, '| all lines:', items.length);
  console.log('\nBy status:', JSON.stringify(byStatus));
  console.log('\n--- NEEDS FIX ---');
  rows.filter((r) => r.status !== 'ok').forEach((r) => {
    console.log('L' + (r.idx + 1), r.status, '|', r.room || '(no room)', '|', r.title.slice(0, 60));
    console.log('   ', r.detail);
  });
  console.log('\n--- OK (' + (byStatus.ok || 0) + ' lines) ---');
  rows.filter((r) => r.status === 'ok').forEach((r) => {
    console.log('L' + (r.idx + 1), r.room, '|', r.title.slice(0, 55));
  });
})().catch((e) => { console.error(e); process.exit(1); });
