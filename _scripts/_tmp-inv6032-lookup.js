#!/usr/bin/env node
'use strict';
const admin = require('firebase-admin');
const path = require('path');
const KEY = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(require(KEY)) });
const db = admin.firestore();
const projectId = 'cloud-rolling-hills';
const invId = 'jmzQU1IiyC5FUCYG6rxQ';

(async () => {
  const inv = await db.collection('boards').doc(projectId).collection('invoices').doc(invId).get();
  if (!inv.exists) { console.log('INVOICE NOT FOUND'); return; }
  const d = inv.data();
  console.log('=== INVOICE', d.invoiceNum || d.name, invId, '===');
  const items = d.items || [];
  items.forEach((it, i) => {
    const lid = String(it.libraryProductId || it.linkedLibraryProductId || '').trim();
    console.log('--- line', i, '---');
    console.log('title:', (it.title || it.name || '').slice(0, 100));
    console.log('libraryProductId:', lid || '(none)');
    console.log('libraryProductIdLocked:', it.libraryProductIdLocked, it._libraryProductIdLocked);
    console.log('clipId:', it.clipId || it.sourceClipId || '(none)');
    console.log('imageUrl:', (it.imageUrl || '').slice(0, 120));
    console.log('images:', Array.isArray(it.images) ? it.images.length + ' imgs' : it.images);
    if (Array.isArray(it.images) && it.images.length) {
      console.log('  first:', JSON.stringify(it.images[0]).slice(0, 150));
    }
    console.log('imageUrlOverride:', it.imageUrlOverride);
    console.log('category:', it.category, 'room:', it.room, 'vendor:', it.vendor);
  });

  const clipId = 'rOPcgZOtBfQxocbabgYx';
  const clip = await db.collection('boards').doc(projectId).collection('clips').doc(clipId).get();
  if (clip.exists) {
    const c = clip.data();
    console.log('=== CLIP', clipId, '===');
    console.log('title:', (c.title || '').slice(0, 100));
    console.log('libraryProductId:', c.libraryProductId || c.linkedLibraryProductId);
    console.log('imageUrl:', (c.imageUrl || '').slice(0, 120));
    console.log('images:', Array.isArray(c.images) ? c.images.length : 0);
    if (Array.isArray(c.images) && c.images[0]) console.log('  first:', JSON.stringify(c.images[0]).slice(0, 150));
  } else {
    console.log('CLIP not found:', clipId);
  }

  const line = items[0] || {};
  const lid = String(line.libraryProductId || line.linkedLibraryProductId || '').trim();
  const clipLid = clip.exists
    ? String((clip.data().libraryProductId || clip.data().linkedLibraryProductId || '')).trim()
    : '';
  const idsToCheck = [...new Set([lid, clipLid].filter(Boolean))];
  for (const id of idsToCheck) {
    for (const col of ['productLibrary', 'productLibrary_archive', 'products', 'products_archive']) {
      const doc = await db.collection('boards').doc(projectId).collection(col).doc(id).get();
      if (doc.exists) {
        const p = doc.data();
        console.log('=== FOUND in', col, id, '===');
        console.log('title:', (p.title || p.name || '').slice(0, 100));
        console.log('imageUrl:', (p.imageUrl || '').slice(0, 120));
        console.log('_quarantinedAt:', p._quarantinedAt);
        console.log('_archiveReason:', p._archiveReason);
        console.log('_quarantineScript:', p._quarantineScript);
      }
    }
  }

  const slugId = 'modern_cabinet_hardware_collection7__modern_rectangular_flush_pull_in_french_antique_brass_by_emtek__myknobs__hardware__';
  const clipLibId = 'BkdoqNhZnYmlfg7RJ0uD';
  async function checkLibId(id, label) {
    console.log('=== ID lookup:', label || id, '===');
    let foundAny = false;
    for (const col of ['productLibrary', 'productLibrary_archive', 'products', 'products_archive']) {
      const doc = await db.collection(col).doc(id).get();
      console.log(' ', col, doc.exists ? 'EXISTS' : 'missing');
      if (doc.exists) {
        foundAny = true;
        const p = doc.data();
        console.log('   title:', (p.title || p.name || '').slice(0, 80));
        console.log('   project:', p.project, 'projectId:', p.projectId);
        console.log('   imageUrl:', (p.imageUrl || '').slice(0, 100));
        console.log('   _quarantinedAt:', p._quarantinedAt);
        console.log('   _archiveReason:', p._archiveReason);
      }
    }
    if (!foundAny) console.log('   NOT FOUND in any root collection');
  }

  for (const id of [...new Set([...idsToCheck, slugId, clipLibId])]) {
    await checkLibId(id);
  }

  const titleExact = items[0] && (items[0].title || items[0].name);
  if (titleExact) {
    for (const col of ['productLibrary_archive', 'products_archive', 'productLibrary', 'products']) {
      const snap = await db.collection(col)
        .where('title', '==', titleExact).limit(3).get();
      if (snap.size) {
        console.log('=== title match in', col, '===');
        snap.forEach(d => console.log(' ', d.id, d.data()._quarantinedAt));
      }
    }
  }
})().catch(e => { console.error(e); process.exit(1); });
