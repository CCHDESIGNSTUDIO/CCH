#!/usr/bin/env node
'use strict';
const path = require('path');
const admin = require('firebase-admin');
const KEY = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
const db = admin.initializeApp({ credential: admin.credential.cert(require(KEY)) }, 'vendual').firestore();

function slim(id, x) {
  x = x || {};
  return {
    id,
    name: x.name || x.company || x.vendor || '',
    category: x.category || '',
    type: x.type || x.vendorType || '',
    tags: x.tags || '',
    isWorkroom: x.isWorkroom || false,
    isShowroom: x.isShowroom || false,
    isReceiver: x.isReceiver || false,
    showroomFor: x.showroomFor || x.showroomVendors || x.lines || '',
    elu: x.elu || x.eluAccount || x.account || '',
    notes: String(x.notes || x.note || '').slice(0, 120)
  };
}

function hit(name, x) {
  const n = String(name || x.name || x.company || x.vendor || '').toLowerCase();
  return /oc custom|dana creath|creath|glass blow|la glass|elu/.test(n);
}

(async () => {
  const vendors = [];
  const wr = [];
  (await db.collection('vendors').get()).forEach((d) => {
    const x = d.data() || {};
    const name = x.name || x.company || x.vendor || d.id;
    if (hit(name, x) || hit(d.id, x)) vendors.push(slim(d.id, x));
  });
  try {
    (await db.collection('workrooms').get()).forEach((d) => {
      const x = d.data() || {};
      const name = x.name || x.title || d.id;
      if (hit(name, x)) wr.push(slim(d.id, x));
    });
  } catch (_e) {}
  console.log(JSON.stringify({ vendors, workrooms: wr }, null, 2));
})().catch((e) => { console.error(e); process.exit(1); });
