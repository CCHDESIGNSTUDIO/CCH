/**
 * READ-ONLY: PRO-3025 lock fields (status, clientApprovedTotalAt, item count).
 */
const path = require('path');
const admin = require('firebase-admin');
const KEY = path.join(
  __dirname,
  '..',
  '_debug',
  'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json'
);
const app = admin.initializeApp({ credential: admin.credential.cert(require(KEY)) }, 'probePro3025');
const db = app.firestore();

function lineInvFlags(it) {
  if (!it || typeof it !== 'object') return false;
  return !!(it.invoiced || it.invoiceId || it.invoiceNum || it.invoicedAt || it.onInvoice);
}

(async () => {
  const projects = ['cloud-rolling-hills'];
  for (const pid of projects) {
    const snap = await db.collection('boards').doc(pid).collection('proposals').get();
    for (const d of snap.docs) {
      const p = d.data() || {};
      const num = String(p.proposalNum || p.number || p.name || '');
      if (!/3025/.test(num) && !/3025/.test(d.id)) continue;
      const items = Array.isArray(p.items) ? p.items : [];
      const approvedLines = items.filter((it) => {
        if (!it) return false;
        const s = String(it.lineApprovalStatus || '').toLowerCase();
        return s === 'approved' || it.approved === true;
      }).length;
      console.log(JSON.stringify({
        projectId: pid,
        docId: d.id,
        proposalNum: num,
        status: p.status || null,
        clientApprovedTotalAt: p.clientApprovedTotalAt || null,
        clientApprovedTotalBy: p.clientApprovedTotalBy || null,
        approvedAt: p.approvedAt || null,
        published: p.published || null,
        itemCount: items.length,
        approvedLineCount: approvedLines,
        invoicedishLineCount: items.filter(lineInvFlags).length,
        total: p.total,
        updatedAt: p.updatedAt || null
      }, null, 2));
      items.forEach(function (it, i) {
        if (!it) return;
        console.log(
          'LINE',
          i,
          String(it.title || '').slice(0, 48),
          'appr=' + (it.lineApprovalStatus || ''),
          'costLock=' + !!it._costLocked,
          'imgLock=' + !!it._imageLocked,
          'libLock=' + !!it.libraryProductIdLocked
        );
      });
    }
  }
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
