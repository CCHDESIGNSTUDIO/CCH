#!/usr/bin/env node
'use strict';
const path = require('path');
const admin = require('firebase-admin');
const KEY = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
admin.initializeApp({ credential: admin.credential.cert(require(KEY)) });
const db = admin.firestore();
const PID = 'cloud-rolling-hills';

(async () => {
  const snap = await db.collection('boards').doc(PID).collection('clips').get();
  console.log('=== clips in Hall (all) ===');
  for (const d of snap.docs) {
    const x = d.data() || {};
    const room = String(x.room || '').trim();
    if (room !== 'Hall') continue;
    const title = String(x.title || '');
    console.log('\nclip', d.id);
    console.log('  title', title);
    console.log('  vendor', x.vendor);
    console.log('  source', x.source);
    console.log('  houzzId', x.houzzId || x.houzzProductId || '(none)');
    console.log('  libraryProductId', x.libraryProductId || '(none)');
    console.log('  proposalNum', x.proposalNum || x.houzzProposal || '(none)');
    console.log('  invoiceNum', x.invoiceNum || x.houzzInvoice || '(none)');
    console.log('  sku', x.sku);
    console.log('  imageUrl', (x.imageUrl || '').slice(0, 80));
    const lid = String(x.libraryProductId || '').trim();
    if (lid) {
      const p = await db.collection('products').doc(lid).get();
      if (p.exists) {
        const pd = p.data() || {};
        console.log('  products/', lid, 'houzzId', pd.houzzId || pd.houzzProductId || '(none)', 'source', pd.source);
      } else console.log('  products/', lid, 'MISSING');
    }
  }

  console.log('\n=== products/ Hall Urban (by project) ===');
  const ps = await db.collection('products').where('projectId', '==', PID).limit(500).get();
  ps.forEach((d) => {
    const p = d.data() || {};
    if (String(p.room || '') !== 'Hall') return;
    if (!/urban|erddig|houe|jackson/i.test((p.title || '') + (p.vendor || ''))) return;
    console.log('\nproduct', d.id);
    console.log('  title', p.title);
    console.log('  vendor', p.vendor);
    console.log('  houzzId', p.houzzId || p.houzzProductId || '(none)');
    console.log('  source', p.source);
    console.log('  imageUrl', (p.imageUrl || '').slice(0, 80));
  });
})();
