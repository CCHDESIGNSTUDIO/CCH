#!/usr/bin/env node
/**
 * Compare Studio invoices (all boards) to QuickBooks "Invoice List by Date" export.
 *
 *   node studio-qb-invoice-compare.js
 *   node studio-qb-invoice-compare.js "C:\path\to\Invoice List by Date.xlsx"
 *   node studio-qb-invoice-compare.js --min-year=2024
 *
 * QB export: header row with Date, Transaction type, Num, Name, Memo, Due date, Amount, Open balance
 * Matching: exact Num, then normalized core (12958), then substring search in Num/Memo/Name.
 *
 * Outputs:
 *   studio-qb-invoice-compare-{ts}.csv
 *   studio-qb-invoice-compare-{ts}-summary.json
 */
'use strict';

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const admin = require('firebase-admin');
const taxRules = require('../platform/cch-invoice-tax-rules.js');

const DEFAULT_QB =
  'C:\\Users\\cindy\\Documents\\CCH Design Inc._Invoice List by Date.xlsx';
const KEY = path.join(
  __dirname,
  'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json',
);
const TOL = 0.05;

const qbPath = process.argv.find((a) => a.endsWith('.xlsx')) || DEFAULT_QB;
const minYearArg = process.argv.find((a) => a.startsWith('--min-year='));
const MIN_YEAR = minYearArg ? parseInt(minYearArg.split('=')[1], 10) : 0;

