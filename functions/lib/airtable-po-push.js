'use strict';

/**
 * CCH Studio → Airtable PO push (shared by Cloud Function + CLI).
 * Spec: Docs/AIRTABLE_PO_PUSH_SPEC.md
 */

const BASE = 'app8Je7Mpc81giBre';
const TBL_PO = 'tblDclxZj88am7XMR';
const TBL_LINES = 'tblT1Bjq0Ur09bd8J';

const PO = {
  number: 'fldATxqfNhq3CkpWK',
  vendor: 'fldVn8PVjfmNBVAvd',
  shipTo: 'fldQJbWEKb0Thi0fs',
  receiverEmail: 'Receiver Email',
  receiverEmailId: 'fldZV8NnuOUBCMmqU',
  client: 'fldrQTqPYNGYcXj0l',
  project: 'fldsHArDlNKaiaqRZ',
  shipToType: 'fldjVFlumus08RBuc',
  date: 'fldTuecPtGcmhjDpT',
  document: 'fldrl2aRbayPNF5eq',
  overallStatus: 'fldPxk2Iv884xWsJg',
  notes: 'fldBqWMJYZuS1j2zO',
};

const LINE = {
  item: 'fldhmc70R3i1Bjcjt',
  sourceKey: 'fldp8laWbTEisVqOT',
  po: 'fldIVNKXd1Yr2ZhmH',
  vendor: 'fldJQrfjDKXC9mYpJ',
  sku: 'fldArHbF3WE6ru8fu',
  finish: 'fldVWXlYQ9m4a5PkG',
  room: 'fldw8xlSuYFDrjkuv',
  qtyOrdered: 'fldGgrCXP9uWehfUD',
  unitPrice: 'fldPUjodTopCL9wUy',
  productImage: 'fld5FahFNCB8uknrb',
  status: 'fld6qNHLbv4TN0N1b',
};

const AIRTABLE_THROTTLE_MS = 230;
const SHIPTO_JUNK = new Set(['client', 'customer', 'n/a', 'na', 'none', '-', '--', 'tbd', 'project']);

