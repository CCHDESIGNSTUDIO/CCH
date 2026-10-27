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
const INV_BACKUP = path.join(__dirname, '..', '_backup', 'inv6018-to-proposal-2026-06-06', 'invoice-backup.json');

function str(v) { return String(v == null ? '' : v).trim(); }

function isProductLine(r) {
  if (!r || r.lineKind === 'group') return false;
  const et = str(r.expenseType).toLowerCase();
  if (['service', 'sales_tax', 'shipping', 'handling', 'expense', 'other_expense', 'discount', 'labor'].includes(et)) return false;
  return !!str(r.title || r.name);
}

function wouldShowInLibrary(p) {
  if (!p) return false;
  const t = str(p.title).toLowerCase();
  const v = str(p.vendor).toLowerCase();
  const cost = parseFloat(p.costPrice || p.cost || p.unitCost);
  const sell = parseFloat(p.sellPrice || p.clientPrice);
  const hasMoney = (!isNaN(cost) && cost > 0) || (!isNaN(sell) && sell > 0);
  const hasImg = !!str(p.imageUrl || p.image);
  if (v || hasMoney) return true;
  if (hasImg && t.length >= 3) return true;
  return false;
}

(async () => {
  const inv = JSON.parse(fs.readFileSync(INV_BACKUP, 'utf8'));
  const invLines = (inv.items || []).map((line, idx) => ({ idx: idx + 1, line })).filter((x) => isProductLine(x.line));

  const proSnap = await db.collection('boards').doc(PID).collection('proposals').doc(PRO_ID).get();
  const proItems = proSnap.exists ? (proSnap.data().items || []) : [];
  const proClipIds = new Set();
  const proTitles = new Set();
  proItems.forEach((l) => {
    const c = str(l.clipId || l.sourceClipId);
    if (c) proClipIds.add(c);
    proTitles.add(str(l.title || l.name).toLowerCase());
  });

  const clipSnap = await db.collection('boards').doc(PID).collection('clips').get();
  const clips = [];
  clipSnap.forEach((d) => {
    const c = d.data() || {};
    if (str(c.vendor).toLowerCase() !== 'elu') return;
    clips.push({ id: d.id, ...c });
  });

  const gaps = {
    invNotOnPro: [],
    clipNoLibrary: [],
    libraryNotVisible: [],
    clipNoProLink: [],
    deadClipOnInv: [],
  };

  for (const { idx, line } of invLines) {
    const clipId = str(line.clipId || line.sourceClipId || line._matchedClipId);
    const title = str(line.title || line.name);
    const onPro = clipId ? proClipIds.has(clipId) : proTitles.has(title.toLowerCase());
    if (!onPro) {
      const cs = clipId ? await db.collection('boards').doc(PID).collection('clips').doc(clipId).get() : null;
      gaps.invNotOnPro.push({
        L: idx, title, room: str(line.room), clipId,
        clipExists: !!(cs && cs.exists),
        amount: parseFloat(line.amount) || 0,
      });
      if (clipId && cs && !cs.exists) gaps.deadClipOnInv.push({ L: idx, title, clipId });
    }
  }

  for (const c of clips) {
    const lib = str(c.libraryProductId);
    let prod = null;
    let pl = null;
    if (lib) {
      const ps = await db.collection('products').doc(lib).get();
      const pls = await db.collection('productLibrary').doc(lib).get();
      prod = ps.exists ? ps.data() : null;
      pl = pls.exists ? pls.data() : null;
    }
    const row = prod || pl;
    const onPro = proClipIds.has(c.id);
    if (!lib || (!prod && !pl)) {
      gaps.clipNoLibrary.push({
        clipId: c.id,
        title: str(c.title),
        room: str(c.room),
        onPRO3025: onPro,
      });
    } else if (row && !wouldShowInLibrary(row)) {
      gaps.libraryNotVisible.push({
        clipId: c.id,
        libId: lib,
        title: str(c.title),
        libTitle: str(row.title),
        productCode: str(row.productCode),
        vendor: str(row.vendor),
        hasImage: !!str(row.imageUrl),
      });
    }
    if (!onPro && str(c.title)) {
      gaps.clipNoProLink.push({
        clipId: c.id,
        title: str(c.title),
        room: str(c.room),
        hasLibrary: !!(prod || pl),
        productCode: row ? str(row.productCode) : '',
      });
    }
  }

  const summary = {
    inv6018ProductLines: invLines.length,
    pro3025Lines: proItems.filter(isProductLine).length,
    eluClipsOnBoard: clips.length,
    invNotOnPro: gaps.invNotOnPro.length,
    deadClipOnInv: gaps.deadClipOnInv.length,
    clipNoLibrary: gaps.clipNoLibrary.length,
    clipNotOnPro: gaps.clipNoProLink.length,
    libraryNotVisible: gaps.libraryNotVisible.length,
  };

  console.log('=== Rolling Hills missing-product audit ===');
  console.log(JSON.stringify(summary, null, 2));
  console.log('\n--- INV-6018 lines NOT on PRO-3025 ---');
  gaps.invNotOnPro.forEach((r) => console.log(JSON.stringify(r)));
  console.log('\n--- Elu clips with NO library row ---');
  gaps.clipNoLibrary.forEach((r) => console.log(JSON.stringify(r)));
  console.log('\n--- Elu clips NOT on PRO-3025 ---');
  gaps.clipNoProLink.forEach((r) => console.log(JSON.stringify(r)));

  const outDir = path.join(__dirname, '..', '_backup', 'rh-missing-products-2026-06-07');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, 'RH_MISSING_PRODUCTS_AUDIT_BY_CLAUDE_2026-06-07.json'),
    JSON.stringify({ summary, gaps }, null, 2)
  );
  console.log('\nWrote audit JSON to', outDir);
})().catch((e) => { console.error(e); process.exit(1); });
