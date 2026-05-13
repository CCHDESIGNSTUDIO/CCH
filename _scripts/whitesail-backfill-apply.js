#!/usr/bin/env node
/**
 * Whitesail backfill — APPLY mode (real Firestore writes).
 *
 * Loads backfill-proposal.json (produced by whitesail-backfill-dryrun.js)
 * and writes the 9 docs (3 invoices + 6 POs) to Firestore using
 * firebase-admin with the local service account key.
 *
 * Safety:
 * - Requires explicit --apply flag (default is preview only)
 * - Checks for existing _source='houzz-0427-backfill' docs and refuses
 *   to run if found (no silent duplicates)
 * - Writes a manifest doc to admin/whitesail-backfill-<timestamp>
 *
 * Run preview: node _scripts/whitesail-backfill-apply.js
 * Run apply:   node _scripts/whitesail-backfill-apply.js --apply
 */
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const SA_KEY = path.join(__dirname, '..', '_debug', 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
const PROPOSAL_JSON = 'C:\\Users\\cindy\\Dropbox\\Claude - CCH studio\\Houzz FILES\\_whitesail_extract\\backfill-proposal.json';
const PROJECT_ID = '31-whitesail';
const SOURCE_MARKER = 'houzz-0427-backfill';
const APPLY = process.argv.includes('--apply');

if (!fs.existsSync(SA_KEY)) { console.error('Service account key not found:', SA_KEY); process.exit(1); }
if (!fs.existsSync(PROPOSAL_JSON)) { console.error('Proposal JSON not found:', PROPOSAL_JSON); process.exit(1); }

admin.initializeApp({ credential: admin.credential.cert(require(SA_KEY)) });
const db = admin.firestore();

(async () => {
  const proposal = JSON.parse(fs.readFileSync(PROPOSAL_JSON, 'utf8'));
  const invoices = proposal.invoices.map(({ _firestorePath, ...rest }) => rest);
  const purchaseOrders = proposal.purchaseOrders.map(({ _firestorePath, ...rest }) => rest);

  console.log(`Mode: ${APPLY ? 'APPLY (real writes)' : 'PREVIEW (no writes)'}`);
  console.log(`Target: boards/${PROJECT_ID}`);
  console.log(`Invoices to create: ${invoices.length}`);
  console.log(`POs to create:      ${purchaseOrders.length}`);

  // Verify board exists
  const boardRef = db.collection('boards').doc(PROJECT_ID);
  const boardSnap = await boardRef.get();
  if (!boardSnap.exists) { console.error('Board not found:', PROJECT_ID); process.exit(1); }
  console.log(`Board:              "${boardSnap.data().name}"`);

  // Check for prior backfill (refuse to dupe) — scoped to this project,
  // no collectionGroup needed
  const priorInv = await boardRef.collection('invoices')
    .where('_source', '==', SOURCE_MARKER).limit(1).get();
  const priorPo = await boardRef.collection('purchaseOrders')
    .where('_source', '==', SOURCE_MARKER).limit(1).get();
  if (!priorInv.empty || !priorPo.empty) {
    console.error('ABORT: prior backfill detected (_source=' + SOURCE_MARKER + ' exists). Refusing to create duplicates.');
    console.error('To start fresh, delete prior docs first:');
    console.error('  Invoices: db.collectionGroup("invoices").where("_source","==","' + SOURCE_MARKER + '")...');
    console.error('  POs:      db.collectionGroup("purchaseOrders").where("_source","==","' + SOURCE_MARKER + '")...');
    process.exit(1);
  }
  console.log('No prior backfill — clean to proceed.');

  // Check current Whitesail collection counts
  const curInv = await boardRef.collection('invoices').count().get();
  const curPo = await boardRef.collection('purchaseOrders').count().get();
  console.log(`Current Whitesail: ${curInv.data().count} invoices, ${curPo.data().count} POs`);

  if (!APPLY) {
    console.log('\nPREVIEW only. Re-run with --apply to actually write.');
    console.log('\nInvoices that WOULD be created:');
    for (const inv of invoices) {
      console.log(`  #${String(inv.invoiceNum).padEnd(8)} ${inv.status.padEnd(15)} $${inv.total.toFixed(2).padStart(10)}  due ${inv.dueDate || '—'}  houzzId=${inv._houzzId}`);
    }
    console.log('\nPOs that WOULD be created:');
    for (const po of purchaseOrders) {
      console.log(`  #${String(po.poNum).padEnd(8)} ${po.status.padEnd(15)} $${po.total.toFixed(2).padStart(10)}  ${(po.name || '').slice(0, 50)}`);
    }
    process.exit(0);
  }

  // APPLY
  const results = { invoices: [], pos: [], errors: [] };

  console.log('\nWriting invoices...');
  for (const inv of invoices) {
    try {
      const ref = await boardRef.collection('invoices').add(inv);
      results.invoices.push({ docNumber: inv.invoiceNum, total: inv.total, status: inv.status, firestoreId: ref.id, houzzId: inv._houzzId });
      console.log(`  + #${inv.invoiceNum} $${inv.total} ${inv.status} → ${ref.id}`);
    } catch (e) {
      results.errors.push({ kind: 'invoice', docNumber: inv.invoiceNum, error: e.message });
      console.error(`  × #${inv.invoiceNum}: ${e.message}`);
    }
  }

  console.log('\nWriting purchase orders...');
  for (const po of purchaseOrders) {
    try {
      const ref = await boardRef.collection('purchaseOrders').add(po);
      results.pos.push({ docNumber: po.poNum, total: po.total, status: po.status, firestoreId: ref.id, houzzId: po._houzzId });
      console.log(`  + #${po.poNum} $${po.total} ${po.status} → ${ref.id}`);
    } catch (e) {
      results.errors.push({ kind: 'po', docNumber: po.poNum, error: e.message });
      console.error(`  × #${po.poNum}: ${e.message}`);
    }
  }

  // Update board rollup counts
  try {
    await boardRef.update({
      invoiceCount: admin.firestore.FieldValue.increment(results.invoices.length),
      poCount: admin.firestore.FieldValue.increment(results.pos.length),
      updatedAt: new Date().toISOString()
    });
    console.log('\nBoard rollup counts updated.');
  } catch (e) {
    console.warn('Could not update board rollup:', e.message);
  }

  // Save manifest
  const manifestId = 'whitesail-backfill-' + Date.now();
  try {
    await db.collection('admin').doc(manifestId).set({
      ranAt: new Date().toISOString(),
      ranBy: 'cindy@cchdesign.com (via _scripts/whitesail-backfill-apply.js)',
      sourceMarker: SOURCE_MARKER,
      targetProject: PROJECT_ID,
      invoicesCreated: results.invoices,
      posCreated: results.pos,
      errors: results.errors
    });
    console.log(`Manifest saved: admin/${manifestId}`);
  } catch (e) {
    console.warn('Could not save manifest:', e.message);
  }

  console.log('\n=== APPLY COMPLETE ===');
  console.log(`Invoices created: ${results.invoices.length}`);
  console.log(`POs created:      ${results.pos.length}`);
  console.log(`Errors:           ${results.errors.length}`);
  if (results.errors.length) console.log('Errors:', JSON.stringify(results.errors, null, 2));

  console.log('\nUndo (if needed):');
  console.log('  node -e \'require("firebase-admin").initializeApp({credential:require("firebase-admin").credential.cert(require("./_debug/service-account.json"))});const db=require("firebase-admin").firestore();Promise.all(["invoices","purchaseOrders"].map(c=>db.collectionGroup(c).where("_source","==","' + SOURCE_MARKER + '").get().then(s=>Promise.all(s.docs.map(d=>d.ref.delete()))))).then(()=>process.exit(0))\'');

  process.exit(0);
})().catch(e => { console.error('FATAL:', e); process.exit(1); });
