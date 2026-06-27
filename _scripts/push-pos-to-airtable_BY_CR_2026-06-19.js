'use strict';
/**
 * CCH Studio -> Airtable PO push (one-way).
 * Builds per the spec at cch-deploy/Docs/AIRTABLE_PO_PUSH_SPEC.md (base app8Je7Mpc81giBre).
 *
 * Reads purchase orders from Firestore (boards/{projectId}/purchaseOrders/{poId}, items in po.items[])
 * and upserts them + their line items into the "CCH Delivery Receiving" Airtable base so receivers /
 * workrooms can check items in. Re-running updates existing records instead of duplicating, and it
 * NEVER writes receiver-entered fields (Qty received, Status*, Condition, Photo, Received by, Date received).
 *   *Line Status is written ONCE on create (default "Expected") and left alone afterward.
 *
 * Usage:
 *   set AIRTABLE_PAT=pat_xxx                      (PowerShell: $env:AIRTABLE_PAT="pat_xxx")
 *   node _scripts/push-pos-to-airtable_BY_CR_2026-06-19.js --project=<boardId> [--env=staging|prod] [--po=<poId>] [--limit=N] [--dry-run]
 *
 * Flags:
 *   --env=staging|prod    optional. Which Firebase project to READ POs from. Default: staging (test-safe).
 *   --project=<boardId>   required. Firestore board/project id.
 *   --po=<poId>           optional. Push a single PO doc only.
 *   --limit=N             optional. Cap number of POs (after --po filter).
 *   --dry-run             optional. No Airtable calls; prints what would be sent + a sample payload.
 *
 * Auth: Airtable Personal Access Token (PAT) with data.records:read + data.records:write, scoped to the base.
 *       Never commit the token. Firestore uses the PROD service account (read-only here).
 */

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

