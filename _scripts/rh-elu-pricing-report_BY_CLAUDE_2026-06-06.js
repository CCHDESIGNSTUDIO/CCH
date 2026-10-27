#!/usr/bin/env node
'use strict';
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const KEY = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
admin.initializeApp({ credential: admin.credential.cert(require(KEY)) });
const db = admin.firestore();

const PID = 'cloud-rolling-hills';
const PRO_ID = 'QdIB3AClnotrP9YgBLTs';

function str(v) { return String(v == null ? '' : v).trim(); }
function csvCell(v) {
  const s = String(v == null ? '' : v);
  return '"' + s.replace(/"/g, '""') + '"';
}

(async () => {
  const proSnap = await db.collection('boards').doc(PID).collection('proposals').doc(PRO_ID).get();
  const proClipIds = new Set();
  if (proSnap.exists) {
    (proSnap.data().items || []).forEach((l) => {
      const c = str(l.clipId || l.sourceClipId);
      if (c) proClipIds.add(c);
    });
  }

  const clipSnap = await db.collection('boards').doc(PID).collection('clips').get();
  const rows = [];

  for (const d of clipSnap.docs) {
    const c = d.data() || {};
    if (str(c.vendor).toLowerCase() !== 'elu') continue;

    const lib = str(c.libraryProductId || c.linkedLibraryProductId);
    let productCode = '';
    let prodCost = '';
    let prodSell = '';

    if (lib) {
      const pSnap = await db.collection('products').doc(lib).get();
      const p = pSnap.exists ? (pSnap.data() || {}) : {};
      productCode = str(p.productCode);
      if (p.costPrice != null) prodCost = p.costPrice;
      if (p.sellPrice != null) prodSell = p.sellPrice;
    }

    const clipCost = c.cost != null ? c.cost : '';
    const clipPrice = c.clientPrice != null ? c.clientPrice : '';
    const unpriced = (clipCost === '' || clipCost === null || Number(clipCost) === 0)
      && (clipPrice === '' || clipPrice === null || Number(clipPrice) === 0);

    rows.push({
      clipId: d.id,
      title: str(c.title).slice(0, 80),
      room: str(c.room),
      clipCost,
      clipClientPrice: clipPrice,
      unpricedCustom: unpriced ? 'YES' : '',
      libraryProductId: lib,
      productCode: productCode || '(none)',
      prodCost,
      prodSell,
      source: str(c.source) || '(none)',
      doNotReuse: c._doNotReuse === true ? 'YES' : '',
      onPRO3025: proClipIds.has(d.id) ? 'YES' : '',
      proposalNum: str(c.proposalNum),
      invoiceNum: str(c.invoiceNum),
    });
  }

  rows.sort((a, b) => (a.room + '|' + a.title).localeCompare(b.room + '|' + b.title));

  const flagged = rows.filter((r) => r.doNotReuse === 'YES');
  const unpriced = rows.filter((r) => r.unpricedCustom === 'YES');
  const onPro = rows.filter((r) => r.onPRO3025 === 'YES');
  const noProductCode = rows.filter((r) => r.productCode === '(none)');

  const hdr = ['clipId', 'title', 'room', 'clipCost', 'clipClientPrice', 'unpricedCustom',
    'libraryProductId', 'productCode', 'prodCost', 'prodSell', 'source', 'doNotReuse',
    'onPRO3025', 'proposalNum', 'invoiceNum'];
  const csv = [hdr.join(',')].concat(rows.map((r) => hdr.map((h) => csvCell(r[h])).join(','))).join('\n');

  const outDir = path.join(__dirname, '..', '_backup', 'rh-elu-pricing-report-2026-06-06');
  fs.mkdirSync(outDir, { recursive: true });
  const csvPath = path.join(outDir, 'RH_ELU_CLIPS_PRICING_REPORT_BY_CLAUDE_2026-06-06.csv');
  fs.writeFileSync(csvPath, csv);

  const summary = {
    projectId: PID,
    proposalPRO3025: PRO_ID,
    eluClipCount: rows.length,
    unpricedCustomCount: unpriced.length,
    doNotReuseFlaggedCount: flagged.length,
    onPRO3025Count: onPro.length,
    missingProductCodeCount: noProductCode.length,
    note: 'unpricedCustom = no cost and no clientPrice on clip (expected for custom Elu until quoted)',
    flaggedForReview: flagged.map((r) => ({ room: r.room, title: r.title, clipId: r.clipId })),
    onPRO3025: onPro.map((r) => ({
      room: r.room, title: r.title, clipClientPrice: r.clipClientPrice, doNotReuse: r.doNotReuse,
    })),
  };
  fs.writeFileSync(path.join(outDir, 'summary_BY_CLAUDE_2026-06-06.json'), JSON.stringify(summary, null, 2));

  console.log('Elu clips:', rows.length);
  console.log('Unpriced (custom — no cost/sell on clip):', unpriced.length);
  console.log('_doNotReuse flagged:', flagged.length);
  console.log('On PRO-3025:', onPro.length);
  console.log('Missing CCH- productCode:', noProductCode.length);
  console.log('CSV:', csvPath);
})().catch((e) => { console.error(e); process.exit(1); });
