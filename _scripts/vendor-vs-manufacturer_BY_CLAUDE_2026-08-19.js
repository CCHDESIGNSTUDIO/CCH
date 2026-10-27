#!/usr/bin/env node
'use strict';
/** Is manufacturer distinguished from supplier anywhere? READ-ONLY. */
const admin = require('firebase-admin');
const path = require('path');
const KEY = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(require(KEY)) });
const db = admin.firestore();

const SHOWROOMS = ['myknobs', 'hardware hut', 'hardwarehut', 'build.com', 'wayfair', 'houzz', 'perigold', 'ferguson'];

(async () => {
  const scopes = [{ label: 'products', ref: db.collection('products') },
                  { label: 'productLibrary', ref: db.collection('productLibrary') }];
  const boards = await db.collection('boards').get();
  boards.forEach(b => scopes.push({ label: 'clips/' + b.id, ref: b.ref.collection('clips') }));

  let total = 0, hasVendor = 0, hasMfr = 0, hasBoth = 0, bothSame = 0, bothDiffer = 0;
  let vendorIsShowroom = 0, vendorIsShowroomNoMfr = 0;
  const examples = [];

  for (const s of scopes) {
    let snap; try { snap = await s.ref.get(); } catch (e) { continue; }
    snap.forEach(d => {
      const p = d.data() || {};
      total++;
      const v = String(p.vendor || '').trim();
      const m = String(p.manufacturer || '').trim();
      if (v) hasVendor++;
      if (m) hasMfr++;
      if (v && m) {
        hasBoth++;
        if (v.toLowerCase() === m.toLowerCase()) bothSame++; else bothDiffer++;
      }
      const isShow = SHOWROOMS.some(x => v.toLowerCase().includes(x));
      if (isShow) {
        vendorIsShowroom++;
        if (!m) {
          vendorIsShowroomNoMfr++;
          if (examples.length < 6) examples.push({
            where: s.label, id: d.id,
            title: String(p.title || p.name || '').slice(0, 58),
            vendor: v, mfr: m || '(EMPTY)', sku: p.sku || '—'
          });
        }
      }
    });
  }

  console.log('documents scanned .................. ' + total);
  console.log('have a vendor ...................... ' + hasVendor);
  console.log('have a manufacturer ................ ' + hasMfr);
  console.log('have BOTH .......................... ' + hasBoth +
              '   (identical: ' + bothSame + ', genuinely different: ' + bothDiffer + ')');
  console.log('');
  console.log('vendor looks like a SHOWROOM/supplier ....... ' + vendorIsShowroom);
  console.log('  ...of those, manufacturer is EMPTY ....... ' + vendorIsShowroomNoMfr +
              '   <-- maker identity lost');
  console.log('\n=== examples (supplier in vendor, no manufacturer) ===');
  examples.forEach(e => console.log('  [' + e.where + '] ' + e.title +
    '\n     vendor:"' + e.vendor + '"  manufacturer:' + e.mfr + '  sku:' + e.sku));

  console.log('\ndone — nothing was written.');
})().catch(e => { console.error(e.message); process.exit(1); });
