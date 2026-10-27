#!/usr/bin/env node
'use strict';
const path = require('path');
const admin = require('firebase-admin');
const KEY = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
admin.initializeApp({ credential: admin.credential.cert(require(KEY)) });
const db = admin.firestore();
const PID = 'cloud-rolling-hills';

function junkScore(title) {
  const t = String(title || '').trim();
  if (!t) return 0;
  let score = 0;
  if (/^(weight|wattage|total wattage|top to center|extension|height|width|depth|overall weight)/i.test(t)) score += 50;
  if (/weight\s*:/i.test(t)) score += 40;
  if (/provide satisfying|contrast\./i.test(t)) score += 45;
  if (/speak for itself|perfectly together|fluted brass body/i.test(t)) score += 45;
  if (/\d+(\.\d+)?"\s*x\s*\d+/i.test(t) && t.length < 60) score += 40;
  if (/^\.\.\.|^\.\.\./i.test(t) || /\.\.\.\s*$/i.test(t)) score += 30;
  if (/cm\)|in \(\d|\blbs\.?\s*$/i.test(t) && t.length < 70) score += 25;
  return score;
}

(async () => {
  const snap = await db.collection('boards').doc(PID).collection('clips').get();
  console.log('=== Powder 1 clips ===\n');
  for (const d of snap.docs) {
    const x = d.data() || {};
    if (String(x.room || '').trim() !== 'Powder 1') continue;
    const img = String(x.imageUrl || x.image || '').trim();
    console.log('clip', d.id);
    console.log('  title', JSON.stringify(x.title));
    console.log('  vendor', x.vendor);
    console.log('  source', x.source);
    console.log('  houzzId', x.houzzId || x.houzzProductId || '(none)');
    console.log('  libraryProductId', x.libraryProductId || '(none)');
    console.log('  imageUrl', img.slice(0, 90) || '(none)');
    console.log('  desc', String(x.description || '').slice(0, 80));
    console.log('  junkScore', junkScore(x.title));
    console.log('');
  }
})();
