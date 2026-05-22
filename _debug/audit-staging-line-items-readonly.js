/**
 * READ-ONLY: Compare invoice/PO line items on staging vs production (Admin SDK).
 * Usage: node audit-staging-line-items-readonly.js [boardId]
 */
'use strict';
const path = require('path');
const admin = require('firebase-admin');

const STAGING_KEY = path.join(__dirname, 'service-account.json', 'cch-studio-staging-firebase-adminsdk-fbsvc-b93c6f1cf4.json');
const PROD_KEY = path.join(__dirname, 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
const BOARD = process.argv[2] || 'cloud-parker';

function countItems(data) {
  const items = data.items || data.lineItems || [];
  return Array.isArray(items) ? items.length : 0;
}

async function auditBoard(db, label, boardId) {
  const out = {};
  for (const sub of ['invoices', 'purchaseOrders', 'proposals']) {
    const snap = await db.collection('boards').doc(boardId).collection(sub).get();
    let docs = 0, empty = 0, withItems = 0, totalLines = 0;
    const samplesEmpty = [];
    const samplesWith = [];
    snap.forEach((d) => {
      docs++;
      const x = d.data();
      const n = countItems(x);
      totalLines += n;
      const num = x.invoiceNum || x.number || x.poNum || x.proposalNum || '';
      if (n === 0) {
        empty++;
        if (samplesEmpty.length < 8) {
          samplesEmpty.push({ id: d.id, num, status: x.status, total: x.total, updatedAt: x.updatedAt, lastEditedBy: x.lastEditedBy });
        }
      } else {
        withItems++;
        if (samplesWith.length < 5) {
          samplesWith.push({ id: d.id, num, lines: n, total: x.total });
        }
      }
    });
    out[sub] = { docs, empty, withItems, totalLines, samplesEmpty, samplesWith };
  }
  return out;
}

async function scanAllBoards(db, label) {
  const boards = await db.collection('boards').get();
  let invDocs = 0, invEmpty = 0, invLines = 0;
  let poDocs = 0, poEmpty = 0, poLines = 0;
  const worst = [];
  for (const b of boards.docs) {
    const name = b.data().name || b.id;
    let bInvE = 0, bInvT = 0, bPoE = 0, bPoT = 0;
    const invSnap = await b.ref.collection('invoices').get();
    invSnap.forEach((d) => {
      invDocs++;
      bInvT++;
      const n = countItems(d.data());
      invLines += n;
      if (n === 0) { invEmpty++; bInvE++; }
    });
    try {
      const poSnap = await b.ref.collection('purchaseOrders').get();
      poSnap.forEach((d) => {
        poDocs++;
        bPoT++;
        const n = countItems(d.data());
        poLines += n;
        if (n === 0) { poEmpty++; bPoE++; }
      });
    } catch (e) {}
    if (bInvT >= 5 && bInvE === bInvT) worst.push({ name, id: b.id, inv: bInvE + '/' + bInvT, po: bPoE + '/' + bPoT });
  }
  return { invDocs, invEmpty, invLines, poDocs, poEmpty, poLines, worst };
}

(async () => {
  const prodApp = admin.initializeApp({ credential: admin.credential.cert(require(PROD_KEY)) }, 'prod');
  const stApp = admin.initializeApp({ credential: admin.credential.cert(require(STAGING_KEY)) }, 'staging');
  const prodDb = prodApp.firestore();
  const stDb = stApp.firestore();

  console.log('=== STAGING vs PROD line items (read-only, Admin SDK) ===');
  console.log('Board:', BOARD, '\n');

  const st = await auditBoard(stDb, 'STAGING', BOARD);
  const pr = await auditBoard(prodDb, 'PRODUCTION', BOARD);

  for (const sub of ['invoices', 'purchaseOrders', 'proposals']) {
    const a = st[sub];
    const b = pr[sub];
    console.log('---', sub.toUpperCase(), '---');
    console.log('  STAGING:    ', a.docs, 'docs |', a.withItems, 'with lines |', a.empty, 'EMPTY |', a.totalLines, 'total lines');
    console.log('  PRODUCTION: ', b.docs, 'docs |', b.withItems, 'with lines |', b.empty, 'EMPTY |', b.totalLines, 'total lines');
    if (a.empty > 0 && a.samplesEmpty.length) {
      console.log('  Staging EMPTY samples (first few):');
      a.samplesEmpty.forEach((s) => console.log('   ', s.num || s.id, 'status=' + s.status, 'total=' + s.total, 'updated=' + (s.updatedAt || '').slice(0, 19)));
    }
    if (a.withItems > 0 && a.samplesWith.length) {
      console.log('  Staging WITH lines:', a.samplesWith.map((s) => (s.num || s.id) + '(' + s.lines + ' lines)').join(', '));
    }
    console.log('');
  }

  console.log('--- ALL BOARDS on STAGING ---');
  const scan = await scanAllBoards(stDb);
  console.log('  Invoices:', scan.invDocs, 'docs |', scan.invEmpty, 'empty (',
    scan.invDocs ? (scan.invEmpty / scan.invDocs * 100).toFixed(1) : 0, '%) |', scan.invLines, 'lines total');
  console.log('  POs:     ', scan.poDocs, 'docs |', scan.poEmpty, 'empty (',
    scan.poDocs ? (scan.poEmpty / scan.poDocs * 100).toFixed(1) : 0, '%) |', scan.poLines, 'lines total');
  if (scan.worst.length) {
    console.log('  Projects where ALL invoices are empty (>=5 inv docs):');
    scan.worst.slice(0, 15).forEach((w) => console.log('   ', w.name, '|', w.id, '| inv', w.inv, '| po', w.po));
  }

  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