function safeNum(v) {
  const n = parseFloat(String(v ?? '').replace(/[$,]/g, ''));
  return Number.isFinite(n) ? n : 0;
}
function round2(n) {
  return Math.round(n * 100) / 100;
}
function csvEsc(v) {
  if (v == null) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

/** Strip IN-/INV-/PO- and optional 2-digit year prefix → numeric core */
function normCore(num) {
  let s = String(num || '')
    .toUpperCase()
    .trim()
    .replace(/\s+/g, '');
  if (!s) return '';
  s = s.replace(/^(IN|INV|PO|RR|PRO|BL)-?/, '');
  s = s.replace(/^(\d{2})-/, '');
  s = s.replace(/^0+/, '');
  return s;
}

function normDisplay(num) {
  return String(num || '')
    .toUpperCase()
    .trim()
    .replace(/\s+/g, '');
}

function lineAmt(it) {
  const qty = parseFloat(it.qty) || 1;
  const cost = parseFloat(it.cost) || 0;
  let sell = parseFloat(it.amount) || 0;
  const rate = parseFloat(it.rate) || parseFloat(it.unitPrice) || 0;
  if (!sell && rate > 0) sell = Math.round(rate * qty * 100) / 100;
  if (taxRules.cchInvoiceLineIsNonTaxableService(it)) {
    if (cost > 0) return Math.round(cost * qty * 100) / 100;
    if (rate > 0) return Math.round(rate * qty * 100) / 100;
    return sell;
  }
  const mk = parseFloat(it.markupPct) || 0;
  if (cost > 0) return Math.round(cost * qty * (1 + mk / 100) * 100) / 100;
  return sell;
}

function studioComputedTotal(inv) {
  if (String(inv.status || '').toLowerCase() === 'void') return 0;
  const items = inv.items || [];
  if (!items.length) return safeNum(inv.total);
  let sub = 0;
  let taxable = 0;
  let ship = 0;
  items.forEach((it) => {
    const amt = lineAmt(it);
    sub += amt;
    ship += parseFloat(it.shipping) || 0;
    if (taxRules.cchCaliforniaInvoiceLineIsTaxable(it)) taxable += amt;
  });
  const rate = parseFloat(inv.taxRate) || 0;
  return round2(sub + ship + taxable * (rate / 100));
}

function studioPayments(inv) {
  const fromRows = (inv.payments || []).reduce((s, p) => s + safeNum(p.amount), 0);
  if (fromRows > 0) return round2(fromRows);
  return round2(safeNum(inv.paidAmount));
}

function studioBalance(inv, computed) {
  const b = inv.invoiceBalance != null ? inv.invoiceBalance : inv.balance;
  if (b != null && b !== '' && !Number.isNaN(parseFloat(b))) return round2(safeNum(b));
  return round2(Math.max(0, computed - studioPayments(inv)));
}

function parseQbWorkbook(filePath) {
  const wb = XLSX.readFile(filePath);
  const raw = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' });
  let headerRow = -1;
  for (let i = 0; i < Math.min(30, raw.length); i++) {
    const row = raw[i];
    if (
      row.some((c) => String(c).toLowerCase() === 'num') &&
      row.some((c) => String(c).toLowerCase() === 'amount')
    ) {
      headerRow = i;
      break;
    }
  }
  if (headerRow < 0) throw new Error('Could not find QB header row (Num, Amount)');

  const header = raw[headerRow].map((c) => String(c || '').trim());
  const idx = (name) =>
    header.findIndex((c) => c.toLowerCase() === name.toLowerCase());
  const cDate = idx('Date');
  const cType = idx('Transaction type');
  const cNum = idx('Num');
  const cName = idx('Name');
  const cMemo = idx('Memo');
  const cAmount = idx('Amount');
  const cOpen = idx('Open balance');

  const byExact = new Map();
  const byCore = new Map();
  const all = [];

  for (let i = headerRow + 1; i < raw.length; i++) {
    const r = raw[i];
    const type = String(r[cType] || '').trim().toLowerCase();
    if (type !== 'invoice') continue;
    const num = String(r[cNum] || '').trim();
    if (!num) continue;
    const dateStr = String(r[cDate] || '');
    const year = parseInt(dateStr.slice(6, 10) || dateStr.slice(0, 4), 10);
    if (MIN_YEAR && year && year < MIN_YEAR) continue;

    const rec = {
      num,
      numNorm: normDisplay(num),
      core: normCore(num),
      date: dateStr,
      name: String(r[cName] || '').trim(),
      memo: String(r[cMemo] || '').trim(),
      amount: round2(safeNum(r[cAmount])),
      openBalance: round2(safeNum(r[cOpen])),
      paid: round2(safeNum(r[cAmount]) - safeNum(r[cOpen])),
      rowIndex: i + 1,
    };
    all.push(rec);

    const pushCore = (map, key, val) => {
      if (!key) return;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(val);
    };
    pushCore(byExact, rec.numNorm, rec);
    pushCore(byCore, rec.core, rec);
  }

  return { byExact, byCore, all, headerRow };
}

function amountCompatible(studioAmt, qbAmt) {
  if (studioAmt <= 0.005) return true;
  const d = Math.abs(studioAmt - qbAmt);
  return d <= TOL || d <= Math.max(50, studioAmt * 0.02);
}

function pickBestQb(candidates, studioRec) {
  if (!candidates || !candidates.length) return null;
  const target =
    studioRec && studioRec.computed > 0.005
      ? studioRec.computed
      : studioRec
        ? studioRec.stored
        : null;

  const viable = target
    ? candidates.filter((q) => amountCompatible(target, q.amount))
    : candidates;
  const pool = viable.length ? viable : candidates;

  if (pool.length === 1) return { ...pool[0], _duplicateQb: candidates.length };

  if (!target) return { ...pool[0], _duplicateQb: candidates.length };

  let best = pool[0];
  let bestDiff = Infinity;
  for (const q of pool) {
    const diff = Math.abs(q.amount - target);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = q;
    }
  }
  if (!amountCompatible(target, best.amount)) return null;
  return { ...best, _duplicateQb: candidates.length };
}

/** Search QB Num, Memo, Name for full invoice id or numeric core (user: search part of doc). */
function searchQbByDocText(studio, qb) {
  const tokens = [];
  if (/^(IN|INV|RR|PO)-\d+/i.test(studio.number)) tokens.push(studio.numNorm);
  if (studio.core && studio.core.length >= 5) tokens.push(studio.core);
  if (!tokens.length) return null;

  const hits = qb.all.filter((q) => {
    const blob = (q.num + ' | ' + q.memo + ' | ' + q.name).toUpperCase();
    return tokens.some((t) => blob.includes(t));
  });
  return pickBestQb(hits, studio);
}

