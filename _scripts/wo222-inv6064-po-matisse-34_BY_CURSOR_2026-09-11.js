/**
 * WO-222 PRODUCTION: INV-6064 + PO Kitchen/Powder Matisse 1 1/4 → 3/4.
 * Identity only (title, sku, image, library id). Money fields unchanged.
 *
 *   node _scripts\wo222-inv6064-po-matisse-34_BY_CURSOR_2026-09-11.js
 *   node _scripts\wo222-inv6064-po-matisse-34_BY_CURSOR_2026-09-11.js --apply
 */
'use strict';
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const APPLY = process.argv.includes('--apply');
const BOARD = 'cloud-rolling-hills';
const INV_ID = 'Kw4Dbyi6kdsyVCnSYGhb';
const LIB_34 = '3_4_slab_calacatta_matisse_polished__walker_zanger__stone___tile__finish_polished';
const TITLE_34 = '3/4 Slab Calacatta Matisse Polished';
const SKU_34 = '0034MASMCNCPORGCAMAT';
const IMG_34 = 'https://www.walkerzanger.com/wp-content/uploads/2025/05/Item_Img_24614_Picasso-scaled.jpg';
const URL_34 = 'https://www.walkerzanger.com/product/3-4-slab-calacatta-matisse-polished/';
const CLIP_KITCHEN = 'WF9kxPj8Al2DsLuGyDr7';
const CLIP_POWDER = 'dpPXnHSaXwXXrZhKA3L0';

const KEY = path.join(
  __dirname,
  '..',
  '_debug',
  'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json'
);
const db = admin.initializeApp({ credential: admin.credential.cert(require(KEY)) }, 'wo222matisse').firestore();

function str(v) { return String(v == null ? '' : v).trim(); }
function isKitchenOrPowder(room) {
  const r = str(room).toLowerCase();
  if (r === 'kitchen') return 'kitchen';
  if (r === 'powder 1' || r === 'powder' || r.indexOf('powder') === 0) return 'powder';
  return '';
}
function isMatisse114(it) {
  const t = str(it.title || it.name);
  const sku = str(it.sku || it.model);
  if (!/matisse|matise/i.test(t + ' ' + sku)) return false;
  if (/3\s*\/\s*4/.test(t)) return false;
  return /1\s*1\s*\/\s*4/.test(t) || sku === '2SLAPIC3CMP';
}
function moneySnap(it) {
  return {
    qty: it.qty,
    cost: it.cost,
    markupPct: it.markupPct,
    amount: it.amount,
    shipping: it.shipping,
    taxable: it.taxable
  };
}
function patchIdentity(it, roomKind) {
  const next = Object.assign({}, it);
  next.title = TITLE_34;
  if (str(next.name)) next.name = TITLE_34;
  next.sku = SKU_34;
  if (str(next.model)) next.model = SKU_34;
  next.libraryProductId = LIB_34;
  next.linkedLibraryProductId = LIB_34;
  next.imageUrl = IMG_34;
  next.image = IMG_34;
  if (Array.isArray(next.images) && next.images.length) next.images = [IMG_34].concat(next.images.slice(1));
  else next.images = [IMG_34];
  next.productUrl = URL_34;
  if (str(next.pageUrl)) next.pageUrl = URL_34;
  if (str(next.sourceUrl)) next.sourceUrl = URL_34;
  next.clipId = roomKind === 'powder' ? CLIP_POWDER : CLIP_KITCHEN;
  next._wo222Matisse34At = new Date().toISOString();
  return next;
}

(async function main() {
  const board = db.collection('boards').doc(BOARD);
  const planned = [];

  const invSnap = await board.collection('invoices').doc(INV_ID).get();
  if (!invSnap.exists) throw new Error('INV missing ' + INV_ID);
  const inv = invSnap.data() || {};
  const invItems = Array.isArray(inv.items) ? inv.items : [];
  invItems.forEach(function (it, i) {
    if (!it) return;
    const kind = isKitchenOrPowder(it.room);
    if (!kind || !isMatisse114(it)) return;
    planned.push({
      col: 'invoices',
      id: INV_ID,
      num: inv.invoiceNum || inv.number || 'INV-6064',
      lineIdx: i,
      room: str(it.room),
      kind: kind,
      title: str(it.title || it.name),
      sku: str(it.sku || it.model),
      money: moneySnap(it),
      docTotal: inv.total,
      taxAmount: inv.taxAmount
    });
  });

  const poSnap = await board.collection('purchaseOrders').get();
  poSnap.forEach(function (d) {
    const x = d.data() || {};
    const num = str(x.poNum || x.number || x.docNumber || d.id);
    const items = Array.isArray(x.items) ? x.items : [];
    items.forEach(function (it, i) {
      if (!it) return;
      const kind = isKitchenOrPowder(it.room);
      if (!kind || !isMatisse114(it)) return;
      planned.push({
        col: 'purchaseOrders',
        id: d.id,
        num: num,
        lineIdx: i,
        room: str(it.room),
        kind: kind,
        title: str(it.title || it.name),
        sku: str(it.sku || it.model),
        money: moneySnap(it),
        docTotal: x.total,
        taxAmount: x.taxAmount || null
      });
    });
  });

  console.log('APPLY', APPLY);
  console.log('HITS', planned.length);
  planned.forEach(function (p) {
    console.log([p.col, p.num, p.id, 'line ' + p.lineIdx, p.room, p.title, p.sku, JSON.stringify(p.money)].join(' | '));
  });

  if (!APPLY) {
    console.log('Dry-run only. Re-run with --apply to write.');
    process.exit(0);
  }
  if (!planned.length) {
    console.log('Nothing to write.');
    process.exit(0);
  }

  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const backupDir = path.join(__dirname, '..', '_backup', 'wo222-matisse-34-' + stamp);
  fs.mkdirSync(backupDir, { recursive: true });

  const byDoc = {};
  planned.forEach(function (p) {
    const k = p.col + '/' + p.id;
    if (!byDoc[k]) byDoc[k] = { col: p.col, id: p.id, lines: [] };
    byDoc[k].lines.push(p);
  });

  for (const k of Object.keys(byDoc)) {
    const g = byDoc[k];
    const ref = board.collection(g.col).doc(g.id);
    const snap = await ref.get();
    if (!snap.exists) throw new Error('vanished ' + k);
    const x = snap.data() || {};
    const items = Array.isArray(x.items) ? x.items.slice() : [];
    fs.writeFileSync(path.join(backupDir, g.col + '-' + g.id + '.json'), JSON.stringify({ id: g.id, data: x }, null, 2));
    g.lines.forEach(function (p) {
      const before = items[p.lineIdx] || {};
      const after = patchIdentity(before, p.kind);
      const mb = moneySnap(before);
      const ma = moneySnap(after);
      if (JSON.stringify(mb) !== JSON.stringify(ma)) {
        throw new Error('Money changed on ' + k + ' line ' + p.lineIdx);
      }
      items[p.lineIdx] = after;
    });
    const update = {
      items: items,
      updatedAt: new Date().toISOString(),
      _wo222Matisse34At: new Date().toISOString()
    };
    await ref.update(update);
    console.log('UPDATED', k, g.lines.length, 'lines; doc total left', x.total);
  }
  console.log('BACKUP', backupDir);
  process.exit(0);
})().catch(function (e) {
  console.error(e);
  process.exit(1);
});
