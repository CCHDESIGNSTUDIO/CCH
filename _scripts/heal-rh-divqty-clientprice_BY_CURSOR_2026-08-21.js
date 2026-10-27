#!/usr/bin/env node
'use strict';
/**
 * Heal Rolling Hills clip.clientPrice where stored value is unit÷qty.
 * PRODUCTION board cloud-rolling-hills. DRY RUN unless --apply.
 * Writes reversal JSON before any update. Does not touch proposals/invoices/library.
 */
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');
const KEY = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(require(KEY)) });
const db = admin.firestore();

const APPLY = process.argv.includes('--apply');
const PROJECT = 'cloud-rolling-hills';
const STAMP = 'div-qty-unit-2026-08-21';

function money(v) {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  const n = parseFloat(String(v).replace(/[$,\s]/g, ''));
  return isNaN(n) ? 0 : n;
}
function round2(n) { return Math.round(n * 100) / 100; }
function near(a, b, tol) { return Math.abs(a - b) <= (tol == null ? 0.06 : tol); }

function lineUnitSell(it) {
  it = it || {};
  var qty = money(it.qty) || 1;
  if (!(qty > 0)) qty = 1;
  var amt = money(it.amount) || money(it.totalSelling);
  var cp = money(it.clientPrice) || money(it.sellPrice) || money(it.unitSellingPrice) || money(it.unitPrice);
  if (amt > 0) {
    if (cp > 0 && Math.abs((cp * qty) - amt) <= Math.max(0.05, amt * 0.02)) return round2(cp);
    return round2(amt / qty);
  }
  if (cp > 0) return round2(cp);
  return 0;
}

(async () => {
  const board = db.collection('boards').doc(PROJECT);
  const clipSnap = await board.collection('clips').get();
  const clips = [];
  clipSnap.forEach(d => clips.push({ id: d.id, data: d.data() || {} }));

  const unitByClipId = {};
  const unitSrc = {};
  for (const col of ['invoices', 'proposals']) {
    const docs = await board.collection(col).get();
    docs.forEach(doc => {
      const d = doc.data() || {};
      const num = d.invoiceNum || d.proposalNum || d.number || d.name || doc.id;
      (Array.isArray(d.items) ? d.items : []).forEach(it => {
        const cid = String(it.clipId || it.sourceClipId || '').trim();
        if (!cid) return;
        const u = lineUnitSell(it);
        if (!(u > 0)) return;
        if (!unitByClipId[cid]) {
          unitByClipId[cid] = u;
          unitSrc[cid] = col + ' ' + num;
        }
      });
    });
  }

  const updates = [];
  clips.forEach(row => {
    const c = row.data;
    const qty = money(c.qty || c.quantity) || 1;
    const cp = money(c.clientPrice);
    const cost = money(c.cost) || money(c.unitCost) || money(c.costPrice);
    const docUnit = unitByClipId[row.id] || 0;
    let next = 0;
    let reason = '';

    if (qty >= 2 && cp > 0 && docUnit > 0 && near(cp * qty, docUnit, Math.max(0.08, docUnit * 0.02))) {
      next = round2(docUnit);
      reason = 'clientPrice×qty matches linked ' + unitSrc[row.id] + ' unit ' + docUnit;
    } else if (qty >= 2 && cp > 0 && cost > 0 && cp < cost) {
      const fromMk = round2(cost * 1.35);
      if (near(cp * qty, fromMk, 0.08)) {
        next = fromMk;
        reason = 'clientPrice×qty = cost×1.35 (' + cost + '→' + fromMk + ')';
      }
    }

    if (!(next > 0) || near(next, cp, 0.005)) return;

    const patch = {
      clientPrice: next,
      _priceHealedFrom: STAMP,
      _priceHealedAt: new Date().toISOString(),
      _priceHealedPrevClientPrice: c.clientPrice
    };
    ['sellPrice', 'unitSellingPrice', 'totalSelling'].forEach(k => {
      if (c[k] != null && c[k] !== '' && near(money(c[k]), cp, 0.02)) patch[k] = next;
    });

    updates.push({
      clipId: row.id,
      title: String(c.title || c.name || '').slice(0, 60),
      room: c.room || '—',
      qty: qty,
      prev: c.clientPrice,
      next: next,
      cost: cost || null,
      reason: reason,
      patch: patch
    });
  });

  console.log((APPLY ? 'APPLY' : 'DRY-RUN') + '  ' + PROJECT + '  candidates=' + updates.length);
  updates.forEach(u => {
    console.log('  [' + u.room + '] ' + u.title);
    console.log('     ' + u.clipId + '  ' + u.prev + '  →  ' + u.next + '  qty=' + u.qty);
    console.log('     ' + u.reason);
  });

  const revPath = path.join(__dirname, '..', '_debug', 'REVERSAL-rh-divqty-clientprice-2026-08-21.json');
  const reversal = {
    project: PROJECT,
    stamp: STAMP,
    applied: APPLY,
    at: new Date().toISOString(),
    updates: updates.map(u => ({
      clipId: u.clipId,
      previousClientPrice: u.prev,
      nextClientPrice: u.next,
      extraKeys: Object.keys(u.patch).filter(k => k !== 'clientPrice' && k.indexOf('_priceHealed') !== 0)
    }))
  };
  fs.mkdirSync(path.dirname(revPath), { recursive: true });
  fs.writeFileSync(revPath, JSON.stringify(reversal, null, 2));
  console.log('\nwrote ' + revPath);

  if (!APPLY) {
    console.log('\nNo writes. Re-run with --apply to heal.');
    process.exit(0);
  }

  let n = 0;
  for (const u of updates) {
    await board.collection('clips').doc(u.clipId).update(u.patch);
    n++;
  }
  console.log('\nupdated ' + n + ' clips');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
