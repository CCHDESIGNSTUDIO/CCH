#!/usr/bin/env node
'use strict';
const path = require('path');
const admin = require('firebase-admin');
const KEY = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
const db = admin.initializeApp({ credential: admin.credential.cert(require(KEY)) }, 'wo237').firestore();
const BOARD = 'cloud-rolling-hills';

(async () => {
  const invs = await db.collection('boards').doc(BOARD).collection('invoices').get();
  const invList = [];
  invs.forEach((d) => {
    const x = d.data() || {};
    const num = String(x.invoiceNum || x.number || d.id);
    const st = String(x.status || '');
    if (/12980/i.test(num) || /void/i.test(st) || /void/i.test(num)) {
      invList.push({
        id: d.id, num, status: st, published: !!x.published,
        nItems: (x.items || x.lineItems || []).length,
        total: x.total
      });
    }
  });

  const titles = /large rec|hex lantern|ember hand|linear iron|saddle ring|tailor linen|vale hex|vale sq|vale sconce|black buoy|drum buoy/i;
  const clips = await db.collection('boards').doc(BOARD).collection('clips').get();
  const clipRows = [];
  clips.forEach((d) => {
    const c = d.data() || {};
    const t = String(c.title || '');
    if (!titles.test(t) && String(c.houzzInvoice || c.invoiceNum || '') !== 'IN-12980' && String(c.invoiceNum || '') !== '12980') return;
    clipRows.push({
      id: d.id,
      title: t.slice(0, 50),
      houzzId: c.houzzId || '',
      libraryProductId: c.libraryProductId || '',
      linkedLibraryProductId: c.linkedLibraryProductId || '',
      invoiceNum: c.invoiceNum || '',
      houzzInvoice: c.houzzInvoice || '',
      proposalNum: c.proposalNum || '',
      houzzProposal: c.houzzProposal || '',
      invoiceId: c.invoiceId || ''
    });
  });

  const with12980 = [];
  clips.forEach((d) => {
    const c = d.data() || {};
    const blob = [c.invoiceNum, c.houzzInvoice, c.invoice].join(' ');
    if (/12980/.test(blob)) with12980.push({ id: d.id, title: String(c.title || '').slice(0, 40), invoiceNum: c.invoiceNum || '', houzzInvoice: c.houzzInvoice || '' });
  });

  console.log(JSON.stringify({
    voidishInvoices: invList,
    sampleClips: clipRows.slice(0, 40),
    sampleClipCount: clipRows.length,
    clipsTagged12980: with12980.length,
    clipsTagged12980Sample: with12980.slice(0, 25)
  }, null, 2));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
