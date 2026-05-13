/**
 * Find INV-6022 anywhere it exists + time entries that reference it.
 * Read-only.
 */
const path = require('path');
const admin = require('firebase-admin');

const SERVICE_ACCOUNT = path.join(__dirname, 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
admin.initializeApp({ credential: admin.credential.cert(require(SERVICE_ACCOUNT)) });
const db = admin.firestore();

const VARIANTS = ['INV-6022', 'IN-6022', '6022', 'inv-6022', 'in-6022'];

(async () => {
  // 1. List Katke-named boards/projects
  console.log('=== Katke-named boards ===');
  const boardsSnap = await db.collection('boards').get();
  const katkeBoards = [];
  boardsSnap.forEach(d => {
    const x = d.data();
    const name = (x.name || '').toLowerCase();
    if (name.includes('katke') || d.id.toLowerCase().includes('katke')) {
      katkeBoards.push({ id: d.id, name: x.name || '(none)', clientName: x.clientName || x.client || '(none)' });
    }
  });
  for (const b of katkeBoards) {
    console.log(`  id=${b.id.padEnd(30)}  name="${b.name}"  client="${b.clientName}"`);
  }

  // 2. Search /invoices/ (global) and each board's invoices for INV-6022 variants
  console.log('\n=== Global /invoices/ collection ===');
  const globalInvSnap = await db.collection('invoices').get();
  console.log(`  total: ${globalInvSnap.size}`);
  globalInvSnap.forEach(d => {
    const x = d.data();
    const candidates = [x.number, x.invoiceNum, x.invoiceNumber, d.id].filter(Boolean).map(v => String(v));
    if (candidates.some(c => VARIANTS.some(v => c.toUpperCase().includes(v.toUpperCase()))) ) {
      console.log(`  MATCH: id=${d.id}`);
      console.log(`    number=${x.number}  invoiceNum=${x.invoiceNum}  projectId=${x.projectId}  projectName=${x.projectName || x.project}`);
      console.log(`    status=${x.status}  total=${x.total}  paidAmount=${x.paidAmount}  createdAt=${x.createdAt}`);
    }
  });

  // 3. Search every Katke board's invoices subcollection
  console.log('\n=== Per-board invoices subcollection for each Katke board ===');
  for (const b of katkeBoards) {
    try {
      const snap = await db.collection('boards').doc(b.id).collection('invoices').get();
      let matched = 0;
      snap.forEach(d => {
        const x = d.data();
        const candidates = [x.number, x.invoiceNum, x.invoiceNumber, d.id].filter(Boolean).map(v => String(v));
        if (candidates.some(c => VARIANTS.some(v => c.toUpperCase().includes(v.toUpperCase())))) {
          matched++;
          console.log(`  [${b.id}/invoices/${d.id}]  number=${x.number}  invoiceNum=${x.invoiceNum}  total=${x.total}  status=${x.status}  createdAt=${x.createdAt}`);
        }
      });
      console.log(`  ${b.id}/invoices  total=${snap.size}  matched=${matched}`);
    } catch (e) {
      console.log(`  ${b.id}/invoices  error: ${e.message}`);
    }
  }

  // 4. Search timeEntries collection for any reference to INV-6022
  console.log('\n=== timeEntries with invoiceNumber referencing 6022 ===');
  try {
    const teSnap = await db.collection('timeEntries').where('invoiceNumber', 'in', VARIANTS).get();
    console.log(`  exact-match timeEntries: ${teSnap.size}`);
    let n = 0;
    teSnap.forEach(d => {
      if (n++ < 10) {
        const x = d.data();
        console.log(`    id=${d.id}  invoiceNumber=${x.invoiceNumber}  project=${x.project}  projectId=${x.projectId}  member=${x.member || x.memberName}  hours=${x.hours}  date=${x.date}`);
      }
    });
  } catch (e) {
    console.log(`  error: ${e.message}`);
  }

  // 5. Also search timeEntries fuzzy — any field containing 6022
  console.log('\n=== Fuzzy scan timeEntries for "6022" in any string field (sample of 5000) ===');
  try {
    const teSnap = await db.collection('timeEntries').limit(5000).get();
    let matchCount = 0;
    teSnap.forEach(d => {
      const x = d.data();
      for (const k of Object.keys(x)) {
        const v = x[k];
        if (typeof v === 'string' && v.includes('6022')) {
          matchCount++;
          if (matchCount <= 5) console.log(`    id=${d.id}  field=${k}  value="${v.slice(0, 60)}"  invoiceNumber=${x.invoiceNumber}  project=${x.project}`);
          break;
        }
      }
    });
    console.log(`  fuzzy matches (out of ${teSnap.size} scanned): ${matchCount}`);
  } catch (e) {
    console.log(`  error: ${e.message}`);
  }

  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
