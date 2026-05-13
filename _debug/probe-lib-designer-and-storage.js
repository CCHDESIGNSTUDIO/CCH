/**
 * Two probes:
 *  1. Does boards/_lib_designer exist? Has Cynthia logged in as admin yet?
 *  2. Can we upload a tiny image to Firebase Storage without auth? Tests the rules.
 */
const fs = require('fs');
const path = require('path');
const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc, collection, getDocs } = require('firebase/firestore');
const { getStorage, ref, uploadBytes, getDownloadURL } = require('firebase/storage');

const PROD = {
  apiKey: 'AIzaSyAd24U5ArVGrA24IxNcYD2NYiTVycyF4og',
  authDomain: 'cch-design-boards.firebaseapp.com',
  projectId: 'cch-design-boards',
  storageBucket: 'cch-design-boards.firebasestorage.app',
  messagingSenderId: '210388013080',
  appId: '1:210388013080:web:cch-design-boards',
};

(async () => {
  const app = initializeApp(PROD);
  const db = getFirestore(app);

  // 1. Probe _lib_designer
  console.log('=== boards/_lib_designer ===');
  try {
    const ds = await getDoc(doc(db, 'boards', '_lib_designer'));
    if (ds.exists()) {
      const x = ds.data();
      console.log('  EXISTS');
      console.log('  name:        ', x.name || '(none)');
      console.log('  status:      ', x.status || '(none)');
      console.log('  archived:    ', x.archived || false);
      console.log('  createdAt:   ', x.createdAt || '(none)');
      console.log('  description: ', x.description || '(none)');
    } else {
      console.log('  DOES NOT EXIST — Cynthia hasn\'t triggered the auto-create on admin login yet');
      console.log('  We can either: (a) create it manually here, or (b) wait until she logs in');
    }
  } catch (e) {
    console.log('  ERROR:', e.code || e.message);
  }

  // Existing ideabooks count if any
  try {
    const snap = await getDocs(collection(db, 'boards', '_lib_designer', 'ideabooks'));
    console.log('  existing ideabooks:', snap.size);
  } catch (e) {
    console.log('  ideabooks read error:', e.code || e.message);
  }

  // 2. Probe Storage upload
  console.log('\n=== Firebase Storage upload test ===');
  const storage = getStorage(app);

  // Tiny 1x1 transparent PNG (67 bytes)
  const tinyPng = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
    0x89, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x44, 0x41,
    0x54, 0x78, 0x9c, 0x62, 0x00, 0x01, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00,
    0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
    0x42, 0x60, 0x82,
  ]);

  const testPath = `_test/probe-${Date.now()}.png`;
  const r = ref(storage, testPath);
  try {
    const result = await uploadBytes(r, tinyPng, { contentType: 'image/png' });
    console.log('  UPLOAD OK');
    console.log('  full path:', result.ref.fullPath);
    console.log('  bucket:   ', result.ref.bucket);
    try {
      const url = await getDownloadURL(r);
      console.log('  download URL:', url.slice(0, 100) + '...');
    } catch (e) {
      console.log('  getDownloadURL failed:', e.code || e.message);
    }
  } catch (e) {
    console.log('  UPLOAD FAILED:', e.code || e.message);
    console.log('  → need auth or service account; rules require authenticated user');
  }

  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
