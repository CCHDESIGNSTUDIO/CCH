#!/usr/bin/env node
'use strict';
/**
 * DRY RUN — Cloud - Rolling Hills proposals + invoices vs room-board clips.
 * No Firestore writes.
 *
 *   node _scripts/audit-rh-docs-roomboard-dryrun_BY_CLAUDE_2026-06-04.js
 */
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const PID = 'cloud-rolling-hills';
const PROJ = 'Cloud - Rolling Hills';
const OUT_DIR = path.join(__dirname, '..', '_backup', 'rh-docs-roomboard-dryrun-2026-06-04');

const KEY = path.join(
  __dirname,
  '..',
  '_debug',
  'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json'
);

function str(v) {
  return String(v == null ? '' : v).trim();
}

function isGroupHeader(it) {
  return it && it.lineKind === 'group';
}

function isRoomBoardProduct(r) {
  if (!r) return false;
  if (isGroupHeader(r)) return false;
  const et = str(r.expenseType).toLowerCase();
  if (['service', 'sales_tax', 'shipping', 'handling', 'expense', 'other_expense', 'discount', 'labor'].includes(et)) {
    return false;
  }
  if (r._isService === true || r.itemType === 'service') return false;
  const title = str(r.title || r.name || r.description);
  if (!title) return false;
  return true;
}

function buildClipIndex(clipDocs) {
  const byLib = Object.create(null);
  const byLibRoom = Object.create(null);
  const byTV = Object.create(null);
  const byId = Object.create(null);

  clipDocs.forEach(({ id, data }) => {
    const c = data || {};
    byId[id] = { id, ...c };
    const lib = str(c.libraryProductId || c.libraryId);
    const rm = str(c.room);
    if (lib) {
      byLib[lib] = id;
      if (rm) byLibRoom[lib + '|' + rm.toLowerCase()] = id;
    }
    const tv = (str(c.title).toLowerCase() + '|' + str(c.vendor).toLowerCase());
    if (tv === '|') return;
    if (!byTV[tv]) byTV[tv] = [];
    byTV[tv].push({ id, room: rm });
  });

  return { byLib, byLibRoom, byTV, byId };
}

