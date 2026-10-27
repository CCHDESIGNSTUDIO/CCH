'use strict';
/** Staging read-only: find design-services invoices that include expense lines. */
const path = require('path');
const admin = require('firebase-admin');
const KEY = path.join(
  __dirname,
  '..',
  '_debug',
  'service-account.json',
  'cch-studio-staging-firebase-adminsdk-fbsvc-b93c6f1cf4.json'
);
const db = admin.initializeApp({ credential: admin.credential.cert(require(KEY)) }, 'stDsExp').firestore();

function coerce(val) {
  if (Array.isArray(val)) return val.filter(Boolean);
  if (val && typeof val === 'object') {
    return Object.keys(val)
      .filter((k) => /^\d+$/.test(k))
      .sort((a, b) => +a - +b)
      .map((k) => val[k])
      .filter(Boolean);
  }
  return [];
}

(async () => {
  const boards = await db.collection('boards').get();
  let found6054 = null;
  const candidates = [];
  for (const b of boards.docs) {
    const invs = await db.collection('boards').doc(b.id).collection('invoices').get();
    for (const inv of invs.docs) {
      const d = inv.data() || {};
      const num = String(d.number || d.invoiceNum || inv.id || '');
      const items = coerce(d.items);
      const ets = items.map((it) => String((it && it.expenseType) || '').toLowerCase());
      const hasExp = ets.some((e) => e === 'expense' || e === 'other_expense');
      const hasSvc =
        ets.some((e) => e === 'service') ||
        items.some((it) => /design service/i.test(String((it && (it.title || it.name)) || '')));
      if (num.includes('6054') || inv.id.includes('6054')) {
        found6054 = { pid: b.id, id: inv.id, num, items: items.length };
      }
      if (hasExp && (hasSvc || String(d.source || '') === 'time-tracker' || (d.timeEntryIds && d.timeEntryIds.length))) {
        candidates.push({
          pid: b.id,
          board: (b.data() || {}).name,
          id: inv.id,
          num,
          n: items.length,
          ets: ets.filter(Boolean).slice(0, 10),
          titles: items.slice(0, 5).map((it) => it.title || it.name)
        });
      }
    }
  }
  console.log('INV-6054 on staging?', found6054 || 'NO');
  console.log('DS+expense candidates', candidates.length);
  candidates.slice(0, 15).forEach((c) => console.log(JSON.stringify(c)));
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
