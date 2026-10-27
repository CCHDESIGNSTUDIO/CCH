#!/usr/bin/env node
'use strict';
const path = require('path');
const admin = require('firebase-admin');
const KEY = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
admin.initializeApp({ credential: admin.credential.cert(require(KEY)) });
const db = admin.firestore();

(async function() {
  var snap = await db.collection('feedbackRequests').orderBy('createdAt', 'desc').limit(15).get();
  console.log('Recent feedbackRequests:', snap.size);
  snap.forEach(function(d) {
    var x = d.data() || {};
    console.log('\n---', d.id);
    console.log(' title:', x.title);
    console.log(' type:', x.type, '| status:', x.status);
    console.log(' by:', x.submittedBy || x.submitterEmail || x.email || x.ownerEmail);
    console.log(' created:', x.createdAt);
    console.log(' lastMessage:', (x.lastMessage || '').slice(0, 120));
    console.log(' unreadBy:', JSON.stringify(x.unreadBy));
    console.log(' fixItEscalate:', x.fixItEscalate, '| fixItClassification:', x.fixItClassification);
  });
})().catch(function(e) { console.error(e); process.exit(1); });
