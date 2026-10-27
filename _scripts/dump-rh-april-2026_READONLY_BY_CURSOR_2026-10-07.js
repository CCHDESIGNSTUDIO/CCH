#!/usr/bin/env node
'use strict';
/**
 * PRODUCTION read-only: Cloud Rolling Hills — April 2026 work for invoice narrative.
 *   node _scripts\dump-rh-april-2026_READONLY_BY_CURSOR_2026-10-07.js
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
const app = admin.initializeApp({ credential: admin.credential.cert(require(KEY)) }, 'rhApril');
const db = app.firestore();
const BOARD = 'cloud-rolling-hills';
const FROM = '2026-04-01';
const TO = '2026-04-30';

const str = (v) => String(v == null ? '' : v).trim();
const n = (v) => parseFloat(v) || 0;
const iso = (v) => {
  if (!v) return '';
  if (typeof v.toDate === 'function') return v.toDate().toISOString();
  if (v.seconds) return new Date(v.seconds * 1000).toISOString();
  const s = String(v);
  if (!s) return '';
  const d = new Date(s);
  return isNaN(d.getTime()) ? s : d.toISOString();
};
const day = (v) => iso(v).slice(0, 10);
const inApril = (v) => {
  const d = day(v);
  return d >= FROM && d <= TO;
};
const anyApril = (obj, fields) => fields.some((f) => inApril(obj[f]));

function lineTitle(it) {
  return str(it && (it.title || it.name || it.description)).slice(0, 90);
}

(async function main() {
  const out = { board: BOARD, range: { FROM, TO }, generatedAt: new Date().toISOString() };

  const boardSnap = await db.collection('boards').doc(BOARD).get();
  if (!boardSnap.exists) throw new Error('board missing');
  const b = boardSnap.data() || {};
  out.project = {
    name: b.name || b.projectName || BOARD,
    client: b.clientName || b.client || '',
    address: [b.projectAddress || b.address, b.projectCity || b.clientCity, b.projectZip || b.clientZip].filter(Boolean).join(', ')
  };

  // Invoices
  const invSnap = await db.collection('boards').doc(BOARD).collection('invoices').get();
  out.invoices = [];
  invSnap.forEach((d) => {
    const x = d.data() || {};
    const items = Array.isArray(x.items) ? x.items : [];
    const created = day(x.createdAt || x.date || x.issueDate);
    const dated = day(x.date || x.issueDate || x.createdAt);
    const sent = day(x.sentAt || x.emailedAt || x.clientEmailedAt);
    const period =
      str(x.periodStart || x.billingPeriodStart || x.fromDate) +
      ' … ' +
      str(x.periodEnd || x.billingPeriodEnd || x.toDate);
    out.invoices.push({
      id: d.id,
      num: str(x.invoiceNum || x.number || d.id),
      title: str(x.title || x.name || x.memo || x.shortDescription).slice(0, 160),
      status: str(x.status),
      created,
      dated,
      sent,
      period,
      total: n(x.total),
      taxAmount: n(x.taxAmount || x.tax),
      taxRate: n(x.taxRate),
      itemCount: items.length,
      sampleItems: items.slice(0, 12).map(lineTitle),
      isHours: !!(x._isDesignServices || x.invoiceKind === 'design_services' || /design|hours|time/i.test(str(x.title || x.name))),
      aprilTouch: inApril(x.createdAt) || inApril(x.date) || inApril(x.sentAt) || inApril(x.updatedAt)
    });
  });
  out.invoices.sort((a, b) => String(a.num).localeCompare(String(b.num), undefined, { numeric: true }));

  // Time entries (top-level)
  const teAll = [];
  (await db.collection('timeEntries').get()).forEach((d) => teAll.push({ id: d.id, ...d.data() }));
  const looksRh = (t) => {
    const pid = str(t.projectId).toLowerCase();
    const name = (str(t.project) + ' ' + str(t.projectName) + ' ' + str(t.job)).toLowerCase();
    return pid === BOARD || pid === 'cloud-rolling-hills' || name.includes('rolling') || name.includes('cloud rh') || name.includes('rh cloud');
  };
  const aprilTime = teAll.filter((t) => looksRh(t) && inApril(t.date || t.day || t.startedAt || t.start));
  aprilTime.sort((a, b) => day(a.date).localeCompare(day(b.date)));
  out.time = {
    count: aprilTime.length,
    hours: Math.round(aprilTime.reduce((s, t) => s + n(t.hours || t.durationHours || (n(t.minutes) / 60)), 0) * 100) / 100,
    byDay: {},
    entries: aprilTime.map((t) => ({
      date: day(t.date || t.day),
      member: str(t.member || t.userName || t.user || t.person).slice(0, 40),
      hours: n(t.hours || t.durationHours || (n(t.minutes) / 60)),
      service: str(t.service || t.category || t.billingCategory).slice(0, 60),
      notes: str(t.notes || t.note || t.description || t.memory).slice(0, 240),
      invoiced: str(t.invoiceNum || t.invoiceNumber || t.invoiceId)
    }))
  };
  aprilTime.forEach((t) => {
    const d = day(t.date || t.day);
    if (!out.time.byDay[d]) out.time.byDay[d] = { hours: 0, notes: [] };
    out.time.byDay[d].hours += n(t.hours || t.durationHours || (n(t.minutes) / 60));
    const note = str(t.notes || t.note || t.description || t.memory);
    if (note) out.time.byDay[d].notes.push(note.slice(0, 180));
  });

  // timelyEntries
  try {
    const timely = [];
    (await db.collection('timelyEntries').get()).forEach((d) => timely.push({ id: d.id, ...d.data() }));
    const rhTimely = timely.filter((t) => {
      const blob = JSON.stringify(t).toLowerCase();
      return blob.includes('rolling') || blob.includes('cloud-rolling') || str(t.projectId) === BOARD;
    }).filter((t) => inApril(t.day || t.date || t.spent_date || t.created_at));
    out.timelyCount = rhTimely.length;
    out.timelySample = rhTimely.slice(0, 40).map((t) => ({
      date: day(t.day || t.date || t.spent_date),
      hours: n(t.hours || (n(t.duration) / 3600) || (n(t.minutes) / 60)),
      note: str(t.note || t.notes || t.description).slice(0, 200)
    }));
  } catch (e) {
    out.timelyError = String(e.message || e);
  }

  // Activity (top-level + subcollection)
  const acts = [];
  try {
    (await db.collection('activity').where('projectId', '==', BOARD).get()).forEach((d) => acts.push({ id: d.id, ...d.data(), _src: 'top' }));
  } catch (e) {
    out.activityTopErr = String(e.message || e);
  }
  try {
    (await db.collection('boards').doc(BOARD).collection('activity').get()).forEach((d) => acts.push({ id: d.id, ...d.data(), _src: 'sub' }));
  } catch (e) {
    out.activitySubErr = String(e.message || e);
  }
  const aprilActs = acts.filter((a) => inApril(a.timestamp || a.createdAt || a.date || a.at));
  aprilActs.sort((a, b) => iso(a.timestamp || a.createdAt).localeCompare(iso(b.timestamp || b.createdAt)));
  out.activity = aprilActs.map((a) => ({
    date: day(a.timestamp || a.createdAt || a.date),
    type: str(a.type || a.action || a.kind),
    text: str(a.message || a.text || a.summary || a.description || a.title).slice(0, 220),
    who: str(a.userName || a.member || a.by).slice(0, 40)
  }));

  // Messages / correspondence
  const msgs = [];
  try {
    (await db.collection('boards').doc(BOARD).collection('messages').get()).forEach((d) => msgs.push({ id: d.id, ...d.data() }));
  } catch (e) {
    out.messagesErr = String(e.message || e);
  }
  out.messagesApril = msgs.filter((m) => inApril(m.createdAt || m.sentAt || m.date || m.timestamp)).map((m) => ({
    date: day(m.createdAt || m.sentAt || m.date),
    from: str(m.from || m.sender || m.author).slice(0, 50),
    subj: str(m.subject || m.title).slice(0, 120),
    preview: str(m.body || m.text || m.message).replace(/\s+/g, ' ').slice(0, 220)
  }));

  // Client documents
  const docs = [];
  try {
    (await db.collection('boards').doc(BOARD).collection('clientDocuments').get()).forEach((d) => docs.push({ id: d.id, ...d.data() }));
  } catch (e) {
    out.clientDocsErr = String(e.message || e);
  }
  out.clientDocsApril = docs.filter((x) => anyApril(x, ['createdAt', 'updatedAt', 'sharedAt', 'date'])).map((x) => ({
    date: day(x.createdAt || x.date),
    title: str(x.title || x.name || x.fileName).slice(0, 120),
    type: str(x.type || x.kind)
  }));

  // Proposals
  const props = [];
  (await db.collection('boards').doc(BOARD).collection('proposals').get()).forEach((d) => {
    const x = d.data() || {};
    props.push({
      id: d.id,
      num: str(x.proposalNum || x.number || d.id),
      title: str(x.title || x.name).slice(0, 120),
      status: str(x.status),
      created: day(x.createdAt || x.date),
      sent: day(x.sentAt || x.emailedAt),
      updated: day(x.updatedAt),
      total: n(x.total),
      items: (x.items || []).length,
      aprilTouch: anyApril(x, ['createdAt', 'date', 'sentAt', 'emailedAt', 'updatedAt', 'approvedAt'])
    });
  });
  out.proposalsApril = props.filter((p) => p.aprilTouch);

  // POs
  const pos = [];
  (await db.collection('boards').doc(BOARD).collection('purchaseOrders').get()).forEach((d) => {
    const x = d.data() || {};
    pos.push({
      id: d.id,
      num: str(x.number || x.poNum || d.id),
      vendor: str(x.vendor || x.vendorName).slice(0, 80),
      status: str(x.status),
      created: day(x.createdAt || x.date),
      sent: day(x.sentAt || x.emailedAt),
      total: n(x.total),
      items: (x.items || []).slice(0, 8).map(lineTitle),
      aprilTouch: anyApril(x, ['createdAt', 'date', 'sentAt', 'emailedAt', 'updatedAt'])
    });
  });
  out.posApril = pos.filter((p) => p.aprilTouch);

  // Inspiration boards + sample items updated in April
  const ibs = [];
  (await db.collection('boards').doc(BOARD).collection('ideabooks').get()).forEach((d) => {
    const x = d.data() || {};
    ibs.push({
      id: d.id,
      name: str(x.name || x.title),
      count: n(x.itemCount) || (Array.isArray(x.items) ? x.items.length : 0),
      updated: day(x.updatedAt || x.createdAt),
      aprilTouch: anyApril(x, ['createdAt', 'updatedAt'])
    });
  });
  out.inspirationApril = ibs.filter((i) => i.aprilTouch);
  out.inspirationAll = ibs.map((i) => ({ id: i.id, name: i.name, count: i.count, updated: i.updated }));

  // Room / design boards
  const dbs = [];
  try {
    (await db.collection('boards').doc(BOARD).collection('designBoards').get()).forEach((d) => {
      const x = d.data() || {};
      dbs.push({
        id: d.id,
        name: str(x.name || x.title || x.room),
        updated: day(x.updatedAt || x.createdAt),
        aprilTouch: anyApril(x, ['createdAt', 'updatedAt'])
      });
    });
  } catch (e) {
    out.designBoardsErr = String(e.message || e);
  }
  out.designBoardsApril = dbs.filter((x) => x.aprilTouch);

  // Whats new / schedule
  try {
    const wn = [];
    (await db.collection('boards').doc(BOARD).collection('whatsNew').get()).forEach((d) => wn.push({ id: d.id, ...d.data() }));
    out.whatsNewApril = wn.filter((x) => anyApril(x, ['createdAt', 'date', 'postedAt'])).map((x) => ({
      date: day(x.createdAt || x.date || x.postedAt),
      title: str(x.title || x.heading).slice(0, 140),
      text: str(x.body || x.text || x.message).replace(/\s+/g, ' ').slice(0, 240)
    }));
  } catch (e) {
    out.whatsNewErr = String(e.message || e);
  }

  const dest = path.join(__dirname, '..', '_debug', 'rh-april-2026-dump.json');
  fs.writeFileSync(dest, JSON.stringify(out, null, 2));
  console.log('Wrote', dest);
  console.log('Project', out.project);
  console.log('April time entries', out.time.count, 'hours', out.time.hours);
  console.log('April activity', out.activity.length);
  console.log('April messages', out.messagesApril.length);
  console.log('April proposals', out.proposalsApril.length);
  console.log('April POs', out.posApril.length);
  console.log('Invoices', out.invoices.length);
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
