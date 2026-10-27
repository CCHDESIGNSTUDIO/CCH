'use strict';
/**
 * Staging ONLY — seed a tiny design-services invoice with expense lines
 * so Client View can be verified without prod INV-6054.
 * Idempotent: reuses boards/cloud-rolling-hills/invoices/INV-STG-DS-EXPENSE-TEST
 */
const path = require('path');
const admin = require('firebase-admin');
const KEY = path.join(
  __dirname,
  '..',
  '_debug',
  'service-account.json',
  'cch-studio-staging-firebase-adminsdk-fbsvc-b93c6f1cf4.json'
);
const db = admin.initializeApp({ credential: admin.credential.cert(require(KEY)) }, 'seedDsExp').firestore();
const PID = 'cloud-rolling-hills';
const DOC_ID = 'INV-STG-DS-EXPENSE-TEST';
const APPLY = process.argv.includes('--apply');

const items = [
  {
    title: 'CCH Design Services',
    expenseType: 'service',
    itemType: 'service',
    qty: 2,
    rate: 195,
    cost: 195,
    amount: 390,
    taxable: false,
    markupPct: 0,
    description: '2 hours coordination',
    lineApprovalStatus: 'approved',
    approved: true
  },
  {
    title: 'Reimbursable Expense',
    expenseType: 'expense',
    itemType: 'expense',
    qty: 3,
    cost: 1646,
    amount: 4938,
    taxable: false,
    markupPct: 0,
    description: 'QS 10 OUTPUT PS 35V - Lutron Smart Power Panel (staging test twin of INV-6054 pattern)',
    lineApprovalStatus: 'approved',
    approved: true
  },
  {
    title: 'Other Expense',
    expenseType: 'other_expense',
    itemType: 'expense',
    qty: 1,
    cost: 500,
    amount: 500,
    taxable: false,
    markupPct: 0,
    description: '2 Guys / all day site work for Toning & Delivery of panels',
    lineApprovalStatus: 'approved',
    approved: true
  },
  {
    title: 'Pre-Paid Sales Tax',
    expenseType: 'sales_tax',
    itemType: 'expense',
    qty: 1,
    cost: 456.77,
    amount: 456.77,
    taxable: false,
    markupPct: 0,
    description: 'Vendor prepaid tax',
    lineApprovalStatus: 'approved',
    approved: true
  }
];

const total = items.reduce((s, it) => s + (Number(it.amount) || 0), 0);
const payload = {
  number: 'INV-STG-DS-EXP',
  invoiceNum: 'INV-STG-DS-EXP',
  name: 'INV-STG-DS-EXP',
  status: 'Draft',
  source: 'time-tracker',
  timeEntryIds: ['_staging_test_placeholder'],
  clientName: 'Tracey Cloud (staging test)',
  documentTags: 'STAGING TEST — expense vs hours',
  clientSummary: 'Staging proof invoice: expenses must not print as hours.',
  items,
  total,
  subtotal: total,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  _seededBy: 'cursor-ds-expense-hours-test',
  _seededAt: new Date().toISOString()
};

(async () => {
  const ref = db.collection('boards').doc(PID).collection('invoices').doc(DOC_ID);
  const snap = await ref.get();
  console.log('exists', snap.exists, 'APPLY', APPLY, 'total', total);
  console.log('URL path: #/project/' + PID + '/invoice/' + DOC_ID);
  if (!APPLY) {
    console.log('Dry-run. Re-run with --apply to write staging.');
    process.exit(0);
  }
  await ref.set(payload, { merge: true });
  console.log('WROTE', ref.path);
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