// Resolve the Airtable PAT from env first, else a local gitignored file (*.env is gitignored).
// File may be the raw token on one line, or a line "AIRTABLE_PAT=pat_...".
function resolvePat() {
  if (process.env.AIRTABLE_PAT) return process.env.AIRTABLE_PAT.trim();
  const candidates = [
    path.join(process.cwd(), 'airtable-pat.env'),
    path.join(__dirname, '..', 'airtable-pat.env'),
  ];
  for (const f of candidates) {
    try {
      if (!fs.existsSync(f)) continue;
      const raw = fs.readFileSync(f, 'utf8').trim();
      const m = raw.match(/AIRTABLE_PAT\s*=\s*(.+)/);
      return (m ? m[1] : raw).trim().replace(/^["']|["']$/g, '');
    } catch (_e) {}
  }
  return '';
}

// ---- Airtable spec constants (from AIRTABLE_PO_PUSH_SPEC.md) -------------------------------------
const BASE = 'app8Je7Mpc81giBre';
const TBL_PO = 'tblDclxZj88am7XMR';
const TBL_LINES = 'tblT1Bjq0Ur09bd8J';

const PO = {
  number: 'fldATxqfNhq3CkpWK',      // merge key
  vendor: 'fldVn8PVjfmNBVAvd',
  shipTo: 'fldQJbWEKb0Thi0fs',
  receiverName: 'Receiver',         // written BY NAME (PAT lacks schema scope to fetch the id) -- field must be named exactly "Receiver"
  receiverEmail: 'Receiver Email',  // written BY NAME -- must match Airtable column exactly
  client: 'fldrQTqPYNGYcXj0l',
  project: 'fldsHArDlNKaiaqRZ',     // singleSelect
  shipToType: 'fldjVFlumus08RBuc',  // singleSelect (left unset; receiver/Cynthia classifies)
  date: 'fldTuecPtGcmhjDpT',
  document: 'fldrl2aRbayPNF5eq',    // attachment
  overallStatus: 'fldPxk2Iv884xWsJg', // singleSelect -- create-only
  notes: 'fldBqWMJYZuS1j2zO',
};

const LINE = {
  item: 'fldhmc70R3i1Bjcjt',
  sourceKey: 'fldp8laWbTEisVqOT',   // merge key
  po: 'fldIVNKXd1Yr2ZhmH',          // link -> Purchase Orders
  vendor: 'fldJQrfjDKXC9mYpJ',
  sku: 'fldArHbF3WE6ru8fu',
  finish: 'fldVWXlYQ9m4a5PkG',
  room: 'fldw8xlSuYFDrjkuv',
  qtyOrdered: 'fldGgrCXP9uWehfUD',
  unitPrice: 'fldPUjodTopCL9wUy',
  productImage: 'fld5FahFNCB8uknrb', // attachment
  status: 'fld6qNHLbv4TN0N1b',       // singleSelect -- create-only default "Expected"
  // Receiver-owned (NEVER written by this push):
  // qtyReceived fldCZSej18Zpg8dRi, condition fldbvM4Ig0sNfJUUe, photo fld9w3S95M7EKZnwR,
  // receivedBy fldCVjTLRomvVAvoI, dateReceived fldTvY1JS1jqCNpQi, remaining (formula), lineTotal (formula)
};

// Project singleSelect options (exact strings in the base).
const PROJECT_OPTIONS = ['Rolling Hills', '31 Whitesail', 'Bradbury-High', 'Bugle Trail / April Box', 'ELU Atelier', 'Other'];

// ---- CLI --------------------------------------------------------------------------------------
const ARGV = process.argv.slice(2);
const arg = (name) => { const hit = ARGV.find(a => a === '--' + name || a.startsWith('--' + name + '=')); if (!hit) return undefined; const eq = hit.indexOf('='); return eq < 0 ? true : hit.slice(eq + 1); };
const PROJECT_ID = arg('project');
const ONLY_PO = arg('po');
const LIMIT = parseInt(arg('limit'), 10) || 0;
const DRY = !!arg('dry-run');
const ENV = String(arg('env') || 'staging').toLowerCase();
const PAT = resolvePat();

// Firebase source environments. Default is staging so test pushes never read prod by accident.
const FIRE_ENVS = {
  staging: { key: 'cch-studio-staging-firebase-adminsdk-fbsvc-b93c6f1cf4.json', bucket: 'cch-studio-staging.firebasestorage.app' },
  prod: { key: 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json', bucket: 'cch-design-boards.firebasestorage.app' },
};

if (!PROJECT_ID) { console.error('ERROR: --project=<boardId> is required.'); process.exit(1); }
if (!FIRE_ENVS[ENV]) { console.error('ERROR: --env must be "staging" or "prod" (got "' + ENV + '").'); process.exit(1); }
if (!DRY && !PAT) { console.error('ERROR: AIRTABLE_PAT required (env var or airtable-pat.env file), or use --dry-run.'); process.exit(1); }

// ---- Firebase admin (read-only use) -----------------------------------------------------------
const KEY = require(path.join(__dirname, '..', '_debug', 'service-account.json', FIRE_ENVS[ENV].key));
const app = admin.initializeApp({ credential: admin.credential.cert(KEY), storageBucket: FIRE_ENVS[ENV].bucket }, 'CCH_' + ENV.toUpperCase());
const db = app.firestore();

// ---- helpers ----------------------------------------------------------------------------------
const str = (v) => String(v == null ? '' : v).trim();
const num = (v) => { const n = parseFloat(v); return isNaN(n) ? null : n; };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const AIRTABLE_THROTTLE_MS = 230; // stay under Airtable's 5 req/sec per base

function mapProjectOption(boardName, projectName) {
  const hay = (str(boardName) + ' ' + str(projectName)).toLowerCase();
  const m = (frag) => hay.indexOf(frag) >= 0;
  if (m('rolling hills')) return 'Rolling Hills';
  if (m('whitesail') || m('white sail')) return '31 Whitesail';
  if (m('bradbury')) return 'Bradbury-High';
  if (m('bugle') || m('april box')) return 'Bugle Trail / April Box';
  if (m('elu') || m('atelier')) return 'ELU Atelier';
  return 'Other';
}

function poDateIso(po) {
  const v = po.date || po.poDate || po.createdAt;
  if (!v) return null;
  try {
    if (typeof v === 'object' && typeof v.toDate === 'function') return v.toDate().toISOString().slice(0, 10);
    const s = str(v);
    const m = s.match(/\d{4}-\d{2}-\d{2}/);
    if (m) return m[0];
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  } catch (_e) {}
  return null;
}

function firstStr() {
  for (let i = 0; i < arguments.length; i++) { const s = str(arguments[i]); if (s) return s; }
  return '';
}

// Ship to = receiving party (receiver/workroom), NEVER the client. Drop junk tokens and client echoes.
const SHIPTO_JUNK = new Set(['client', 'customer', 'n/a', 'na', 'none', '-', '--', 'tbd', 'project']);
function cleanShipTo(raw, client) {
  const s = str(raw);
  if (!s) return '';
  const low = s.toLowerCase();
  if (SHIPTO_JUNK.has(low)) return '';
  if (client && low === str(client).toLowerCase()) return '';
  return s;
}

// Auto-classify the Ship-to type singleSelect from the PO's ship-to / workroom / receiver / vendor text.
// Exact option strings must match the Airtable field: "Window workroom", "Receiver / warehouse", "Other".
function classifyShipToType(po, shipTo) {
  // Respect an explicit, already-correct value on the PO if present.
  const explicit = str(po && po.shipToType).toLowerCase();
  if (/work\s*room/.test(explicit)) return 'Window workroom';
  if (/receiv|warehouse/.test(explicit)) return 'Receiver / warehouse';
  const hay = [shipTo, po && po.workroom, po && po.shipTo, po && po.deliverTo, po && po.receiver, po && po.vendor]
    .map(str).join(' ').toLowerCase();
  if (!hay.trim()) return 'Other';
  if (/work\s*room|fabricat|drapery|drapes|window treatment|seamstress|upholster|sew/.test(hay)) return 'Window workroom';
  if (/receiv|warehouse|moving|logistics|freight|storage|delivery|deliver|3pl|distribution/.test(hay)) return 'Receiver / warehouse';
  return 'Other';
}

// Clean receiving-party NAME for grouping/filtering (no address/phone). Prefer explicit po.receiver,
// else the company name = first segment of the ship-to before the address ("·" or "," separator).
function cleanReceiverName(po, shipTo) {
  let r = str(po && po.receiver).trim();
  if (!r) {
    const s = str(shipTo).trim();
    if (s) r = s.split('·')[0].split(',')[0].trim();
  }
  if (SHIPTO_JUNK.has(r.toLowerCase())) return '';
  return r;
}

// Pull a candidate image URL string off a line item (mirrors index.html getProposalLineHeroImageUrl order).
function rawImageCandidate(it) {
  const direct = firstStr(it.imageUrl, it.image, it.productImage, it.thumbnail);
  if (direct) return direct;
  const arrs = [it.imageUrls, it.images];
  for (const a of arrs) {
    if (!Array.isArray(a)) continue;
    for (const el of a) {
      if (typeof el === 'string' && str(el)) return str(el);
      if (el && typeof el === 'object') { const s = firstStr(el.imageUrl, el.url, el.src, el.image); if (s) return s; }
    }
  }
  return '';
}

function looksUnreliable(u) {
  // Houzz/Ivy signed URLs frequently 404 and would make Airtable's attachment fetch fail.
  return /ivy-uploads\.|img\.houzz|houzzcdn|houzz\.com/i.test(u) || /&amp;|&#38;/.test(u);
}

// Resolve a line image to a publicly fetchable https URL Airtable can ingest. Best-effort, non-fatal.
async function resolveImageUrl(it) {
  const raw = rawImageCandidate(it);
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return looksUnreliable(raw) ? null : raw;
  try {
    if (/^gs:\/\//i.test(raw)) {
      const m = raw.match(/^gs:\/\/([^/]+)\/(.+)$/i);
      if (!m) return null;
      const [url] = await app.storage().bucket(m[1]).file(m[2]).getSignedUrl({ action: 'read', expires: Date.now() + 24 * 3600 * 1000 });
      return url || null;
    }
    if (raw.indexOf('/') >= 0 && !raw.startsWith('//') && !/^data:/i.test(raw)) {
      const [url] = await app.storage().bucket().file(raw.replace(/^\//, '')).getSignedUrl({ action: 'read', expires: Date.now() + 24 * 3600 * 1000 });
      return url || null;
    }
  } catch (e) {
    console.warn('  ! image sign failed for', raw.slice(0, 80), '-', e.message || e);
  }
  return null;
}

async function airtable(method, tableId, body) {
  const res = await fetch('https://api.airtable.com/v0/' + BASE + '/' + tableId, {
    method,
    headers: { Authorization: 'Bearer ' + PAT, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error('Airtable ' + res.status + ': ' + text.slice(0, 500));
  await sleep(AIRTABLE_THROTTLE_MS);
  return text ? JSON.parse(text) : {};
}

// List all values of one field across a table (for create-only default detection). Read-only.
async function listExistingKeys(tableId, fieldId) {
  const keys = new Set();
  if (DRY) return keys;
  let offset = '';
  do {
    const url = new URL('https://api.airtable.com/v0/' + BASE + '/' + tableId);
    url.searchParams.set('fields[]', fieldId);
    url.searchParams.set('pageSize', '100');
    url.searchParams.set('returnFieldsByFieldId', 'true');
    if (offset) url.searchParams.set('offset', offset);
    const res = await fetch(url, { headers: { Authorization: 'Bearer ' + PAT } });
    const text = await res.text();
    if (!res.ok) throw new Error('Airtable list ' + res.status + ': ' + text.slice(0, 400));
    const json = JSON.parse(text);
    (json.records || []).forEach(r => { const v = str((r.fields || {})[fieldId]); if (v) keys.add(v); });
    offset = json.offset || '';
    await sleep(AIRTABLE_THROTTLE_MS);
  } while (offset);
  return keys;
}

function chunk(arr, n) { const out = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out; }

// Ship-to contacts (receivers + workrooms) for email resolution on Airtable push.
async function loadShipToContacts() {
  const out = [];
  const seen = new Set();
  const add = (name, email, phone) => {
    name = str(name);
    if (!name || seen.has(name.toLowerCase())) return;
    seen.add(name.toLowerCase());
    out.push({ name, email: str(email), phone: str(phone) });
  };
  try {
    const vs = await db.collection('vendors').get();
    vs.forEach((d) => {
      const v = d.data() || {};
      const cat = str(v.category);
      const typ = str(v.type || v.vendorType).toLowerCase();
      const email = v.email || v.contactEmail;
      const phone = v.phone || v.contactPhone;
      const name = v.name || v.company || v.vendor;
      if (cat === 'Delivery / Receiver' || cat === 'Freight / Receiver' ||
          v.type === 'receiver' || v.isReceiver === true ||
          typ.indexOf('receiver') >= 0 || typ.indexOf('freight') >= 0) {
        add(name, email, phone);
      }
      if (cat === 'Workroom' || v.isWorkroom === true || typ === 'workroom' || typ.indexOf('upholster') >= 0) {
        add(name, email, phone);
      }
    });
  } catch (_e) {}
  try {
    const ws = await db.collection('workrooms').get();
    ws.forEach((d) => {
      const w = d.data() || {};
      add(w.name || w.title || w.workroomName || d.id, w.email || w.contactEmail, w.phone || w.contactPhone);
    });
  } catch (_e) {}
  try {
    const ts = await db.collection('team').get();
    ts.forEach((d) => {
      const t = d.data() || {};
      const role = str(t.role).toLowerCase();
      if (role === 'receiver' || role === 'workroom') add(t.name || t.company, t.email || t.contactEmail, t.phone || t.contactPhone);
    });
  } catch (_e) {}
  return out;
}

// Resolve receiver email like Studio's cchPoShipToContactResolved: explicit po.receiverEmail,
// else match the receiver / ship-to name to a contact record's email.
function resolveReceiverEmail(po, shipTo, contacts) {
  const direct = str(po && po.receiverEmail);
  if (direct) return direct;
  if (!contacts || !contacts.length) return '';
  const candidates = [];
  const nm = str(po && (po.receiver || po.receiverName));
  if (nm) candidates.push(nm.toLowerCase());
  const st = str(shipTo);
  if (st) {
    candidates.push(st.split('\n')[0].split('·')[0].split(',')[0].trim().toLowerCase());
    candidates.push(st.toLowerCase());
  }
  for (const cand of candidates) {
    if (!cand) continue;
    for (const r of contacts) {
      const rn = str(r.name).toLowerCase();
      if (rn && (rn === cand || cand.indexOf(rn) === 0) && r.email) return r.email;
    }
  }
  return '';
}

// ---- main -------------------------------------------------------------------------------------
(async () => {
  const stats = { pos: 0, lines: 0, images: 0, skippedImages: 0 };

  const boardDoc = await db.collection('boards').doc(PROJECT_ID).get();
  if (!boardDoc.exists) { console.error('ERROR: board/project not found:', PROJECT_ID); process.exit(1); }
  const board = boardDoc.data() || {};
  const boardName = str(board.name || board.projectName);
  const boardClient = str(board.clientName || board.client);
  const receiverContacts = await loadShipToContacts();

  let poDocs;
  if (ONLY_PO) {
    const d = await db.collection('boards').doc(PROJECT_ID).collection('purchaseOrders').doc(str(ONLY_PO)).get();
    if (!d.exists) { console.error('ERROR: PO not found:', ONLY_PO); process.exit(1); }
    poDocs = [d];
  } else {
    const snap = await db.collection('boards').doc(PROJECT_ID).collection('purchaseOrders').get();
    poDocs = snap.docs;
  }
  if (LIMIT > 0) poDocs = poDocs.slice(0, LIMIT);

  console.log((DRY ? '[DRY RUN] ' : '') + 'Read env: ' + ENV.toUpperCase() + ' | Project "' + (boardName || PROJECT_ID) + '" — ' + poDocs.length + ' PO(s)');

  const existingPoNumbers = await listExistingKeys(TBL_PO, PO.number);
  const existingSourceKeys = await listExistingKeys(TBL_LINES, LINE.sourceKey);
  const projectOption = mapProjectOption(boardName, board.projectName);

  let samplePrinted = false;

  for (const pod of poDocs) {
    const po = pod.data() || {};
    const poNumber = firstStr(po.poNumber, po.number) || ('PO-' + pod.id.slice(0, 8));
    const client = firstStr(po.clientName, po.client, boardClient);
    const shipTo = cleanShipTo(firstStr(po.shipTo, po.deliverTo, po.receiver, po.workroom), client);

    const poFields = {};
    poFields[PO.number] = poNumber;
    if (str(po.vendor)) poFields[PO.vendor] = str(po.vendor);
    if (shipTo) poFields[PO.shipTo] = shipTo;
    const receiverName = cleanReceiverName(po, shipTo);
    if (receiverName) poFields[PO.receiverName] = receiverName;
    const receiverEmail = resolveReceiverEmail(po, shipTo, receiverContacts);
    if (receiverEmail) poFields[PO.receiverEmail] = receiverEmail;
    // Client name intentionally NOT pushed -- receivers must never see the client (privacy guardrail).
    poFields[PO.shipToType] = classifyShipToType(po, shipTo);
    poFields[PO.project] = projectOption;
    const iso = poDateIso(po);
    if (iso) poFields[PO.date] = iso;
    const notes = firstStr(po.notes, po.memo);
    if (notes) poFields[PO.notes] = notes;
    const poPdf = firstStr(po.pdfUrl, po.documentUrl);
    if (/^https?:\/\//i.test(poPdf)) poFields[PO.document] = [{ url: poPdf }];
    // Overall status is a receiving roll-up the receiver owns -> write only when first creating the PO.
    if (!existingPoNumbers.has(poNumber)) poFields[PO.overallStatus] = 'Open';

    let poRecordId = null;
    if (DRY) {
      console.log('  PO ' + poNumber + (existingPoNumbers.has(poNumber) ? ' (update)' : ' (create)'));
      if (!samplePrinted) { console.log('    sample PO fields:', JSON.stringify(poFields)); }
    } else {
      const resp = await airtable('PATCH', TBL_PO, { performUpsert: { fieldsToMergeOn: [PO.number] }, records: [{ fields: poFields }], typecast: true });
      poRecordId = (resp.records && resp.records[0] && resp.records[0].id) || null;
    }
    stats.pos++;

    const items = po.items || po.lineItems || [];
    const lineRecords = [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i] || {};
      const sourceKey = str(it.id) ? (pod.id + ':' + str(it.id)) : (pod.id + ':' + i);
      const qty = num(it.qty);
      const unit = num(it.cost != null ? it.cost : (it.unitCost != null ? it.unitCost : it.costPrice));

      const f = {};
      f[LINE.item] = firstStr(it.title, it.name) || 'Item';
      f[LINE.sourceKey] = sourceKey;
      if (str(it.vendor)) f[LINE.vendor] = str(it.vendor);
      const sku = firstStr(it.sku, it.model, it.itemCode);
      if (sku) f[LINE.sku] = sku;
      if (str(it.finish)) f[LINE.finish] = str(it.finish);
      const room = firstStr(it.room, it.category);
      if (room) f[LINE.room] = room;
      if (qty != null) f[LINE.qtyOrdered] = qty;
      if (unit != null) f[LINE.unitPrice] = unit;
      if (poRecordId) f[LINE.po] = [poRecordId];
      // Line Status is receiver-owned after creation -> set default only when this line is new.
      if (!existingSourceKeys.has(sourceKey)) f[LINE.status] = 'Expected';

      const imgUrl = await resolveImageUrl(it);
      if (imgUrl) { f[LINE.productImage] = [{ url: imgUrl }]; stats.images++; }
      else if (rawImageCandidate(it)) { stats.skippedImages++; }

      lineRecords.push({ fields: f });

      if (DRY && !samplePrinted) { console.log('    sample line fields:', JSON.stringify(f)); samplePrinted = true; }
    }

    if (DRY) {
      console.log('    ' + lineRecords.length + ' line(s)');
      stats.lines += lineRecords.length;
    } else {
      for (const batch of chunk(lineRecords, 10)) {
        await airtable('PATCH', TBL_LINES, { performUpsert: { fieldsToMergeOn: [LINE.sourceKey] }, records: batch, typecast: true });
        stats.lines += batch.length;
      }
    }
    samplePrinted = true;
  }

  console.log('\n' + (DRY ? '[DRY RUN] ' : '') + 'Done. POs: ' + stats.pos + ' | lines: ' + stats.lines + ' | images attached: ' + stats.images + ' | images skipped: ' + stats.skippedImages);
  process.exit(0);
})().catch(e => { console.error('FATAL', e.message || e); process.exit(1); });
