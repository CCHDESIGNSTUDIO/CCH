#!/usr/bin/env node
/**
 * merge-houzz-legacy.js
 *
 * Single merge pass for legacy Houzz → Firestore (boards/*).
 * Sources:
 *   1. Houzz Clients export (CSV) — email, phone, address on board doc
 *   2. Document tags — from EITHER:
 *        HOUZZ_PROJECT_TRACKER_XLSX  (Project Tracker export: Invoice/Proposal + Category/Room/Title)
 *        HOUZZ_TXN_XLSX              (Transaction report: Code + Document Tags column)
 *   3. Firestore — remove case-duplicate invoice/proposal docs (keep lowercase id when present)
 *
 * Default: DRY RUN (no writes). Pass --apply to commit.
 *
 * Env / flags:
 *   HOUZZ_CLIENTS_CSV   path to Clients.csv
 *   HOUZZ_PROJECT_TRACKER_XLSX  path to project_tracker_report .xlsx (preferred when you have it)
 *   HOUZZ_TXN_XLSX              path to transaction / reports .xlsx (Document Tags column)
 *   --apply               write to Firestore (otherwise report only)
 *   --project <boardId>   only one board, e.g. cloud-susan
 *   --backup <dir>        export JSON snapshot before apply (recommended)
 *
 * Example (Susan, dry run with project tracker you exported):
 *   set HOUZZ_PROJECT_TRACKER_XLSX=C:\...\Cloud_Susan_project_tracker_report-05-26-2026-19-06.xlsx
 *   node merge-houzz-legacy.js --project cloud-susan
 *
 * Example (Susan, apply with backup):
 *   node merge-houzz-legacy.js --project cloud-susan --apply --backup ./_backup/susan
 */

const admin = require('firebase-admin');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const DEFAULT_CLIENTS =
  process.env.HOUZZ_CLIENTS_CSV ||
  'C:/Users/cindy/Dropbox/Claude - CCH studio/Houzz FILES/ARCHIVE/Clients.csv';
const DEFAULT_TRACKER = process.env.HOUZZ_PROJECT_TRACKER_XLSX || '';
const DEFAULT_TXN = process.env.HOUZZ_TXN_XLSX || '';

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const SKIP_CLIENTS = args.includes('--skip-clients');
const projectFilter = (function () {
  const i = args.indexOf('--project');
  return i >= 0 ? args[i + 1] : '';
})();
const backupDir = (function () {
  const i = args.indexOf('--backup');
  return i >= 0 ? args[i + 1] : '';
})();
const trackerPath = (function () {
  const i = args.indexOf('--tracker');
  return i >= 0 ? args[i + 1] : DEFAULT_TRACKER;
})();
const txnPath = (function () {
  const i = args.indexOf('--txn');
  return i >= 0 ? args[i + 1] : DEFAULT_TXN;
})();

const saPath = path.join(
  __dirname,
  '_debug/service-account.json/cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json'
);
const sa = require(saPath);
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

