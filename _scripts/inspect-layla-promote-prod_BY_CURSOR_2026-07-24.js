/**
 * Read-only: find Layla (or similar) on production Cloud Rolling Hills inspiration
 * and report libraryProductId / linked products/clips.
 *
 * Usage:
 *   node _scripts/inspect-layla-promote-prod_BY_CURSOR_2026-07-24.js
 *   node _scripts/inspect-layla-promote-prod_BY_CURSOR_2026-07-24.js --q=layla
 */
'use strict';
const path = require('path');
const admin = require('firebase-admin');

const KEY = path.join(
  __dirname,
  '..',
  '_debug',
  'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json'
);
const BOARD = 'cloud-rolling-hills';
const qArg = (process.argv.find((a) => a.startsWith('--q=')) || '--q=layla').slice(4).toLowerCase();

const app = admin.initializeApp({ credential: admin.credential.cert(require(KEY)) }, 'laylaInsp');
const db = app.firestore();

function titleOf(img) {
  return String((img && (img.caption || img.title || img.name)) || '').trim();
}

async function main() {
  console.log('PROD project: cch-design-boards');
  console.log('Board:', BOARD);
  console.log('Search:', qArg);
  console.log('---');

  const ibSnap = await db.collection('boards').doc(BOARD).collection('ideabooks').get();
  const hits = [];
  ibSnap.forEach((d) => {
    const data = d.data() || {};
    const images = Array.isArray(data.images) ? data.images : [];
    images.forEach((img, idx) => {
      if (!img || typeof img !== 'object') return;
      const t = titleOf(img);
      const blob = [t, img.vendor, img.libraryProductId, img.roomClipId, img.imageUrl]
        .map((x) => String(x || '').toLowerCase())
        .join(' ');
      if (blob.indexOf(qArg) < 0 && t.toLowerCase().indexOf(qArg) < 0) return;
      hits.push({
        sectionId: d.id,
        sectionName: data.name || d.id,
        index: idx,
        caption: t,
        vendor: img.vendor || '',
        libraryProductId: img.libraryProductId || img.linkedLibraryProductId || '',
        roomClipId: img.roomClipId || '',
        promotedRoom: img.promotedRoom || '',
        promotedAt: img.promotedAt || '',
        imageUrl: String(img.imageUrl || '').slice(0, 120),
        pageUrl: img.sourceUrl || img.pageUrl || img.productUrl || img.clippedFromUrl || ''
      });
    });
  });

  console.log('Inspiration hits:', hits.length);
  for (const h of hits) {
    console.log('\n=== PIN ===');
    console.log(JSON.stringify(h, null, 2));
    const lid = String(h.libraryProductId || '').trim();
    if (lid) {
      const ps = await db.collection('products').doc(lid).get();
      if (!ps.exists) {
        console.log('LINKED products/' + lid + ' — MISSING (orphan link)');
      } else {
        const p = ps.data() || {};
        console.log('LINKED products/' + lid, {
          title: p.title || '',
          vendor: p.vendor || '',
          category: p.category || '',
          projectId: p.projectId || '',
          imageUrl: String(p.imageUrl || '').slice(0, 120),
          inspirationSource: p.inspirationSource || '',
          updatedAt: p.updatedAt || ''
        });
      }
    } else {
      console.log('No libraryProductId on pin');
    }
    const cid = String(h.roomClipId || '').trim();
    if (cid) {
      const cs = await db.collection('boards').doc(BOARD).collection('clips').doc(cid).get();
      if (!cs.exists) console.log('roomClipId', cid, '— MISSING');
      else {
        const c = cs.data() || {};
        console.log('CLIP', cid, {
          title: c.title || '',
          vendor: c.vendor || '',
          room: c.room || '',
          libraryProductId: c.libraryProductId || '',
          imageUrl: String(c.imageUrl || '').slice(0, 120)
        });
      }
    }
  }

  // Also search products titled Layla on this project
  const prodHits = [];
  const pSnap = await db.collection('products').where('projectId', '==', BOARD).limit(500).get();
  pSnap.forEach((d) => {
    const p = d.data() || {};
    const t = String(p.title || '').toLowerCase();
    if (t.indexOf(qArg) >= 0) {
      prodHits.push({
        id: d.id,
        title: p.title || '',
        vendor: p.vendor || '',
        imageUrl: String(p.imageUrl || '').slice(0, 100),
        inspirationSource: p.inspirationSource || ''
      });
    }
  });
  console.log('\n=== products/ with title matching "' + qArg + '" for this project ===');
  console.log(prodHits.length ? JSON.stringify(prodHits, null, 2) : '(none)');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
