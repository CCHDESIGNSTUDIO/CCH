'use strict';
/**
 * READ-ONLY firm-wide: ledger vs sent invoice gaps BY JOB (project).
 * Includes dollar totals, not just hours.
 */
const path = require('path');
const admin = require('firebase-admin');
const KEY = require(path.join(__dirname, '..', '_debug', 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json'));
const db = admin.initializeApp({ credential: admin.credential.cert(KEY) }, 'jobs').firestore();

const str = (v) => String(v == null ? '' : v).trim();
const n = (v) => parseFloat(v) || 0;
const r2 = (v) => Math.round(n(v) * 100) / 100;

function serviceQtyFromItems(items) {
  items = Array.isArray(items) ? items : [];
  let sum = 0;
  items.forEach((it) => {
    if (!it) return;
    if (it.expenseType === 'service' || it.itemType === 'service') {
      sum += n(it.qty != null ? it.qty : it.quantity);
    }
  });
  return r2(sum);
}
function serviceAmtFromItems(items) {
  items = Array.isArray(items) ? items : [];
  let sum = 0;
  items.forEach((it) => {
    if (!it) return;
    if (it.expenseType === 'service' || it.itemType === 'service') sum += n(it.amount);
  });
  return r2(sum);
}

(async () => {
  const snap = await db.collection('timeEntries').get();
  const all = [];
  let withInvId = 0;
  let missingPid = 0;
  snap.forEach((d) => {
    const t = d.data() || {};
    if (!str(t.invoiceId)) return;
    withInvId++;
    const pid = str(t.invoiceProjectId || t.projectId);
    if (!pid) missingPid++;
    all.push({ id: d.id, pid, ...t });
  });

  // invoice groups pid|iid
  const invGroups = {};
  all.forEach((t) => {
    const pid = str(t.invoiceProjectId || t.projectId);
    const iid = str(t.invoiceId);
    if (!pid || !iid) return;
    const key = pid + '|' + iid;
    if (!invGroups[key]) {
      invGroups[key] = {
        pid, iid,
        projectName: str(t.project || t.projectName) || pid,
        invNum: str(t.invoiceNumber || t.invoiceNum),
        ledgerH: 0, ledger$: 0, entries: 0
      };
    }
    const g = invGroups[key];
    g.ledgerH += n(t.hours);
    g.ledger$ += n(t.total);
    g.entries++;
    if (!g.invNum && str(t.invoiceNumber || t.invoiceNum)) g.invNum = str(t.invoiceNumber || t.invoiceNum);
  });

  const invCache = {};
  const keys = Object.keys(invGroups);
  for (let i = 0; i < keys.length; i++) {
    const g = invGroups[keys[i]];
    g.ledgerH = r2(g.ledgerH);
    g.ledger$ = r2(g.ledger$);
    try {
      const invSnap = await db.collection('boards').doc(g.pid).collection('invoices').doc(g.iid).get();
      if (invSnap.exists) {
        const data = invSnap.data() || {};
        invCache[keys[i]] = data;
        g.invNum = g.invNum || str(data.invoiceNum || data.number);
        g.invH = serviceQtyFromItems(data.items);
        g.inv$ = serviceAmtFromItems(data.items);
        g.invTotal$ = r2(n(data.total));
        g.status = str(data.status);
        g.source = str(data.source);
        g.hrsGap = r2(g.ledgerH - g.invH);
        g.$Gap = r2(g.ledger$ - g.inv$);
        g.match = Math.abs(g.hrsGap) < 0.05;
      } else {
        g.invH = 0; g.inv$ = 0; g.hrsGap = g.ledgerH; g.$Gap = g.ledger$; g.match = false; g.missingDoc = true;
      }
    } catch (e) {
      g.error = e.message;
      g.match = false;
    }
  }

  // Roll up BY JOB (project display name)
  const jobs = {};
  keys.forEach((k) => {
    const g = invGroups[k];
    const jobKey = g.projectName || g.pid;
    if (!jobs[jobKey]) {
      jobs[jobKey] = { pid: g.pid, name: jobKey, invoices: [], ledgerH: 0, ledger$: 0, invH: 0, inv$: 0, hrsLeak: 0, $Leak: 0, mismatchCount: 0 };
    }
    const j = jobs[jobKey];
    j.invoices.push(g);
    j.ledgerH = r2(j.ledgerH + g.ledgerH);
    j.ledger$ = r2(j.ledger$ + g.ledger$);
    j.invH = r2(j.invH + (g.invH || 0));
    j.inv$ = r2(j.inv$ + (g.inv$ || 0));
    if (!g.match) {
      j.mismatchCount++;
      if (g.hrsGap > 0.05) j.hrsLeak = r2(j.hrsLeak + g.hrsGap);
      if (g.$Gap > 0.05) j.$Leak = r2(j.$Leak + g.$Gap);
    }
  });

  const jobList = Object.values(jobs).sort((a, b) => b.$Leak - a.$Leak);
  const badJobs = jobList.filter((j) => j.mismatchCount > 0 && (j.hrsLeak > 0.05 || j.$Leak > 0.05));

  console.log('=== FIRM-WIDE: LEDGER vs SENT INVOICE (Studio-linked time) ===');
  console.log('Time entries with invoiceId:', withInvId);
  console.log('Missing invoiceProjectId/projectId:', missingPid);
  console.log('Invoice groups checked:', keys.length);
  console.log('Jobs with at least one mismatch:', badJobs.length);
  console.log('');

  let totalHrsLeak = 0, total$Leak = 0;
  console.log('--- JOBS WITH LEDGER > INVOICE (hours or $ leak) ---');
  badJobs.forEach((j) => {
    totalHrsLeak = r2(totalHrsLeak + j.hrsLeak);
    total$Leak = r2(total$Leak + j.$Leak);
    console.log('');
    console.log(j.name + ' (' + j.pid + ')');
    console.log('  Job totals: ledger ' + j.ledgerH + 'h $' + j.ledger$ + ' | invoice lines ' + j.invH + 'h $' + j.inv$);
    console.log('  Leak (ledger − invoice, positive only): ' + j.hrsLeak + 'h | $' + j.$Leak + ' across ' + j.mismatchCount + ' invoice(s)');
    j.invoices.filter((g) => !g.match).forEach((g) => {
      console.log('    ' + (g.invNum || g.iid) + (g.status ? ' [' + g.status + ']' : '') +
        ' ledger ' + g.ledgerH + 'h $' + g.ledger$ +
        ' | inv ' + (g.invH || 0) + 'h $' + (g.inv$ || 0) +
        ' | gap +' + (g.hrsGap || 0) + 'h $' + (g.$Gap || 0) +
        (g.missingDoc ? ' MISSING DOC' : ''));
    });
  });

  console.log('');
  console.log('--- FIRM TOTAL (positive leak only, ' + badJobs.length + ' jobs) ---');
  console.log('  Hours leak: ' + totalHrsLeak + 'h');
  console.log('  Dollar leak: $' + total$Leak);

  // Also show jobs where invoice > ledger (over-billed on paper)
  const over = jobList.filter((j) => j.mismatchCount > 0 && j.hrsLeak < 0.05 && j.invoices.some((g) => g.hrsGap < -0.05));
  if (over.length) {
    console.log('');
    console.log('--- Jobs where invoice qty > ledger (other direction) ---');
    over.forEach((j) => {
      j.invoices.filter((g) => g.hrsGap < -0.05).forEach((g) => {
        console.log('  ' + j.name + ' ' + (g.invNum || g.iid) + ' ledger ' + g.ledgerH + 'h inv ' + g.invH + 'h (inv higher)');
      });
    });
  }

  // Orphan entries (invoiceId but no board pid)
  if (missingPid) {
    const orphans = {};
    all.filter((t) => !str(t.invoiceProjectId || t.projectId)).forEach((t) => {
      const p = str(t.project || t.projectName) || '(unknown)';
      orphans[p] = (orphans[p] || 0) + 1;
    });
    console.log('');
    console.log('--- Orphan linked entries (no project board id) ---');
    Object.keys(orphans).sort().forEach((p) => console.log('  ' + p + ': ' + orphans[p] + ' entries'));
  }

  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
