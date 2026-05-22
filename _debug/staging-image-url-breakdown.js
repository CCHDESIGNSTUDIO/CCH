'use strict';
const path = require('path');
const admin = require('firebase-admin');
const SK = path.join(__dirname, 'service-account.json', 'cch-studio-staging-firebase-adminsdk-fbsvc-b93c6f1cf4.json');
const db = admin.initializeApp({ credential: admin.credential.cert(require(SK)) }, 'st').firestore();

function bucket(u) {
  u = String(u || '').trim();
  if (!u) return 'missing';
  if (u.startsWith('http://') || u.startsWith('https://')) {
    if (u.includes('ivy-uploads')) return 'ivy-s3';
    if (u.includes('cch-studio-staging')) return 'firebase-staging';
    if (u.includes('cch-design-boards')) return 'firebase-prod';
    if (u.includes('cdn.brandfolder')) return 'brandfolder';
    return 'other-https';
  }
  if (u.includes('&amp;')) return 'broken-html-entity';
  if (/\.(jpe?g|png|webp|gif)/i.test(u)) return 'filename-only';
  return 'fragment-other';
}

async function board(boardId) {
  const inv = await db.collection('boards').doc(boardId).collection('invoices').get();
  const counts = {};
  let lines = 0, docsShown = 0;
  inv.forEach((d) => {
    const x = d.data();
    const items = x.items || [];
    if (!items.length) return;
    items.forEach((it) => {
      lines++;
      const b = bucket(it.imageUrl || (it.images && it.images[0]));
      counts[b] = (counts[b] || 0) + 1;
    });
  });
  console.log('\n' + boardId + ' invoice line image URL breakdown (' + lines + ' lines on docs with items):');
  Object.keys(counts).sort().forEach((k) => console.log('  ', k + ':', counts[k]));

  // Invoices user likely opens: uppercase shell vs lowercase
  let shells = 0, good = 0;
  inv.forEach((d) => {
    const n = (d.data().items || []).length;
    if (d.id === d.id.toUpperCase() && /^IN-\d/.test(d.id) && n === 0) shells++;
    if (n > 0) good++;
  });
  console.log('  docs with lines:', good, '| uppercase empty shells:', shells);
}

(async () => {
  await board('cloud-rolling-hills');
  await board('7225-bugletrail');
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
