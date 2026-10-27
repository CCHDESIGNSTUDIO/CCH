'use strict';
/**
 * Add "Neolith" to settings/vendors.list (Clipper picker) if missing.
 * Default DRY RUN. APPLY=1 to write (production).
 */
const path = require('path');
const fs = require('fs');
const admin = require('firebase-admin');
const KEY = path.join(
  __dirname,
  '..',
  '_debug',
  'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json'
);
const db = admin.initializeApp({ credential: admin.credential.cert(require(KEY)) }, 'neoSync').firestore();
const APPLY = process.env.APPLY === '1';
const NAME = 'Neolith';

(async () => {
  console.log(APPLY ? 'MODE: APPLY' : 'MODE: DRY RUN');
  const ref = db.collection('settings').doc('vendors');
  const snap = await ref.get();
  const before = snap.exists ? snap.data() || {} : {};
  const list = Array.isArray(before.list) ? before.list.slice() : [];
  const has = list.some((v) => String(v || '').trim().toLowerCase() === NAME.toLowerCase());
  console.log('list length', list.length, 'already has Neolith?', has);
  if (has) {
    console.log('Nothing to do.');
    process.exit(0);
  }
  const backupDir = path.join(__dirname, '..', '_backups');
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
  const backupPath = path.join(backupDir, 'settings-vendors-list_before_neolith_BY_CURSOR_2026-07-23.json');
  fs.writeFileSync(backupPath, JSON.stringify({ list: before.list || [], updatedAt: before.updatedAt || null }, null, 2));
  console.log('Backup:', backupPath);
  list.push(NAME);
  list.sort((a, b) => String(a).toLowerCase().localeCompare(String(b).toLowerCase()));
  if (!APPLY) {
    console.log('Would write Neolith into settings/vendors.list (new length ' + list.length + ')');
    process.exit(0);
  }
  await ref.set({ list: list, updatedAt: new Date().toISOString() }, { merge: true });
  console.log('UPDATED settings/vendors.list — Neolith added. length=', list.length);
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
