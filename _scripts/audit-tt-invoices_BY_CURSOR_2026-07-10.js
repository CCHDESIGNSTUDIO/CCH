'use strict';
const path = require('path');
const admin = require('firebase-admin');
const KEY = require(path.join(__dirname, '..', '_debug', 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json'));
const db = admin.initializeApp({ credential: admin.credential.cert(KEY) }, 'x').firestore();
const str = (v) => String(v == null ? '' : v).trim();
const n = (v) => parseFloat(v) || 0;
const r2 = (v) => Math.round(n(v) * 100) / 100;

function svcFromItems(items) {
  let h = 0, $ = 0;
  (items || []).forEach((it) => {
    if (!it || !(it.expenseType === 'service' || it.itemType === 'service')) return;
    h += n(it.qty != null ? it.qty : it.quantity);
    $ += n(it.amount);
  });
  return { h: r2(h), $: r2($) };
}

(async () => {
  const entries = [];
  (await db.collection('timeEntries').get()).forEach((d) => entries.push({ id: d.id, ...d.data() }));

  const ttInvs = [];
  const boards = await db.collection('boards').get();
  for (const b of boards.docs) {
    const invs = await db.collection('boards').doc(b.id).collection('invoices').get();
    invs.forEach((d) => {
      const x = d.data() || {};
      if (str(x.source) !== 'time-tracker') return;
      const svc = svcFromItems(x.items);
      ttInvs.push({
        docId: d.id,
        pid: b.id,
        pname: str(x.projectName) || b.id,
        invNum: str(x.invoiceNum || x.number) || d.id,
        status: str(x.status),
        svcH: svc.h, svc$: svc.$,
        entryIds: (x.timeEntryIds || []).length
      });
    });
  }

  const problems = [];
  const jobs = new Set();

  ttInvs.forEach((inv) => {
    const rows = entries.filter((t) => str(t.invoiceId) === inv.docId && str(t.invoiceProjectId || t.projectId) === inv.pid);
    const ledgerH = r2(rows.reduce((s, t) => s + n(t.hours), 0));
    const ledger$ = r2(rows.reduce((s, t) => s + n(t.total), 0));
    const gapH = r2(ledgerH - inv.svcH);
    const gap$ = r2(ledger$ - inv.svc$);
    const bad = Math.abs(gapH) > 0.05 || Math.abs(gap$) > 0.05 || (inv.entryIds > 0 && !rows.length);
    if (bad) {
      jobs.add(inv.pname);
      problems.push({ ...inv, rows: rows.length, ledgerH, ledger$, gapH, gap$ });
    }
  });

  problems.sort((a, b) => b.gap$ - a.gap$);

  console.log('Time-tracker invoices:', ttInvs.length);
  console.log('Problem invoices:', problems.length);
  console.log('Distinct jobs:', jobs.size);
  console.log('');
  problems.forEach((p) => {
    const dir = p.gapH > 0 ? 'LEDGER HIGH' : (p.gapH < 0 ? 'INV HIGH' : 'AMT');
    console.log(p.pname);
    console.log('  ' + p.invNum + ' [' + p.status + '] ' + dir);
    console.log('  ledger: ' + p.ledgerH + 'h $' + p.ledger$ + ' (' + p.rows + ' rows) | invoice lines: ' + p.svcH + 'h $' + p.svc$ + ' | gap: ' + p.gapH + 'h $' + p.gap$);
  });

  let posH = 0, pos$ = 0;
  problems.forEach((p) => { if (p.gapH > 0) posH += p.gapH; if (p.gap$ > 0) pos$ += p.gap$; });
  console.log('\nFirm positive leak (ledger > invoice): ' + r2(posH) + 'h $' + r2(pos$));
  console.log('\nJobs:');
  [...jobs].sort().forEach((j) => console.log(' • ' + j));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
