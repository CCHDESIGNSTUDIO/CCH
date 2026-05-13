/**
 * Read full field set on one of the triplicate garbage docs.
 * Look for any timestamp / source / migration field that might reveal when they appeared.
 */
const path = require('path');
const admin = require('firebase-admin');

const SERVICE_ACCOUNT = path.join(__dirname, 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
admin.initializeApp({ credential: admin.credential.cert(require(SERVICE_ACCOUNT)) });
const db = admin.firestore();

const TARGET_IDS = [
  'XNWp2EEyDtcVK1vS4f88',  // "Add a touch of elegant style..." instance 1
  'nJ0oHPIrElp39x5zJNnK',  // instance 2
  'rXIU9dV2JjRKKMHY5bdZ',  // instance 3
  'cnYVgvTks5723gYCufGN',  // "Added gate..." instance 1
  'LbQSpqFYgznZY06TF5En',  // "Additional Plumbing & Elevation" instance 1
];

(async () => {
  for (const id of TARGET_IDS) {
    const ds = await db.collection('productLibrary').doc(id).get();
    if (!ds.exists) { console.log(`${id} — NOT FOUND`); continue; }
    const x = ds.data();
    console.log(`\n=== ${id} ===`);
    for (const k of Object.keys(x).sort()) {
      const v = x[k];
      const sv = (v && typeof v === 'object') ? JSON.stringify(v).slice(0, 100) : String(v).slice(0, 100);
      console.log(`  ${k.padEnd(30)} = ${sv}`);
    }
  }

  // Also: get the createTime metadata via REST shape (admin SDK exposes via doc snapshot)
  console.log(`\n=== Firestore metadata (createTime / updateTime) ===`);
  for (const id of TARGET_IDS) {
    const ref = db.collection('productLibrary').doc(id);
    const snap = await ref.get();
    console.log(`  ${id} createTime=${snap.createTime?.toDate().toISOString()} updateTime=${snap.updateTime?.toDate().toISOString()}`);
  }

  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