function norm(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function normDocId(s) {
  return String(s || '')
    .trim()
    .toUpperCase();
}

function normEmail(s) {
  return String(s || '')
    .trim()
    .toLowerCase();
}

function slugify(name) {
  return (name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 60);
}

function parseCsvClients(fp) {
  if (!fs.existsSync(fp)) throw new Error('Clients CSV not found: ' + fp);
  const text = fs.readFileSync(fp, 'utf8');
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return { byEmail: {}, byName: {} };
  const headers = lines[0].split(',').map((h) => h.trim());
  const idx = {};
  headers.forEach((h, i) => {
    idx[h] = i;
  });
  const byEmail = {};
  const byName = {};
  for (let r = 1; r < lines.length; r++) {
    // Simple CSV — client names rarely have embedded commas in first column
    const cols = lines[r].split(',');
    const name = (cols[idx['Client Name']] || cols[0] || '').trim();
    if (!name) continue;
    const rec = {
      clientName: name,
      clientEmail: (cols[idx['Email']] || '').trim(),
      clientEmail2: (cols[idx['Email 2']] || '').trim(),
      clientPhone: (cols[idx['Phone']] || '').trim(),
      clientPhone2: (cols[idx['Phone 2']] || '').trim(),
      clientAddress: [
        cols[idx['Address']],
        cols[idx['Address 2']],
        cols[idx['City']],
        cols[idx['State']],
        cols[idx['Zip']],
      ]
        .filter(Boolean)
        .join(', ')
        .replace(/\s+/g, ' ')
        .trim(),
      clientAddressLine1: (cols[idx['Address']] || '').trim(),
      clientCity: (cols[idx['City']] || '').trim(),
      clientState: (cols[idx['State']] || '').trim(),
      clientZip: (cols[idx['Zip']] || '').trim(),
    };
    byName[norm(name)] = rec;
    if (rec.clientEmail) byEmail[normEmail(rec.clientEmail)] = rec;
    if (rec.clientEmail2) byEmail[normEmail(rec.clientEmail2)] = rec;
  }
  return { byEmail, byName };
}

/** Find header row + column index by label (case-insensitive substring). */
function findTxnHeaderGrid(raw) {
  for (let r = 0; r < Math.min(raw.length, 20); r++) {
    const row = raw[r] || [];
    const labels = row.map((c) => String(c || '').trim().toLowerCase());
    const codeIdx = labels.findIndex((l) => l === 'code' || l === 'document' || l === 'number');
    const typeIdx = labels.findIndex((l) => l.includes('transaction type'));
    if (codeIdx >= 0 && typeIdx >= 0) {
      const col = {};
      row.forEach((cell, i) => {
        const key = String(cell || '').trim().toLowerCase();
        if (!key) return;
        if (key === 'code' || key === 'document') col.code = i;
        else if (key.includes('document tag')) col.documentTags = i;
        else if (key.includes('memo') || key.includes('description')) col.memo = i;
        else if (key.includes('transaction type')) col.type = i;
        else if (key === 'amount') col.amount = i;
        else if (key.includes('status')) col.status = i;
        else if (key.includes('doc date') || key === 'date') {
          if (col.docDate === undefined) col.docDate = i;
        }
        else if (labels[0] === '' && i === 0) col.project = 0;
      });
      // Project is usually col 0 in Houzz reports
      if (col.project === undefined) col.project = 0;
      if (col.code === undefined) col.code = codeIdx;
      if (col.type === undefined) col.type = typeIdx;
      return { headerRow: r, col };
    }
  }
  // Fallback: same fixed layout as import-houzz-data.js
  return {
    headerRow: 4,
    col: {
      project: 0,
      code: 2,
      documentTags: 3,
      docDate: 4,
      type: 7,
      memo: 9,
      status: 10,
      amount: 10,
    },
  };
}

/** Parse "IN-12345 - Paid" from project tracker Invoice/Proposal cells */
function parseTrackerDocRef(cell) {
  const s = String(cell || '').trim();
  if (!s || s === '-') return null;
  const m = s.match(/^(IN|PR|PO)-(\d+)/i);
  if (!m) return null;
  return { type: m[1].toUpperCase() === 'IN' ? 'invoice' : m[1].toUpperCase() === 'PR' ? 'proposal' : 'po', code: m[1].toUpperCase() + '-' + m[2] };
}

/**
 * Houzz Project Tracker export (line items per invoice).
 * Builds documentTags from Category (+ Room) grouped per invoice/proposal number.
 */
function parseProjectTrackerXlsx(fp) {
  if (!fp || !fs.existsSync(fp)) return { docs: {}, sheet: '(none)', rowCount: 0 };
  const wb = XLSX.readFile(fp);
  const sheetName = wb.SheetNames.find((n) => /tracker/i.test(n)) || wb.SheetNames[0];
  const data = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: '' });
  const docs = {};
  const byCode = {};

  data.forEach(function(row) {
    const projectName = String(row['Project Name'] || row.Project || '').trim();
    if (!projectName) return;
    const projId = slugify(projectName);
    const category = String(row.Category || '').trim();
    const room = String(row.Room || '').trim();
    const title = String(row.Title || '').trim();

    ['Invoice', 'Proposal'].forEach(function(col) {
      const ref = parseTrackerDocRef(row[col]);
      if (!ref || ref.type === 'po') return;
      const key = projId + '|' + ref.code;
      if (!byCode[key]) {
        byCode[key] = { projectName, projectId: projId, code: ref.code, type: ref.type, categories: new Set(), rooms: new Set() };
      }
      if (category) byCode[key].categories.add(category);
      if (room) byCode[key].rooms.add(room);
      if (title && !category) byCode[key].categories.add(title.substring(0, 60));
    });
  });

  Object.keys(byCode).forEach(function(key) {
    const b = byCode[key];
    const cats = Array.from(b.categories);
    const tagText = cats.slice(0, 4).join(', ');
    if (!tagText) return;
    docs[key] = {
      projectName: b.projectName,
      projectId: b.projectId,
      code: b.code,
      type: b.type,
      documentTags: tagText,
      shortDescription: tagText,
      source: 'project-tracker',
    };
  });

  return { docs: docs, sheet: sheetName, rowCount: data.length };
}

