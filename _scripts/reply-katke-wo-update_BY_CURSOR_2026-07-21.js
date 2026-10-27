const path = require('path');
const admin = require('firebase-admin');
const KEY = path.join(
  __dirname,
  '..',
  '_debug',
  'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json'
);
const app = admin.initializeApp({ credential: admin.credential.cert(require(KEY)) }, 'replyKatke2');
const db = app.firestore();
const REQUEST_ID = 'YHWJDuC5ckG0MXsDUrdp';
const BODY =
  'Update (same day re-check):\n\n' +
  'There is now **1** saved work order on Katke – Graceland Dr.:\n' +
  '• KAT-U-01 — Upholstery — Living Room — saved Jul 21, 2026 1:40 PM Pacific (doc Hp29zQA4EvVX5SMACVRR)\n\n' +
  'Still only one in Firestore + Storage. No second Katke work order found anywhere (no orphan files, no KAT-W / KAT-U-02).\n\n' +
  'If Vanessa remembers a second one: open Order Builder on the computer she used and check for “Restored unsaved browser draft,” or re-enter from notes/PDF. Hard refresh the Work Orders tab — KAT-U-01 should appear.';

(async () => {
  const now = new Date().toISOString();
  await db.collection('feedbackRequests').doc(REQUEST_ID).collection('messages').add({
    role: 'owner',
    authorName: 'Cindy / Studio',
    authorEmail: 'cindy@cchdesign.com',
    body: BODY,
    text: BODY,
    createdAt: now,
    source: 'cursor-firestore-probe-2026-07-21-b'
  });
  await db.collection('feedbackRequests').doc(REQUEST_ID).update({
    status: 'In Progress',
    updatedAt: now,
    lastMessageAt: now,
    lastMessagePreview: BODY.slice(0, 160),
    response: BODY.slice(0, 500)
  });
  console.log('ok');
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
