'use strict';
/** READ-ONLY: simulate client portal personal greeting for cloud-rolling-hills (Tracey). */
const path = require('path');
const admin = require('firebase-admin');
const KEY = require(path.join(__dirname, '..', '_debug', 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json'));
const db = admin.initializeApp({ credential: admin.credential.cert(KEY) }, 'PROD').firestore();
const PID = 'cloud-rolling-hills';
const str = (v) => String(v == null ? '' : v).trim();

function tsMs(v) {
  if (!v) return 0;
  const d = new Date(v);
  return isNaN(d.getTime()) ? 0 : d.getTime();
}

function proposalTextLooksTerminal(pr) {
  const t = str(pr.proposalNum || pr.name || pr.title).toLowerCase();
  return /\b(void|cancelled|canceled|superseded|duplicate|test)\b/.test(t);
}

function proposalNeedsClientReview(pr) {
  if (!pr || !pr.published) return false;
  if (pr.hideFromClientPortal || pr.hideFromClientAttention || pr.archived || pr.isArchived || pr.legacyClosedAt) return false;
  if (String(pr.importedFrom || '').toLowerCase() === 'houzz' && pr.clientReviewRequired !== true) return false;
  if (proposalTextLooksTerminal(pr)) return false;
  const stL = str(pr.status).toLowerCase();
  const terminal = ['approved', 'invoiced', 'converted', 'declined', 'rejected', 'cancelled', 'lost', 'signed', 'complete', 'completed', 'closed', 'void', 'archived'];
  if (terminal.indexOf(stL) >= 0) return false;
  return true;
}

function cpPortalInspirationIdeabook(ib) {
  if (!ib || ib.hiddenInNav) return false;
  const t = str(ib.type || ib.boardType).toLowerCase().replace(/-/g, '_');
  if (t === 'design_board' || t === 'designboard') return false;
  if (t === 'concept_board' || t === 'conceptboard' || t === 'concept') return false;
  const imgs = Array.isArray(ib.images) ? ib.images : [];
  if (imgs.length > 0) return true;
  if (Array.isArray(ib.items) && ib.items.length > 0) return true;
  return false;
}

function cpIdeabookItemCount(ib) {
  const nImg = Array.isArray(ib.images) ? ib.images.length : 0;
  const nItems = Array.isArray(ib.items) ? ib.items.length : 0;
  const stored = parseInt(ib.itemCount, 10) || 0;
  return Math.max(nImg, nItems, stored);
}

function cpPortalInvoiceIsOpen(inv) {
  const st = str(inv.status).toLowerCase();
  if (st === 'paid' || st === 'cancelled' || st === 'canceled' || st === 'void' || st === 'written off') return false;
  const total = parseFloat(inv.total || inv.amount) || 0;
  const payments = Array.isArray(inv.payments) ? inv.payments : [];
  const paid = payments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0) || (st === 'paid' ? total : 0);
  return total - paid > 0.01 || ['sent', 'unpaid', 'due', 'overdue', 'partial', 'open'].indexOf(st) >= 0;
}

function joinNatural(items) {
  if (!items.length) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return items[0] + ' and ' + items[1];
  return items.slice(0, -1).join(', ') + ', and ' + items[items.length - 1];
}

function buildGreeting(firstName, updates, isReturning) {
  const headline = firstName === 'there'
    ? 'Welcome to your project dashboard'
    : 'Hello ' + firstName + (isReturning ? ' — welcome back' : ' — welcome');
  const phraseParts = [];
  const props = updates.newProposals || [];
  const freshProps = updates.freshProposals || props;
  const boards = updates.newInspirationBoards || [];
  const docs = updates.newDocuments || [];
  const invs = updates.newInvoices || [];

  if (props.length === 1) {
    phraseParts.push(freshProps.length ? 'a new proposal to review' : 'a proposal waiting for your review');
  } else if (props.length > 1) {
    phraseParts.push(freshProps.length
      ? freshProps.length + ' new proposals to review'
      : props.length + ' proposals waiting for your review');
  }
  if (boards.length === 1) {
    phraseParts.push(isReturning
      ? 'new items on your ' + boards[0].name + ' inspiration board'
      : 'updates on your ' + boards[0].name + ' inspiration board');
  } else if (boards.length > 1) {
    phraseParts.push(isReturning
      ? 'new items on ' + boards.length + ' inspiration boards'
      : 'updates on ' + boards.length + ' inspiration boards');
  }
  if (docs.length === 1) phraseParts.push(isReturning ? 'a new document to review' : 'a document waiting for your review');
  else if (docs.length > 1) phraseParts.push(docs.length + (isReturning ? ' new documents' : ' documents') + ' to review');
  if (invs.length === 1) phraseParts.push(isReturning ? 'a new invoice to view' : 'an invoice to view');
  else if (invs.length > 1) phraseParts.push(invs.length + (isReturning ? ' new invoices' : ' invoices') + ' to view');

  const subline = phraseParts.length ? 'You have ' + joinNatural(phraseParts) + '.' : '';
  return { headline, subline, full: subline ? headline + '\n\n' + subline : headline };
}

function cpPortalIsStudioProposal(p) {
  if (!p) return false;
  if (String(p.importedFrom || '').toLowerCase() === 'houzz') return false;
  if (String(p.id || '').indexOf('houzz-') === 0) return false;
  return true;
}

function cpPortalIsStudioPortalInvoice(inv) {
  if (!inv) return false;
  if (String(inv.importedFrom || '').toLowerCase() === 'houzz') return false;
  if (String(inv.id || '').indexOf('houzz-') === 0) return false;
  const st = str(inv.status).toLowerCase();
  if (st === 'void' || st === 'voided' || st === 'draft') return false;
  const invNum = str(inv.invoiceNum || inv.number || inv.name);
  if (!invNum || invNum === '-' || /^%20/.test(invNum)) return false;
  if (!/^INV-/i.test(invNum)) return false;
  if (st === 'unsent' && !inv.published) return false;
  return true;
}

(async () => {
  const projDoc = await db.collection('boards').doc(PID).get();
  if (!projDoc.exists) { console.log('Board not found:', PID); process.exit(1); }
  const proj = projDoc.data() || {};
  console.log('Project:', str(proj.name), '| clientName:', str(proj.clientName || proj.client));

  const [propSnap, ibSnap, docSnap, fileSnap, invSnap] = await Promise.all([
    db.collection('boards').doc(PID).collection('proposals').get(),
    db.collection('boards').doc(PID).collection('ideabooks').get(),
    db.collection('boards').doc(PID).collection('clientDocuments').get(),
    db.collection('boards').doc(PID).collection('files').get(),
    db.collection('boards').doc(PID).collection('invoices').get(),
  ]);

  const proposals = propSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const ideabooks = ibSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const clientDocuments = docSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const projectFiles = fileSnap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((f) => f.internal !== true && f.hideFromClient !== true);
  const portalDocuments = clientDocuments.concat(projectFiles.map((f) => ({
    id: 'studiofile:' + f.id,
    title: str(f.name || 'File'),
    createdAt: f.createdAt || '',
    status: 'shared'
  })));
  const invoices = invSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const awaiting = proposals.filter((p) => cpPortalIsStudioProposal(p) && proposalNeedsClientReview(p));
  const studioOpenInv = invoices.filter((inv) => cpPortalIsStudioPortalInvoice(inv) && cpPortalInvoiceIsOpen(inv));
  const publishedIb = ideabooks.filter(cpPortalInspirationIdeabook).filter((ib) => cpIdeabookItemCount(ib) > 0);

  console.log('\n--- Inventory ---');
  console.log('Proposals awaiting review:', awaiting.length);
  awaiting.forEach((p) => console.log('  •', str(p.proposalNum || p.name || p.id), '| status:', str(p.status), '| published:', !!p.published, '| updated:', str(p.updatedAt || p.publishedAt).slice(0, 10)));
  console.log('Inspiration boards (client-visible):', publishedIb.length);
  publishedIb.forEach((ib) => console.log('  •', str(ib.name || ib.title || ib.id), '| items:', cpIdeabookItemCount(ib), '| updated:', str(ib.updatedAt || ib.createdAt).slice(0, 10)));
  console.log('Portal documents (client + studio files):', portalDocuments.length);
  portalDocuments.forEach((d) => console.log('  •', str(d.title || d.id), '|', str(d.createdAt).slice(0, 10)));
  console.log('Studio open invoices (INV-*):', studioOpenInv.length);
  studioOpenInv.forEach((inv) => console.log('  •', str(inv.invoiceNum || inv.name || inv.id), '| status:', str(inv.status)));

  const recentCutoff = Date.now() - (21 * 24 * 60 * 60 * 1000);
  function computeUpdates(isReturning, sinceMs) {
    const newProposals = awaiting;
    const freshProposals = isReturning
      ? newProposals.filter((p) => tsMs(p.publishedAt || p.updatedAt || p.createdAt) > sinceMs)
      : newProposals;
    const newInspirationBoards = publishedIb.filter((ib) => {
      const ts = tsMs(ib.updatedAt || ib.createdAt);
      if (!ts) return false;
      if (!isReturning) return ts >= recentCutoff;
      return ts > sinceMs;
    }).map((ib) => ({ id: ib.id, name: str(ib.name || ib.title || 'Inspiration') }));
    const newDocuments = isReturning
      ? portalDocuments.filter((d) => tsMs(d.createdAt || d.updatedAt) > sinceMs)
      : portalDocuments;
    const newInvoices = isReturning
      ? studioOpenInv.filter((inv) => tsMs(inv.publishedAt || inv.sentAt || inv.updatedAt || inv.createdAt) > sinceMs)
      : studioOpenInv;
    return { isReturning, newProposals, freshProposals, newInspirationBoards, newDocuments, newInvoices };
  }

  function buildUpdatesLine(updates) {
    const phraseParts = [];
    const props = updates.newProposals || [];
    const freshProps = updates.freshProposals || props;
    const boards = updates.newInspirationBoards || [];
    const docs = updates.newDocuments || [];
    const invs = updates.newInvoices || [];
    const isReturning = !!updates.isReturning;
    if (props.length === 1) phraseParts.push(freshProps.length ? 'a new proposal to review' : 'a proposal waiting for your review');
    else if (props.length > 1) phraseParts.push(freshProps.length ? freshProps.length + ' new proposals to review' : props.length + ' proposals waiting for your review');
    if (boards.length === 1) phraseParts.push(isReturning ? 'new items on your ' + boards[0].name + ' inspiration board' : 'updates on your ' + boards[0].name + ' inspiration board');
    else if (boards.length > 1) phraseParts.push(isReturning ? 'new items on ' + boards.length + ' inspiration boards' : 'updates on ' + boards.length + ' inspiration boards');
    if (docs.length === 1) phraseParts.push(isReturning ? 'a new document shared with you' : 'a document shared with you');
    else if (docs.length > 1) phraseParts.push(docs.length + (isReturning ? ' new documents shared with you' : ' documents shared with you'));
    if (invs.length === 1) phraseParts.push(isReturning ? 'a new invoice to view' : 'an invoice to view');
    else if (invs.length > 1) phraseParts.push(invs.length + (isReturning ? ' new invoices' : ' invoices') + ' to view');
    if (!phraseParts.length) return '';
    return 'You have ' + joinNatural(phraseParts) + '.';
  }

  const firstName = 'Tracey';
  const firstVisit = computeUpdates(false, 0);
  const returning30d = computeUpdates(true, Date.now() - 30 * 24 * 60 * 60 * 1000);

  console.log('\n=== FIRST VISIT (enters name Tracey, never opened portal before) ===');
  const g1 = buildGreeting(firstName, firstVisit, false);
  console.log(g1.full);

  console.log('\n=== RETURN VISIT (last opened ~30 days ago) ===');
  const g2 = buildGreeting(firstName, returning30d, true);
  console.log(g2.full);

  console.log('\n=== RETURN VISIT (last opened yesterday — only very recent updates) ===');
  const yesterday = computeUpdates(true, Date.now() - 24 * 60 * 60 * 1000);
  const g3 = buildGreeting(firstName, yesterday, true);
  console.log(g3.full);

  process.exit(0);
})().catch((e) => { console.error('ERROR', e.message || e); process.exit(1); });
