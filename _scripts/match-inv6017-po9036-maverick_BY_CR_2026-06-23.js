// Match INV-6017 and PO-9036 Suite 2/4 Maverick lines: SKU 3MAVR52BK, finish "Matte Black housing
// with Walnut Blades", and the walnut image (PO reuses the image already on the invoice line).
// SKU/finish/image are non-financial. Backs up both docs. --apply to write.
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const APPLY = process.argv.includes('--apply');
const PROJECT = 'cloud-rolling-hills';
const INV_ID = 'woO4Doh3IHzRuUEXqIhW';
const PO_ID = '7lTOzx4fCVBCyKvLMFp7';
const TARGET_CLIPS = ['rhG2Maverick52L39', 'rhG4Maverick52L39'];
const SKU = '3MAVR52BK';
const FINISH = 'Matte Black housing with Walnut Blades';

admin.initializeApp({
  credential: admin.credential.cert(require(path.join(__dirname, '..', '_debug', 'service-account.json',
    'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json'))),
});
const db = admin.firestore();
const backupDir = path.join(__dirname, '..', '_backup', 'inv6017-po9036-suite24-sku-finish-2026-06-23');

async function loadDoc(coll, id) {
  const ref = db.collection('boards').doc(PROJECT).collection(coll).doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw new Error(coll + '/' + id + ' not found');
  return { ref, data: snap.data() };
}

(async () => {
  const inv = await loadDoc('invoices', INV_ID);
  const po = await loadDoc('purchaseOrders', PO_ID);
  const invItems = Array.isArray(inv.data.items) ? inv.data.items : [];
  const poItems = Array.isArray(po.data.items) ? po.data.items : [];

  const invTargets = invItems.map((it, i) => ({ it, i })).filter(x => TARGET_CLIPS.includes(String(x.it.clipId || '')));
  const poTargets = poItems.map((it, i) => ({ it, i })).filter(x => TARGET_CLIPS.includes(String(x.it.clipId || '')));

  // walnut image already on the invoice target lines
  const walnutUrl = (invTargets.find(t => t.it.imageUrl) || {}).it
    ? invTargets.find(t => t.it.imageUrl).it.imageUrl : '';

  console.log('INV-6017 targets:', invTargets.map(t => '[' + t.i + '] ' + (t.it.room || '') + ' sku=' + (t.it.sku || '') + ' finish=' + (t.it.finish || '')).join(' | '));
  console.log('PO-9036  targets:', poTargets.map(t => '[' + t.i + '] ' + (t.it.room || '') + ' sku=' + (t.it.sku || '') + ' finish=' + (t.it.finish || '') + ' img=' + String(t.it.imageUrl||'').split('/').pop().split('?')[0]).join(' | '));
  console.log('Will set -> sku=' + SKU + ' | finish=' + FINISH);
  console.log('Walnut image URL (for PO):', walnutUrl ? walnutUrl.slice(0, 90) + '...' : '(NONE FOUND)');

  if (!APPLY) { console.log('\nDRY RUN — no write. Re-run with --apply.'); process.exit(0); }
  if (invTargets.length !== 2 || poTargets.length !== 2) {
    console.error('Expected 2 targets in each doc (inv=' + invTargets.length + ', po=' + poTargets.length + ') — aborting.');
    process.exit(1);
  }
  if (!walnutUrl) { console.error('No walnut image URL on invoice lines — run the image script first. Aborting.'); process.exit(1); }

  fs.mkdirSync(backupDir, { recursive: true });
  fs.writeFileSync(path.join(backupDir, 'inv6017-before.json'), JSON.stringify(inv.data, null, 2));
  fs.writeFileSync(path.join(backupDir, 'po9036-before.json'), JSON.stringify(po.data, null, 2));
  console.log('\nBackups ->', backupDir);

  const newInv = invItems.slice();
  invTargets.forEach(t => { const l = Object.assign({}, t.it); l.sku = SKU; l.finish = FINISH; newInv[t.i] = l; });
  await inv.ref.update({ items: newInv, updatedAt: new Date().toISOString() });

  const newPo = poItems.slice();
  poTargets.forEach(t => {
    const l = Object.assign({}, t.it);
    l.sku = SKU; l.finish = FINISH;
    l.imageUrl = walnutUrl; l.images = [walnutUrl];
    l.heroImageIndex = 0; l.selectionImageIndex = 0; l._imageManual = true;
    newPo[t.i] = l;
  });
  await po.ref.update({ items: newPo, updatedAt: new Date().toISOString() });

  console.log('APPLIED — INV-6017 (sku+finish) and PO-9036 (sku+finish+walnut image) updated on 2 lines each.');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
