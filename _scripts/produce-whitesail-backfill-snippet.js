#!/usr/bin/env node
/**
 * Reads backfill-proposal.json and emits a single browser-console
 * snippet at:
 *   Houzz FILES/_whitesail_extract/PASTE-IN-STUDIO-CONSOLE.js
 *
 * Open that file, copy the entire contents, paste into the browser
 * console at cch-platform.web.app while signed in as admin (cindy@).
 * The snippet asks for one confirmation before any Firestore write
 * and logs progress.
 *
 * Run: node _scripts/produce-whitesail-backfill-snippet.js
 */
const fs = require('fs');
const path = require('path');

const PROPOSAL = 'C:\\Users\\cindy\\Dropbox\\Claude - CCH studio\\Houzz FILES\\_whitesail_extract\\backfill-proposal.json';
const OUT = 'C:\\Users\\cindy\\Dropbox\\Claude - CCH studio\\Houzz FILES\\_whitesail_extract\\PASTE-IN-STUDIO-CONSOLE.js';

const p = JSON.parse(fs.readFileSync(PROPOSAL, 'utf8'));

// Strip the _firestorePath helper before embedding (it's a comment field)
const stripPath = d => { const { _firestorePath, ...rest } = d; return rest; };
const invoices = p.invoices.map(stripPath);
const purchaseOrders = p.purchaseOrders.map(stripPath);

