'use strict';
/** Scan ALL "Volcan" docs across products/productLibrary/archives; then (on --apply) rename the Global
 *  Views Volcan to "Volcan Handled Jar - Large" (fixes the 101-char filter). Backs up the doc first.
 *  PRODUCTION single-doc edit — Cynthia GO given. Dry-scan unless --apply. */
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const APPLY = process.argv.includes('--apply');
const KEY = require(path.join(__dirname, '..', '_debug', 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json'));
const db = admin.initializeApp({ credential: admin.credential.cert(KEY) }, 'PROD').firestore();
const str = (v) => String(v == null ? '' : v).trim();
const NEW_TITLE = 'Volcan Handled Jar - Large';
async function scan() {
  const out = [];
  for (const coll of ['products', 'productLibrary', 'products_archive', 'productLibrary_archive']) {
    const snap = await db.collection(coll).get();
    snap.forEach((d) => { const p = d.data() || {}; const t = str(p.title || p.name); if (/volcan/i.test(t)) out.push({ coll, id: d.id, title: t, len: t.length, vendor: str(p.vendor), cost: p.costPrice || p.cost || p.unitCost || '', sku: str(p.sku), created: str(p.createdAt).slice(0, 16), hidden: t.length > 100 }); });
  }
  return out;
}
(async () => {
  console.log('=== ALL "Volcan" docs (before) ===');
  let rows = await scan();
  rows.forEach((r) => console.log('  [' + r.coll.padEnd(14) + '] ' + (r.hidden ? 'HIDDEN ' : 'shows  ') + 'len=' + String(r.len).padEnd(4) + ' "' + r.title.slice(0, 50) + '" vendor=' + r.vendor + ' cost=' + r.cost + ' created=' + r.created + '\n      id=' + r.id));
  // target = Global Views Volcan in products/
  const target = rows.find((r) => r.coll === 'products' && /global\s*views/i.test(r.vendor));
  if (!target) { console.log('\nNo Global Views Volcan in products/ — nothing to rename.'); process.exit(0); }
  console.log('\nTARGET to rename → "' + NEW_TITLE + '":\n  ' + target.id);
  if (!APPLY) { console.log('\nSCAN ONLY (add --apply to rename). Total Volcan docs:', rows.length); process.exit(0); }
  // backup
  const docRef = db.collection('products').doc(target.id);
  const snap = await docRef.get();
  const outDir = path.join(__dirname, '..', '_backup', 'volcan-rename-2026-06-09'); fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'BACKUP_' + target.id.slice(0, 40) + '.json'), JSON.stringify({ id: target.id, prev: snap.data() }, null, 2));
  await docRef.update({ title: NEW_TITLE, name: NEW_TITLE, updatedAt: '2026-06-09T00:00:00.000Z' });
  console.log('  ✓ renamed. Backup saved.');
  console.log('\n=== ALL "Volcan" docs (after) ===');
  rows = await scan();
  rows.forEach((r) => console.log('  [' + r.coll.padEnd(14) + '] ' + (r.hidden ? 'HIDDEN ' : 'shows  ') + 'len=' + String(r.len).padEnd(4) + ' "' + r.title.slice(0, 50) + '" vendor=' + r.vendor + ' cost=' + r.cost));
  const visible = rows.filter((r) => r.coll === 'products' && !r.hidden);
  console.log('\nVolcan products that now SHOW in the library:', visible.length);
  process.exit(0);
})().catch((e) => { console.error('ERROR', e.message || e); process.exit(1); });
