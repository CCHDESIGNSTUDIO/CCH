/**
 * Cloud Mustang PO vendor field audit.
 * For each PO: dump vendor + shipping address + connected docs + tags.
 * Identify how many vendors are actually clients, team members, or shipping addresses.
 */
const path = require('path');
const admin = require('firebase-admin');

const SERVICE_ACCOUNT = path.join(__dirname, 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
admin.initializeApp({ credential: admin.credential.cert(require(SERVICE_ACCOUNT)) });
const db = admin.firestore();

// Known client names / team members / non-vendor strings to flag
const NON_VENDORS = [
  'ron & tracey cloud', 'ron & tracey', 'tracey cloud', 'ron cloud',
  'cindy holloway', 'cindy', 'cynthia holloway', 'cynthia',
  'vanessa holliday', 'vanessa', 'cch design inc', 'cch design',
  'shelley katke', 'shelly katke',
];

(async () => {
  // 1. All POs in cloud-mustang
  const snap = await db.collection('boards').doc('cloud-mustang').collection('purchaseOrders').get();
  console.log(`Cloud Mustang POs: ${snap.size}\n`);

  const vendorCount = {};
  const wrongVendors = [];
  const samples = [];

  snap.forEach(d => {
    const x = d.data();
    const v = String(x.vendor || '').trim();
    vendorCount[v] = (vendorCount[v] || 0) + 1;

    const vLower = v.toLowerCase();
    const isNonVendor = NON_VENDORS.some(n => vLower === n || vLower.includes(n));

    if (isNonVendor) {
      wrongVendors.push({
        number: x.number || x.poNum || d.id,
        vendor: v,
        name: x.name || '',
        items_count: (x.items || []).length,
        total: x.total,
        qbId: x.qbDocId || x.qbId,
        date: x.date || x.createdAt,
      });
    }

    if (samples.length < 5) {
      samples.push({ id: d.id, doc: x });
    }
  });

  console.log('--- Top vendors by frequency (top 25) ---');
  const sorted = Object.entries(vendorCount).sort((a, b) => b[1] - a[1]).slice(0, 25);
  for (const [v, n] of sorted) {
    const tag = NON_VENDORS.some(nv => String(v).toLowerCase().includes(nv)) ? ' ⚠ NON-VENDOR' : '';
    console.log(`  ${String(n).padStart(4)}  "${v}"${tag}`);
  }

  console.log(`\n--- POs with non-vendor in vendor field: ${wrongVendors.length} ---`);
  for (const w of wrongVendors.slice(0, 20)) {
    console.log(`  ${String(w.number).padEnd(12)} vendor="${w.vendor}"  name="${w.name.slice(0,30)}"  total=$${w.total}  qbId=${w.qbId || '(none)'}  date=${w.date}`);
  }
  if (wrongVendors.length > 20) console.log(`  ...and ${wrongVendors.length - 20} more`);

  // 2. Sample PO full field dump to find shipping/billing/connected docs fields
  console.log('\n--- Full field dump: first PO (look for shipping/billing/Houzz original vendor fields) ---');
  const first = samples[0];
  for (const k of Object.keys(first.doc).sort()) {
    const v = first.doc[k];
    if (v == null || v === '' || (Array.isArray(v) && v.length === 0)) continue;
    const s = (typeof v === 'object') ? JSON.stringify(v).slice(0, 120) : String(v).slice(0, 120);
    console.log(`  ${k.padEnd(28)} = ${s}`);
  }

  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