const snippet = `// ════════════════════════════════════════════════════════════════
// WHITESAIL BACKFILL — paste this entire block into the browser console
// at https://cch-platform.web.app while signed in as cindy@cchdesign.com.
// Generated: ${p.generatedAt}
// Source:    cchdesign_0427.csv (canonical Houzz export)
// Target:    boards/31-whitesail/{invoices,purchaseOrders}
// Writes:    ${invoices.length} invoices + ${purchaseOrders.length} purchase orders
// Tag:       _source: 'houzz-0427-backfill' (use to find/delete if needed)
// ════════════════════════════════════════════════════════════════
(async function whitesailBackfill() {
  const PROJECT_ID = '31-whitesail';
  const SOURCE_MARKER = 'houzz-0427-backfill';

  const INVOICES = ${JSON.stringify(invoices, null, 2)};

  const PURCHASE_ORDERS = ${JSON.stringify(purchaseOrders, null, 2)};

  // Sanity: confirm logged in + collections currently empty
  if (typeof firebase === 'undefined' || !firebase.firestore) {
    console.error('Firebase SDK not loaded. Are you on cch-platform.web.app?');
    return;
  }
  const db = firebase.firestore();
  const user = firebase.auth().currentUser;
  if (!user) { console.error('Not signed in.'); return; }
  console.log('Signed in as:', user.email);

  const projRef = db.collection('boards').doc(PROJECT_ID);
  const projSnap = await projRef.get();
  if (!projSnap.exists) { console.error('Board not found:', PROJECT_ID); return; }
  console.log('Board:', projSnap.data().name);

  const existingInvSnap = await projRef.collection('invoices').limit(1).get();
  const existingPoSnap  = await projRef.collection('purchaseOrders').limit(1).get();
  const existingSourceSnap = await db.collectionGroup('invoices')
    .where('_source', '==', SOURCE_MARKER).limit(1).get();

  if (!existingInvSnap.empty || !existingPoSnap.empty) {
    const proceed = confirm(
      'Whitesail already has invoices or POs. Proceed anyway? ' +
      'This adds new docs alongside what is there (no overwrite).'
    );
    if (!proceed) { console.log('Cancelled.'); return; }
  }
  if (!existingSourceSnap.empty) {
    const proceed = confirm(
      'A previous backfill with _source="' + SOURCE_MARKER + '" exists. ' +
      'Run again and create DUPLICATES? Click Cancel to abort.'
    );
    if (!proceed) { console.log('Cancelled.'); return; }
  }

  const ok = confirm(
    'About to create ' + INVOICES.length + ' invoices and ' +
    PURCHASE_ORDERS.length + ' POs in boards/' + PROJECT_ID + '.\\n\\n' +
    'Tag on every doc: _source="' + SOURCE_MARKER + '"\\n' +
    'You can delete them later by querying that tag.\\n\\n' +
    'Proceed?'
  );
  if (!ok) { console.log('Cancelled.'); return; }

  const createdInvoiceIds = [];
  const createdPoIds = [];
  const errors = [];

  for (const inv of INVOICES) {
    try {
      const ref = await projRef.collection('invoices').add(inv);
      createdInvoiceIds.push({ docNumber: inv.invoiceNum, total: inv.total, status: inv.status, firestoreId: ref.id, houzzId: inv._houzzId });
      console.log('+ invoice', inv.invoiceNum, '$' + inv.total, inv.status, '→', ref.id);
    } catch (e) {
      errors.push({ kind: 'invoice', docNumber: inv.invoiceNum, error: e.message });
      console.error('× invoice', inv.invoiceNum, e.message);
    }
  }

  for (const po of PURCHASE_ORDERS) {
    try {
      const ref = await projRef.collection('purchaseOrders').add(po);
      createdPoIds.push({ docNumber: po.poNum, total: po.total, status: po.status, firestoreId: ref.id, houzzId: po._houzzId });
      console.log('+ PO     ', po.poNum, '$' + po.total, po.status, '→', ref.id);
    } catch (e) {
      errors.push({ kind: 'po', docNumber: po.poNum, error: e.message });
      console.error('× PO     ', po.poNum, e.message);
    }
  }

  // Update rollup counts on the board doc so the dashboard reflects reality
  try {
    await projRef.update({
      invoiceCount: firebase.firestore.FieldValue.increment(createdInvoiceIds.length),
      poCount: firebase.firestore.FieldValue.increment(createdPoIds.length),
      updatedAt: new Date().toISOString()
    });
    console.log('Updated board rollup counts.');
  } catch (e) {
    console.warn('Could not update board rollup counts:', e.message);
  }

  console.log('\\n=== Whitesail backfill complete ===');
  console.log('Invoices created:', createdInvoiceIds.length);
  console.log('POs created:     ', createdPoIds.length);
  console.log('Errors:          ', errors.length);
  if (errors.length) console.log('Error details:', errors);

  // Save a result manifest in Firestore so we have a paper trail
  try {
    await db.collection('admin').doc('whitesail-backfill-' + Date.now()).set({
      ranAt: new Date().toISOString(),
      ranBy: user.email,
      sourceMarker: SOURCE_MARKER,
      targetProject: PROJECT_ID,
      invoicesCreated: createdInvoiceIds,
      posCreated: createdPoIds,
      errors
    });
    console.log('Manifest saved to admin/whitesail-backfill-*');
  } catch (e) {
    console.warn('Could not save manifest:', e.message);
  }

  console.log('\\nDONE. Reload the Whitesail project page to see the new docs.');
  console.log('To undo: db.collectionGroup("invoices").where("_source","==","' + SOURCE_MARKER + '").get().then(s=>s.forEach(d=>d.ref.delete()))');
  console.log('   and:  db.collectionGroup("purchaseOrders").where("_source","==","' + SOURCE_MARKER + '").get().then(s=>s.forEach(d=>d.ref.delete()))');
})();
`;

fs.writeFileSync(OUT, snippet, 'utf8');
console.log('Snippet written to:');
console.log('  ' + OUT);
console.log('');
console.log('Size:', snippet.length, 'bytes (', snippet.split('\n').length, 'lines)');
console.log('');
console.log('Next steps:');
console.log('  1. Open that file in any text editor');
console.log('  2. Select all + copy');
console.log('  3. Open https://cch-platform.web.app, sign in as cindy@cchdesign.com');
console.log('  4. Open DevTools (F12) → Console tab');
console.log('  5. Paste, press Enter');
console.log('  6. Click OK on the confirmation dialog');
console.log('  7. Watch the log');