const str = (v) => String(v == null ? '' : v).trim();
const num = (v) => { const n = parseFloat(v); return isNaN(n) ? null : n; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function firstStr() {
  for (let i = 0; i < arguments.length; i++) {
    const s = str(arguments[i]);
    if (s) return s;
  }
  return '';
}

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

function cleanShipTo(raw, client) {
  const s = str(raw);
  if (!s) return '';
  const low = s.toLowerCase();
  if (SHIPTO_JUNK.has(low)) return '';
  if (client && low === str(client).toLowerCase()) return '';
  return s;
}

function classifyShipToType(po, shipTo) {
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

function cleanReceiverName(po, shipTo) {
  let r = str(po && po.receiver).trim();
  if (!r) {
    const s = str(shipTo).trim();
    if (s) r = s.split('·')[0].split(',')[0].trim();
  }
  if (SHIPTO_JUNK.has(r.toLowerCase())) return '';
  return r;
}

function mapOverallStatus(po) {
  const s = str(po.shippingStatus || po.status || '').toLowerCase();
  if (!s) return 'Open';
  if (s === 'partially received' || s === 'partial') return 'Partially received';
  if (/^(received|installed|received \(goods in\))/.test(s) || (s.includes('received') && !s.includes('partial'))) return 'Fully received';
  if (s === 'cancelled' || s === 'closed' || s === 'on hold') return 'Closed';
  return 'Open';
}

function coerceImageIterable(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    return val.split(/[\n,|]/).map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

function pushImageUrl(list, u) {
  u = str(u);
  if (!u) return;
  if (u.indexOf('//') === 0) u = 'https:' + u;
  const low = u.toLowerCase();
  for (let i = 0; i < list.length; i++) {
    if (list[i].toLowerCase() === low) return;
  }
  list.push(u);
}

function collectLineImageCandidates(it) {
  it = it || {};
  const out = [];
  const arrs = [it.images, it.imageUrls, it.gallery, it.photos, it.photoUrls, it.productPhotos];
  for (let a = 0; a < arrs.length; a++) {
    coerceImageIterable(arrs[a]).forEach((el) => {
      if (typeof el === 'string') pushImageUrl(out, el);
      else if (el && typeof el === 'object') {
        pushImageUrl(out, firstStr(el.imageUrl, el.url, el.src, el.image, el.thumbnail));
      }
    });
  }
  [it.imageUrl, it.image, it.productImage, it.thumbnail, it.photo, it.imageUrlOverride]
    .forEach((u) => pushImageUrl(out, u));

  const heroIdx = Math.max(0, Math.min(parseInt(it.heroImageIndex, 10) || 0, Math.max(0, out.length - 1)));
  if (out.length > 1 && heroIdx > 0) {
    const hero = out[heroIdx];
    out.splice(heroIdx, 1);
    out.unshift(hero);
  }
  return out.sort((a, b) => imageUrlScore(b) - imageUrlScore(a));
}

function rawImageCandidate(it) {
  const list = collectLineImageCandidates(it);
  return list.length ? list[0] : '';
}

function imageUrlScore(u) {
  u = str(u);
  if (!u) return -1;
  if (/^data:image/i.test(u)) return 95;
  if (/firebasestorage\.googleapis|\.firebasestorage\.app|storage\.googleapis\.com/i.test(u)) return 100;
  if (looksUnreliable(u)) return 5;
  return 40;
}

function looksUnreliable(u) {
  u = str(u);
  if (!u) return true;
  if (/firebasestorage\.googleapis|\.firebasestorage\.app|storage\.googleapis\.com/i.test(u)) return false;
  return /ivy-uploads\.|img\.houzz|houzzcdn|houzz\.com/i.test(u) || /&amp;|&#38;/.test(u);
}

async function enrichItemImages(db, projectId, it) {
  const candidates = collectLineImageCandidates(it);
  const hasGood = candidates.some((u) => imageUrlScore(u) >= 40);
  if (hasGood) return it;

  const lid = firstStr(it.libraryProductId, it.linkedLibraryProductId);
  if (lid) {
    try {
      const d = await db.collection('products').doc(lid).get();
      if (d.exists) return Object.assign({}, d.data() || {}, it);
    } catch (_e) {}
  }
  const cid = firstStr(it.clipId, it.sourceClipId);
  if (cid && projectId) {
    try {
      const d = await db.collection('boards').doc(projectId).collection('clips').doc(cid).get();
      if (d.exists) return Object.assign({}, d.data() || {}, it);
    } catch (_e) {}
  }
  return it;
}

async function resolveOneImageUrl(storage, raw) {
  raw = str(raw);
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return looksUnreliable(raw) ? null : raw;
  try {
    if (/^gs:\/\//i.test(raw)) {
      const m = raw.match(/^gs:\/\/([^/]+)\/(.+)$/i);
      if (!m) return null;
      const [url] = await storage.bucket(m[1]).file(m[2]).getSignedUrl({
        action: 'read',
        expires: Date.now() + 7 * 24 * 3600 * 1000,
      });
      return url || null;
    }
    if (raw.indexOf('/') >= 0 && !raw.startsWith('//') && !/^data:/i.test(raw)) {
      const [url] = await storage.bucket().file(raw.replace(/^\//, '')).getSignedUrl({
        action: 'read',
        expires: Date.now() + 7 * 24 * 3600 * 1000,
      });
      return url || null;
    }
  } catch (_e) {}
  return null;
}

async function resolveImageUrl(storage, it) {
  const candidates = collectLineImageCandidates(it);
  for (let i = 0; i < candidates.length; i++) {
    const url = await resolveOneImageUrl(storage, candidates[i]);
    if (url) return url;
  }
  return null;
}

async function airtableRequest(pat, method, tableId, body, dryRun) {
  if (dryRun) return { records: [] };
  const res = await fetch('https://api.airtable.com/v0/' + BASE + '/' + tableId, {
    method,
    headers: { Authorization: 'Bearer ' + pat, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error('Airtable ' + res.status + ': ' + text.slice(0, 500));
  await sleep(AIRTABLE_THROTTLE_MS);
  return text ? JSON.parse(text) : {};
}

async function listExistingKeys(pat, tableId, fieldId, dryRun) {
  const keys = new Set();
  if (dryRun) return keys;
  let offset = '';
  do {
    const url = new URL('https://api.airtable.com/v0/' + BASE + '/' + tableId);
    url.searchParams.set('fields[]', fieldId);
    url.searchParams.set('pageSize', '100');
    url.searchParams.set('returnFieldsByFieldId', 'true');
    if (offset) url.searchParams.set('offset', offset);
    const res = await fetch(url, { headers: { Authorization: 'Bearer ' + pat } });
    const text = await res.text();
    if (!res.ok) throw new Error('Airtable list ' + res.status + ': ' + text.slice(0, 400));
    const json = JSON.parse(text);
    (json.records || []).forEach((r) => {
      const v = str((r.fields || {})[fieldId]);
      if (v) keys.add(v);
    });
    offset = json.offset || '';
    await sleep(AIRTABLE_THROTTLE_MS);
  } while (offset);
  return keys;
}

/** Read receiver name + email from the Airtable PO row (Studio never pulled these before). */
async function lookupAirtablePoReceiver({ pat, poNumber }) {
  const num = str(poNumber);
  if (!pat || !num) return null;
  const formula = '{fldATxqfNhq3CkpWK}="' + num.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
  const url = new URL('https://api.airtable.com/v0/' + BASE + '/' + TBL_PO);
  url.searchParams.set('filterByFormula', formula);
  url.searchParams.set('returnFieldsByFieldId', 'true');
  url.searchParams.set('maxRecords', '1');
  const res = await fetch(url, { headers: { Authorization: 'Bearer ' + pat } });
  const text = await res.text();
  if (!res.ok) throw new Error('Airtable lookup ' + res.status + ': ' + text.slice(0, 400));
  const json = text ? JSON.parse(text) : {};
  const rec = (json.records && json.records[0]) || null;
  if (!rec) return null;
  const f = rec.fields || {};
  const shipTo = str(f[PO.shipTo]);
  const name = cleanReceiverName({ receiver: '' }, shipTo) || shipTo;
  const email = str(f[PO.receiverEmailId] || f[PO.receiverEmail]);
  const shipToType = str(f[PO.shipToType]);
  if (!name && !email) return null;
  return {
    name: name || '',
    email: email || '',
    shipTo: shipTo || '',
    shipToType: shipToType || '',
    recordId: rec.id || ''
  };
}

function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

async function loadShipToContacts(db) {
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

function isLegacyHouzzNumber(po) {
  if (!po) return false;
  const n = String(po.number || po.num || po.poNum || po.poNumber || '').trim();
  return /^(?:po[-\s]?)?400\d+$/i.test(n);
}

function isHouzzSourcePo(po) {
  if (!po) return false;
  if (po.houzzImport === true) return true;
  const src = String(po.source || po.dataSource || po.origin || '').trim().toLowerCase();
  if (src === 'houzz-import' || src === 'houzz_import' || src.indexOf('houzz') >= 0) return true;
  if (po.houzzBalance != null && po.houzzBalance !== '') return true;
  if (String(po._qbIdSource || '').toLowerCase() === 'houzz-import') return true;
  const pays = po.payments || [];
  for (let i = 0; i < pays.length; i++) {
    const m = String((pays[i] || {}).method || '').toLowerCase();
    if (m.indexOf('houzz') >= 0) return true;
  }
  if (isLegacyHouzzNumber(po)) return true;
  return false;
}

function poMerchandiseTotal(po) {
  if (!po) return 0;
  const t = parseFloat(po.total);
  if (t > 0) return t;
  return (po.items || po.lineItems || []).reduce((s, it) => {
    const q = parseFloat(it.qty) || 1;
    const c = parseFloat(it.cost) || 0;
    return s + (c > 0 ? c * q : (parseFloat(it.amount) || 0));
  }, 0);
}

function poPaidAmount(po) {
  if (!po) return 0;
  let paySum = 0;
  if (Array.isArray(po.payments) && po.payments.length) {
    for (let i = 0; i < po.payments.length; i++) {
      const e = po.payments[i];
      paySum += parseFloat(e && (e.amount != null ? e.amount : e)) || 0;
    }
    paySum = Math.round(paySum * 100) / 100;
    if (paySum > 0.001) return paySum;
  }
  const direct = parseFloat(po.paidAmount);
  if (!Number.isNaN(direct) && direct > 0.001) return direct;
  const clipFb = parseFloat(po._clipPaidFallback);
  if (!Number.isNaN(clipFb) && clipFb > 0.001) return clipFb;
  return 0;
}

function isOpenPo(po) {
  if (!po) return false;
  const st = String(po.status || '').toLowerCase();
  const paySt = String(po.paymentStatus || '').toLowerCase();
  if (st === 'cancelled' || st === 'closed') return false;
  if (st === 'received' || st === 'installed' || st === 'paid' || st === 'delivered') return false;
  if (paySt === 'paid' && (st === 'received' || st === 'installed' || st === 'delivered')) return false;
  return true;
}

function isHouzzPoHidden(po) {
  if (!isHouzzSourcePo(po)) return false;
  if (!isOpenPo(po)) return true;
  if (Math.abs(poMerchandiseTotal(po) - poPaidAmount(po)) <= 0.02) return true;
  return false;
}

function isStudioPo(po) {
  return !isHouzzPoHidden(po);
}

async function loadPoDocs(db, scope, projectId, poId) {
  const out = [];
  if (scope === 'po') {
    if (!projectId || !poId) throw new Error('projectId and poId required for scope po');
    const d = await db.collection('boards').doc(projectId).collection('purchaseOrders').doc(String(poId)).get();
    if (!d.exists) throw new Error('PO not found: ' + poId);
    out.push({ doc: d, projectId, boardName: '', boardClient: '' });
    const boardDoc = await db.collection('boards').doc(projectId).get();
    if (boardDoc.exists) {
      const board = boardDoc.data() || {};
      out[0].boardName = str(board.name || board.projectName);
      out[0].boardClient = str(board.clientName || board.client);
    }
    return out;
  }
  if (scope === 'project') {
    if (!projectId) throw new Error('projectId required for scope project');
    const boardDoc = await db.collection('boards').doc(projectId).get();
    if (!boardDoc.exists) throw new Error('board/project not found: ' + projectId);
    const board = boardDoc.data() || {};
    const boardName = str(board.name || board.projectName);
    const boardClient = str(board.clientName || board.client);
    const snap = await db.collection('boards').doc(projectId).collection('purchaseOrders').get();
    snap.forEach((d) => {
      out.push({ doc: d, projectId, boardName, boardClient });
    });
    return out;
  }
  if (scope === 'firm') {
    const boardsSnap = await db.collection('boards').get();
    for (const boardDoc of boardsSnap.docs) {
      const bid = boardDoc.id;
      const board = boardDoc.data() || {};
      const boardName = str(board.name || board.projectName);
      const boardClient = str(board.clientName || board.client);
      let posSnap;
      try {
        posSnap = await db.collection('boards').doc(bid).collection('purchaseOrders').get();
      } catch (_e) {
        continue;
      }
      posSnap.forEach((d) => {
        out.push({ doc: d, projectId: bid, boardName, boardClient });
      });
    }
    return out;
  }
  throw new Error('scope must be po, project, or firm');
}

async function pushPoBatch(opts) {
  const {
    db,
    storage,
    pat,
    poEntries,
    dryRun,
    receiverContacts,
    existingPoNumbers,
    existingSourceKeys,
  } = opts;

  const stats = { pos: 0, lines: 0, imagesAttached: 0, imagesSkipped: 0 };

  for (const entry of poEntries) {
    const pod = entry.doc;
    const po = pod.data() || {};
    if (!isStudioPo(po)) continue;

    const boardName = entry.boardName || '';
    const boardClient = entry.boardClient || '';
    const projectOption = mapProjectOption(boardName, po.projectName);

    const poNumber = firstStr(po.poNumber, po.number) || ('PO-' + pod.id.slice(0, 8));
    const client = firstStr(po.clientName, po.client, boardClient);
    const shipTo = cleanShipTo(firstStr(po.shipTo, po.deliverTo, po.receiver, po.workroom), client);

    const poFields = {};
    poFields[PO.number] = poNumber;
    if (str(po.vendor)) poFields[PO.vendor] = str(po.vendor);
    const receiverName = cleanReceiverName(po, shipTo);
    if (receiverName) {
      poFields[PO.shipTo] = receiverName;
    } else if (shipTo) {
      poFields[PO.shipTo] = shipTo;
    }
    const receiverEmail = resolveReceiverEmail(po, shipTo, receiverContacts);
    if (receiverEmail) poFields[PO.receiverEmail] = receiverEmail;
    poFields[PO.shipToType] = classifyShipToType(po, shipTo);
    poFields[PO.project] = projectOption;
    const iso = poDateIso(po);
    if (iso) poFields[PO.date] = iso;
    const notes = firstStr(po.notes, po.memo);
    if (notes) poFields[PO.notes] = notes;
    const poPdf = firstStr(po.pdfUrl, po.documentUrl);
    if (/^https?:\/\//i.test(poPdf)) poFields[PO.document] = [{ url: poPdf }];
    poFields[PO.overallStatus] = mapOverallStatus(po);

    let poRecordId = null;
    if (!dryRun) {
      const resp = await airtableRequest(pat, 'PATCH', TBL_PO, {
        performUpsert: { fieldsToMergeOn: [PO.number] },
        records: [{ fields: poFields }],
        typecast: true,
      });
      poRecordId = (resp.records && resp.records[0] && resp.records[0].id) || null;
    }
    stats.pos++;

    const items = po.items || po.lineItems || [];
    const lineRecords = [];
    for (let i = 0; i < items.length; i++) {
      const it = await enrichItemImages(db, entry.projectId, items[i] || {});
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
      if (!existingSourceKeys.has(sourceKey)) f[LINE.status] = 'Expected';

      const imgUrl = await resolveImageUrl(storage, it);
      if (imgUrl) {
        f[LINE.productImage] = [{ url: imgUrl }];
        stats.imagesAttached++;
      } else if (rawImageCandidate(it)) {
        stats.imagesSkipped++;
      }

      lineRecords.push({ fields: f });
    }

    if (dryRun) {
      stats.lines += lineRecords.length;
    } else {
      for (const batch of chunk(lineRecords, 10)) {
        await airtableRequest(pat, 'PATCH', TBL_LINES, {
          performUpsert: { fieldsToMergeOn: [LINE.sourceKey] },
          records: batch,
          typecast: true,
        });
        stats.lines += batch.length;
      }
    }
  }

  return stats;
}

/**
 * @param {object} opts
 * @param {import('firebase-admin/firestore').Firestore} opts.db
 * @param {import('firebase-admin/storage').Storage} opts.storage
 * @param {string} opts.pat
 * @param {'po'|'project'|'firm'} opts.scope
 * @param {string} [opts.projectId]
 * @param {string} [opts.poId]
 * @param {boolean} [opts.dryRun]
 */
async function pushPOsToAirtable(opts) {
  const db = opts.db;
  const storage = opts.storage;
  const pat = str(opts.pat);
  const scope = str(opts.scope || 'po');
  const dryRun = !!opts.dryRun;

  if (!dryRun && !pat) throw new Error('AIRTABLE_PAT required');

  const entries = await loadPoDocs(db, scope, opts.projectId, opts.poId);
  const receiverContacts = await loadShipToContacts(db);
  const existingPoNumbers = await listExistingKeys(pat, TBL_PO, PO.number, dryRun);
  const existingSourceKeys = await listExistingKeys(pat, TBL_LINES, LINE.sourceKey, dryRun);

  const stats = await pushPoBatch({
    db,
    storage,
    pat,
    poEntries: entries,
    dryRun,
    receiverContacts,
    existingPoNumbers,
    existingSourceKeys,
  });

  return {
    pos: stats.pos,
    lines: stats.lines,
    imagesAttached: stats.imagesAttached,
    imagesSkipped: stats.imagesSkipped,
  };
}

module.exports = {
  pushPOsToAirtable,
  lookupAirtablePoReceiver,
  BASE,
  TBL_PO,
  TBL_LINES,
};
