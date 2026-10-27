/**
 * PRODUCTION: cancel Square payment link(s) on Cloud Rolling Hills invoices,
 * then clear Studio checkout URL so portal Pay with CC disappears.
 *
 *   $env:SQUARE_ACCESS_TOKEN = (gcloud secrets versions access latest --secret=SQUARE_ACCESS_TOKEN --project=cch-design-boards)
 *   node _scripts\cancel-rh-square-pay-link_BY_CURSOR_2026-08-29.js
 *   node _scripts\cancel-rh-square-pay-link_BY_CURSOR_2026-08-29.js --apply
 *   node _scripts\cancel-rh-square-pay-link_BY_CURSOR_2026-08-29.js --apply --all
 */
'use strict';
const path = require('path');
const fs = require('fs');
const admin = require('firebase-admin');
const KEY = path.join(__dirname, '..', '_debug', 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
const app = admin.initializeApp({ credential: admin.credential.cert(require(KEY)) }, 'cancelSq');
const db = app.firestore();
const BOARD = 'cloud-rolling-hills';
const APPLY = process.argv.indexOf('--apply') >= 0;
const ALL = process.argv.indexOf('--all') >= 0;
const WANT = ['INV-6068'];

function squareToken() {
  var fromEnv = String(process.env.SQUARE_ACCESS_TOKEN || '').replace(/[\r\n\t ]+/g, '').trim();
  if (fromEnv) return fromEnv;
  var envFile = path.join(__dirname, '..', 'square-pat.env');
  if (fs.existsSync(envFile)) {
    return String(fs.readFileSync(envFile, 'utf8') || '').replace(/[\r\n\t ]+/g, '').trim();
  }
  return '';
}

async function squareDeleteLink(token, linkId) {
  var id = String(linkId || '').trim();
  if (!id) return { skipped: true, reason: 'no-link-id' };
  var res = await fetch('https://connect.squareup.com/v2/online-checkout/payment-links/' + encodeURIComponent(id), {
    method: 'DELETE',
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json',
      'Square-Version': '2025-01-23'
    }
  });
  var json = {};
  try { json = await res.json(); } catch (_e) {}
  return { ok: res.ok || res.status === 404, status: res.status, errors: json.errors || null };
}

(async function main() {
  var token = squareToken();
  if (APPLY && !token) {
    console.error('Need SQUARE_ACCESS_TOKEN env or square-pat.env (do not print the token).');
    process.exit(1);
  }
  var snap = await db.collection('boards').doc(BOARD).collection('invoices').get();
  var rows = [];
  snap.forEach(function (d) {
    var x = d.data() || {};
    var num = String(x.invoiceNum || x.number || d.id);
    var url = String(x.squareCheckoutUrl || '').trim();
    var linkId = String(x.squarePaymentLinkId || '').trim();
    if (!url && !linkId) return;
    rows.push({
      id: d.id,
      num: num,
      status: x.status || '',
      total: x.total,
      dueNowAmount: x.dueNowAmount || 0,
      squareCheckoutAmountCents: x.squareCheckoutAmountCents || 0,
      squarePaymentLinkId: linkId,
      hasUrl: !!url
    });
  });
  console.log('invoices_with_square', rows.length);
  rows.forEach(function (r) {
    console.log(JSON.stringify({
      num: r.num,
      id: r.id,
      status: r.status,
      total: r.total,
      dueNowAmount: r.dueNowAmount,
      chargeCents: r.squareCheckoutAmountCents,
      hasLinkId: !!r.squarePaymentLinkId,
      hasUrl: r.hasUrl
    }));
  });
  var targets = rows.filter(function (r) {
    if (ALL) return true;
    return WANT.indexOf(r.num) >= 0;
  });
  if (!targets.length) {
    console.log('no matching invoices to cancel');
    process.exit(0);
  }
  if (!APPLY) {
    console.log('dry-run targets', targets.map(function (t) { return t.num; }));
    process.exit(0);
  }
  for (var i = 0; i < targets.length; i++) {
    var t = targets[i];
    var del = await squareDeleteLink(token, t.squarePaymentLinkId);
    var patch = {
      squareCheckoutUrl: admin.firestore.FieldValue.delete(),
      squarePaymentLinkId: admin.firestore.FieldValue.delete(),
      squareOrderId: admin.firestore.FieldValue.delete(),
      squareCheckoutAmountCents: admin.firestore.FieldValue.delete(),
      squareInvoiceDueCents: admin.firestore.FieldValue.delete(),
      squareFeeGrossed: admin.firestore.FieldValue.delete(),
      squareCheckoutCreatedAt: admin.firestore.FieldValue.delete(),
      squareCheckoutCanceledAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await db.collection('boards').doc(BOARD).collection('invoices').doc(t.id).update(patch);
    console.log('canceled', t.num, 'squareDelete', del.ok ? 'ok' : 'fail', 'http', del.status);
  }
  process.exit(0);
})().catch(function (e) {
  console.error(e && e.message ? e.message : e);
  process.exit(1);
});
