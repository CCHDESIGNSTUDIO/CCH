// Fix PO-9036 (cloud-rolling-hills) Guest 2 & Guest 4 Maverick lines:
//   amount written as SELLING (701.12) -> reset to vendor COST (519.35), strip stray total/markup.
// READ-ONLY unless run with --apply. Backs up the full PO doc before any write.
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const APPLY = process.argv.includes('--apply');
const PROJECT = 'cloud-rolling-hills';
const PO_ID = '7lTOzx4fCVBCyKvLMFp7';
const TARGET_CLIPS = ['rhG2Maverick52L39', 'rhG4Maverick52L39'];

admin.initializeApp({
  credential: admin.credential.cert(require(path.join(__dirname, '..', '_debug', 'service-account.json',
    'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json'))),
});
const db = admin.firestore();
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

(async () => {
  const ref = db.collection('boards').doc(PROJECT).collection('purchaseOrders').doc(PO_ID);
  const snap = await ref.get();
  if (!snap.exists) { console.error('PO not found'); process.exit(1); }
  const data = snap.data();
  const items = Array.isArray(data.items) ? data.items : [];

  // backup
  const backupDir = path.join(__dirname, '..', '_backup', 'po9036-g2g4-amount-fix-2026-06-22');
  fs.mkdirSync(backupDir, { recursive: true });
  fs.writeFileSync(path.join(backupDir, 'backup-before.json'),
    JSON.stringify({ id: PO_ID, project: PROJECT, total: data.total, data }, null, 2));
  console.log('Backup written to', backupDir);

  let changed = 0;
  const newItems = items.map((line, i) => {
    const l = Object.assign({}, line);
    const clip = String(l.clipId || '');
    const isTarget = TARGET_CLIPS.includes(clip);
    if (!isTarget) return line;
    const qty = Number(l.qty) || 1;
    const cost = (l.unitCost != null ? Number(l.unitCost) : Number(l.cost)) || 0;
    const newAmount = round2(cost * qty);
    console.log('\n--- line index ' + i + ' (' + (l.room || '?') + ' / clip ' + clip + ') ---');
    console.log('  BEFORE: amount=' + l.amount + '  total=' + l.total + '  markup=' + l.markup + '  cost=' + l.cost + '  unitCost=' + l.unitCost + '  qty=' + qty);
    l.amount = newAmount;
    if ('total' in l) delete l.total;
    if ('markup' in l) delete l.markup;
    console.log('  AFTER : amount=' + l.amount + '  total=' + (l.total === undefined ? '(removed)' : l.total) + '  markup=' + (l.markup === undefined ? '(removed)' : l.markup));
    changed++;
    return l;
  });

  // sibling reference (Guest 3 shared-clip line) for shape comparison
  const g3 = items.find(l => String(l.clipId || '') === '0X3msVr4kqQhV1Ap4VX3');
  if (g3) console.log('\n[sibling Guest 3 for reference] amount=' + g3.amount + '  total=' + g3.total + '  markup=' + g3.markup + '  cost=' + g3.cost);

  console.log('\nMatched target lines: ' + changed);
  console.log('PO total (unchanged, cost-based): ' + data.total);

  if (!APPLY) { console.log('\nDRY RUN — no write. Re-run with --apply to write.'); process.exit(0); }
  if (changed !== 2) { console.error('\nExpected 2 target lines, found ' + changed + ' — aborting write for safety.'); process.exit(1); }
  await ref.update({ items: newItems, updatedAt: new Date().toISOString() });
  console.log('\nAPPLIED. PO-9036 Guest 2 & Guest 4 line amounts reset to cost.');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
