/**
 * Seed staging-native DS invoice for Fable verify (not INV-6009).
 * Dry-run by default. APPLY=1 to write.
 * Usage:
 *   node _scripts/seed-stg-ds-expense-golden_BY_CURSOR.js
 *   $env:APPLY='1'; node _scripts/seed-stg-ds-expense-golden_BY_CURSOR.js
 */
'use strict';
var fs = require('fs');
var path = require('path');
var admin = require('firebase-admin');

var root = path.join(__dirname, '..');
var fixture = JSON.parse(fs.readFileSync(
  path.join(root, 'Docs', 'golden', 'ds-invoice-expenses', 'v1', 'FIXTURE.json'), 'utf8'));
var APPLY = String(process.env.APPLY || '') === '1';

var saPath = path.join(root, 'cch-studio-staging-firebase-adminsdk-fbsvc-b93c6f1cf4.json');
if (!fs.existsSync(saPath)) saPath = path.join(root, 'serviceAccount-staging.json');
if (!fs.existsSync(saPath)) throw new Error('Missing staging service account JSON');
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(require(saPath)) }, 'seedDsGolden');
}
var db = admin.app('seedDsGolden').firestore();

var ref = db.collection('boards').doc(fixture.projectId).collection('invoices').doc(fixture.id);
var payload = Object.assign({}, fixture.docData, {
  items: fixture.items,
  total: 1675,
  updatedAt: new Date().toISOString(),
  _goldenLock: 'FABLE_DECISION_ds-invoice-expenses_CW_Jul30_v1.0'
});

console.log(APPLY ? 'APPLY' : 'DRY-RUN', ref.path);
console.log('lines', fixture.items.length, 'kinds: service + expense + handling + other_expense + sales_tax');
if (!APPLY) {
  console.log('Re-run with APPLY=1 to write staging.');
  process.exit(0);
}
ref.set(payload, { merge: true }).then(function () {
  console.log('Wrote', ref.path);
  process.exit(0);
}).catch(function (e) {
  console.error(e);
  process.exit(1);
});
