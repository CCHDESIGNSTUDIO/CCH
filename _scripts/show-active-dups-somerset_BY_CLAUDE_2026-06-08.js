'use strict';
/** READ-ONLY: show the CURRENT active Somerset Bay catalog (products/ + productLibrary/ merged, exactly
 *  how the Product Library screen builds it) grouped by houzzId, flagging every duplicate row. No writes. */
const path = require('path');
const admin = require('firebase-admin');
const KEY = require(path.join(__dirname, '..', '_debug', 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json'));
const db = admin.initializeApp({ credential: admin.credential.cert(KEY) }, 'PROD').firestore();
const str = (v) => String(v == null ? '' : v).trim();
const hz = (o) => str(o && (o.houzzId || o.houzzProductId || o.catalogId));
const RE = /somerset\s*bay/i;
async function rows(coll) { const s = await db.collection(coll).get(); const o = []; s.forEach((d) => { const p = d.data() || {}; if (RE.test(str(p.vendor))) o.push({ id: d.id, coll, hz: hz(p), title: str(p.title || p.name) }); }); return o; }
(async () => {
  const all = (await rows('products')).concat(await rows('productLibrary'));
  const groups = {};
  all.forEach((r) => { const k = r.hz ? 'hz:' + r.hz : 't:' + r.title.toLowerCase(); (groups[k] = groups[k] || []).push(r); });
  const dupGroups = Object.entries(groups).filter(([, g]) => g.length > 1);
  console.log('=== ACTIVE Somerset Bay catalog (products/ + productLibrary/) ===');
  console.log('Total active rows:', all.length, '| unique products:', Object.keys(groups).length, '| groups WITH duplicates:', dupGroups.length, '\n');
  console.log('DUPLICATE GROUPS (each should be 1 row, not many):');
  dupGroups.sort((a, b) => b[1].length - a[1].length).forEach(([k, g]) => {
    console.log('\n  ' + k + '  →  ' + g.length + ' rows:');
    g.forEach((r) => console.log('     [' + r.coll.padEnd(14) + '] "' + r.title.slice(0, 42).padEnd(42) + '"  id=' + r.id));
  });
  const extra = all.length - Object.keys(groups).length;
  console.log('\n>>> ' + extra + ' duplicate rows are still showing in the active catalog (' + all.length + ' shown vs ' + Object.keys(groups).length + ' real products).');
  process.exit(0);
})().catch((e) => { console.error('ERROR', e.message || e); process.exit(1); });
