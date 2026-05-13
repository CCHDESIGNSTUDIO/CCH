/**
 * Patch the Whitesail backfilled invoices + POs with missing top-level
 * fields that Studio's renderer expects (so the rows show date, balance,
 * etc. instead of blank). Does NOT touch items[] — line-item backfill
 * is a separate pass.
 *
 * Default: dry-run. Pass --apply to write.
 */
const path = require('path');
const admin = require('firebase-admin');
const SA = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
admin.initializeApp({ credential: admin.credential.cert(require(SA)) });
const db = admin.firestore();
const APPLY = process.argv.includes('--apply');
const SOURCE = 'houzz-0427-backfill';

(async () => {
  console.log('Mode:', APPLY ? 'APPLY' : 'DRY-RUN');
  const ref = db.collection('boards').doc('31-whitesail');

  // Invoices: add date, balance, paymentCount, source
  const invSnap = await ref.collection('invoices').where('_source', '==', SOURCE).get();
  console.log(`\nBackfilled invoices: ${invSnap.size}`);
  for (const d of invSnap.docs) {
    const x = d.data();
    const dateStr = (x.createdAt || '').slice(0, 10) || (x.datePaid || '').slice(0, 10);
    const total = Number(x.total) || 0;
    const paid = Number(x.paidAmount) || 0;
    const patch = {
      date: dateStr,
      balance: Math.max(0, total - paid),
      paymentCount: (x.payments || []).length,
      source: SOURCE,
      notes: x.terms || '',
      lastEditedAt: new Date().toISOString(),
      lastEditedBy: 'Houzz 0427 backfill',
      lastEditedByEmail: 'cindy@cchdesign.com'
    };
    console.log(`  ${d.id} #${x.invoiceNum} +date=${patch.date} +balance=$${patch.balance} +paymentCount=${patch.paymentCount}`);
    if (APPLY) await d.ref.update(patch);
  }

  // POs: add date + try to fill vendor from clip lookup if title matches
  const poSnap = await ref.collection('purchaseOrders').where('_source', '==', SOURCE).get();
  console.log(`\nBackfilled POs: ${poSnap.size}`);

  // Load clips to match PO names → vendor
  const clipsSnap = await ref.collection('clips').get();
  const clipByTitle = {};
  clipsSnap.forEach(c => {
    const cx = c.data();
    const t = String(cx.title || cx.name || '').trim().toLowerCase();
    if (t) clipByTitle[t] = cx;
  });

  for (const d of poSnap.docs) {
    const x = d.data();
    const dateStr = (x.createdAt || '').slice(0, 10);
    const total = Number(x.total) || 0;
    const paid = Number(x.paidAmount) || 0;

    // Try vendor match: PO name like "Lighting- Otto Small Flush Mount" →
    // strip "Lighting- " prefix and try clip lookup
    let vendor = '';
    let matchedClipTitle = '';
    const rawName = String(x.name || '').trim();
    const stripped = rawName.replace(/^[A-Za-z]+\-\s*/, '').toLowerCase();
    for (const k of Object.keys(clipByTitle)) {
      if (k.includes(stripped) || stripped.includes(k)) {
        vendor = clipByTitle[k].vendor || clipByTitle[k].manufacturer || '';
        matchedClipTitle = clipByTitle[k].title || clipByTitle[k].name || '';
        break;
      }
    }

    const patch = {
      date: dateStr,
      balance: Math.max(0, total - paid),
      source: SOURCE,
      vendor: vendor || '',
      lastEditedAt: new Date().toISOString(),
      lastEditedBy: 'Houzz 0427 backfill',
      lastEditedByEmail: 'cindy@cchdesign.com'
    };
    console.log(`  ${d.id} #${x.poNum} "${rawName.slice(0,40)}" +date=${patch.date} +vendor="${patch.vendor || '(none)'}" (matched clip: ${matchedClipTitle.slice(0,40) || '—'})`);
    if (APPLY) await d.ref.update(patch);
  }

  if (!APPLY) console.log('\nDRY-RUN. Re-run with --apply to write.');
  process.exit(0);
})();
