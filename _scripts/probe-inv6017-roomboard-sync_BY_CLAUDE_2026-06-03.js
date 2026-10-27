#!/usr/bin/env node
'use strict';
const path = require('path');
const admin = require('firebase-admin');
const KEY = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
admin.initializeApp({ credential: admin.credential.cert(require(KEY)) });
const db = admin.firestore();
const PID = 'cloud-rolling-hills';
const INV_NUM = 'INV-6017';

function hero(x) {
  if (!x) return '';
  if (Array.isArray(x.images) && x.images.length) {
    const im = x.images[0];
    return String(typeof im === 'string' ? im : (im && (im.url || im.imageUrl)) || '').trim();
  }
  return String(x.imageUrl || x.image || '').trim();
}

(async () => {
  let invDoc = null;
  let invId = '';
  const invSnap = await db.collection('boards').doc(PID).collection('invoices').get();
  for (const d of invSnap.docs) {
    const x = d.data() || {};
    const num = String(x.invoiceNum || x.number || x.name || '').trim();
    if (num === INV_NUM || d.id === INV_NUM) {
      invDoc = x;
      invId = d.id;
      break;
    }
  }
  if (!invDoc) {
    console.log('Invoice not found:', INV_NUM);
    process.exit(1);
  }

  console.log('=== INV-6017', invId, '===');
  const items = invDoc.items || [];
  const byRoom = {};
  items.forEach((it, idx) => {
    const room = String(it.room || '').trim() || '(no room)';
    if (!byRoom[room]) byRoom[room] = [];
    byRoom[room].push({ idx, it });
  });

  const clipSnap = await db.collection('boards').doc(PID).collection('clips').get();
  const clipsById = {};
  const clipsByRoom = {};
  clipSnap.forEach((d) => {
    const x = d.data() || {};
    clipsById[d.id] = { id: d.id, ...x };
    const rm = String(x.room || '').trim() || '(no room)';
    if (!clipsByRoom[rm]) clipsByRoom[rm] = [];
    clipsByRoom[rm].push({ id: d.id, ...x });
  });

  for (const room of Object.keys(byRoom).sort()) {
    console.log('\n--- Room:', room, '---');
    for (const { idx, it } of byRoom[room]) {
      const title = String(it.title || it.description || '').trim();
      const cid = String(it.clipId || it.sourceClipId || '').trim();
      const lid = String(it.libraryProductId || it.linkedLibraryProductId || '').trim();
      const img = hero(it);
      console.log('\nINV line', idx, title);
      console.log('  vendor', it.vendor, '| qty', it.qty, '| clipId', cid || '(none)', '| lib', lid || '(none)');
      console.log('  houzzId', it.houzzId || it.houzzProductId || '(none)');
      console.log('  image', img ? img.slice(0, 90) : '(none)');
      if (cid && clipsById[cid]) {
        const c = clipsById[cid];
        console.log('  CLIP MATCH', cid);
        console.log('    clip title', c.title, '| source', c.source, '| room', c.room);
        console.log('    clip image', hero(c) ? hero(c).slice(0, 90) : '(none)');
        console.log('    clip inv', c.invoiceNum || c.invoiceId || '(none)');
        console.log('    image match', hero(c) === img ? 'YES' : 'NO');
      } else if (cid) {
        console.log('  CLIP MISSING', cid);
      }
      // orphan clips same room+title
      const orphans = (clipsByRoom[room] || []).filter((c) => {
        if (cid && c.id === cid) return false;
        return String(c.title || '').toLowerCase().indexOf(title.toLowerCase().slice(0, 12)) >= 0 ||
          title.toLowerCase().indexOf(String(c.title || '').toLowerCase().slice(0, 12)) >= 0;
      });
      if (orphans.length) {
        console.log('  OTHER CLIPS same room/title fragment:', orphans.length);
        orphans.forEach((o) => {
          console.log('   ', o.id, '|', o.title, '| source', o.source, '| lib', o.libraryProductId || '(none)', '| img', hero(o) ? 'yes' : 'NO');
        });
      }
    }
  }

  console.log('\n=== Theater clips summary ===');
  (clipsByRoom['Theater'] || []).forEach((c) => {
    console.log(c.id, '|', c.title, '|', c.source, '| inv', c.invoiceNum || '-', '| clipId on inv?', 'check above');
  });
})();
