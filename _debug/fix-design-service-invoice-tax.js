#!/usr/bin/env node
/**
 * Apply California sales-tax rules to invoice lines (Grok / tracker cleaning logic).
 * Clears tax on design & professional service rows; recalculates invoice total.
 *
 *   node fix-design-service-invoice-tax.js --board=cloud-rolling-hills
 *   node fix-design-service-invoice-tax.js --board=cloud-rolling-hills --execute
 *   node fix-design-service-invoice-tax.js --all-boards --execute
 */
'use strict';

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const taxRules = require('../platform/cch-invoice-tax-rules.js');

const EXECUTE = process.argv.includes('--execute');
const ALL = process.argv.includes('--all-boards');
const boardArg = process.argv.find((a) => a.startsWith('--board='));
const BOARD_FILTER = boardArg ? boardArg.split('=')[1] : 'cloud-rolling-hills';

const KEY = path.join(__dirname, 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');

function lineAmt(it) {
  const qty = parseFloat(it.qty) || 1;
  const cost = parseFloat(it.cost) || 0;
  let sell = parseFloat(it.amount) || 0;
  const rate = parseFloat(it.rate) || parseFloat(it.unitPrice) || 0;
  if (!sell && rate > 0) sell = Math.round(rate * qty * 100) / 100;
  if (taxRules.cchInvoiceLineIsNonTaxableService(it)) {
    if (cost > 0) return Math.round(cost * qty * 100) / 100;
    if (rate > 0) return Math.round(rate * qty * 100) / 100;
    return sell;
  }
  const mk = parseFloat(it.markupPct) || 0;
  if (cost > 0) return Math.round(cost * qty * (1 + mk / 100) * 100) / 100;
  return sell;
}

function computedTotal(inv) {
  if (String(inv.status || '').toLowerCase() === 'void') return 0;
  const items = inv.items || [];
  if (!items.length) return parseFloat(inv.total) || 0;
  let sub = 0;
  let taxable = 0;
  let ship = 0;
  items.forEach((it) => {
    const amt = lineAmt(it);
    sub += amt;
    ship += parseFloat(it.shipping) || 0;
    if (taxRules.cchCaliforniaInvoiceLineIsTaxable(it)) taxable += amt;
  });
  const rate = parseFloat(inv.taxRate) || 0;
  const tax = taxable * (rate / 100);
  return Math.round((sub + ship + tax) * 100) / 100;
}

(async () => {
  admin.initializeApp({ credential: admin.credential.cert(require(KEY)) });
  const db = admin.firestore();
  const boards = [];
  if (ALL) {
    const snap = await db.collection('boards').select().get();
    snap.forEach((d) => boards.push(d.id));
  } else {
    boards.push(BOARD_FILTER);
  }

  const log = [];
  let updated = 0;

  for (const boardId of boards) {
    const invSnap = await db.collection('boards').doc(boardId).collection('invoices').get();
    for (const doc of invSnap.docs) {
      const data = doc.data();
      if (String(data.status || '').toLowerCase() === 'void') continue;
      const items = (data.items || []).map((it) => ({ ...it }));
      let changed = false;
      items.forEach((it) => {
        if (taxRules.cchApplyCaliforniaTaxRulesToLine(it)) changed = true;
        else if (taxRules.cchInvoiceLineWasWronglyTaxed(it)) {
          taxRules.cchApplyCaliforniaTaxRulesToLine(it);
          changed = true;
        }
      });
      if (!changed) continue;
      const invObj = { ...data, items };
      const newTotal = computedTotal(invObj);
      const oldTotal = parseFloat(data.total) || 0;
      log.push({
        boardId,
        invoiceId: doc.id,
        number: data.number || data.invoiceNum,
        oldTotal,
        newTotal,
        delta: Math.round((newTotal - oldTotal) * 100) / 100,
      });
      if (EXECUTE) {
        await doc.ref.update({
          items,
          total: newTotal,
          updatedAt: new Date().toISOString(),
          _caTaxRulesFixedAt: new Date().toISOString(),
        });
      }
      updated++;
    }
  }

  const outPath = path.join(
    __dirname,
    'fix-design-service-invoice-tax-' + (EXECUTE ? 'apply' : 'dryrun') + '-' + Date.now() + '.json',
  );
  fs.writeFileSync(outPath, JSON.stringify({ boards, updated, log, rules: 'cch-invoice-tax-rules.js' }, null, 2));

  console.log('CA tax rules fix (' + (EXECUTE ? 'EXECUTE' : 'DRY RUN') + ')');
  console.log('  boards:', boards.length, ALL ? '(all)' : BOARD_FILTER);
  console.log('  invoices to update:', updated);
  log.slice(0, 30).forEach((r) => {
    console.log('  ', r.number, r.oldTotal, '->', r.newTotal, '(Δ', r.delta + ')');
  });
  if (log.length > 30) console.log('  ... +' + (log.length - 30) + ' more in', outPath);
  console.log('  log:', outPath);
  if (!EXECUTE) console.log('\nApply: node fix-design-service-invoice-tax.js --board=cloud-rolling-hills --execute');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
