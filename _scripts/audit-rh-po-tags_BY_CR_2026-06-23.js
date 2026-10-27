// READ-ONLY: audit line tags across Cloud Rolling Hills invoices vs purchase orders.
// Builds tag index from invoice lines (by clipId, sku, title|vendor); for each PO line reports
// whether it has a tag and whether a matching invoice tag exists. No writes.
const path = require('path');
const admin = require('firebase-admin');
admin.initializeApp({
  credential: admin.credential.cert(require(path.join(__dirname, '..', '_debug', 'service-account.json',
    'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json'))),
});
const db = admin.firestore();
const PROJECT = 'cloud-rolling-hills';
const norm = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
const tagOf = (it) => String(it.lineTag || it.lineTagCode || it.fixtureTag || it.tag || '').trim();

(async () => {
  const invSnap = await db.collection('boards').doc(PROJECT).collection('invoices').get();
  const byClip = {}, bySku = {}, byTitleVendor = {};
  let invLineCount = 0, invTagged = 0;
  invSnap.forEach(doc => {
    const items = (doc.data().items || []);
    items.forEach(it => {
      invLineCount++;
      const t = tagOf(it);
      if (!t) return;
      invTagged++;
      if (it.clipId) byClip[String(it.clipId)] = byClip[String(it.clipId)] || t;
      if (it.sku) bySku[norm(it.sku)] = bySku[norm(it.sku)] || t;
      const tv = norm(it.title) + '|' + norm(it.vendor);
      if (norm(it.title)) byTitleVendor[tv] = byTitleVendor[tv] || t;
    });
  });
  console.log('Invoices: ' + invSnap.size + ' docs, ' + invLineCount + ' lines, ' + invTagged + ' with a tag.');
  console.log('Tag index: byClip=' + Object.keys(byClip).length + ' bySku=' + Object.keys(bySku).length + ' byTitleVendor=' + Object.keys(byTitleVendor).length);
  console.log('='.repeat(90));

  const poSnap = await db.collection('boards').doc(PROJECT).collection('purchaseOrders').get();
  let poLines = 0, poHasTag = 0, wouldPush = 0, noMatch = 0;
  poSnap.forEach(doc => {
    const d = doc.data();
    const items = (d.items || []);
    const lines = [];
    items.forEach(it => {
      poLines++;
      const cur = tagOf(it);
      if (cur) { poHasTag++; return; }
      const match = (it.clipId && byClip[String(it.clipId)]) || (it.sku && bySku[norm(it.sku)]) ||
        byTitleVendor[norm(it.title) + '|' + norm(it.vendor)] || '';
      if (match) { wouldPush++; lines.push('   PUSH "' + match + '" <- ' + (it.title || '').slice(0, 40) + ' [clip=' + (it.clipId || '-') + ' sku=' + (it.sku || '-') + ']'); }
      else { noMatch++; lines.push('   no-match: ' + (it.title || '').slice(0, 40) + ' [clip=' + (it.clipId || '-') + ' sku=' + (it.sku || '-') + ']'); }
    });
    if (lines.length) {
      console.log('PO ' + (d.number || doc.id) + ' (' + (d.vendor || '') + ')');
      lines.forEach(l => console.log(l));
    }
  });
  console.log('='.repeat(90));
  console.log('PO lines: ' + poLines + ' | already tagged: ' + poHasTag + ' | could push from invoice: ' + wouldPush + ' | no invoice match: ' + noMatch);
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
