#!/usr/bin/env node
'use strict';
const admin = require('firebase-admin');
const path = require('path');
const KEY = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(require(KEY)) });
const db = admin.firestore();
const projectId = 'cloud-rolling-hills';

async function scanCollection(col, filterFn) {
  const snap = await db.collection(col).get();
  const hits = [];
  snap.forEach(d => {
    const p = d.data();
    const blob = JSON.stringify(p).toLowerCase();
    if (filterFn(p, blob, d.id)) hits.push({ id: d.id, col, ...p });
  });
  return hits;
}

(async () => {
  const needles = ['emt220307', 'rectangular flush pull', 'emtek-7-modern', 'banquette hardware'];
  function match(p, blob) {
    return needles.some(n => blob.includes(n));
  }

  console.log('=== All catalog rows matching hardware pull ===');
  for (const col of ['productLibrary', 'products', 'productLibrary_archive', 'products_archive']) {
    const hits = await scanCollection(col, match);
    hits.forEach(h => {
      console.log('\n', col, h.id);
      console.log('  title:', (h.title || h.name || '').slice(0, 90));
      console.log('  vendor:', h.vendor, 'source:', h.source);
      console.log('  createdAt:', h.createdAt, 'updatedAt:', h.updatedAt);
      console.log('  clippedFromUrl:', (h.clippedFromUrl || h.sourceUrl || h.pageUrl || '').slice(0, 90));
      console.log('  imageUrl:', (h.imageUrl || '').slice(0, 80));
      console.log('  _archiveMeta:', h._archiveMeta ? h._archiveMeta.archivedAt : '');
      console.log('  keys-only:', Object.keys(h).filter(k => !['id','col'].includes(k)).slice(0, 15).join(','));
    });
  }

  console.log('\n=== Clips on Rolling Hills matching pull ===');
  const clipSnap = await db.collection('boards').doc(projectId).collection('clips').get();
  clipSnap.forEach(d => {
    const c = d.data();
    const t = String(c.title || '').toLowerCase();
    if (t.includes('rectangular flush') || t.includes('emt220307') || t.includes('banquette')) {
      console.log('\n clip', d.id);
      console.log('  title:', (c.title || '').slice(0, 90));
      console.log('  room:', c.room, 'libraryProductId:', c.libraryProductId);
      console.log('  source:', c.source, 'addedAt:', c.addedAt, 'updatedAt:', c.updatedAt);
      console.log('  imageUrl:', (c.imageUrl || '').slice(0, 80));
    }
  });

  console.log('\n=== Docs referencing this product ===');
  for (const coll of ['proposals', 'invoices']) {
    const snap = await db.collection('boards').doc(projectId).collection(coll).get();
    snap.forEach(d => {
      const doc = d.data();
      const num = doc.proposalNum || doc.invoiceNum || doc.name || d.id;
      (doc.items || []).forEach((it, idx) => {
        const t = String(it.title || it.name || '').toLowerCase();
        const lid = String(it.libraryProductId || it.linkedLibraryProductId || '');
        if (t.includes('rectangular flush') || lid.includes('modern_cabinet_hardware_collection7')) {
          console.log(coll, num, d.id, 'line', idx);
          console.log('  clipId:', it.clipId || '(none)', 'room:', it.room);
          console.log('  libId:', lid.slice(0, 60));
          console.log('  created/updated doc:', doc.createdAt, doc.updatedAt);
        }
      });
    });
  }

  // INV-6032 full metadata
  const inv = await db.collection('boards').doc(projectId).collection('invoices').doc('jmzQU1IiyC5FUCYG6rxQ').get();
  const invD = inv.data() || {};
  console.log('\n=== INV-6032 metadata ===');
  console.log('createdAt:', invD.createdAt, 'updatedAt:', invD.updatedAt);
  console.log('status:', invD.status, 'sourceProposal:', invD.sourceProposalId || invD.proposalId);
  console.log('fromProposal:', invD.fromProposal, 'generatedFrom:', invD.generatedFrom);
})().catch(e => { console.error(e); process.exit(1); });
