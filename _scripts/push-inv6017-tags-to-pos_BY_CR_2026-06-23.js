// Push line tags from INV-6017 onto matching PO lines across Cloud Rolling Hills.
// Source of truth: INV-6017 line tags (matched to PO lines by clipId, then sku, then title|vendor).
// Only sets lineTag where the PO line is currently empty AND a match exists. Nothing else touched.
// Usage: node push-inv6017-tags-to-pos_BY_CR_2026-06-23.js          (dry run, default)
//        node push-inv6017-tags-to-pos_BY_CR_2026-06-23.js --apply  (writes, after backup)
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
admin.initializeApp({
  credential: admin.credential.cert(require(path.join(__dirname, '..', '_debug', 'service-account.json',
    'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json'))),
});
const db = admin.firestore();
const PROJECT = 'cloud-rolling-hills';
const APPLY = process.argv.includes('--apply');
const norm = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
const tagOf = (it) => String(it.lineTag || it.lineTagCode || it.fixtureTag || it.tag || '').trim();
const BACKUP_DIR = path.join(__dirname, '..', '_backup', 'rh-po-tags-from-inv6017-2026-06-23');

(async () => {
  // 1) Locate INV-6017 and build its tag index.
  const invSnap = await db.collection('boards').doc(PROJECT).collection('invoices').get();
  let invDoc = null;
  invSnap.forEach(d => {
    const v = d.data();
    if (/6017/.test(String(v.number || '')) || /6017/.test(String(v.name || ''))) invDoc = d;
  });
  if (!invDoc) { console.error('INV-6017 not found'); process.exit(1); }
  const inv = invDoc.data();
  console.log('Source invoice: ' + (inv.number || invDoc.id) + ' (doc ' + invDoc.id + ') — ' + (inv.items || []).length + ' lines');

  const byClip = {}, bySku = {}, byTitleVendor = {};
  (inv.items || []).forEach(it => {
    const t = tagOf(it);
    if (!t) return;
    if (it.clipId) byClip[String(it.clipId)] = byClip[String(it.clipId)] || t;
    if (it.sku) bySku[norm(it.sku)] = bySku[norm(it.sku)] || t;
    if (norm(it.title)) byTitleVendor[norm(it.title) + '|' + norm(it.vendor)] = byTitleVendor[norm(it.title) + '|' + norm(it.vendor)] || t;
  });
  console.log('Tags on INV-6017: byClip=' + Object.keys(byClip).length + ' bySku=' + Object.keys(bySku).length + ' byTitleVendor=' + Object.keys(byTitleVendor).length);
  console.log('='.repeat(90));

  // 2) Walk POs, compute pushes.
  if (APPLY && !fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const poSnap = await db.collection('boards').doc(PROJECT).collection('purchaseOrders').get();
  let totalPush = 0, posChanged = 0;
  for (const doc of poSnap.docs) {
    const d = doc.data();
    const items = (d.items || []).map(x => ({ ...x }));
    const changes = [];
    items.forEach(it => {
      if (tagOf(it)) return;
      const match = (it.clipId && byClip[String(it.clipId)]) || (it.sku && bySku[norm(it.sku)]) ||
        byTitleVendor[norm(it.title) + '|' + norm(it.vendor)] || '';
      if (match) { it.lineTag = match; changes.push('"' + match + '" <- ' + (it.title || '').slice(0, 42)); }
    });
    if (!changes.length) continue;
    posChanged++; totalPush += changes.length;
    console.log((APPLY ? 'WRITE ' : 'DRY  ') + (d.number || doc.id) + ' (' + (d.vendor || '') + ') — ' + changes.length + ' tag(s)');
    changes.forEach(c => console.log('     ' + c));
    if (APPLY) {
      fs.writeFileSync(path.join(BACKUP_DIR, (d.number || doc.id) + '.json'), JSON.stringify(d, null, 2));
      await doc.ref.update({ items, updatedAt: new Date().toISOString() });
    }
  }
  console.log('='.repeat(90));
  console.log((APPLY ? 'APPLIED' : 'DRY RUN') + ': ' + totalPush + ' tags across ' + posChanged + ' POs.' + (APPLY ? ' Backups in ' + BACKUP_DIR : ' Re-run with --apply to write.'));
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
