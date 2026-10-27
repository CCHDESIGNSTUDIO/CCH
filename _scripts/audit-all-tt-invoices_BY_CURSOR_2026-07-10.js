'use strict';
const path = require('path');
const admin = require('firebase-admin');
const KEY = require(path.join(__dirname, '..', '_debug', 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json'));
const db = admin.initializeApp({ credential: admin.credential.cert(KEY) }, 'all').firestore();
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

  const rows = [];
  const boards = await db.collection('boards').get();
  for (const b of boards.docs) {
    const invs = await db.collection('boards').doc(b.id).collection('invoices').get();
    invs.forEach((d) => {
      const x = d.data() || {};
      if (str(x.source) !== 'time-tracker') return;
      const svc = svcFromItems(x.items);
      const linked = entries.filter((t) => str(t.invoiceId) === d.id && str(t.invoiceProjectId || t.projectId) === b.id);
      const ledgerH = r2(linked.reduce((s, t) => s + n(t.hours), 0));
      const ledger$ = r2(linked.reduce((s, t) => s + n(t.total), 0));
      const gapH = r2(ledgerH - svc.h);
      const gap$ = r2(ledger$ - svc.$);
      let flag = 'OK';
      if (Math.abs(gapH) > 0.05 || Math.abs(gap$) > 0.05) flag = gapH > 0 || gap$ > 0 ? 'LEAK' : 'INV>HRS';
      if ((x.timeEntryIds || []).length && !linked.length) flag = 'NO LINK';
      rows.push({
        pname: str(x.projectName) || b.id,
        pid: b.id,
        invNum: str(x.invoiceNum || x.number),
        status: str(x.status),
        ledgerH, ledger$, invH: svc.h, inv$: svc.$,
        gapH, gap$, flag,
        rows: linked.length
      });
    });
  }
  rows.sort((a, b) => a.pname.localeCompare(b.pname) || a.invNum.localeCompare(b.invNum));
  console.log('ALL time-tracker invoices (' + rows.length + '):\n');
  rows.forEach((r) => {
    console.log((r.flag === 'OK' ? '  OK' : ' BAD') + ' | ' + r.pname + ' | ' + r.invNum + ' [' + r.status + ']' +
      ' | ledger ' + r.ledgerH + 'h $' + r.ledger$ +
      ' | inv ' + r.invH + 'h $' + r.inv$ +
      (r.flag !== 'OK' ? ' | gap ' + r.gapH + 'h $' + r.gap$ : ''));
  });
  const badJobs = [...new Set(rows.filter((r) => r.flag !== 'OK').map((r) => r.pname))];
  console.log('\nBad jobs (' + badJobs.length + '): ' + badJobs.join('; '));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
