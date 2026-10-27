#!/usr/bin/env node
'use strict';
const admin = require('firebase-admin');
const path = require('path');
const KEY = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(require(KEY)) });
const db = admin.firestore();
const projectId = 'cloud-rolling-hills';

function matches(blob, id) {
  const b = blob.toLowerCase();
  return /modern flush|modern rectangular flush|emt220307|banquette hardware|flush pull/i.test(b) || /modern.?flush/i.test(id);
}

(async () => {
  console.log('=== CATALOG: Modern Flush / related ===\n');
  for (const col of ['productLibrary', 'products', 'productLibrary_archive', 'products_archive']) {
    const snap = await db.collection(col).get();
    snap.forEach(d => {
      const p = d.data();
      const blob = JSON.stringify(p) + ' ' + d.id;
      if (!matches(blob, d.id)) return;
      console.log('[' + col + ']', d.id);
      console.log('  title:', p.title || p.name || '(empty)');
      console.log('  vendor:', p.vendor, '| source:', p.source);
      console.log('  createdAt:', p.createdAt, '| updatedAt:', p.updatedAt);
      console.log('  clippedFromUrl:', (p.clippedFromUrl || p.sourceUrl || p.pageUrl || '').slice(0, 100));
      console.log('  imageUrl:', (p.imageUrl || '').slice(0, 90) || '(none)');
      if (p._archiveMeta) console.log('  archived:', p._archiveMeta.archivedAt, p._archiveMeta.reason);
      console.log('');
    });
  }

  console.log('=== CLIPS (Rolling Hills) ===\n');
  const clipSnap = await db.collection('boards').doc(projectId).collection('clips').get();
  clipSnap.forEach(d => {
    const c = d.data();
    const blob = JSON.stringify(c) + ' ' + (c.title || '');
    if (!matches(blob, d.id)) return;
    console.log('clip', d.id);
    console.log('  title:', c.title);
    console.log('  room:', c.room, '| libId:', c.libraryProductId);
    console.log('  addedAt:', c.addedAt, '| updatedAt:', c.updatedAt);
    console.log('  imageUrl:', (c.imageUrl || '').slice(0, 90));
    console.log('');
  });

  console.log('=== PROPOSALS / INVOICES (Rolling Hills) ===\n');
  for (const coll of ['proposals', 'invoices']) {
    const snap = await db.collection('boards').doc(projectId).collection(coll).get();
    snap.forEach(d => {
      const doc = d.data();
      const num = doc.proposalNum || doc.invoiceNum || doc.name || d.id;
      (doc.items || []).forEach((it, idx) => {
        const blob = JSON.stringify(it);
        if (!matches(blob, '')) return;
        console.log(coll, num, d.id, 'line', idx);
        console.log('  title:', it.title || it.name);
        console.log('  libId:', it.libraryProductId || '(none)');
        console.log('  clipId:', it.clipId || it.sourceClipId || '(none)');
        console.log('  room:', it.room, '| vendor:', it.vendor);
        console.log('');
      });
    });
  }
})().catch(e => { console.error(e); process.exit(1); });
