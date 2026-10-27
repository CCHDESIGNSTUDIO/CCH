'use strict';
/** PRODUCTION cost-fill PHASE 1 — SKU-matched only (high confidence). Reads the dry-run manifest,
 *  re-verifies each target against LIVE products/ (must still exist AND cost still empty = fill-empty-only),
 *  writes costPrice = the crosswalk Houzz cost. Backs up every touched doc. Cynthia GO given (Jun 9).
 *  Title-matched (Phase 2) is NOT applied here. */
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const KEY = require(path.join(__dirname, '..', '_debug', 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json'));
const db = admin.initializeApp({ credential: admin.credential.cert(KEY) }, 'PROD').firestore();
const num = (v) => { const n = parseFloat(v); return isFinite(n) && n > 0 ? n : 0; };
const liveCost = (p) => num(p.costPrice) || num(p.unitCost) || num(p.cost) || num(p.tradeCost);
(async () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '_backup', 'cost-fill-2026-06-09', 'DRYRUN_cost_fill_manifest.json'), 'utf8'));
  const sku = (manifest.willFill || []).filter((r) => r.match_method === 'sku');
  console.log('Phase 1 (SKU-matched) targets from manifest:', sku.length);
  const snap = await db.collection('products').get();
  const byId = new Map(); snap.forEach((d) => byId.set(d.id, d.data() || {}));

  const applied = [], skippedHasCost = [], skippedStale = [], backups = [];
  let batch = db.batch(), n = 0, committed = 0;
  for (const r of sku) {
    const p = byId.get(r.studio_doc_id);
    if (!p) { skippedStale.push(r.studio_doc_id); continue; }
    if (liveCost(p) > 0) { skippedHasCost.push({ id: r.studio_doc_id, live: liveCost(p) }); continue; }
    backups.push({ id: r.studio_doc_id, prev: { costPrice: p.costPrice == null ? null : p.costPrice, unitCost: p.unitCost == null ? null : p.unitCost } });
    batch.update(db.collection('products').doc(r.studio_doc_id), { costPrice: r.fillCostPrice, _costBackfilledAt: '2026-06-09', _costBackfillSource: 'crosswalk-sku-PHASE1_BY_CLAUDE', updatedAt: '2026-06-09T00:00:00.000Z' });
    applied.push({ id: r.studio_doc_id, title: r.title, cost: r.fillCostPrice });
    n++;
    if (n >= 400) { await batch.commit(); committed += n; console.log('  committed ' + committed + '...'); batch = db.batch(); n = 0; }
  }
  if (n > 0) { await batch.commit(); committed += n; }
  const outDir = path.join(__dirname, '..', '_backup', 'cost-fill-2026-06-09'); fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'APPLIED_phase1_sku.json'), JSON.stringify({ applied, skippedHasCost, skippedStale }, null, 2));
  fs.writeFileSync(path.join(outDir, 'BACKUP_phase1_sku.json'), JSON.stringify(backups, null, 2));
  console.log('\nFILLED costPrice on:', applied.length, 'products');
  console.log('SKIPPED (already had cost):', skippedHasCost.length);
  console.log('SKIPPED (stale/gone id):', skippedStale.length);
  console.log('Backup: _backup/cost-fill-2026-06-09/BACKUP_phase1_sku.json');
  process.exit(0);
})().catch((e) => { console.error('ERROR', e.message || e); process.exit(1); });
