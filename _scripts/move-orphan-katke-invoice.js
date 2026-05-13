/**
 * Move INV-6022 from phantom boards/katke-graceland to real boards/katke-graceland-dr.
 * After this runs, the phantom board has no remaining data and is safe to delete.
 */
const path = require('path');
const admin = require('firebase-admin');
const SA = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
admin.initializeApp({ credential: admin.credential.cert(require(SA)) });
const db = admin.firestore();

(async () => {
  const FROM = db.collection('boards').doc('katke-graceland');
  const TO = db.collection('boards').doc('katke-graceland-dr');

  const orphans = await FROM.collection('invoices').get();
  if (orphans.empty) { console.log('No orphans to move. Done.'); process.exit(0); }

  console.log(`Moving ${orphans.size} invoice(s) from katke-graceland → katke-graceland-dr...`);

  for (const d of orphans.docs) {
    const data = d.data();
    // Preserve original Firestore ID by using .doc(d.id).set()
    const newRef = TO.collection('invoices').doc(d.id);
    const existing = await newRef.get();
    if (existing.exists) {
      console.log(`  × ${d.id} ALREADY EXISTS on target — skipping move, leaving orphan in place.`);
      continue;
    }
    // Annotate so we can audit
    const moved = {
      ...data,
      _movedFromPhantom: 'katke-graceland',
      _movedAt: new Date().toISOString(),
      _movedBy: 'whitesail-session cleanup 2026-05-13'
    };
    await newRef.set(moved);
    await d.ref.delete();
    console.log(`  + ${d.id} moved (invoiceNum=${data.invoiceNum || data.number || '?'}, total=${data.total})`);
  }

  // Bump invoiceCount on the real board
  await TO.update({
    invoiceCount: admin.firestore.FieldValue.increment(orphans.size),
    updatedAt: new Date().toISOString()
  });
  console.log('Real board invoiceCount bumped by ' + orphans.size + '.');

  // Verify phantom is now empty
  const stillThere = await FROM.collection('invoices').count().get();
  console.log('Phantom katke-graceland/invoices count after move:', stillThere.data().count);
  process.exit(0);
})().catch(e => { console.error('FATAL:', e); process.exit(1); });
