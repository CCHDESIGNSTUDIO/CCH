'use strict';
const path = require('path');
const admin = require('firebase-admin');
const SK = path.join(__dirname, 'service-account.json', 'cch-studio-staging-firebase-adminsdk-fbsvc-b93c6f1cf4.json');
const db = admin.initializeApp({ credential: admin.credential.cert(require(SK)) }, 'st').firestore();

const BOARDS = ['cloud-rolling-hills', '7225-bugletrail'];

function itemCount(x) {
  const a = x.items || x.lineItems || [];
  return Array.isArray(a) ? a.length : 0;
}

function classifyUrl(u) {
  if (!u || typeof u !== 'string') return 'none';
  const s = u.trim();
  if (!s) return 'empty';
  if (s.startsWith('data:')) return 'data';
  if (s.includes('cch-studio-staging')) return 'staging-storage';
  if (s.includes('cch-design-boards') || s.includes('firebasestorage.googleapis.com')) return 'prod-storage';
  if (s.startsWith('http')) return 'other-http';
  return 'relative-or-other';
}

(async () => {
  for (const boardId of BOARDS) {
    const b = await db.collection('boards').doc(boardId).get();
    console.log('\n' + '='.repeat(72));
    console.log('BOARD:', boardId, '|', (b.data() || {}).name || '(no name)');
    console.log('='.repeat(72));

    const invSnap = await db.collection('boards').doc(boardId).collection('invoices').get();
    const poSnap = await db.collection('boards').doc(boardId).collection('purchaseOrders').get();
    const clipSnap = await db.collection('boards').doc(boardId).collection('clips').get();

    let invDocs = 0, invEmpty = 0, invWithLines = 0, invLines = 0;
    let invImgAny = 0, invImgStaging = 0, invImgProd = 0, invImgData = 0, invImgNone = 0;
    const dupNums = {};
    const emptyShells = [];
    const withLinesSamples = [];

    invSnap.forEach((d) => {
      invDocs++;
      const x = d.data();
      const num = String(x.invoiceNum || x.number || '').trim() || d.id;
      const n = itemCount(x);
      invLines += n;
      if (n === 0) {
        invEmpty++;
        if (d.id === d.id.toUpperCase() && d.id.match(/^IN-/)) emptyShells.push({ docId: d.id, num, total: x.total });
      } else {
        invWithLines++;
        let lineImg = 0, lineNoImg = 0;
        const urlKinds = {};
        (x.items || x.lineItems || []).forEach((it) => {
          const u = it.imageUrl || (it.images && it.images[0]) || '';
          const k = classifyUrl(u);
          urlKinds[k] = (urlKinds[k] || 0) + 1;
          if (k === 'none' || k === 'empty') lineNoImg++;
          else {
            lineImg++;
            if (k === 'staging-storage') invImgStaging++;
            if (k === 'prod-storage') invImgProd++;
            if (k === 'data') invImgData++;
            invImgAny++;
          }
        });
        if (withLinesSamples.length < 4) {
          withLinesSamples.push({ docId: d.id, num, lines: n, total: x.total, lineImg, lineNoImg, urlKinds });
        }
      }
      if (!dupNums[num]) dupNums[num] = [];
      dupNums[num].push({ docId: d.id, lines: n });

      (x.items || []).forEach((it) => {
        const u = it.imageUrl || '';
        const k = classifyUrl(u);
        if (k === 'none' || k === 'empty') invImgNone++;
      });
    });

    const dups = Object.entries(dupNums).filter(([, a]) => a.length > 1);
    const upperEmptyDups = dups.filter(([, arr]) =>
      arr.some((a) => a.docId === a.docId.toUpperCase() && a.lines === 0) &&
      arr.some((a) => a.lines > 0)
    );

    console.log('\nINVOICES:', invDocs, '| with lines:', invWithLines, '| empty items[]:', invEmpty, '| total line rows:', invLines);
    console.log('Duplicate invoice # groups:', dups.length, '| upper-empty + lower-with-lines:', upperEmptyDups.length);
    if (emptyShells.length) console.log('Uppercase empty shells (first 5):', emptyShells.slice(0, 5).map((e) => e.docId).join(', '));
    console.log('Line image URLs (lines with any url): staging', invImgStaging, '| prod bucket', invImgProd, '| data:', invImgData, '| lines missing url:', invImgNone);

    withLinesSamples.forEach((s) => {
      console.log('\n  Sample', s.num, '(' + s.docId + ')');
      console.log('    lines:', s.lines, '| total:', s.total, '| lines w/ image:', s.lineImg, '| w/o:', s.lineNoImg);
      console.log('    url kinds:', JSON.stringify(s.urlKinds));
    });

    // POs
    let poDocs = 0, poLines = 0, poImgProd = 0, poImgNone = 0;
    poSnap.forEach((d) => {
      poDocs++;
      const x = d.data();
      (x.items || []).forEach((it) => {
        poLines++;
        const k = classifyUrl(it.imageUrl || '');
        if (k === 'prod-storage') poImgProd++;
        if (k === 'none' || k === 'empty') poImgNone++;
      });
    });
    console.log('\nPOs:', poDocs, '| line rows:', poLines, '| prod storage urls:', poImgProd, '| no url:', poImgNone);

    // Clips (source of images for many invoices)
    let clips = 0, clipImgProd = 0, clipImgStaging = 0, clipNoImg = 0;
    clipSnap.forEach((d) => {
      clips++;
      const c = d.data();
      const u = c.imageUrl || c.image || c.thumbnail || '';
      const k = classifyUrl(u);
      if (k === 'prod-storage') clipImgProd++;
      else if (k === 'staging-storage') clipImgStaging++;
      else clipNoImg++;
    });
    console.log('\nCLIPS:', clips, '| prod storage image:', clipImgProd, '| staging storage:', clipImgStaging, '| no/other:', clipNoImg);

    // Side-by-side duplicate example
    if (upperEmptyDups.length) {
      const [num, arr] = upperEmptyDups[0];
      console.log('\nDUPLICATE EXAMPLE:', num);
      for (const a of arr) {
        const doc = invSnap.docs.find((d) => d.id === a.docId);
        const x = doc.data();
        const first = (x.items || [])[0];
        console.log('  ', a.docId, '| lines:', a.lines, '| first image:', first ? classifyUrl(first.imageUrl) : 'n/a');
        if (first && first.imageUrl) console.log('       ', String(first.imageUrl).slice(0, 90));
      }
    }
  }
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
