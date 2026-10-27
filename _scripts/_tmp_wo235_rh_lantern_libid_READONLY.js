#!/usr/bin/env node
'use strict';
/** PRODUCTION read-only: Cloud Rolling Hills lantern clip vs PRO-3025 / INV-6067 + recent clip deletes. */
const path = require('path');
const admin = require('firebase-admin');
const KEY = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
const db = admin.initializeApp({ credential: admin.credential.cert(require(KEY)) }, 'wo235peek').firestore();
const BOARD = 'cloud-rolling-hills';

function slimClip(d) {
  const x = d.data() || {};
  return {
    id: d.id,
    title: x.title || x.name || '',
    room: x.room || '',
    category: x.category || '',
    vendor: x.vendor || '',
    sku: x.sku || '',
    libraryProductId: x.libraryProductId || x.linkedLibraryProductId || '',
    houzzId: x.houzzId || x.houzzProductId || '',
    clipId: x.clipId || '',
    proposalId: x.proposalId || '',
    proposalNum: x.proposalNum || x.houzzProposal || '',
    invoiceId: x.invoiceId || '',
    invoiceNum: x.invoiceNum || x.houzzInvoice || '',
    cost: x.cost || x.costPrice || '',
    sell: x.clientPrice || x.sell || x.sellPrice || '',
    source: x.source || '',
    updatedAt: x.updatedAt || x.createdAt || ''
  };
}
function slimLine(it, i, extra) {
  return Object.assign({
    i: i,
    title: it.title || it.name || '',
    room: it.room || '',
    libraryProductId: it.libraryProductId || it.linkedLibraryProductId || '',
    libraryProductIdLocked: !!it.libraryProductIdLocked,
    houzzId: it.houzzId || it.houzzProductId || '',
    clipId: it.clipId || it.sourceClipId || '',
    sku: it.sku || '',
    vendor: it.vendor || '',
    amount: it.amount || it.totalSelling || '',
    qty: it.qty || it.quantity || ''
  }, extra || {});
}

(async () => {
  const clipsSnap = await db.collection('boards').doc(BOARD).collection('clips').get();
  const clips = [];
  clipsSnap.forEach((d) => clips.push(slimClip(d)));
  const lanternish = clips.filter((c) => /lantern|sconce|pendant|lightingbedding/i.test(c.title + ' ' + c.category));
  const noLib = lanternish.filter((c) => !c.libraryProductId && !c.houzzId);

  const props = await db.collection('boards').doc(BOARD).collection('proposals').get();
  const invs = await db.collection('boards').doc(BOARD).collection('invoices').get();
  const propHits = [];
  const invHits = [];
  const clipIds = new Set(clips.map((c) => c.id));
  const orphanDocLines = [];

  props.forEach((pd) => {
    const p = pd.data() || {};
    const num = String(p.proposalNum || p.number || pd.id);
    (p.items || []).forEach((it, i) => {
      const t = String(it.title || it.name || '');
      if (/3025/i.test(num) || /lantern|sconce|large rec/i.test(t)) {
        const row = slimLine(it, i, { doc: num, docId: pd.id, published: !!p.published, status: p.status });
        propHits.push(row);
        const cid = String(it.clipId || it.sourceClipId || '').trim();
        if (cid && !clipIds.has(cid) && /lantern|sconce|pendant/i.test(t)) {
          orphanDocLines.push(Object.assign({ kind: 'proposal' }, row, { missingClipId: cid }));
        }
      }
    });
  });
  invs.forEach((ivd) => {
    const inv = ivd.data() || {};
    const num = String(inv.invoiceNum || inv.number || ivd.id);
    const items = inv.items || inv.lineItems || [];
    items.forEach((it, i) => {
      const t = String(it.title || it.name || '');
      if (/6067/i.test(num) || /lantern|sconce|large rec/i.test(t)) {
        const row = slimLine(it, i, { doc: num, docId: ivd.id, published: !!inv.published, status: inv.status });
        invHits.push(row);
        const cid = String(it.clipId || it.sourceClipId || '').trim();
        if (cid && !clipIds.has(cid) && /lantern|sconce|pendant/i.test(t)) {
          orphanDocLines.push(Object.assign({ kind: 'invoice' }, row, { missingClipId: cid }));
        }
      }
    });
  });

  let acts = [];
  try {
    const as = await db.collection('activity').where('projectId', '==', BOARD).orderBy('timestamp', 'desc').limit(40).get();
    as.forEach((d) => {
      const a = d.data() || {};
      const desc = String(a.description || a.action || a.type || '');
      if (/delet|clip|selection|lantern|sconce/i.test(desc + JSON.stringify(a.meta || {}))) {
        acts.push({
          id: d.id,
          type: a.type,
          action: a.action,
          description: desc.slice(0, 180),
          user: a.user || a.userEmail || '',
          timestamp: a.timestamp || a.createdAt || ''
        });
      }
    });
  } catch (e) {
    acts = [{ error: String(e.message || e) }];
  }

  const libHits = [];
  const qTitles = ['Large Rec Glass', 'Rec Glass Lantern', 'LightingBedding'];
  for (const t of lanternish.slice(0, 20)) {
    if (t.title && t.title.length >= 8) {
      try {
        const qs = await db.collection('products').where('title', '==', t.title).limit(5).get();
        qs.forEach((d) => libHits.push({ id: d.id, title: (d.data() || {}).title, category: (d.data() || {}).category, sku: (d.data() || {}).sku }));
      } catch (_e) {}
    }
  }

  console.log(JSON.stringify({
    clipCount: clips.length,
    lanternish: lanternish,
    lanternNoHouzzNoLib: noLib,
    propHits: propHits.filter((r) => /large rec|3025/i.test(r.title + r.doc)),
    invHits: invHits.filter((r) => /large rec|6067/i.test(r.title + r.doc)),
    orphanDocLines,
    recentActivity: acts.slice(0, 20),
    libTitleExact: libHits
  }, null, 2));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
