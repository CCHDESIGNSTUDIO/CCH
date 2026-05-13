/**
 * Are QB IDs in Studio under a different field name?
 * For known Houzz QB IDs (PO-12913 → 74201, IN-12974 → 74412, etc.),
 * search every field on the matching Studio doc.
 *
 * Also dump all unique field names across Studio Katke docs.
 */
const path = require('path');
const XLSX = require('xlsx');
const admin = require('firebase-admin');

const SERVICE_ACCOUNT = path.join(__dirname, 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
admin.initializeApp({ credential: admin.credential.cert(require(SERVICE_ACCOUNT)) });
const db = admin.firestore();

const HOUZZ_FILE = String.raw`C:\Users\cindy\Dropbox\Claude - CCH studio\Houzz FILES\Project Trackers\Katke - Graceland All Transactions.xlsx`;
const BOARD_ID = 'katke-graceland-dr';

(async () => {
  // 1. Parse Houzz QB ID lookups
  const wb = XLSX.readFile(HOUZZ_FILE);
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' });
  const houzzQbByCode = new Map();
  for (let i = 5; i < rows.length; i++) {
    const code = String(rows[i][2] || '').trim().toUpperCase();
    const qb = String(rows[i][27] || '').trim();
    if (code && qb) houzzQbByCode.set(code, qb);
  }
  console.log(`Houzz has QB IDs for: ${houzzQbByCode.size} codes`);

  // 2. Pull every Studio doc field
  const fieldFreq = new Map();
  const studioDocsByCode = new Map();
  for (const sub of ['invoices', 'purchaseOrders', 'proposals']) {
    const snap = await db.collection('boards').doc(BOARD_ID).collection(sub).get();
    snap.forEach(d => {
      const x = d.data();
      const code = String(x.number || x.invoiceNum || x.proposalNum || x.poNum || d.id).trim().toUpperCase();
      studioDocsByCode.set(code, { sub, docId: d.id, x });
      for (const k of Object.keys(x)) fieldFreq.set(k, (fieldFreq.get(k) || 0) + 1);
    });
  }

  // 3. List every field name that exists with "qb" or "quickbooks" or "doc" or "id" in name
  console.log('\n--- All Studio fields containing qb/quickbooks/docid/external (case-insensitive) ---');
  for (const [k, n] of [...fieldFreq.entries()].sort((a, b) => b[1] - a[1])) {
    if (/qb|quickbooks|docid|doc_id|external/i.test(k)) {
      console.log(`  ${k.padEnd(30)} on ${n} docs`);
    }
  }

  // 4. For known Houzz QB IDs, look up the matching Studio doc and scan EVERY field for that value
  console.log('\n--- QB ID scan: are Houzz QB IDs hiding in any field on the matching Studio doc? ---');
  const testCodes = ['PO-12913', 'PO-12895', 'IN-12974', 'IN-12936', 'PO-10053', 'PO-12869', 'PO-12896'];
  for (const code of testCodes) {
    const houzzQb = houzzQbByCode.get(code);
    const studio = studioDocsByCode.get(code);
    if (!houzzQb) { console.log(`  ${code}: no QB ID in Houzz`); continue; }
    if (!studio) { console.log(`  ${code}: not in Studio`); continue; }
    let found = [];
    for (const [k, v] of Object.entries(studio.x)) {
      if (v == null) continue;
      const s = String(v);
      if (s === houzzQb || s.includes(houzzQb)) found.push(`${k}="${s.slice(0,40)}"`);
    }
    console.log(`  ${code.padEnd(12)} houzzQB=${houzzQb}  matching fields on Studio doc: ${found.length ? found.join(', ') : '(none — really missing)'}`);
  }

  // 5. Sample dump of every field on PO-12913 (one of the test codes)
  const sample = studioDocsByCode.get('PO-12913');
  if (sample) {
    console.log(`\n--- Full field dump: PO-12913 (Studio ${sample.sub}/${sample.docId}) ---`);
    for (const k of Object.keys(sample.x).sort()) {
      const v = sample.x[k];
      if (v == null || v === '' || v === 0 || (Array.isArray(v) && v.length === 0)) continue;
      const s = (typeof v === 'object') ? JSON.stringify(v).slice(0, 100) : String(v).slice(0, 100);
      console.log(`  ${k.padEnd(28)} = ${s}`);
    }
  }

  // 6. Universal count: how many Studio Katke docs have ANY field with a numeric value matching a Houzz QB ID pattern (4-6 digits)?
  let docsWithLikelyQB = 0;
  for (const [, info] of studioDocsByCode) {
    for (const v of Object.values(info.x)) {
      if (v == null) continue;
      const s = String(v);
      if (/^\d{4,6}$/.test(s)) { docsWithLikelyQB++; break; }
    }
  }
  console.log(`\nStudio docs with ANY field matching a 4-6 digit number pattern (potential QB ID): ${docsWithLikelyQB} / ${studioDocsByCode.size}`);

  process.exit(0);
})().catch(e => { console.error('FAILED:', e); process.exit(1); });
