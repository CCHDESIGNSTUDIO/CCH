#!/usr/bin/env node
/**
 * Inspect a board doc + all its subcollections.
 * Usage: node _scripts/inspect-board.js <boardId> [boardId2 ...]
 */
const path = require('path');
const admin = require('firebase-admin');
const SA_KEY = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
admin.initializeApp({ credential: admin.credential.cert(require(SA_KEY)) });
const db = admin.firestore();

const SUBCOLLECTIONS = ['invoices', 'purchaseOrders', 'proposals', 'clips', 'files', 'tasks', 'rooms', 'designboards', 'workOrders', 'specBook', 'communications', 'notes'];

(async () => {
  const ids = process.argv.slice(2);
  if (!ids.length) { console.error('Usage: node inspect-board.js <boardId>'); process.exit(1); }

  for (const id of ids) {
    console.log('\n=== boards/' + id + ' ===');
    const ref = db.collection('boards').doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      console.log('  Doc does NOT exist (phantom). Checking for subcollections anyway...');
    } else {
      const d = snap.data();
      console.log('  name:        ', d.name || '(none)');
      console.log('  clientName:  ', d.clientName || '(none)');
      console.log('  owner:       ', d.owner || '(none)');
      console.log('  source:      ', d.source || '(none)');
      console.log('  createdAt:   ', d.createdAt || '(none)');
      console.log('  updatedAt:   ', d.updatedAt || '(none)');
      console.log('  invoiceCount:', d.invoiceCount || 0);
      console.log('  poCount:     ', d.poCount || 0);
      console.log('  proposalCount:', d.proposalCount || 0);
      console.log('  clipCount:   ', d.clipCount || 0);
    }
    // List subcollections actually present
    let foundAny = false;
    for (const sub of SUBCOLLECTIONS) {
      const cnt = await ref.collection(sub).count().get();
      const n = cnt.data().count;
      if (n > 0) {
        foundAny = true;
        console.log('  ' + sub.padEnd(15) + ' ' + n + ' docs');
      }
    }
    if (!foundAny) console.log('  (no subcollection data — truly empty)');
  }
  process.exit(0);
})();
