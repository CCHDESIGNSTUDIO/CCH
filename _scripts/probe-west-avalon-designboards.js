#!/usr/bin/env node
'use strict';
const path = require('path');
const admin = require('firebase-admin');
const KEY = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
admin.initializeApp({ credential: admin.credential.cert(require(KEY)) });
const db = admin.firestore();
const PID = 'west-avalon';

(async () => {
  const snap = await db.collection('boards').doc(PID).collection('designBoards').get();
  console.log('designBoards:', snap.size);
  snap.forEach((d) => {
    const x = d.data() || {};
    const els = x.elements || [];
    const withImg = els.filter((e) => e && (e.imageUrl || e.img || (e.images && e.images.length)));
    console.log('\n---', d.id, '|', x.name || x.title, '| room:', x.room);
    console.log('  elements:', els.length, '| with image url:', withImg.length, '| updated:', x.updatedAt);
    els.slice(0, 8).forEach((e, i) => {
      const title = String(e.title || e.text || e.type || '').slice(0, 60);
      const img = String(e.imageUrl || e.img || '').slice(0, 70);
      console.log('   ', i, e.type || 'image', title, img ? '| img' : '| NO IMG');
    });
  });
})();
