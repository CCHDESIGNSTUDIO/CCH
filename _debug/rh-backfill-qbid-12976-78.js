/**
 * Rolling Hills — backfill QuickBooks invoice IDs for IN-12976 / IN-12977 / IN-12978 only.
 * Houzz assigned these after the May 3 tracker pass; rh-delta expects 74460 / 74461 / 74462.
 *
 *   node rh-backfill-qbid-12976-78.js           # dry run
 *   node rh-backfill-qbid-12976-78.js --execute
 *
 * Does not change status, paidAmount, or balance — record payments in Studio after qbId is set.
 */
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const BOARD_ID = 'cloud-rolling-hills';
const EXECUTE = process.argv.includes('--execute');

const QB_BY_NUMBER = {
  'IN-12976': '74460',
  'IN-12977': '74461',
  'IN-12978': '74462',
};

function findServiceAccountJson() {
  const dir = path.join(__dirname, 'service-account.json');
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
  if (!files.length) return null;
  return path.join(dir, files[0]);
}

(async () => {
  const sa = findServiceAccountJson();
  if (!sa) {
    console.error('No JSON under _debug/service-account.json/ — cannot run.');
    process.exit(1);
  }
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(require(sa)) });
  }
  const db = admin.firestore();
  const inv = db.collection('boards').doc(BOARD_ID).collection('invoices');
  const snap = await inv.get();

  const rows = [];
  snap.forEach((d) => {
    const x = d.data();
    const n = String(x.number || x.invoiceNum || '').trim().toUpperCase();
    const want = QB_BY_NUMBER[n];
    if (!want) return;
    const qBid = String(x.qbId || '').trim();
    const qInv = String(x.qbInvoiceId || '').trim();
    const qDoc = String(x.qbDocId || '').trim();
    const cur = qBid || qInv || qDoc;
    const needsPatch =
      qBid !== want ||
      qInv !== want ||
      qDoc !== want ||
      x.qbSynced !== true;
    rows.push({ ref: d.ref, docId: d.id, number: n, cur, want, qBid, qInv, qDoc, needsPatch });
  });

  console.log(`Rolling Hills qbId backfill (${EXECUTE ? 'EXECUTE' : 'DRY RUN'})\n`);
  for (const r of rows.sort((a, b) => a.number.localeCompare(b.number))) {
    const same = !r.needsPatch;
    console.log(
      `${r.number}  docId=${r.docId}  qbId=${r.qBid || '—'}  qbInvoiceId=${r.qInv || '—'}  qbDocId=${r.qDoc || '—'}  →  ${r.want}  ${same ? '(OK)' : '(patch)'}`
    );
  }

  const toWrite = rows.filter((r) => r.needsPatch);
  if (!toWrite.length) {
    console.log('\nNothing to write.');
    process.exit(0);
  }

  if (!EXECUTE) {
    console.log(`\nDRY RUN — ${toWrite.length} doc(s) would be updated. Re-run with --execute.`);
    process.exit(0);
  }

  const batch = db.batch();
  const now = new Date().toISOString();
  for (const r of toWrite) {
    batch.update(r.ref, {
      qbId: r.want,
      qbInvoiceId: r.want,
      qbDocId: r.want,
      qbSynced: true,
      qbSyncDate: now,
      qbStatus: 'sent',
      _qbIdBackfilledAt: now,
      _qbIdBackfillNote: 'rh-backfill-qbid-12976-78.js IN-12976/77/78 → Houzz QB IDs 74460/61/62',
    });
  }
  await batch.commit();
  console.log(`\nWrote ${toWrite.length} invoice(s).`);
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
