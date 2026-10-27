'use strict';
/** READ-ONLY: broader leak scan — Studio link, import ref, unlinked billable */
const path = require('path');
const admin = require('firebase-admin');
const KEY = require(path.join(__dirname, '..', '_debug', 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json'));
const db = admin.initializeApp({ credential: admin.credential.cert(KEY) }, 'broad').firestore();

const str = (v) => String(v == null ? '' : v).trim();
const n = (v) => parseFloat(v) || 0;
const r2 = (v) => Math.round(n(v) * 100) / 100;

function isInvoicedAny(t) {
  return !!(str(t.invoiceId) || str(t.invoiceNumber) || str(t.invoiceNum) || str(t.invoiceRef) || str(t.houzzInvoice));
}
function isStudioLinked(t) { return !!str(t.invoiceId); }

const NB = /\b(personal|pto|vacation|sick|holiday)\b/i;
const CCH = /^(cch|cbh)|^(internal|admin|overhead|marketing|business development)$/i;

function isClientBillable(t) {
  if (t.billable === false) return false;
  const proj = str(t.project || t.projectName).toLowerCase();
  if (!proj || NB.test(proj) || CCH.test(proj)) return false;
  return true;
}

(async () => {
  const snap = await db.collection('timeEntries').get();
  const byProject = {};

  snap.forEach((d) => {
    const t = d.data() || {};
    if (!isClientBillable(t)) return;
    const h = n(t.hours);
    if (h <= 0) return;
    const pname = str(t.project || t.projectName) || '(none)';
    if (!byProject[pname]) {
      byProject[pname] = {
        loggedH: 0, logged$: 0,
        studioH: 0, studio$: 0,
        importRefH: 0, importRef$: 0,
        unlinkedH: 0, unlinked$: 0,
        studioMismatchH: 0
      };
    }
    const p = byProject[pname];
    const $ = n(t.total);
    p.loggedH += h; p.logged$ += $;

    if (isStudioLinked(t)) { p.studioH += h; p.studio$ += $; }
    else if (isInvoicedAny(t)) { p.importRefH += h; p.importRef$ += $; }
    else { p.unlinkedH += h; p.unlinked$ += $; }
  });

  // Studio invoice docs from time-tracker source
  const boardsSnap = await db.collection('boards').get();
  const ttInvoices = [];
  for (const b of boardsSnap.docs) {
    const invSnap = await db.collection('boards').doc(b.id).collection('invoices').get();
    invSnap.forEach((d) => {
      const x = d.data() || {};
      if (str(x.source) !== 'time-tracker') return;
      let svcH = 0, svc$ = 0;
      (x.items || []).forEach((it) => {
        if (it && (it.expenseType === 'service' || it.itemType === 'service')) {
          svcH += n(it.qty != null ? it.qty : it.quantity);
          svc$ += n(it.amount);
        }
      });
      ttInvoices.push({
        pid: b.id,
        pname: str(x.projectName) || b.id,
        invNum: str(x.invoiceNum || x.number) || d.id,
        svcH: r2(svcH), svc$: r2(svc$),
        total$: r2(n(x.total)),
        entryIds: (x.timeEntryIds || []).length,
        status: str(x.status)
      });
    });
  }

  Object.keys(byProject).forEach((k) => {
    const p = byProject[k];
    p.loggedH = r2(p.loggedH); p.logged$ = r2(p.logged$);
    p.studioH = r2(p.studioH); p.studio$ = r2(p.studio$);
    p.importRefH = r2(p.importRefH); p.importRef$ = r2(p.importRef$);
    p.unlinkedH = r2(p.unlinkedH); p.unlinked$ = r2(p.unlinked$);
  });

  console.log('=== BROADER TIME BILLING SCAN (production) ===\n');

  // Jobs with significant unlinked billable (never invoiced in Studio)
  const unlinked = Object.entries(byProject)
    .filter(([, p]) => p.unlinkedH > 5)
    .sort((a, b) => b[1].unlinked$ - a[1].unlinked$);

  console.log('--- Jobs with 5h+ UNLINKED billable time (no invoice link at all) ---');
  unlinked.slice(0, 20).forEach(([name, p]) => {
    console.log('  ' + name + ': ' + p.unlinkedH + 'h $' + p.unlinked$ + ' unlinked (of ' + p.loggedH + 'h logged)');
  });
  console.log('  Count:', unlinked.length, 'jobs\n');

  // time-tracker invoices where linked entry hours may not match
  console.log('--- All time-tracker Studio invoices (' + ttInvoices.length + ') ---');
  const invByProject = {};
  ttInvoices.forEach((inv) => {
    const k = inv.pname;
    if (!invByProject[k]) invByProject[k] = [];
    invByProject[k].push(inv);
  });

  // Re-fetch ledger sums per invoice id
  const allEntries = [];
  snap.forEach((d) => {
    const t = d.data() || {};
    if (str(t.invoiceId)) allEntries.push({ id: d.id, ...t });
  });

  const problemJobs = new Set();
  const problems = [];

  for (const inv of ttInvoices) {
    const linked = allEntries.filter((t) => str(t.invoiceId) === inv.invNum.replace('INV-', '') ? false : str(t.invoiceId));
    // match by project + invoice number on entries
    const rows = allEntries.filter((t) => {
      const pid = str(t.invoiceProjectId || t.projectId);
      const num = str(t.invoiceNumber || t.invoiceNum);
      return pid === inv.pid && (num === inv.invNum || str(t.invoiceId)); 
    });
    // better: get invoice doc id
  }

  // Simpler: for each tt invoice, find entries with matching invoiceNumber and pid
  for (const inv of ttInvoices) {
    const rows = [];
    allEntries.forEach((t) => {
      if (str(t.invoiceProjectId || t.projectId) !== inv.pid) return;
      const num = str(t.invoiceNumber || t.invoiceNum);
      if (num === inv.invNum) rows.push(t);
    });
    const ledgerH = r2(rows.reduce((s, t) => s + n(t.hours), 0));
    const ledger$ = r2(rows.reduce((s, t) => s + n(t.total), 0));
    const gapH = r2(ledgerH - inv.svcH);
    const gap$ = r2(ledger$ - inv.svc$);
    if (rows.length && (Math.abs(gapH) > 0.05 || Math.abs(gap$) > 0.05)) {
      problemJobs.add(inv.pname);
      problems.push({ ...inv, ledgerH, ledger$, gapH, gap$, rows: rows.length });
    } else if (!rows.length && inv.entryIds > 0) {
      problemJobs.add(inv.pname);
      problems.push({ ...inv, ledgerH: 0, ledger$: 0, gapH: -inv.svcH, gap$: -inv.svc$, rows: 0, note: 'invoice lists timeEntryIds but no matching ledger rows' });
    }
  }

  problems.sort((a, b) => Math.abs(b.gap$) - Math.abs(a.gap$));
  console.log('Invoices where ledger link sum ≠ invoice service lines:');
  problems.forEach((p) => {
    console.log('  ' + p.pname + ' | ' + p.invNum + ' [' + p.status + ']' +
      ' | ledger ' + (p.ledgerH || 0) + 'h $' + (p.ledger$ || 0) +
      ' | invoice ' + p.svcH + 'h $' + p.svc$ +
      ' | gap ' + (p.gapH >= 0 ? '+' : '') + p.gapH + 'h $' + (p.gap$ >= 0 ? '+' : '') + p.gap$ +
      ' | rows=' + p.rows + (p.note ? ' ' + p.note : ''));
  });

  console.log('\n--- DISTINCT JOBS WITH TIME-TRACKER INVOICE MISMATCH ---');
  console.log('Count:', problemJobs.size);
  [...problemJobs].sort().forEach((j) => console.log('  • ' + j));

  // Sum leak on positive gaps only
  let hrs = 0, dol = 0;
  problems.forEach((p) => { if (p.gapH > 0.05) hrs += p.gapH; if (p.gap$ > 0.05) dol += p.gap$; });
  console.log('\nPositive leak (ledger > invoice lines): ' + r2(hrs) + 'h | $' + r2(dol));

  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