function parseTxnXlsx(fp) {
  if (!fp || !fs.existsSync(fp)) {
    return { docs: {}, headerRow: -1, sheet: '(none)' };
  }
  const wb = XLSX.readFile(fp);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  const { headerRow, col } = findTxnHeaderGrid(raw);
  const docs = {}; // key: projectSlug|IN-12345 → { type, tags, status, amount, projectName }

  for (let i = headerRow + 1; i < raw.length; i++) {
    const row = raw[i];
    if (!row) continue;
    const projectName = String(row[col.project] || '').trim();
    const code = String(row[col.code] || '').trim();
    if (!projectName || !code) continue;
    const typeRaw = String(row[col.type] || '').trim().toLowerCase();
    let type = '';
    if (typeRaw.includes('invoice')) type = 'invoice';
    else if (typeRaw.includes('proposal')) type = 'proposal';
    else if (typeRaw.includes('purchase order')) type = 'po';
    else continue;

    const tags = String(row[col.documentTags] || '').trim();
    const memo = col.memo !== undefined ? String(row[col.memo] || '').trim() : '';
    const tagText = tags || memo;
    if (!tagText) continue;

    const projId = slugify(projectName);
    const normCode = normDocId(code);
    const key = projId + '|' + normCode;
    docs[key] = {
      projectName,
      projectId: projId,
      code: normCode,
      type,
      documentTags: tags || tagText,
      shortDescription: tags || tagText,
      status: col.status !== undefined ? String(row[col.status] || '').trim() : '',
      amount: col.amount !== undefined ? parseFloat(row[col.amount]) || 0 : 0,
      source: 'transaction-report',
    };
  }
  return { docs, headerRow, sheet: wb.SheetNames[0] };
}

/** Tracker tags win; transaction report fills gaps. */
function mergeTagSources(tracker, txn) {
  const docs = Object.assign({}, txn.docs || {});
  Object.keys(tracker.docs || {}).forEach(function(k) {
    docs[k] = tracker.docs[k];
  });
  return {
    docs: docs,
    trackerRows: tracker.rowCount || 0,
    trackerSheet: tracker.sheet,
    txnSheet: txn.sheet,
  };
}

function pickKeeper(entries) {
  // Prefer legacy clean docs (no line items → list uses stored total = Houzz paid).
  const emptyItems = entries.filter((e) => !(e.data.items || []).length);
  if (emptyItems.length === 1) return emptyItems[0];
  if (emptyItems.length > 1) {
    return emptyItems.find((e) => e.id === e.id.toUpperCase()) || emptyItems[0];
  }
  return entries.slice().sort((a, b) => {
    const score = (d) =>
      (d.data.shortDescription ? 2 : 0) +
      (d.data.documentTags ? 2 : 0) +
      ((d.data.payments || []).length ? 3 : 0);
    return score(b.data) - score(a.data);
  })[0];
}

function matchClientForBoard(board, clients) {
  const email = normEmail(board.clientEmail);
  if (email && clients.byEmail[email]) return { rec: clients.byEmail[email], via: 'email' };
  const name = norm(board.clientName);
  if (name && clients.byName[name]) return { rec: clients.byName[name], via: 'clientName' };
  // Last name match (Cloud projects often store "Tracey Cloud" vs "Ron & Tracey Cloud")
  if (name) {
    const keys = Object.keys(clients.byName);
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      if (k.includes(name) || name.includes(k.split('&').pop().trim())) {
        return { rec: clients.byName[k], via: 'fuzzyName:' + k };
      }
    }
  }
  return null;
}

function boardClientPatch(board, clientRec, mode) {
  const patch = {};
  const fields = [
    'clientName',
    'clientEmail',
    'clientEmail2',
    'clientPhone',
    'clientPhone2',
    'clientAddress',
    'clientAddressLine1',
    'clientCity',
    'clientState',
    'clientZip',
  ];
  fields.forEach((f) => {
    const incoming = clientRec[f];
    if (!incoming) return;
    const cur = String(board[f] || '').trim();
    if (!cur || mode === 'overwrite') patch[f] = incoming;
    else if (cur !== incoming) patch[f] = { _conflict: true, current: cur, incoming };
  });
  return patch;
}

