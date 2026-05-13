const path = require('path');
const admin = require('firebase-admin');
const SA = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
admin.initializeApp({ credential: admin.credential.cert(require(SA)) });
const db = admin.firestore();

(async () => {
  const board = 'boards/31-whitesail';
  const ref = db.collection('boards').doc('31-whitesail');

  console.log('=== Inspiration data ===');
  for (const sub of ['inspiration', 'inspirationBoards', 'ideabooks', 'moodboards', 'roomBoards', 'rooms']) {
    const cnt = await ref.collection(sub).count().get();
    const n = cnt.data().count;
    if (n > 0) {
      console.log(`  ${sub}: ${n} docs`);
      const sample = await ref.collection(sub).limit(2).get();
      sample.forEach(d => {
        const x = d.data();
        console.log(`    ${d.id}: published=${x.published}  name="${(x.name||x.title||'').slice(0,40)}"  items=${(x.items||x.clips||[]).length}`);
      });
    }
  }
  // Inspiration might be a field on the board doc
  const bd = (await ref.get()).data();
  console.log('  board.inspirationCount:', bd.inspirationCount);
  console.log('  board.rooms (array on board doc):', (bd.rooms || []).length, '→', bd.rooms);

  console.log('\n=== One of the new invoices (sample shape) ===');
  const invSnap = await ref.collection('invoices').limit(1).get();
  invSnap.forEach(d => {
    const x = d.data();
    console.log('  Firestore ID:', d.id);
    console.log('  Field keys:  ', Object.keys(x).sort().join(', '));
    console.log('  Has items:    ', (x.items||[]).length);
    console.log('  Has client:   ', x.clientName || x.clientEmail || '(none on inv)');
    console.log('  Has vendor:   ', x.vendor || '(n/a for invoice)');
  });

  console.log('\n=== One of the new POs (sample shape) ===');
  const poSnap = await ref.collection('purchaseOrders').limit(1).get();
  poSnap.forEach(d => {
    const x = d.data();
    console.log('  Firestore ID:', d.id);
    console.log('  Field keys:  ', Object.keys(x).sort().join(', '));
    console.log('  Has items:    ', (x.items||[]).length);
    console.log('  Vendor:       ', x.vendor || '(EMPTY)');
    console.log('  Ship-to:      ', x.shipTo || x.shipToAddress || '(EMPTY)');
  });

  console.log('\n=== Compare: an existing Greene-Hixson invoice (working) shape ===');
  const ref2 = db.collection('boards').doc('greene-hixson');
  const exSnap = await ref2.collection('invoices').limit(1).get();
  exSnap.forEach(d => {
    const x = d.data();
    console.log('  Firestore ID:', d.id);
    console.log('  Field keys:  ', Object.keys(x).sort().join(', '));
    console.log('  Has items:    ', (x.items||[]).length);
  });

  process.exit(0);
})();
