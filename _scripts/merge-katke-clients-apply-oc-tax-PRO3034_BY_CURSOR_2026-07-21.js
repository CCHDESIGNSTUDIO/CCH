/**
 * PRODUCTION apply (Cindy GO 2026-07-21):
 * 1) Merge Shelly / Garza C/O / Katke stub into canonical client shelley-katke
 * 2) Point Katke boards at shelley-katke
 * 3) Apply Orange County 7.75% taxRate to PRO-3034 (project already OC)
 *
 * Usage:
 *   node _scripts/merge-katke-clients-apply-oc-tax-PRO3034_BY_CURSOR_2026-07-21.js
 *   node _scripts/merge-katke-clients-apply-oc-tax-PRO3034_BY_CURSOR_2026-07-21.js --apply
 */
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const APPLY = process.argv.includes('--apply');
const KEY = path.join(
  __dirname,
  '..',
  '_debug',
  'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json'
);
const BACKUP_DIR = path.join(
  __dirname,
  '..',
  '_backup',
  'katke-client-merge-2026-07-21'
);

const KEEP_ID = 'shelley-katke';
const DELETE_IDS = [
  'shelly-katke',
  'shelley-katke-c-o-garza-blanca-resort-att-maria-estela-nu-es',
  'katke'
];
const BOARD_IDS = ['katke-graceland-dr', 'katke-nashville', 'katke-puerto-vallarta'];
const PROP_PATH = {
  projectId: 'katke-graceland-dr',
  proposalId: 'vODrqOOtaMUOsBEhQYXE',
  proposalNum: 'PRO-3034'
};
const OC_RATE = 7.75;

const app = admin.initializeApp(
  { credential: admin.credential.cert(require(KEY)) },
  'katkeMergeOcTax'
);
const db = app.firestore();

function proposalLineTotal(it) {
  const amount = parseFloat(it && it.amount);
  if (!isNaN(amount)) return amount;
  const qty = parseFloat(it && it.qty) || 1;
  const cp = parseFloat(it && it.clientPrice) || 0;
  return cp * qty;
}

function isTaxable(it) {
  if (!it || it.lineKind === 'group') return false;
  return it.taxable !== false;
}

(async () => {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const backup = { at: new Date().toISOString(), clients: {}, boards: {}, proposal: null };

  const keepSnap = await db.collection('clients').doc(KEEP_ID).get();
  if (!keepSnap.exists) throw new Error('Canonical client missing: ' + KEEP_ID);
  backup.clients[KEEP_ID] = keepSnap.data();

  const shellySnap = await db.collection('clients').doc('shelly-katke').get();
  const shelly = shellySnap.exists ? shellySnap.data() : {};
  backup.clients['shelly-katke'] = shelly;

  for (const id of DELETE_IDS) {
    const s = await db.collection('clients').doc(id).get();
    backup.clients[id] = s.exists ? s.data() : null;
  }

  const keepPatch = {
    name: 'Shelley Katke',
    email: 'sjkat99@yahoo.com',
    phone: String(backup.clients[KEEP_ID].phone || shelly.phone || '(949) 874-4928').trim(),
    street: backup.clients[KEEP_ID].street || '571 Graceland Dr',
    city: backup.clients[KEEP_ID].city || 'Laguna Beach',
    state: 'California',
    zip: backup.clients[KEEP_ID].zip || '92651',
    address:
      backup.clients[KEEP_ID].address ||
      '571 Graceland Dr, Laguna Beach, California, 92651',
    updatedAt: new Date().toISOString(),
    _mergedFrom: DELETE_IDS.slice(),
    _mergedAt: new Date().toISOString()
  };

  const boardPatches = {};
  for (const bid of BOARD_IDS) {
    const s = await db.collection('boards').doc(bid).get();
    backup.boards[bid] = s.exists ? s.data() : null;
    if (!s.exists) continue;
    const d = s.data() || {};
    boardPatches[bid] = {
      clientId: KEEP_ID,
      clientName: 'Shelley Katke',
      clientEmail: d.clientEmail || 'sjkat99@yahoo.com',
      clientPhone: d.clientPhone || keepPatch.phone,
      updatedAt: new Date().toISOString()
    };
  }

  const propRef = db
    .collection('boards')
    .doc(PROP_PATH.projectId)
    .collection('proposals')
    .doc(PROP_PATH.proposalId);
  const propSnap = await propRef.get();
  if (!propSnap.exists) throw new Error('PRO-3034 not found');
  const prop = propSnap.data() || {};
  backup.proposal = Object.assign({ id: PROP_PATH.proposalId }, prop);

  const items = Array.isArray(prop.items) ? prop.items : [];
  let sub = 0;
  let taxableSub = 0;
  items.forEach((it) => {
    if (!it || it.lineKind === 'group') return;
    const amt = proposalLineTotal(it);
    sub += amt;
    if (isTaxable(it)) taxableSub += amt;
  });
  const tax = Math.round(taxableSub * (OC_RATE / 100) * 100) / 100;
  const grand = Math.round((sub + tax) * 100) / 100;
  const propPatch = {
    taxRate: OC_RATE,
    taxRatePreset: String(OC_RATE),
    tax: tax,
    subtotal: Math.round(sub * 100) / 100,
    total: grand,
    updatedAt: new Date().toISOString(),
    _taxAppliedNote: 'OC 7.75% applied from project taxRate 2026-07-21'
  };

  const backupPath = path.join(BACKUP_DIR, 'BACKUP_before_apply.json');
  fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));
  console.log('Backup written:', backupPath);
  console.log('Mode:', APPLY ? 'APPLY' : 'DRY-RUN');
  console.log('Keep client patch:', keepPatch);
  console.log('Delete clients:', DELETE_IDS);
  console.log('Board patches:', boardPatches);
  console.log('PRO-3034 patch:', propPatch);
  console.log('  taxableSub', taxableSub, '→ tax', tax, 'grand', grand, '(was total', prop.total, ')');

  if (!APPLY) {
    console.log('\nRe-run with --apply to write production.');
    process.exit(0);
  }

  await db.collection('clients').doc(KEEP_ID).set(keepPatch, { merge: true });
  for (const id of DELETE_IDS) {
    await db.collection('clients').doc(id).delete();
    console.log('Deleted client', id);
  }
  for (const bid of Object.keys(boardPatches)) {
    await db.collection('boards').doc(bid).set(boardPatches[bid], { merge: true });
    console.log('Updated board', bid);
  }
  await propRef.set(propPatch, { merge: true });
  console.log('Updated PRO-3034 tax to OC 7.75%');
  console.log('DONE');
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