async function backupCollection(dir, pid, sub, snap) {
  const out = path.join(dir, pid, sub + '.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const rows = [];
  snap.forEach((d) => rows.push({ id: d.id, ...d.data() }));
  fs.writeFileSync(out, JSON.stringify(rows, null, 2));
}

async function run() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  merge-houzz-legacy.js                                   ║');
  console.log('║  Clients CSV + Transaction Document Tags + dedupe        ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('Mode: ' + (APPLY ? '*** APPLY (writes enabled) ***' : 'DRY RUN (no writes)'));
  if (projectFilter) console.log('Scope: board/' + projectFilter);
  if (SKIP_CLIENTS) console.log('Client board fields: SKIPPED');
  console.log('Clients: ' + DEFAULT_CLIENTS);
  if (trackerPath) console.log('Project tracker: ' + trackerPath);
  if (txnPath) console.log('Transaction report: ' + txnPath);
  console.log('');

  const clients = parseCsvClients(DEFAULT_CLIENTS);
  const tracker = parseProjectTrackerXlsx(trackerPath);
  const txn = parseTxnXlsx(txnPath);
  const tags = mergeTagSources(tracker, txn);

  if (!Object.keys(tags.docs).length) {
    console.warn('WARN: No document tags loaded. Set HOUZZ_PROJECT_TRACKER_XLSX and/or HOUZZ_TXN_XLSX.\n');
  } else {
    console.log(
      'Loaded ' +
        Object.keys(clients.byName).length +
        ' clients; ' +
        Object.keys(tags.docs).length +
        ' tagged docs' +
        (tags.trackerRows ? ' (tracker: ' + tags.trackerRows + ' rows, sheet "' + tags.trackerSheet + '")' : '') +
        (tags.txnSheet && tags.txnSheet !== '(none)' ? '; txn sheet "' + tags.txnSheet + '"' : '') +
        '\n'
    );
  }

  const boardsSnap = projectFilter
    ? await db.collection('boards').doc(projectFilter).get().then((d) => ({
        docs: d.exists ? [d] : [],
      }))
    : await db.collection('boards').get();

  const summary = {
    boards: 0,
    clientPatches: 0,
    tagPatches: 0,
    deletes: 0,
  };

  for (const boardDoc of boardsSnap.docs) {
    const pid = boardDoc.id;
    const board = boardDoc.data();
    if (!board || !board.name) continue;

    const invSnap = await db.collection('boards').doc(pid).collection('invoices').get();
    const propSnap = await db.collection('boards').doc(pid).collection('proposals').get();
    if (!invSnap.size && !propSnap.size && !projectFilter) continue;

    summary.boards++;
    console.log('── ' + board.name + ' (' + pid + ') ──');

    if (backupDir && APPLY) {
      await backupCollection(backupDir, pid, 'board', { forEach: (fn) => fn({ id: pid, data: () => board }) });
      await backupCollection(backupDir, pid, 'invoices', invSnap);
      await backupCollection(backupDir, pid, 'proposals', propSnap);
    }

    // 1) Client fields on board (optional; use --skip-clients to leave board as-is)
    if (SKIP_CLIENTS) {
      console.log('  CLIENT: skipped (--skip-clients)');
    }
    const clientMatch = SKIP_CLIENTS ? null : matchClientForBoard(board, clients);
    if (clientMatch) {
      const patch = boardClientPatch(board, clientMatch.rec, 'fill-empty');
      const realPatch = {};
      const conflicts = [];
      Object.keys(patch).forEach((k) => {
        if (patch[k] && patch[k]._conflict) conflicts.push({ field: k, ...patch[k] });
        else if (patch[k]) realPatch[k] = patch[k];
      });
      if (Object.keys(realPatch).length) {
        summary.clientPatches++;
        console.log('  CLIENT merge via ' + clientMatch.via + ':');
        Object.keys(realPatch).forEach((k) => {
          console.log('    ' + k + ': "' + String(board[k] || '') + '" → "' + realPatch[k] + '"');
        });
        if (APPLY) {
          realPatch.updatedAt = new Date().toISOString();
          realPatch.houzzClientMergeAt = realPatch.updatedAt;
          await db.collection('boards').doc(pid).set(realPatch, { merge: true });
        }
      }
      if (conflicts.length) {
        console.log('  CLIENT conflicts (not overwritten):');
        conflicts.forEach((c) =>
          console.log('    ' + c.field + ': FS="' + c.current + '" CSV="' + c.incoming + '"')
        );
      }
    } else if (!SKIP_CLIENTS) {
      console.log('  CLIENT: no CSV match for clientName="' + (board.clientName || '') + '"');
    }

    // 2) Dedupe + document tags — invoices
    const invGroups = {};
    invSnap.forEach((d) => {
      const n = normDocId(d.data().invoiceNum || d.data().number || d.id);
      if (!invGroups[n]) invGroups[n] = [];
      invGroups[n].push({ id: d.id, ref: d.ref, data: d.data() });
    });

    for (const normCode of Object.keys(invGroups).sort()) {
      const entries = invGroups[normCode];
      const keeper = entries.length > 1 ? pickKeeper(entries) : entries[0];
      const tagKey = pid + '|' + normCode;
      const tagRow = tags.docs[tagKey];

      if (entries.length > 1) {
        for (const e of entries) {
          if (e.id === keeper.id) continue;
          summary.deletes++;
          console.log('  DELETE invoice ' + e.id + ' (dup of ' + keeper.id + ')');
          if (APPLY) await e.ref.delete();
        }
      }

      if (tagRow && tagRow.type === 'invoice') {
        const cur = String(keeper.data.documentTags || keeper.data.shortDescription || '').trim();
        if (cur !== tagRow.documentTags) {
          summary.tagPatches++;
          console.log(
            '  TAG invoice ' +
              keeper.id +
              ': "' +
              (cur || '(empty)') +
              '" → "' +
              tagRow.documentTags +
              '"'
          );
          if (APPLY) {
            await keeper.ref.set(
              {
                documentTags: tagRow.documentTags,
                shortDescription: tagRow.shortDescription,
                houzzTagMergeAt: new Date().toISOString(),
              },
              { merge: true }
            );
          }
        }
      }
    }

    // 3) Dedupe + tags — proposals
    const propGroups = {};
    propSnap.forEach((d) => {
      const n = normDocId(d.data().proposalNum || d.data().number || d.id);
      if (!propGroups[n]) propGroups[n] = [];
      propGroups[n].push({ id: d.id, ref: d.ref, data: d.data() });
    });

    for (const normCode of Object.keys(propGroups).sort()) {
      const entries = propGroups[normCode];
      const keeper = entries.length > 1 ? pickKeeper(entries) : entries[0];
      const tagKey = pid + '|' + normCode;
      const tagRow = tags.docs[tagKey];

      if (entries.length > 1) {
        for (const e of entries) {
          if (e.id === keeper.id) continue;
          summary.deletes++;
          console.log('  DELETE proposal ' + e.id + ' (dup of ' + keeper.id + ')');
          if (APPLY) await e.ref.delete();
        }
      }

      if (tagRow && tagRow.type === 'proposal') {
        const cur = String(keeper.data.documentTags || keeper.data.shortDescription || keeper.data.name || '').trim();
        const tagText = tagRow.documentTags;
        if (cur !== tagText) {
          summary.tagPatches++;
          console.log('  TAG proposal ' + keeper.id + ': "' + (cur || '(empty)') + '" → "' + tagText + '"');
          if (APPLY) {
            await keeper.ref.set(
              {
                documentTags: tagText,
                shortDescription: tagText,
                name: keeper.data.name || tagText,
                houzzTagMergeAt: new Date().toISOString(),
              },
              { merge: true }
            );
          }
        }
      }
    }

    console.log('');
  }

  console.log('══════════════════════════════════════════════════════════');
  console.log('SUMMARY' + (APPLY ? '' : ' (dry run)'));
  console.log('  Boards processed: ' + summary.boards);
  console.log('  Client board patches: ' + summary.clientPatches);
  console.log('  Document tag patches: ' + summary.tagPatches);
  console.log('  Duplicate docs removed: ' + summary.deletes);
  if (!APPLY) {
    console.log('\nNo changes written. Re-run with --apply --backup <dir> to commit.');
  }
  console.log('══════════════════════════════════════════════════════════\n');
}

run()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
