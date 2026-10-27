/**
 * PRODUCTION — push Exquisite Surfaces library trade costs → RH clips + unlocked proposal lines.
 *
 *   node _scripts/push-exquisite-surfaces-costs-rh-prod_BY_CURSOR_2026-07-24.js
 *   node _scripts/push-exquisite-surfaces-costs-rh-prod_BY_CURSOR_2026-07-24.js --apply
 */
'use strict';
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const APPLY = process.argv.includes('--apply');
const KEY = path.join(__dirname, '..', '_debug', 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
const BOARD = 'cloud-rolling-hills';
const VENDOR_NEEDLES = ['exquisite surfaces', 'exquisite surface'];

const app = admin.initializeApp({ credential: admin.credential.cert(require(KEY)) }, 'esPush');
const db = app.firestore();

function norm(s) { return String(s || '').trim().toLowerCase().replace(/\s+/g, ' '); }
function isVendor(v) { const n = norm(v); return VENDOR_NEEDLES.some((x) => n.indexOf(x) >= 0); }
function parseCost(row) {
  const n = parseFloat(row.costPrice != null ? row.costPrice : (row.unitCost != null ? row.unitCost : row.cost));
  if (isNaN(n) || n < 0) return null;
  return Math.round(n * 100) / 100;
}
function titleKey(t) { return norm(t); }
function costsMatch(a, b) {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return Math.round(a * 100) === Math.round(b * 100);
}
function proposalLocked(prop) {
  const st = norm(prop.status);
  if (st === 'invoiced' || st === 'partially invoiced') return true;
  if (prop.clientApprovedTotalAt) return true;
  return false;
}
function lineLocked(line) { return line && (line._costLocked === true || line._costManual === true); }

async function loadProducts() {
  const byId = new Map();
  const byTitle = new Map();
  const snaps = [];
  try { snaps.push(await db.collection('products').where('projectId', '==', BOARD).limit(1000).get()); } catch (_e) {}
  try { snaps.push(await db.collection('products').where('vendor', '==', 'Exquisite Surfaces').limit(500).get()); } catch (_e2) {}
  // fallback scan if vendor field variants
  if (!snaps.length || snaps.every((s) => s.empty)) {
    const all = await db.collection('products').limit(2000).get();
    snaps.push(all);
  }
  snaps.forEach((snap) => {
    snap.forEach((d) => {
      const p = d.data() || {};
      if (!isVendor(p.vendor || p.manufacturer)) return;
      const cost = parseCost(p);
      if (cost == null) return;
      const row = { id: d.id, title: String(p.title || p.name || '').trim(), cost, vendor: String(p.vendor || p.manufacturer || '').trim() };
      byId.set(d.id, row);
      const tk = titleKey(row.title);
      if (!tk) return;
      if (!byTitle.has(tk)) byTitle.set(tk, []);
      const arr = byTitle.get(tk);
      if (!arr.some((x) => x.id === d.id)) arr.push(row);
    });
  });
  return { byId, byTitle };
}

function resolveProd(byId, byTitle, lid, title, vendor) {
  let prod = lid && byId.get(lid);
  if (prod) return prod;
  const arr = byTitle.get(titleKey(title)) || [];
  if (arr.length === 1) return arr[0];
  if (arr.length > 1 && isVendor(vendor)) {
    return arr.find((x) => norm(x.vendor) === norm(vendor)) || arr[0];
  }
  return null;
}

async function main() {
  console.log(APPLY ? 'MODE: APPLY' : 'MODE: dry-run');
  const { byId, byTitle } = await loadProducts();
  console.log('Exquisite Surfaces products with cost:', byId.size);
  byId.forEach((p) => console.log('  ', p.title, p.cost));

  const clipUpdates = [];
  const clipSnap = await db.collection('boards').doc(BOARD).collection('clips').get();
  clipSnap.forEach((d) => {
    const c = d.data() || {};
    const lid = String(c.libraryProductId || c.libraryId || '').trim();
    const prod = resolveProd(byId, byTitle, lid, c.title, c.vendor);
    if (!prod) return;
    if (!isVendor(c.vendor || c.manufacturer) && !isVendor(prod.vendor)) return;
    const cur = parseCost(c);
    if (costsMatch(cur, prod.cost)) return;
    if (c._costLocked || c._costManual) {
      clipUpdates.push({ id: d.id, title: c.title, skip: 'locked', from: cur, to: prod.cost });
      return;
    }
    clipUpdates.push({ id: d.id, title: c.title || prod.title, from: cur, to: prod.cost, libId: prod.id, healLib: !lid });
  });

  const lineUpdates = [];
  const propSnap = await db.collection('boards').doc(BOARD).collection('proposals').get();
  propSnap.forEach((pd) => {
    const prop = pd.data() || {};
    const lockedDoc = proposalLocked(prop);
    const num = prop.proposalNum || prop.number || pd.id;
    (prop.items || []).forEach((line, li) => {
      if (!line) return;
      const lid = String(line.libraryProductId || line.linkedLibraryProductId || '').trim();
      const prod = resolveProd(byId, byTitle, lid, line.title || line.name, line.vendor);
      if (!prod) return;
      if (!isVendor(line.vendor) && !isVendor(prod.vendor)) return;
      const cur = parseCost(line);
      if (costsMatch(cur, prod.cost)) return;
      if (lockedDoc || lineLocked(line)) {
        lineUpdates.push({ propId: pd.id, num, lineIndex: li, title: line.title, skip: lockedDoc ? 'proposal-locked' : 'line-locked', from: cur, to: prod.cost });
        return;
      }
      lineUpdates.push({
        propId: pd.id, num, lineIndex: li, title: line.title || line.name || prod.title,
        from: cur, to: prod.cost, libId: prod.id, healLib: !lid, status: prop.status || 'Draft'
      });
    });
  });

  const clipApply = clipUpdates.filter((u) => !u.skip);
  const lineApply = lineUpdates.filter((u) => !u.skip);
  console.log('\nCLIPS to update:', clipApply.length);
  clipApply.forEach((u) => console.log(' ', u.title, u.from, '→', u.to));
  console.log('PROPOSAL LINES to update:', lineApply.length);
  lineApply.forEach((u) => console.log(' ', u.num, 'L' + (u.lineIndex + 1), u.title, u.from, '→', u.to));

  const backupDir = path.join(__dirname, '..', '_backups');
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
  fs.writeFileSync(path.join(backupDir, 'ES_COST_PUSH_RH_PROD_' + (APPLY ? 'APPLY_' : 'DRY_') + Date.now() + '.json'),
    JSON.stringify({ clipApply, lineApply }, null, 2));

  if (!APPLY) { console.log('Dry-run only.'); return; }

  const now = new Date().toISOString();
  let clipOk = 0;
  for (const u of clipApply) {
    const patch = { cost: u.to, unitCost: u.to, costPrice: u.to, updatedAt: now, _tradeCostPushedFromLibraryAt: now };
    if (u.healLib && u.libId) patch.libraryProductId = u.libId;
    await db.collection('boards').doc(BOARD).collection('clips').doc(u.id).update(patch);
    clipOk++;
  }
  const byProp = new Map();
  lineApply.forEach((u) => { if (!byProp.has(u.propId)) byProp.set(u.propId, []); byProp.get(u.propId).push(u); });
  let lineOk = 0;
  for (const [propId, ups] of byProp) {
    const ref = db.collection('boards').doc(BOARD).collection('proposals').doc(propId);
    const snap = await ref.get();
    if (!snap.exists) continue;
    const prop = snap.data() || {};
    if (proposalLocked(prop)) continue;
    const items = (prop.items || []).slice();
    ups.forEach((u) => {
      const line = items[u.lineIndex];
      if (!line || lineLocked(line)) return;
      line.cost = u.to;
      if (line.unitCost != null) line.unitCost = u.to;
      if (line.costPrice != null) line.costPrice = u.to;
      if (u.healLib && u.libId && !line.libraryProductId) line.libraryProductId = u.libId;
      const qty = parseFloat(line.qty) || 1;
      const mk = parseFloat(line.markupPct);
      if (!isNaN(mk) && qty > 0) {
        const sell = Math.round(u.to * (1 + mk / 100) * 100) / 100;
        line.clientPrice = sell;
        line.amount = Math.round(sell * qty * 100) / 100;
      }
      lineOk++;
    });
    const total = items.reduce((s, i) => s + (parseFloat(i && i.amount) || 0), 0);
    await ref.update({ items, total, updatedAt: now, _tradeCostPushedFromLibraryAt: now });
  }
  console.log('Applied clips:', clipOk, 'proposal lines:', lineOk);
}

main().catch((e) => { console.error(e); process.exit(1); });