function resolveClipId(index, r, targetRoom) {
  if (!index || !r) return '';
  targetRoom = str(targetRoom || r.room);
  const existing = str(r.clipId || r.sourceClipId);
  if (existing) return existing;
  const lib = str(r.libraryProductId || r.linkedLibraryProductId || r._libDocId);
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

function docNum(data, kind) {
  if (kind === 'proposal') return str(data.proposalNum || data.name || data.number);
  return str(data.invoiceNum || data.name || data.number);
}

function auditLine(ctx) {
  const { collection, docId, docRef, lineIdx, line, index } = ctx;
  const title = str(line.title || line.name || line.description).slice(0, 120);
  const room = str(line.room);
  const clipId = str(line.clipId || line.sourceClipId);
  const resolved = resolveClipId(index, line, room);

  let status = 'ok';
  let detail = '';
  let suggestedClipId = '';

  if (!clipId) {
    if (resolved) {
      status = 'missing_clipId_would_link';
      suggestedClipId = resolved;
      detail = 'line has no clipId; existing room-board clip can be linked';
    } else {
      status = 'missing_clipId_would_create';
      detail = 'line has no clipId; no matching clip in room — would need new clip';
    }
  } else if (!index.byId[clipId]) {
    status = 'clip_doc_missing';
    detail = 'clipId on line but boards/' + PID + '/clips/' + clipId + ' does not exist';
  } else {
    const clip = index.byId[clipId];
    const clipRoom = str(clip.room);
    if (room && clipRoom && room !== clipRoom) {
      status = 'room_mismatch';
      detail = 'line room "' + room + '" vs clip room "' + clipRoom + '"';
      if (resolved && resolved !== clipId) {
        suggestedClipId = resolved;
        detail += '; alt clip in line room: ' + resolved;
      }
    } else {
      status = 'ok';
      detail = 'linked clip exists' + (clipRoom ? ' in ' + clipRoom : '');
    }
  }

  return {
    collection,
    docId,
    docRef,
    lineIdx,
    title,
    vendor: str(line.vendor),
    room,
    category: str(line.category),
    clipId: clipId || '',
    libraryProductId: str(line.libraryProductId || line.linkedLibraryProductId),
    status,
    suggestedClipId,
    detail,
  };
}

function escCsv(v) {
  const s = String(v == null ? '' : v).replace(/"/g, '""');
  return /[",\n\r]/.test(s) ? `"${s}"` : s;
}

async function main() {
  if (!fs.existsSync(KEY)) {
    console.error('Missing service account:', KEY);
    process.exit(2);
  }
  admin.initializeApp({ credential: admin.credential.cert(require(KEY)) });
  const db = admin.firestore();

  console.log('DRY RUN —', PROJ, '(' + PID + ')');
  console.log('Scope: proposals + invoices only. No writes.\n');

  const board = await db.collection('boards').doc(PID).get();
  if (!board.exists) {
    console.error('Board not found:', PID);
    process.exit(1);
  }

  const clipSnap = await db.collection('boards').doc(PID).collection('clips').get();
  const clipDocs = clipSnap.docs.map((d) => ({ id: d.id, data: d.data() || {} }));
  const index = buildClipIndex(clipDocs);
  console.log('Room-board clips:', clipDocs.length);

  const results = {
    at: new Date().toISOString(),
    projectId: PID,
    projectName: PROJ,
    clipCount: clipDocs.length,
    proposals: [],
    invoices: [],
    summary: {},
  };

  const allRows = [];

  async function scanCollection(coll, docNumKind) {
    const snap = await db.collection('boards').doc(PID).collection(coll).get();
    let productLines = 0;
    const docStats = [];

    snap.forEach((d) => {
      const data = d.data() || {};
      const ref = docNum(data, docNumKind) || d.id;
      let lines = 0;
      let ok = 0;
      let issues = 0;
      const docIssues = [];

      (data.items || []).forEach((line, idx) => {
        if (!isRoomBoardProduct(line)) return;
        lines++;
        productLines++;
        const row = auditLine({
          collection: coll,
          docId: d.id,
          docRef: ref,
          lineIdx: idx,
          line,
          index,
        });
        allRows.push(row);
        if (row.status === 'ok') ok++;
        else {
          issues++;
          docIssues.push(row);
        }
      });

      if (lines > 0) {
        docStats.push({ docId: d.id, docRef: ref, productLines: lines, ok, issues, docIssues });
      }
    });

    return { docCount: snap.size, productLines, docStats };
  }

  const prop = await scanCollection('proposals', 'proposal');
  const inv = await scanCollection('invoices', 'invoice');

  results.proposals = prop.docStats;
  results.invoices = inv.docStats;

  const byStatus = {};
  allRows.forEach((r) => {
    byStatus[r.status] = (byStatus[r.status] || 0) + 1;
  });
  results.summary = {
    proposalDocs: prop.docCount,
    invoiceDocs: inv.docCount,
    proposalProductLines: prop.productLines,
    invoiceProductLines: inv.productLines,
    totalProductLines: allRows.length,
    byStatus,
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const jsonPath = path.join(OUT_DIR, 'audit-rh-docs-roomboard-dryrun_BY_CLAUDE_2026-06-04.json');
  fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2));

  const issueRows = allRows.filter((r) => r.status !== 'ok');
  const csvPath = path.join(OUT_DIR, 'audit-rh-docs-roomboard-issues_BY_CLAUDE_2026-06-04.csv');
  const hdr = ['collection', 'docRef', 'docId', 'lineIdx', 'status', 'title', 'room', 'vendor', 'clipId', 'suggestedClipId', 'detail'];
  const csv = [hdr.join(',')].concat(
    issueRows.map((r) => hdr.map((h) => escCsv(r[h])).join(','))
  );
  fs.writeFileSync(csvPath, csv.join('\n'));

  console.log('=== SUMMARY ===');
  console.log('Proposal docs:', prop.docCount, '| product lines:', prop.productLines);
  console.log('Invoice docs:', inv.docCount, '| product lines:', inv.productLines);
  console.log('Total furnishing product lines:', allRows.length);
  console.log('\nBy status:');
  Object.keys(byStatus).sort().forEach((k) => console.log(' ', k + ':', byStatus[k]));

  const docsWithIssues = prop.docStats.filter((d) => d.issues > 0)
    .concat(inv.docStats.filter((d) => d.issues > 0));
  console.log('\nDocs with any issue:', docsWithIssues.length);
  docsWithIssues.slice(0, 20).forEach((d) => {
    console.log(' ', d.docRef, '(' + d.docId + ')', d.issues + '/' + d.productLines, 'lines need attention');
  });
  if (docsWithIssues.length > 20) console.log(' …', docsWithIssues.length - 20, 'more in CSV');

  console.log('\nSample issues (first 15):');
  issueRows.slice(0, 15).forEach((r) => {
    console.log(
      ' ', r.collection, r.docRef, 'L' + r.lineIdx, '|', r.status,
      '|', JSON.stringify(r.title).slice(0, 50),
      r.room ? '| ' + r.room : '',
      r.suggestedClipId ? '| suggest ' + r.suggestedClipId : ''
    );
  });

  console.log('\nReport:', jsonPath);
  console.log('Issues CSV:', csvPath);
  console.log('\nDry-run only — no links created. Apply via Studio “Link to Room Boards” or approved script after review.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
