/**
 * Step 2: Mirror Rolling Hills from PRODUCTION (read-only) to STAGING (writes).
 * Preserves all linkage fields (houzzInvoice, houzzPO, houzzProposal) and
 * embedded line item arrays in proposals/invoices/POs.
 *
 * Staging is wiped of any prior cloud-rolling-hills data first (safe — staging only).
 */
const { initializeApp, getApps, getApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, setDoc, getDoc } = require('firebase/firestore');

const PROD_CONFIG = {
  apiKey: 'AIzaSyAd24U5ArVGrA24IxNcYD2NYiTVycyF4og',
  authDomain: 'cch-design-boards.firebaseapp.com',
  projectId: 'cch-design-boards',
  storageBucket: 'cch-design-boards.appspot.com',
  messagingSenderId: '210388013080',
  appId: '1:210388013080:web:cch-design-boards',
};
const STAGING_CONFIG = {
  apiKey: 'AIzaSyBIwwo7uRij6Q0FZg-qmIS1LC8t2AjXrYo',
  authDomain: 'cch-studio-staging.firebaseapp.com',
  projectId: 'cch-studio-staging',
  storageBucket: 'cch-studio-staging.firebasestorage.app',
  messagingSenderId: '210388013080',
  appId: '1:210388013080:web:fcd520b30c0d50b149736d',
};

const BOARD_ID = 'cloud-rolling-hills';
const SUBCOLLECTIONS = ['clips', 'proposals', 'invoices', 'purchaseOrders'];
const TAG = { source: 'staging-copy-from-prod-rh', _stagedAt: new Date().toISOString() };

(async () => {
  const prodApp = initializeApp(PROD_CONFIG, 'prod');
  const stagingApp = initializeApp(STAGING_CONFIG, 'staging');
  const prodDb = getFirestore(prodApp);
  const stagingDb = getFirestore(stagingApp);

  console.log('Phase A: Read production (read-only)');
  console.log('  Reading board doc...');
  const allBoards = await getDocs(collection(prodDb, 'boards'));
  let boardDoc = null;
  allBoards.forEach(d => { if (d.id === BOARD_ID) boardDoc = { id: d.id, data: d.data() }; });
  if (!boardDoc) { console.error('Board not found in prod'); process.exit(1); }

  const subData = {};
  for (const sub of SUBCOLLECTIONS) {
    const snap = await getDocs(collection(prodDb, 'boards', BOARD_ID, sub));
    const docs = [];
    snap.forEach(d => docs.push({ id: d.id, data: d.data() }));
    subData[sub] = docs;
    console.log(`  ${sub}: ${docs.length}`);
  }

  console.log();
  console.log('Phase B (skipped): wipe disabled per user rule "do not delete anything with an image"');
  console.log('  Staging cloud-rolling-hills was verified empty in step 1; nothing to wipe.');

  console.log();
  console.log('Phase C: Write to staging (with linkage preserved). Skip overwrite if staging doc has image.');
  await setDoc(doc(stagingDb, 'boards', BOARD_ID), { ...boardDoc.data, ...TAG });
  console.log(`  wrote board doc: ${BOARD_ID}`);

  for (const sub of SUBCOLLECTIONS) {
    let written = 0, skipped = 0;
    for (const d of subData[sub]) {
      // Safety: if a staging doc already exists AND has an image, skip overwrite.
      const existing = await getDoc(doc(stagingDb, 'boards', BOARD_ID, sub, d.id));
      if (existing.exists()) {
        const ex = existing.data();
        const exHasImg = !!(ex.imageUrl || (ex.images && ex.images.length) || ex.image);
        if (exHasImg) { skipped++; continue; }
      }
      await setDoc(doc(stagingDb, 'boards', BOARD_ID, sub, d.id), { ...d.data, ...TAG });
      written++;
      if (written % 25 === 0) console.log(`  ${sub}: ${written}/${subData[sub].length}`);
    }
    console.log(`  ${sub}: wrote ${written}, skipped (had-image protection) ${skipped}`);
  }

  console.log();
  console.log('Phase D: Sanity report');
  console.log(`  Production board id: ${boardDoc.id}`);
  console.log(`  Production board name: ${boardDoc.data.name || boardDoc.data.title}`);
  for (const sub of SUBCOLLECTIONS) {
    const sample = subData[sub][0];
    if (!sample) continue;
    const linkFields = {};
    for (const k of ['houzzInvoice','houzzPO','houzzProposal','invoiceNum','proposalNum','poNum']) {
      if (sample.data[k]) linkFields[k] = String(sample.data[k]).slice(0, 40);
    }
    console.log(`  ${sub} sample doc id=${sample.id}: linkage fields = ${JSON.stringify(linkFields)}`);
  }

  console.log();
  console.log('Done. Staging URL to view:');
  console.log('  https://cch-platform-staging.web.app/#/project/cloud-rolling-hills');

  process.exit(0);
})().catch(err => { console.error('FAILED:', err); process.exit(1); });
