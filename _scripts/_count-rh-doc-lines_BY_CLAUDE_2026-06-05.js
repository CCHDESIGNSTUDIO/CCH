#!/usr/bin/env node
'use strict';
const admin = require('firebase-admin');
const path = require('path');
const KEY = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
admin.initializeApp({ credential: admin.credential.cert(require(KEY)) });
const db = admin.firestore();
const PID = 'cloud-rolling-hills';

function isProduct(r) {
  if (!r || r.lineKind === 'group') return false;
  const et = String(r.expenseType || '').toLowerCase();
  if (['service', 'sales_tax', 'shipping', 'handling', 'expense', 'other_expense', 'discount', 'labor'].includes(et)) return false;
  if (r._isService === true || r.itemType === 'service') return false;
  return !!String(r.title || r.name || r.description || '').trim();
}

(async () => {
  let propLines = 0;
  let invLines = 0;
  const propList = [];
  const invList = [];
  const ps = await db.collection('boards').doc(PID).collection('proposals').get();
  ps.forEach((d) => {
    const x = d.data() || {};
    const all = x.items || [];
    const prod = all.filter(isProduct);
    if (!prod.length) return;
    propLines += prod.length;
    propList.push({
      ref: String(x.proposalNum || x.number || x.name || d.id).trim(),
      id: d.id,
      productLines: prod.length,
      allLines: all.length,
      status: x.status || '',
    });
  });
  const is = await db.collection('boards').doc(PID).collection('invoices').get();
  is.forEach((d) => {
    const x = d.data() || {};
    const all = x.items || [];
    const prod = all.filter(isProduct);
    if (!prod.length) return;
    invLines += prod.length;
    invList.push({
      ref: String(x.invoiceNum || x.number || x.name || d.id).trim(),
      id: d.id,
      productLines: prod.length,
      allLines: all.length,
      status: x.status || '',
      fromClips: !!x._fromClips,
    });
  });
  propList.sort((a, b) => b.productLines - a.productLines);
  invList.sort((a, b) => b.productLines - a.productLines);

  console.log('=== cloud-rolling-hills — what the audit counted ===\n');
  console.log('Proposal docs (with any product lines):', propList.length);
  console.log('Invoice docs (with any product lines):', invList.length);
  console.log('Total invoice docs in Firestore:', is.size);
  console.log('Product furnishing lines — proposals:', propLines);
  console.log('Product furnishing lines — invoices:', invLines);
  console.log('TOTAL (audit 212):', propLines + invLines);
  console.log('\n--- Proposals ---');
  propList.forEach((p) => console.log(' ', p.ref, '| product lines:', p.productLines, '| all lines:', p.allLines, '|', p.status));
  console.log('\n--- All invoices with product lines ---');
  invList.forEach((p) => console.log(' ', p.ref, '| product:', p.productLines, '| all:', p.allLines, '|', p.status, p.fromClips ? '| _fromClips' : ''));
})().catch((e) => { console.error(e); process.exit(1); });
