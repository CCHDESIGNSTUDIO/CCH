/**
 * PRODUCTION: create Square payment links for RH invoices that have no checkout URL.
 * Uses tax-inclusive Firestore total. Grosses ~3% like createSquarePaymentLink.
 *
 *   $env:SQUARE_ACCESS_TOKEN = ...
 *   node _scripts\create-rh-square-pay-links_BY_CURSOR_2026-08-29.js --apply
 */
'use strict';
const path = require('path');
const fs = require('fs');
const admin = require('firebase-admin');
const KEY = path.join(__dirname, '..', '_debug', 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
const app = admin.initializeApp({ credential: admin.credential.cert(require(KEY)) }, 'createSq');
const db = app.firestore();
const BOARD = 'cloud-rolling-hills';
const APPLY = process.argv.indexOf('--apply') >= 0;
const WANT = ['INV-6065', 'INV-6067', 'INV-6068', 'INV-6069'];
const FEE = 0.03;
const MAX_GROSS = 5000000;

function token() {
  var fromEnv = String(process.env.SQUARE_ACCESS_TOKEN || '').replace(/[\r\n\t ]+/g, '').trim();
  if (fromEnv) return fromEnv;
  var envFile = path.join(__dirname, '..', 'square-pat.env');
  if (fs.existsSync(envFile)) return String(fs.readFileSync(envFile, 'utf8') || '').replace(/[\r\n\t ]+/g, '').trim();
  return '';
}

function moneyCents(v) {
  return Math.round((parseFloat(v) || 0) * 100);
}

function paidCents(inv) {
  var paid = moneyCents(inv.paidAmount);
  var rows = Array.isArray(inv.payments) ? inv.payments : [];
  var fromRows = rows.reduce(function (s, p) { return s + moneyCents(p && p.amount); }, 0);
  return fromRows > paid ? fromRows : paid;
}

function dueNowNetCents(inv) {
  var remaining = Math.max(0, moneyCents(inv.total) - paidCents(inv));
  if (remaining < 1) return 0;
  var dueNow = moneyCents(inv.dueNowAmount);
  var pct = parseFloat(inv.dueNowPercent);
  if (dueNow < 1 && Number.isFinite(pct) && pct > 0) dueNow = Math.round(remaining * (Math.min(100, pct) / 100));
  if (dueNow < 1) dueNow = remaining;
  return Math.min(dueNow, remaining);
}

function grossCents(net) {
  return Math.ceil((Number(net) || 0) / (1 - FEE));
}

async function squareFetch(tok, pathUrl, opts) {
  opts = opts || {};
  var res = await fetch('https://connect.squareup.com' + pathUrl, {
    method: opts.method || 'GET',
    headers: {
      Authorization: 'Bearer ' + tok,
      'Content-Type': 'application/json',
      'Square-Version': '2025-01-23'
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });
  var json = await res.json().catch(function () { return {}; });
  if (!res.ok) {
    var msg = (json.errors && json.errors[0] && json.errors[0].detail) || ('Square HTTP ' + res.status);
    throw new Error(msg);
  }
  return json;
}

(async function main() {
  var tok = token();
  if (APPLY && !tok) {
    console.error('Need SQUARE_ACCESS_TOKEN');
    process.exit(1);
  }
  var snap = await db.collection('boards').doc(BOARD).collection('invoices').get();
  var targets = [];
  snap.forEach(function (d) {
    var x = d.data() || {};
    var num = String(x.invoiceNum || x.number || '');
    if (WANT.indexOf(num) < 0) return;
    targets.push({ id: d.id, num: num, inv: x });
  });
  var locId = '';
  if (APPLY) {
    var locs = await squareFetch(tok, '/v2/locations');
    var list = Array.isArray(locs.locations) ? locs.locations : [];
    var active = list.find(function (l) { return String(l.status || '').toUpperCase() === 'ACTIVE'; }) || list[0];
    locId = active && active.id;
    if (!locId) throw new Error('No Square location');
  }
  for (var i = 0; i < targets.length; i++) {
    var t = targets[i];
    var due = dueNowNetCents(t.inv);
    var charge = grossCents(due);
    var existing = String(t.inv.squareCheckoutUrl || '').trim();
    console.log(JSON.stringify({
      num: t.num,
      total: t.inv.total,
      dueNet: due / 100,
      chargeGross: charge / 100,
      hasUrl: !!existing
    }));
    if (!APPLY) continue;
    if (due < 1) {
      console.log('skip no balance', t.num);
      continue;
    }
    if (charge > MAX_GROSS) {
      console.log('skip over $50k cap', t.num, charge);
      continue;
    }
    if (existing && t.inv.squareFeeGrossed && Number(t.inv.squareCheckoutAmountCents) === charge) {
      console.log('reuse', t.num);
      continue;
    }
    var created = await squareFetch(tok, '/v2/online-checkout/payment-links', {
      method: 'POST',
      body: {
        idempotency_key: [BOARD, t.id, String(charge), Date.now()].join('-').slice(0, 45),
        quick_pay: {
          name: ('CCH Design · ' + t.num).slice(0, 80),
          price_money: { amount: charge, currency: 'USD' },
          location_id: locId
        }
      }
    });
    var link = created.payment_link || {};
    var url = String(link.url || '').trim();
    if (!url) throw new Error('No URL for ' + t.num);
    var orderId = String(link.order_id || '').trim();
    await db.collection('boards').doc(BOARD).collection('invoices').doc(t.id).update({
      squareCheckoutUrl: url,
      squarePaymentLinkId: link.id || '',
      squareOrderId: orderId,
      squareCheckoutAmountCents: charge,
      squareInvoiceDueCents: due,
      squareFeeGrossed: true,
      squareCheckoutCreatedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    if (orderId) {
      await db.collection('squareCheckouts').doc(orderId).set({
        projectId: BOARD,
        invoiceId: t.id,
        paymentLinkId: link.id || '',
        dueCents: due,
        chargeCents: charge,
        createdAt: new Date().toISOString()
      });
    }
    console.log('created', t.num, 'due', (due / 100).toFixed(2), 'gross', (charge / 100).toFixed(2), url);
  }
  process.exit(0);
})().catch(function (e) {
  console.error(e && e.message ? e.message : e);
  process.exit(1);
});
