'use strict';
/**
 * DRY RUN (read-only): validate crosswalk cost-fill targets against LIVE production products/.
 * For each fillable studio_doc_id: confirm it still exists, and its cost is STILL empty (fill-empty-only),
 * then stage costPrice = houzz_cost. Splits SKU vs TITLE match, flags stale ids, already-has-cost, conflicts.
 * Writes ONLY a manifest. NOTHING is written to Firestore. *** Production WRITE is a separate --apply step + Cynthia GO. ***
 */
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const KEY = require(path.join(__dirname, '..', '_debug', 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json'));
const db = admin.initializeApp({ credential: admin.credential.cert(KEY) }, 'PROD').firestore();
const num = (v) => { const n = parseFloat(v); return isFinite(n) && n > 0 ? n : 0; };
const liveCost = (p) => num(p.costPrice) || num(p.unitCost) || num(p.cost) || num(p.tradeCost);

(async () => {
  const fillable = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '_backup', 'cost-fill-2026-06-09', 'fillable_from_crosswalk.json'), 'utf8'));
  console.log('Loading live production products/ ...');
  const snap = await db.collection('products').get();
  const byId = new Map();
  snap.forEach((d) => byId.set(d.id, d.data() || {}));
  console.log('Live products/:', byId.size, '| crosswalk targets:', fillable.length, '\n');

  const willFill = [], stale = [], alreadyHasCost = [], conflicts = [];
  for (const r of fillable) {
    const p = byId.get(r.studio_doc_id);
    if (!p) { stale.push(r); continue; }
    if (liveCost(p) > 0) { alreadyHasCost.push({ id: r.studio_doc_id, title: r.studio_title, liveCost: liveCost(p), crosswalkCost: r.houzz_cost }); continue; }
    const rec = { studio_doc_id: r.studio_doc_id, title: String(p.title || p.name || r.studio_title), vendor: String(p.vendor || ''), sku: String(p.sku || ''), fillCostPrice: r.houzz_cost, match_method: r.match_method, houzz_ids: r.houzz_ids, cost_conflict: r.cost_conflict, costs_seen: r.costs_seen };
    if (r.cost_conflict) conflicts.push(rec);
    willFill.push(rec);
  }
  const sku = willFill.filter((x) => x.match_method === 'sku');
  const title = willFill.filter((x) => x.match_method === 'title');

  const outDir = path.join(__dirname, '..', '_backup', 'cost-fill-2026-06-09'); fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'DRYRUN_cost_fill_manifest.json'), JSON.stringify({ dryRun: true, project: 'cch-design-boards', generated: '2026-06-09', liveProducts: byId.size, willFill, stale: stale.map((s) => ({ id: s.studio_doc_id, title: s.studio_title })), alreadyHasCost, summary: { willFill: willFill.length, sku: sku.length, title: title.length, conflicts: conflicts.length, stale: stale.length, alreadyHasCost: alreadyHasCost.length } }, null, 2));

  console.log('=== DRY RUN — cost fill from crosswalk (fill-empty-only) ===');
  console.log('WOULD FILL cost on:', willFill.length, 'products');
  console.log('   • SKU-matched (high confidence):', sku.length);
  console.log('   • TITLE-matched (review):       ', title.length);
  console.log('   • of those, cost-conflict flagged:', conflicts.length);
  console.log('SKIP — already has a cost (live):  ', alreadyHasCost.length);
  console.log('SKIP — stale id (not in live products/):', stale.length);
  console.log('\nSample of fills (SKU-matched):');
  sku.slice(0, 10).forEach((x) => console.log('  $' + String(x.fillCostPrice).padEnd(9) + ' ' + x.title.slice(0, 44).padEnd(44) + ' [' + x.sku + ']'));
  console.log('\nSample of fills (TITLE-matched — review):');
  title.slice(0, 8).forEach((x) => console.log('  $' + String(x.fillCostPrice).padEnd(9) + ' ' + x.title.slice(0, 44).padEnd(44) + (x.cost_conflict ? '  ⚠ costs_seen=' + JSON.stringify(x.costs_seen) : '')));
  console.log('\nManifest: ' + path.join(outDir, 'DRYRUN_cost_fill_manifest.json'));
  console.log('DRY RUN — nothing written to Firestore.');
  process.exit(0);
})().catch((e) => { console.error('ERROR', e.message || e); process.exit(1); });
