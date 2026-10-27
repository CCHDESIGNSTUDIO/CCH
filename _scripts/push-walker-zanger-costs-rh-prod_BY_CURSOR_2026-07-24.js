/**
 * PRODUCTION — push Walker Zanger library trade costs → RH selections clips + unlocked proposal lines.
 * (UI trade-cost push not on prod yet / still failing for unlinked lines.)
 *
 *   node _scripts/push-walker-zanger-costs-rh-prod_BY_CURSOR_2026-07-24.js
 *   node _scripts/push-walker-zanger-costs-rh-prod_BY_CURSOR_2026-07-24.js --apply
 */
'use strict';
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const APPLY = process.argv.includes('--apply');
const KEY = path.join(__dirname, '..', '_debug', 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
const BOARD = 'cloud-rolling-hills';
const VENDOR_NEEDLES = ['walker zanger', 'walkerzanger'];

const app = admin.initializeApp({ credential: admin.credential.cert(require(KEY)) }, 'wzPush');
const db = app.firestore();

function norm(s) {
  return String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
}
function isWz(vendor) {
  const v = norm(vendor);
  return VENDOR_NEEDLES.some((n) => v.indexOf(n) >= 0);
}
function parseCost(row) {
  const n = parseFloat(row.costPrice != null ? row.costPrice : (row.unitCost != null ? row.unitCost : row.cost));
  if (isNaN(n) || n < 0) return null;
  return Math.round(n * 100) / 100;
}
function titleKey(t) {
  return norm(t);
}
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
function lineLocked(line) {
  return line && (line._costLocked === true || line._costManual === true);
}

async function loadWzProducts() {
  const byId = new Map();
  const byTitle = new Map(); // titleKey -> [{id, title, cost, sku}]
  // project-scoped first
  const snaps = [
    await db.collection('products').where('projectId', '==', BOARD).limit(1000).get(),
    await db.collection('products').where('vendor', '==', 'Walker Zanger').limit(500).get()
  ];
  // also try manufacturer
  try {
    snaps.push(await db.collection('products').where('manufacturer', '==', 'Walker Zanger').limit(500).get());
  } catch (_e) {}

  snaps.forEach((snap) => {
    snap.forEach((d) => {
      const p = d.data() || {};
      if (!isWz(p.vendor || p.manufacturer)) return;
      const cost = parseCost(p);
      if (cost == null) return;
      const row = {
        id: d.id,
        title: String(p.title || p.name || '').trim(),
        cost,
        sku: String(p.sku || '').trim(),
        vendor: String(p.vendor || p.manufacturer || '').trim()
      };
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

async function main() {
  console.log(APPLY ? 'MODE: APPLY (production)' : 'MODE: dry-run');
  console.log('Board', BOARD);

  const { byId, byTitle } = await loadWzProducts();
  console.log('Walker Zanger products with cost:', byId.size);

  const clipUpdates = [];
  const clipSnap = await db.collection('boards').doc(BOARD).collection('clips').get();
  clipSnap.forEach((d) => {
    const c = d.data() || {};
    if (!isWz(c.vendor || c.manufacturer) && !byId.has(String(c.libraryProductId || '').trim())) {
      // still try title match if vendor missing
      if (!titleKey(c.title)) return;
    }
    const lid = String(c.libraryProductId || c.libraryId || '').trim();
    let prod = lid && byId.get(lid);
    if (!prod) {
      const arr = byTitle.get(titleKey(c.title)) || [];
      if (arr.length === 1) prod = arr[0];
      else if (arr.length > 1 && isWz(c.vendor)) {
        // prefer exact vendor
        prod = arr.find((x) => norm(x.vendor) === norm(c.vendor)) || arr[0];
      }
    }
    if (!prod) return;
    if (!isWz(c.vendor || c.manufacturer) && !isWz(prod.vendor)) return;
    const cur = parseCost(c);
    if (costsMatch(cur, prod.cost)) return;
    if (c._costLocked === true || c._costManual === true) {
      clipUpdates.push({ id: d.id, title: c.title, skip: 'locked', from: cur, to: prod.cost });
      return;
    }
    clipUpdates.push({
      id: d.id,
      title: c.title || prod.title,
      from: cur,
      to: prod.cost,
      libId: prod.id,
      healLib: !lid
    });
  });

  const lineUpdates = [];
  const propSnap = await db.collection('boards').doc(BOARD).collection('proposals').get();
  propSnap.forEach((pd) => {
    const prop = pd.data() || {};
    const lockedDoc = proposalLocked(prop);
    const num = prop.proposalNum || prop.number || pd.id;
    const items = prop.items || [];
    items.forEach((line, li) => {
      if (!line) return;
      const lid = String(line.libraryProductId || line.linkedLibraryProductId || '').trim();
      let prod = lid && byId.get(lid);
      if (!prod) {
        const arr = byTitle.get(titleKey(line.title || line.name)) || [];
        if (arr.length === 1) prod = arr[0];
        else if (arr.length > 1 && isWz(line.vendor)) {
          prod = arr.find((x) => norm(x.vendor) === norm(line.vendor)) || null;
        }
      }
      if (!prod) return;
      if (!isWz(line.vendor) && !isWz(prod.vendor)) return;
      const cur = parseCost(line);
      if (costsMatch(cur, prod.cost)) return;
      if (lockedDoc || lineLocked(line)) {
        lineUpdates.push({
          propId: pd.id, num, lineIndex: li, title: line.title || line.name,
          skip: lockedDoc ? 'proposal-locked' : 'line-locked', from: cur, to: prod.cost
        });
        return;
      }
      lineUpdates.push({
        propId: pd.id,
        num,
        lineIndex: li,
        title: line.title || line.name || prod.title,
        from: cur,
        to: prod.cost,
        libId: prod.id,
        healLib: !lid,
        status: prop.status || 'Draft'
      });
    });
  });

  const clipApply = clipUpdates.filter((u) => !u.skip);
  const lineApply = lineUpdates.filter((u) => !u.skip);
  const clipSkip = clipUpdates.filter((u) => u.skip);
  const lineSkip = lineUpdates.filter((u) => u.skip);

  console.log('\n=== CLIPS will update:', clipApply.length, 'skipped:', clipSkip.length);
  clipApply.slice(0, 40).forEach((u) => {
    console.log('  clip', u.id.slice(0, 8), '|', u.title, '|', u.from, '→', u.to);
  });
  if (clipApply.length > 40) console.log('  …', clipApply.length - 40, 'more');

  console.log('\n=== PROPOSAL LINES will update:', lineApply.length, 'skipped:', lineSkip.length);
  lineApply.slice(0, 40).forEach((u) => {
    console.log('  ', u.num, 'line', u.lineIndex + 1, '|', u.title, '|', u.from, '→', u.to, '|', u.status);
  });
  if (lineSkip.length) {
    console.log('Skipped lines:');
    lineSkip.slice(0, 15).forEach((u) => console.log('  ', u.num, u.title, u.skip));
  }

  const report = { clipApply, lineApply, clipSkip, lineSkip, at: new Date().toISOString() };
  const backupDir = path.join(__dirname, '..', '_backups');
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
  const reportPath = path.join(backupDir, 'WZ_COST_PUSH_RH_PROD_' + (APPLY ? 'APPLY_' : 'DRY_') + Date.now() + '.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log('\nReport', reportPath);

  if (!APPLY) {
    console.log('Dry-run only. Re-run with --apply to write.');
    return;
  }

  const now = new Date().toISOString();
  let clipOk = 0;
  for (const u of clipApply) {
    const patch = {
      cost: u.to,
      unitCost: u.to,
      costPrice: u.to,
      updatedAt: now,
      _tradeCostPushedFromLibraryAt: now
    };
    if (u.healLib && u.libId) patch.libraryProductId = u.libId;
    await db.collection('boards').doc(BOARD).collection('clips').doc(u.id).update(patch);
    clipOk++;
  }

  // group by proposal
  const byProp = new Map();
  lineApply.forEach((u) => {
    if (!byProp.has(u.propId)) byProp.set(u.propId, []);
    byProp.get(u.propId).push(u);
  });
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
      // recompute amount if qty + markup present
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
  console.log('DONE. Hard-refresh Rolling Hills Selections + Proposals.');
}

main().catch((e) => { console.error(e); process.exit(1); });
