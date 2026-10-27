'use strict';
/**
 * Staging ONLY — restore wiped Rami Mirror line on PRO-3017 (Katke).
 * Evidence: proposal total 1757.7 − Floral Charm 1336.5 = 421.2 (= 312 × 1.35);
 * activityLog Line 1+2 approved; tags Wallpaper & Mirror; linked INV-6026 has Rami Mirror.
 * Pass --apply to write.
 */
const path = require('path');
const admin = require('firebase-admin');
const KEY = path.join(
  __dirname,
  '..',
  '_debug',
  'service-account.json',
  'cch-studio-staging-firebase-adminsdk-fbsvc-b93c6f1cf4.json'
);
const db = admin.initializeApp({ credential: admin.credential.cert(require(KEY)) }, 'restore3017').firestore();
const APPLY = process.argv.includes('--apply');
const PID = 'katke-graceland-dr';
const DOC = 'vZ4zDr6atCV4GBKeaLcq';

(async () => {
  const ref = db.collection('boards').doc(PID).collection('proposals').doc(DOC);
  const snap = await ref.get();
  if (!snap.exists) throw new Error('PRO-3017 missing');
  const data = snap.data() || {};
  const items = Array.isArray(data.items) ? data.items.slice() : [];
  console.log('before itemsLen', items.length, 'total', data.total);
  items.forEach((it, i) => console.log(i, it && (it.title || it.name), it && it.room, it && it.amount));

  if (items.length !== 1 || !/floral charm/i.test(String((items[0] && items[0].title) || ''))) {
    console.log('ABORT: expected exactly 1 Floral Charm line (already restored or unexpected state)');
    process.exit(2);
  }
  if (items.some((it) => /rami mirror/i.test(String((it && it.title) || '')))) {
    console.log('ABORT: Rami Mirror already present');
    process.exit(2);
  }

  const inv = await db.collection('boards').doc(PID).collection('invoices').doc('ipQeLAJumPgYEDesWDk0').get();
  const invItems = ((inv.data() || {}).items || []).filter(Boolean);
  const src = invItems.find((it) => /rami mirror/i.test(String((it && it.title) || '')));
  if (!src) throw new Error('Rami Mirror not found on INV-6026');

  const mirror = Object.assign({}, src, {
    amount: 421.2,
    cost: 312,
    markupPct: 35,
    qty: 1,
    shipping: 0,
    rate: undefined,
    groupId: undefined,
    lineApprovalStatus: 'approved',
    approved: true,
    declined: false,
    clipId: 'CgSjgllLAIMhr2Z1jjyn',
    room: String(src.room || 'Master Bathroom').trim() || 'Master Bathroom',
    category: 'Mirror'
  });
  delete mirror.rate;
  delete mirror.groupId;

  const next = [items[0], mirror];
  console.log('after plan itemsLen', next.length);
  next.forEach((it, i) => console.log(i, it.title, it.room, it.amount, it.cost));
  console.log('sum amounts', next.reduce((s, it) => s + (Number(it.amount) || 0), 0), 'doc.total', data.total);
  console.log('APPLY', APPLY);

  if (!APPLY) {
    console.log('Dry-run only. Re-run with --apply to write staging.');
    process.exit(0);
  }

  await ref.update({
    items: next,
    updatedAt: new Date().toISOString(),
    _restoredMirrorAt: new Date().toISOString(),
    _restoredMirrorBy: 'cursor-room-sync-wipe-fix',
    _restoredMirrorNote: 'Rami Mirror restored after P1 sync persistLineLinks wipe; amount 421.2 from total delta'
  });
  console.log('WROTE staging PRO-3017 items[] length 2');
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
