#!/usr/bin/env node
'use strict';
const path = require('path');
const admin = require('firebase-admin');
const KEY = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
admin.initializeApp({ credential: admin.credential.cert(require(KEY)) });
const db = admin.firestore();
const PID = 'cloud-rolling-hills';
const IDS = ['96vfHEbDRvk55heQhXb0', 'geF1cwq7euhGuSxRkAbN'];
(async () => {
  for (const id of IDS) {
    const ref = db.collection('boards').doc(PID).collection('clips').doc(id);
    const s = await ref.get();
    if (!s.exists) { console.log('skip', id); continue; }
    const d = s.data() || {};
    await ref.delete();
    console.log('deleted', id, d.title);
    const lib = String(d.libraryProductId || '').trim();
    if (lib) {
      const patch = { room: admin.firestore.FieldValue.delete(), updatedAt: new Date().toISOString() };
      try { await db.collection('products').doc(lib).update(patch); } catch (_e) {}
    }
  }
})();
