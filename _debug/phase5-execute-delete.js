/**
 * PHASE 5 EXECUTE — Delete the 213 expense/non-product candidates from /products/ + /productLibrary/.
 * Reads phase5-expense-candidates.csv. Batched deletes. Outputs phase5-deleted.csv as audit trail.
 *
 * Storage rules MUST be temp-relaxed for /products/ + /productLibrary/ delete.
 */
const fs = require('fs');
const path = require('path');
const { initializeApp } = require('firebase/app');
const { getFirestore, doc, writeBatch } = require('firebase/firestore');

const PROD = {
  apiKey: 'AIzaSyAd24U5ArVGrA24IxNcYD2NYiTVycyF4og',
  authDomain: 'cch-design-boards.firebaseapp.com',
  projectId: 'cch-design-boards',
  storageBucket: 'cch-design-boards.firebasestorage.app',
  messagingSenderId: '210388013080',
  appId: '1:210388013080:web:cch-design-boards',
};

const IN_CSV = path.join(__dirname, 'phase5-expense-candidates.csv');
const OUT_CSV = path.join(__dirname, 'phase5-deleted.csv');

function csvEsc(v) { if (v == null) return ''; const s = String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
function parseCSV(t) { const rows=[]; let row=[]; let cur=''; let q=false; for (let i=0;i<t.length;i++){const c=t[i]; if(q){if(c==='"'){if(t[i+1]==='"'){cur+='"';i++}else q=false}else cur+=c} else{if(c==='"')q=true; else if(c===','){row.push(cur);cur=''} else if(c==='\r'){} else if(c==='\n'){row.push(cur);rows.push(row);row=[];cur=''} else cur+=c}} if(cur||row.length){row.push(cur);rows.push(row)} return rows; }

(async () => {
  console.log('PHASE 5 EXECUTE — Delete expense/non-product items\n');

  const text = fs.readFileSync(IN_CSV, 'utf-8');
  const rows = parseCSV(text);
  const header = rows[0];
  const idIdx = header.indexOf('studioId');
  const colIdx = header.indexOf('collection');
  const titleIdx = header.indexOf('title');
  const reasonIdx = header.indexOf('reason');

  const items = rows.slice(1).filter(r => r.length > 1 && r[idIdx]).map(r => ({
    id: r[idIdx], collection: r[colIdx], title: r[titleIdx] || '', reason: r[reasonIdx] || ''
  }));
  console.log(`  ${items.length} candidates loaded from manifest`);

  const app = initializeApp(PROD);
  const db = getFirestore(app);

  // Group by collection so each batch only touches one
  const byColl = { products: [], productLibrary: [] };
  for (const it of items) {
    if (byColl[it.collection]) byColl[it.collection].push(it);
  }

  const deleted = [];
  const failed = [];
  const BATCH = 400;
  for (const colName of Object.keys(byColl)) {
    const list = byColl[colName];
    if (!list.length) continue;
    console.log(`\n/${colName}/: deleting ${list.length}...`);
    for (let i = 0; i < list.length; i += BATCH) {
      const slice = list.slice(i, i + BATCH);
      const batch = writeBatch(db);
      for (const it of slice) batch.delete(doc(db, colName, it.id));
      try {
        await batch.commit();
        for (const it of slice) deleted.push({ ...it });
        console.log(`  deleted ${Math.min(i + BATCH, list.length)}/${list.length}`);
      } catch (e) {
        console.error(`  batch failed: ${e.message}`);
        for (const it of slice) failed.push({ ...it, error: e.message });
      }
    }
  }

  // Audit CSV
  const csv = ['studioId,collection,title,reason,status,error'];
  for (const d of deleted) csv.push([d.id, d.collection, d.title, d.reason, 'deleted', ''].map(csvEsc).join(','));
  for (const f of failed) csv.push([f.id, f.collection, f.title, f.reason, 'failed', f.error || ''].map(csvEsc).join(','));
  fs.writeFileSync(OUT_CSV, csv.join('\n'));

  console.log(`\nDONE. Deleted ${deleted.length}. Failed ${failed.length}.`);
  console.log(`Audit: ${OUT_CSV}`);
  process.exit(0);
})().catch(e => { console.error('FAILED:', e); process.exit(1); });
