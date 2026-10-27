// READ-ONLY: inspect the "Designers Moving Service" receiver record(s) for email/phone fields.
const path = require('path');
const admin = require('firebase-admin');
const KEY = require(path.join(__dirname, '..', '_debug', 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json'));
const app = admin.initializeApp({ credential: admin.credential.cert(KEY) }, 'PROD');
const db = app.firestore();

const NEEDLE = 'designers moving';

function show(label, d) {
  const v = d.data() || {};
  const name = v.name || v.company || v.vendor || v.title || d.id;
  if (!String(name).toLowerCase().includes(NEEDLE)) return false;
  console.log('\n=== ' + label + ' / doc ' + d.id + ' ===');
  console.log('name        :', v.name);
  console.log('company     :', v.company);
  console.log('category    :', v.category);
  console.log('type        :', v.type || v.vendorType);
  console.log('role        :', v.role);
  console.log('email       :', JSON.stringify(v.email));
  console.log('contactEmail:', JSON.stringify(v.contactEmail));
  console.log('vendorEmail :', JSON.stringify(v.vendorEmail));
  console.log('phone       :', JSON.stringify(v.phone));
  console.log('contactPhone:', JSON.stringify(v.contactPhone));
  console.log('ALL keys    :', Object.keys(v).join(', '));
  // any field that looks like an email
  Object.keys(v).forEach(function (k) {
    var val = v[k];
    if (typeof val === 'string' && /@/.test(val)) console.log('  ↳ email-like field:', k, '=', val);
  });
  return true;
}

(async () => {
  let hits = 0;
  for (const coll of ['vendors', 'team', 'workrooms']) {
    let snap;
    try { snap = await db.collection(coll).get(); } catch (e) { console.log('skip', coll, e.message); continue; }
    snap.forEach(function (d) { if (show(coll, d)) hits++; });
  }
  if (!hits) console.log('\nNo record matched "' + NEEDLE + '" in vendors/team/workrooms.');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
