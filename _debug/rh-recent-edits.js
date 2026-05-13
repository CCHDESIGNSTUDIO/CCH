/**
 * Find when the broken RH invoices were last modified + who/what touched them.
 * Read-only.
 */
const path = require('path');
const admin = require('firebase-admin');

const SERVICE_ACCOUNT = path.join(__dirname, 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
admin.initializeApp({ credential: admin.credential.cert(require(SERVICE_ACCOUNT)) });
const db = admin.firestore();

const TARGETS = ['IN-12946', 'IN-12902', 'IN-12958', 'IN-12980', 'IN-12948', 'IN-12976', 'IN-12977', 'IN-12978'];

(async () => {
  for (const code of TARGETS) {
    // Find the doc
    const snap = await db.collection('boards').doc('cloud-rolling-hills').collection('invoices').get();
    let foundRef = null, foundData = null;
    snap.forEach(d => {
      const x = d.data();
      const n = String(x.number || x.invoiceNum || d.id).trim().toUpperCase();
      if (n === code) { foundRef = d.ref; foundData = x; }
    });
    if (!foundRef) { console.log(`\n${code}: NOT FOUND`); continue; }

    const snapDoc = await foundRef.get();
    console.log(`\n=== ${code} ===`);
    console.log(`  docId: ${foundRef.id}`);
    console.log(`  Firestore createTime: ${snapDoc.createTime?.toDate().toISOString()}`);
    console.log(`  Firestore updateTime: ${snapDoc.updateTime?.toDate().toISOString()}`);
    console.log(`  Stored fields:`);
    console.log(`    total: $${foundData.total}  paidAmount: $${foundData.paidAmount}  invoiceBalance: $${foundData.invoiceBalance}`);
    console.log(`    status: ${foundData.status}  qbId/qbDocId: ${foundData.qbId || foundData.qbDocId || '(none)'}`);
    console.log(`    lastEditedAt: ${foundData.lastEditedAt || '(none)'}  lastEditedBy: ${foundData.lastEditedBy || '(none)'}`);
    console.log(`    updatedAt: ${foundData.updatedAt || '(none)'}`);
    console.log(`    items count: ${(foundData.items || []).length}`);
    // Markers
    const markers = Object.keys(foundData).filter(k => k.startsWith('_') || k.includes('Backfill') || k.includes('FixedAt') || k.includes('houzz') || k.includes('phase'));
    if (markers.length) {
      console.log(`  Marker / import fields:`);
      for (const m of markers) {
        const v = foundData[m];
        const s = (typeof v === 'object') ? JSON.stringify(v).slice(0, 100) : String(v).slice(0, 100);
        console.log(`    ${m.padEnd(35)} = ${s}`);
      }
    }
    // Activity log if any
    if (Array.isArray(foundData.activityLog) && foundData.activityLog.length) {
      console.log(`  activityLog (last 5 entries):`);
      for (const a of foundData.activityLog.slice(-5)) {
        console.log(`    - ${JSON.stringify(a).slice(0, 200)}`);
      }
    }
  }

  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
