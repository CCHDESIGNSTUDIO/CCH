/**
 * Post grounded diagnosis on Vanessa's Katke work-order ticket (prod).
 * APPLY: one message + status In Progress. No work-order data writes (none found to restore).
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
const app = admin.initializeApp({ credential: admin.credential.cert(require(KEY)) }, 'replyKatkeWO');
const db = app.firestore();

const REQUEST_ID = 'YHWJDuC5ckG0MXsDUrdp';
const BODY =
  'Studio investigation (Cursor, Jul 21 — production Firestore, not a hard-refresh issue):\n\n' +
  '• boards/katke-graceland-dr/workOrders → 0 documents\n' +
  '• phantom boards/katke-graceland → does not exist; 0 work orders\n' +
  '• Firm-wide workOrders search (all projects) → 24 total: Holtz 15, Greene 8, Rolling Hills 1. Zero mention Katke/Graceland.\n' +
  '• Staging also has 0 Katke work orders.\n' +
  '• Storage has no Katke work-order image folders.\n\n' +
  'So these are not “hidden” by the old orderBy bug — they were never successfully saved to this project in Firestore (or never completed Save while signed in). Browser-only drafts may still exist on the computer where Builder was used (localStorage) — open Order Builder for Katke and look for “Restored unsaved browser draft”.\n\n' +
  'Next: if Vanessa has printouts/PDFs or remembers rooms/tags, we re-enter; we cannot restore from an empty collection.';

(async () => {
  const now = new Date().toISOString();
  await db.collection('feedbackRequests').doc(REQUEST_ID).collection('messages').add({
    role: 'owner',
    authorName: 'Cindy / Studio',
    authorEmail: 'cindy@cchdesign.com',
    body: BODY,
    text: BODY,
    createdAt: now,
    source: 'cursor-firestore-probe-2026-07-21'
  });
  await db.collection('feedbackRequests').doc(REQUEST_ID).update({
    status: 'In Progress',
    updatedAt: now,
    lastMessageAt: now,
    lastMessagePreview: BODY.slice(0, 160),
    response: BODY.slice(0, 500)
  });
  console.log('Updated feedback', REQUEST_ID);
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
