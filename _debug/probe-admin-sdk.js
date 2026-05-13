/**
 * Test Firebase Admin SDK with the dropped service account.
 * Probes: Firestore read, Storage upload, public URL generation.
 */
const path = require('path');
const admin = require('firebase-admin');

const SERVICE_ACCOUNT = path.join(__dirname, 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
const BUCKET = 'cch-design-boards.firebasestorage.app';

admin.initializeApp({
  credential: admin.credential.cert(require(SERVICE_ACCOUNT)),
  storageBucket: BUCKET,
});

(async () => {
  // 1. Firestore read
  console.log('=== Firestore read (admin) ===');
  const ds = await admin.firestore().doc('boards/_lib_designer').get();
  console.log('  _lib_designer exists:', ds.exists, ' name:', ds.data()?.name || '(none)');

  // 2. Storage upload (real file from Niice_Organized)
  console.log('\n=== Storage upload (admin) ===');
  const fs = require('fs');
  const fileSrc = path.join('C:\\Users\\cindy\\Dropbox\\CCH-Platform-Deploy\\Niice_Organized\\Lighting & Fixtures\\Alicia Wall Sconce_Arteriors.JPG');
  if (!fs.existsSync(fileSrc)) {
    console.log('  test source file missing:', fileSrc);
    process.exit(1);
  }
  const destPath = `_lib_designer/_test/${Date.now()}-Alicia.jpg`;
  const bucket = admin.storage().bucket();
  await bucket.upload(fileSrc, {
    destination: destPath,
    metadata: { contentType: 'image/jpeg', metadata: { source: 'admin-probe' } },
    public: false,
  });
  console.log('  uploaded:', destPath);

  // 3. Get public download URL via signed URL (long-lived)
  const file = bucket.file(destPath);
  // Make publicly readable so the platform can hotlink without auth
  await file.makePublic();
  const publicUrl = `https://storage.googleapis.com/${BUCKET}/${encodeURI(destPath)}`;
  console.log('  public URL:', publicUrl);

  // 4. Verify the URL works (HEAD)
  const fetch = (await import('node-fetch')).default;
  const headRes = await fetch(publicUrl, { method: 'HEAD' });
  console.log('  HEAD status:', headRes.status, headRes.headers.get('content-type'));

  console.log('\n=== ALL CHECKS PASSED ✓ ===');
  process.exit(0);
})().catch(e => { console.error('FAILED:', e); process.exit(1); });
