#!/usr/bin/env node
'use strict';
/**
 * Set Fisher Sconce Single → Suite 4 on INV-6017 line, clip, and catalog.
 *   node _scripts/fix-fisher-suite4-room_BY_CLAUDE_2026-06-02.js --apply
 */
const path = require('path');
const admin = require('firebase-admin');
const KEY = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
admin.initializeApp({ credential: admin.credential.cert(require(KEY)) });
const db = admin.firestore();
const PID = 'cloud-rolling-hills';
const INV_ID = 'woO4Doh3IHzRuUEXqIhW';
const LINE_IDX = 20;
const CLIP_ID = '0wJ7165xSv4GnpyZXuY7';
const ROOM = 'Suite 4';
const APPLY = process.argv.includes('--apply');

(async () => {
  const invRef = db.collection('boards').doc(PID).collection('invoices').doc(INV_ID);
  const inv = await invRef.get();
  if (!inv.exists) throw new Error('INV-6017 not found');
  const items = JSON.parse(JSON.stringify(inv.data().items || []));
  const line = items[LINE_IDX];
  if (!line || !/fisher sconce/i.test(line.title || '')) throw new Error('Fisher line not at index 20');
  console.log('before line room:', line.room, 'clipId:', line.clipId);
  const clipSnap = await db.collection('boards').doc(PID).collection('clips').doc(CLIP_ID).get();
  if (clipSnap.exists) console.log('before clip room:', clipSnap.data().room);
  if (!APPLY) {
    console.log('Would set room to', ROOM, 'on invoice line, clip, products/');
    return;
  }
  const ts = new Date().toISOString();
  line.room = ROOM;
  if (!line.clipId) line.clipId = CLIP_ID;
  const badLib = String(line.libraryProductId || '') === CLIP_ID;
  if (badLib) {
    const clip = clipSnap.data() || {};
    const realLib = String(clip.libraryProductId || '').trim();
    if (realLib && realLib !== CLIP_ID) line.libraryProductId = realLib;
    else delete line.libraryProductId;
  }
  await invRef.update({ items, updatedAt: ts });
  await db.collection('boards').doc(PID).collection('clips').doc(CLIP_ID).update({ room: ROOM, updatedAt: ts });
  const clip = (await db.collection('boards').doc(PID).collection('clips').doc(CLIP_ID).get()).data() || {};
  const libId = String(clip.libraryProductId || '').trim();
  if (libId && libId !== CLIP_ID) {
    await db.collection('products').doc(libId).set({ room: ROOM, updatedAt: ts }, { merge: true });
    try { await db.collection('productLibrary').doc(libId).set({ room: ROOM, updatedAt: ts }, { merge: true }); } catch (_e) {}
  }
  console.log('Applied Suite 4 to invoice line, clip, catalog');
})();