function classifyAmount(studioAmt, qbAmt) {
  const d = round2(studioAmt - qbAmt);
  if (Math.abs(d) <= TOL) return { ok: true, delta: d };
  return { ok: false, delta: d };
}

(async () => {
  if (!fs.existsSync(qbPath)) {
    console.error('QB file not found:', qbPath);
    process.exit(1);
  }
  console.log('Loading QB:', qbPath);
  const qb = parseQbWorkbook(qbPath);
  console.log('  QB invoice rows:', qb.all.length, MIN_YEAR ? `(year >= ${MIN_YEAR})` : '');

  admin.initializeApp({ credential: admin.credential.cert(require(KEY)) });
  const db = admin.firestore();

  /** @type {Map<string, object[]>} */
  const studioByExact = new Map();
  let studioCount = 0;

  const boardsSnap = await db.collection('boards').get();
  for (const boardDoc of boardsSnap.docs) {
    const boardId = boardDoc.id;
    const boardName = (boardDoc.data() || {}).name || boardId;
    const invSnap = await db.collection('boards').doc(boardId).collection('invoices').get();
    invSnap.forEach((doc) => {
      const x = doc.data();
      const number = String(x.number || x.invoiceNum || doc.id).trim().toUpperCase();
      if (!number) return;
      const stored = round2(safeNum(x.total));
      const computed = studioComputedTotal(x);
      const paid = studioPayments(x);
      const balance = studioBalance(x, computed);
      const rec = {
        boardId,
        boardName,
        docId: doc.id,
        number,
        numNorm: normDisplay(number),
        core: normCore(number),
        stored,
        computed,
        paid,
        balance,
        status: String(x.status || '').trim(),
        qbId: String(x.qbDocId || x.qbId || x.qbInvoiceId || '').trim(),
        itemCount: (x.items || []).length,
        taxFixed: !!x._caTaxRulesFixedAt,
      };
      studioCount++;
      if (!studioByExact.has(rec.numNorm)) studioByExact.set(rec.numNorm, []);
      studioByExact.get(rec.numNorm).push(rec);
    });
  }
  console.log('  Studio invoices:', studioCount, 'across', boardsSnap.size, 'boards');

  const rows = [];
  const stats = {
    matched: 0,
    amountOk: 0,
    amountMismatch: 0,
    balanceMismatch: 0,
    studioOnly: 0,
    qbOnly: 0,
    studioDuplicate: 0,
    qbDuplicate: 0,
    fuzzyMatch: 0,
    noQbMatch: 0,
  };

  const matchedQbNums = new Set();

  for (const [numNorm, studioList] of studioByExact) {
    if (studioList.length > 1) stats.studioDuplicate++;

    const primary =
      studioList.find((s) => s.computed > 0) ||
      studioList.reduce((a, b) => (b.stored > a.stored ? b : a), studioList[0]);

    let qbRec = pickBestQb(qb.byExact.get(numNorm), primary);
    let matchMethod = qbRec ? 'exact' : '';

    if (!qbRec && primary.core.length >= 4) {
      qbRec = pickBestQb(qb.byCore.get(primary.core), primary);
      if (qbRec) matchMethod = 'core';
    }

    if (!qbRec) {
      qbRec = searchQbByDocText(primary, qb);
      if (qbRec) {
        matchMethod = 'doc-search';
        stats.fuzzyMatch++;
      }
    }

    if (!qbRec) {
      stats.noQbMatch++;
      stats.studioOnly++;
      for (const s of studioList) {
        rows.push({
          result: 'STUDIO_NO_QB',
          matchMethod: '',
          number: s.number,
          boardId: s.boardId,
          boardName: s.boardName,
          studioStored: s.stored,
          studioComputed: s.computed,
          studioPaid: s.paid,
          studioBalance: s.balance,
          studioStatus: s.status,
          studioQbId: s.qbId,
          qbNum: '',
          qbAmount: '',
          qbOpen: '',
          qbPaid: '',
          amountDelta: '',
          balanceDelta: '',
          qbName: '',
          qbDate: '',
          note: studioList.length > 1 ? 'duplicate studio docs' : '',
        });
      }
      continue;
    }

    matchedQbNums.add(qbRec.numNorm);
    stats.matched++;
    if (qbRec._duplicateQb > 1) stats.qbDuplicate++;

    const useStudio = primary.computed > 0.005 ? primary.computed : primary.stored;
    const amt = classifyAmount(useStudio, qbRec.amount);
    const bal = classifyAmount(primary.balance, qbRec.openBalance);

    if (amt.ok) stats.amountOk++;
    else stats.amountMismatch++;
    if (!bal.ok) stats.balanceMismatch++;

    let result = 'MATCH';
    if (!amt.ok && !bal.ok) result = 'AMOUNT_AND_BALANCE_MISMATCH';
    else if (!amt.ok) result = 'AMOUNT_MISMATCH';
    else if (!bal.ok) result = 'BALANCE_MISMATCH';

    rows.push({
      result,
      matchMethod,
      number: primary.number,
      boardId: primary.boardId,
      boardName: primary.boardName,
      studioStored: primary.stored,
      studioComputed: primary.computed,
      studioPaid: primary.paid,
      studioBalance: primary.balance,
      studioStatus: primary.status,
      studioQbId: primary.qbId,
      qbNum: qbRec.num,
      qbAmount: qbRec.amount,
      qbOpen: qbRec.openBalance,
      qbPaid: qbRec.paid,
      amountDelta: amt.delta,
      balanceDelta: bal.delta,
      qbName: qbRec.name,
      qbDate: qbRec.date,
      note:
        (studioList.length > 1 ? `studio×${studioList.length}; ` : '') +
        (qbRec._duplicateQb > 1 ? `qb×${qbRec._duplicateQb}; ` : '') +
        (Math.abs(primary.stored - primary.computed) > TOL
          ? `stored≠computed(${primary.stored} vs ${primary.computed}); `
          : ''),
    });
  }

  // QB invoices with no Studio match (focus IN-/INV- style recent)
  for (const q of qb.all) {
    if (matchedQbNums.has(q.numNorm)) continue;
    const isModern = /^(IN|INV)-\d+/i.test(q.num);
    if (!isModern && MIN_YEAR) continue;
    stats.qbOnly++;
    rows.push({
      result: 'QB_ONLY',
      matchMethod: '',
      number: q.num,
      boardId: '',
      boardName: '',
      studioStored: '',
      studioComputed: '',
      studioPaid: '',
      studioBalance: '',
      studioStatus: '',
      studioQbId: '',
      qbNum: q.num,
      qbAmount: q.amount,
      qbOpen: q.openBalance,
      qbPaid: q.paid,
      amountDelta: '',
      balanceDelta: '',
      qbName: q.name,
      qbDate: q.date,
      note: '',
    });
  }

  rows.sort((a, b) => {
    const rank = (r) =>
      r.result === 'AMOUNT_MISMATCH' || r.result === 'AMOUNT_AND_BALANCE_MISMATCH'
        ? 0
        : r.result === 'BALANCE_MISMATCH'
          ? 1
          : r.result === 'STUDIO_NO_QB'
            ? 2
            : 3;
    return rank(a) - rank(b) || String(a.number).localeCompare(String(b.number));
  });

  const ts = Date.now();
  const outXlsx = path.join(__dirname, `studio-qb-invoice-compare-${ts}.xlsx`);
  const outCsv = path.join(__dirname, `studio-qb-invoice-compare-${ts}.csv`);
  const outJson = path.join(__dirname, `studio-qb-invoice-compare-${ts}-summary.json`);

  const headers = [
    'result',
    'matchMethod',
    'number',
    'boardId',
    'boardName',
    'studioStored',
    'studioComputed',
    'studioPaid',
    'studioBalance',
    'studioStatus',
    'studioQbId',
    'qbNum',
    'qbAmount',
    'qbOpen',
    'qbPaid',
    'amountDelta',
    'balanceDelta',
    'qbName',
    'qbDate',
    'note',
  ];
  const csv = [
    headers.join(','),
    ...rows.map((r) => headers.map((h) => csvEsc(r[h])).join(',')),
  ].join('\n');
  fs.writeFileSync(outCsv, csv, 'utf8');

  const mismatchRows = rows.filter(
    (r) =>
      r.result.includes('MISMATCH') ||
      r.result === 'STUDIO_NO_QB' ||
      r.result === 'QB_ONLY',
  );
  const matchRows = rows.filter((r) => r.result === 'MATCH');

  const wbOut = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wbOut, XLSX.utils.json_to_sheet(rows), 'All');
  XLSX.utils.book_append_sheet(wbOut, XLSX.utils.json_to_sheet(mismatchRows), 'Mismatches');
  XLSX.utils.book_append_sheet(wbOut, XLSX.utils.json_to_sheet(matchRows), 'Matches');
  const summaryAoA = [
    ['Metric', 'Value'],
    ['QB file', qbPath],
    ['QB invoices (year filter)', qb.all.length],
    ['Studio invoices', studioCount],
    ['Boards', boardsSnap.size],
    ['Matched', stats.matched],
    ['Amount OK', stats.amountOk],
    ['Amount mismatch', stats.amountMismatch],
    ['Balance mismatch', stats.balanceMismatch],
    ['Studio only (no QB)', stats.studioOnly],
    ['QB only (no Studio)', stats.qbOnly],
    ['Generated', new Date().toISOString()],
  ];
  XLSX.utils.book_append_sheet(wbOut, XLSX.utils.aoa_to_sheet(summaryAoA), 'Summary');
  XLSX.writeFile(wbOut, outXlsx);

  const mismatches = rows.filter(
    (r) =>
      r.result.includes('MISMATCH') ||
      r.result === 'STUDIO_NO_QB' ||
      r.result === 'QB_ONLY',
  );

  const summary = {
    qbPath,
    minYear: MIN_YEAR || null,
    studioInvoices: studioCount,
    qbInvoices: qb.all.length,
    stats,
    mismatchCount: mismatches.length,
    topAmountMismatches: rows
      .filter((r) => r.result.includes('AMOUNT'))
      .sort((a, b) => Math.abs(b.amountDelta) - Math.abs(a.amountDelta))
      .slice(0, 40)
      .map((r) => ({
        number: r.number,
        board: r.boardName,
        studio: r.studioComputed,
        qb: r.qbAmount,
        delta: r.amountDelta,
        qbNum: r.qbNum,
      })),
    rollingHillsSpot: ['IN-12958', 'IN-12946', 'IN-12902', 'IN-12930'].map((n) =>
      rows.find((r) => r.number === n),
    ),
  };
  fs.writeFileSync(outJson, JSON.stringify(summary, null, 2), 'utf8');

  console.log('\n=== Summary ===');
  console.log(JSON.stringify(stats, null, 2));
  console.log('\nRolling Hills spot check:');
  for (const r of summary.rollingHillsSpot) {
    if (!r) continue;
    console.log(
      `  ${r.number}: ${r.result}  Studio $${r.studioComputed} (stored ${r.studioStored})  QB $${r.qbAmount}  Δ $${r.amountDelta}  open QB $${r.qbOpen} vs Studio bal $${r.studioBalance}`,
    );
  }
  console.log('\nTop amount mismatches (up to 15):');
  summary.topAmountMismatches.slice(0, 15).forEach((r) => {
    console.log(`  ${r.number} (${r.board}): Studio ${r.studio} QB ${r.qb} Δ ${r.delta}`);
  });
  console.log('\nExcel:', outXlsx);
  console.log('CSV:', outCsv);
  console.log('JSON:', outJson);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
