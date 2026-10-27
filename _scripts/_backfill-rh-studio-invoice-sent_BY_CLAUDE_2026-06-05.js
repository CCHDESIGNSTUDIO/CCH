#!/usr/bin/env node
'use strict';
/** Backfill sentDate + Sent status for Studio invoices already published via Send to Client. */
const admin = require('firebase-admin');
const path = require('path');
const KEY = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
admin.initializeApp({ credential: admin.credential.cert(require(KEY)) });
const db = admin.firestore();
const PID = 'cloud-rolling-hills';
const TARGETS = ['INV-6017', 'INV-6018', 'INV-6030', 'INV-6032'];

(async () => {
  for (const num of TARGETS) {
    const snap = await db.collection('boards').doc(PID).collection('invoices')
      .where('invoiceNum', '==', num).limit(1).get();
    if (snap.empty) {
      console.log(num, 'not found');
      continue;
    }
    const ref = snap.docs[0].ref;
    const x = snap.docs[0].data() || {};
    const pub = x.publishedAt || x.updatedAt || x.createdAt || '';
    const sentDate = x.sentDate || (pub ? String(pub).split('T')[0] : new Date().toISOString().split('T')[0]);
    const patch = {
      sentDate,
      sentAt: x.sentAt || pub || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const st = String(x.status || '').trim().toLowerCase();
    if (!st || st === 'draft' || st === 'unsent') patch.status = 'Sent';
    if (x.published !== false) patch.published = true;
    await ref.set(patch, { merge: true });
    console.log(num, '→ status:', patch.status || x.status, 'sentDate:', sentDate);
  }
})().catch((e) => { console.error(e); process.exit(1); });
