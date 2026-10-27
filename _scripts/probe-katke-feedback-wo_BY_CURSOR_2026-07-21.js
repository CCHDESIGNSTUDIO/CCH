/**
 * READ-ONLY: Katke work-order feedback ticket + staging check if SA supports it.
 */
const path = require('path');
const fs = require('fs');
const admin = require('firebase-admin');
const KEY = path.join(
  __dirname,
  '..',
  '_debug',
  'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json'
);
const app = admin.initializeApp({ credential: admin.credential.cert(require(KEY)) }, 'probeFbWO');
const db = app.firestore();

(async () => {
  const snap = await db.collection('feedbackRequests').get();
  const hits = [];
  snap.forEach((d) => {
    const x = d.data() || {};
    const blob = JSON.stringify(x).toLowerCase();
    if (blob.includes('work order') || blob.includes('workorder') || blob.includes('katke')) {
      if (/work\s*order/.test(blob) || /katke/.test(blob)) {
        hits.push({
          id: d.id,
          title: x.title,
          status: x.status,
          submittedBy: x.submittedBy || x.submittedByEmail,
          owner: x.ownerName || x.ownerEmail,
          createdAt: x.createdAt,
          description: String(x.description || '').slice(0, 400)
        });
      }
    }
  });
  console.log('feedback hits:', hits.length);
  hits.forEach((h) => console.log(JSON.stringify(h, null, 2)));

  // messages on matching docs
  for (const h of hits.filter((x) => /work/.test(String(x.title || '').toLowerCase()))) {
    const msgs = await db.collection('feedbackRequests').doc(h.id).collection('messages').orderBy('createdAt', 'asc').get().catch(() => null);
    if (!msgs) {
      const msgs2 = await db.collection('feedbackRequests').doc(h.id).collection('messages').get();
      console.log('\nMessages for', h.id, msgs2.size);
      msgs2.forEach((m) => {
        const d = m.data() || {};
        console.log(' -', d.authorName || d.role || '', String(d.body || d.text || d.message || '').slice(0, 300));
      });
    } else {
      console.log('\nMessages for', h.id, msgs.size);
      msgs.forEach((m) => {
        const d = m.data() || {};
        console.log(' -', d.authorName || d.role || '', String(d.body || d.text || d.message || '').slice(0, 300));
      });
    }
  }

  // staging key?
  const stagingKey = path.join(
    __dirname,
    '..',
    '_debug',
    'service-account.json',
    'cch-studio-staging-firebase-adminsdk.json'
  );
  const stagingAlt = fs
    .readdirSync(path.join(__dirname, '..', '_debug', 'service-account.json'))
    .filter((f) => /staging/i.test(f));
  console.log('\nstaging key files:', stagingAlt);

  process.exit(0);
})().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
