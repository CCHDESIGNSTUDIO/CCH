// INV-6017 (cloud-rolling-hills): audit all lines (read), and on --apply upload "Maverick Walnut.png"
// and set it as the image on the Suite 2 / Suite 4 Maverick lines (clipIds rhG2/rhG4Maverick52L39).
// Image is non-financial; backs up the invoice doc before any write. No financial fields touched.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const admin = require('firebase-admin');

const APPLY = process.argv.includes('--apply');
const PROJECT = 'cloud-rolling-hills';
const INV_ID = 'woO4Doh3IHzRuUEXqIhW';
const BUCKET = 'cch-design-boards.firebasestorage.app';
const LOCAL_IMG = 'C:\\Users\\cindy\\Documents\\Maverick Walnut.png';
const TARGET_CLIPS = ['rhG2Maverick52L39', 'rhG4Maverick52L39'];

admin.initializeApp({
  credential: admin.credential.cert(require(path.join(__dirname, '..', '_debug', 'service-account.json',
    'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json'))),
  storageBucket: BUCKET,
});
const db = admin.firestore();
const baseName = (u) => { try { return String(u || '').split('/').pop().split('?')[0]; } catch (_) { return ''; } };

(async () => {
  const ref = db.collection('boards').doc(PROJECT).collection('invoices').doc(INV_ID);
  const snap = await ref.get();
  if (!snap.exists) { console.error('invoice not found'); process.exit(1); }
  const d = snap.data();
  const items = Array.isArray(d.items) ? d.items : [];
  console.log('INV', (d.invoiceNum || d.number || d.name), '| status:', d.status, '| qbSynced:', d.qbSynced, '| lines:', items.length);
  console.log('='.repeat(90));
  items.forEach((it, i) => {
    console.log('[' + i + '] room=' + JSON.stringify(it.room || '') + '  sku=' + JSON.stringify(it.sku || '') +
      '  finish=' + JSON.stringify(it.finish || ''));
    console.log('     title=' + JSON.stringify(it.title || ''));
    console.log('     desc=' + JSON.stringify(String(it.description || '').slice(0, 140)));
    console.log('     clipId=' + JSON.stringify(it.clipId || '') + '  img=' + JSON.stringify(baseName(it.imageUrl)));
  });

  const targets = items.map((it, i) => ({ it, i })).filter(x => TARGET_CLIPS.includes(String(x.it.clipId || '')));
  console.log('\nTarget Maverick lines (Suite 2 / Suite 4):', targets.map(t => '[' + t.i + '] ' + (t.it.room || '')).join(', '));

  if (!APPLY) { console.log('\nDRY RUN — no upload, no write. Re-run with --apply.'); process.exit(0); }
  if (targets.length !== 2) { console.error('\nExpected 2 target lines, found ' + targets.length + ' — aborting.'); process.exit(1); }

  // backup
  const backupDir = path.join(__dirname, '..', '_backup', 'inv6017-suite24-maverick-image-2026-06-23');
  fs.mkdirSync(backupDir, { recursive: true });
  fs.writeFileSync(path.join(backupDir, 'backup-before.json'), JSON.stringify({ id: INV_ID, project: PROJECT, data: d }, null, 2));
  console.log('\nBackup ->', backupDir);

  // upload image
  const token = crypto.randomUUID();
  const dest = 'docLineImages/' + PROJECT + '/invoices/' + INV_ID + '/maverick-walnut-' + Date.now() + '.png';
  await admin.storage().bucket().upload(LOCAL_IMG, {
    destination: dest,
    metadata: { contentType: 'image/png', metadata: { firebaseStorageDownloadTokens: token } },
  });
  const url = 'https://firebasestorage.googleapis.com/v0/b/' + BUCKET + '/o/' + encodeURIComponent(dest) + '?alt=media&token=' + token;
  console.log('Uploaded ->', url);

  const newItems = items.slice();
  targets.forEach(t => {
    const l = Object.assign({}, t.it);
    l.imageUrl = url;
    l.images = [url];
    l.heroImageIndex = 0;
    l.selectionImageIndex = 0;
    l._imageManual = true; // protect from clip-sync overwrite (lineItemImageIsProtected)
    newItems[t.i] = l;
  });
  await ref.update({ items: newItems, updatedAt: new Date().toISOString() });
  console.log('APPLIED — walnut image set on ' + targets.length + ' lines.');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
