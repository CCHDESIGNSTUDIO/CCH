#!/usr/bin/env node
/** Read-only: why sync reported "no library match" on holtz-hill clips */
const path = require('path');
const admin = require('firebase-admin');
const KEY = path.join(__dirname, 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
admin.initializeApp({ credential: admin.credential.cert(require(KEY)) });
const db = admin.firestore();

const isFb = (u) => /firebasestorage\.googleapis|\.firebasestorage\.app/i.test(String(u || ''));
const isIvy = (u) => /ivy-uploads/i.test(String(u || ''));

(async () => {
  const boardId = 'holtz-hill';
  const clipSnap = await db.collection('boards').doc(boardId).collection('clips').get();
  const libHouzz = new Set();
  const libIds = new Set();
  for (const col of ['productLibrary', 'products']) {
    const snap = await db.collection(col).get();
    snap.forEach((d) => {
      libIds.add(d.id);
      const x = d.data();
      const h = String(x.houzzId || x.houzzProductId || x.catalogId || '').trim();
      if (h) libHouzz.add(h);
    });
  }

  const stats = {
    clips: clipSnap.size,
    firebaseUrl: 0,
    ivyUrl: 0,
    emptyUrl: 0,
    hasHouzzId: 0,
    houzzInLibrary: 0,
    hasLibraryProductId: 0,
    libIdInIndex: 0,
    clipperSource: 0,
    wouldNeedSync: 0,
  };
  const samples = { hasIdNoLib: [], hasFbNoLibMatch: [] };

  clipSnap.forEach((d) => {
    const x = d.data();
    const u = x.imageUrl || x.image || '';
    if (isFb(u)) stats.firebaseUrl++;
    else if (isIvy(u)) stats.ivyUrl++;
    else stats.emptyUrl++;

    const hid = String(x.houzzId || x.houzzProductId || '').trim();
    const lid = String(x.libraryProductId || x.linkedLibraryProductId || '').trim();
    if (hid) {
      stats.hasHouzzId++;
      if (libHouzz.has(hid)) stats.houzzInLibrary++;
      else if (samples.hasIdNoLib.length < 8) {
        samples.hasIdNoLib.push({ title: x.title, houzzId: hid, url: String(u).slice(0, 50) });
      }
    }
    if (lid) {
      stats.hasLibraryProductId++;
      if (libIds.has(lid)) stats.libIdInIndex++;
    }
    if (String(x.source || '').toLowerCase().includes('clip')) stats.clipperSource++;
    if (isIvy(u) || !u || (!isFb(u) && u)) stats.wouldNeedSync++;
    if (isFb(u) && hid && !libHouzz.has(hid) && samples.hasFbNoLibMatch.length < 5) {
      samples.hasFbNoLibMatch.push({ title: x.title, houzzId: hid });
    }
  });

  const invSnap = await db.collection('boards').doc(boardId).collection('invoices').get();
  let invLines = 0;
  let invNoTitle = 0;
  invSnap.forEach((d) => {
    (d.data().items || []).forEach((it) => {
      invLines++;
      if (!String(it.title || '').trim()) invNoTitle++;
    });
  });

  console.log('=== holtz-hill clip image audit (read-only) ===\n');
  console.log('Clips:', stats);
  console.log('\nInvoice line items:', invLines, '(empty title:', invNoTitle + ')');
  console.log('\nLibrary index: houzzIds', libHouzz.size, 'doc ids', libIds.size);
  console.log('\nClip has houzzId but NOT in library houzz index (still may have Firebase URL):');
  samples.hasIdNoLib.forEach((s) => console.log(' ', s));
  console.log('\nClip has Firebase URL + houzzId but houzzId missing from library:');
  samples.hasFbNoLibMatch.forEach((s) => console.log(' ', s));

  const src = {};
  const fields = { houzzId: 0, libraryProductId: 0, imageUrl: 0, image: 0, images: 0 };
  let withAnyImg = 0;
  clipSnap.forEach((d) => {
    const x = d.data();
    const s = String(x.source || '(none)');
    src[s] = (src[s] || 0) + 1;
    Object.keys(fields).forEach((k) => {
      if (x[k]) fields[k]++;
    });
    if (x.imageUrl || x.image || (x.images && x.images.length)) withAnyImg++;
  });
  console.log('\nClip source field breakdown:', src);
  console.log('Field counts:', fields, '| any image field:', withAnyImg, '/', clipSnap.size);
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
