#!/usr/bin/env node
'use strict';
/**
 * Remove non-product / spec-junk room-board clips across one or all projects.
 * NEVER deletes or modifies clips referenced on invoice / proposal / PO lines.
 *
 *   node _scripts/cleanup-nonproduct-clips_BY_CLAUDE_2026-06-03.js --project=cloud-rolling-hills
 *   node _scripts/cleanup-nonproduct-clips_BY_CLAUDE_2026-06-03.js --all
 *   node _scripts/cleanup-nonproduct-clips_BY_CLAUDE_2026-06-03.js --all --apply
 */
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const KEY = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
admin.initializeApp({ credential: admin.credential.cert(require(KEY)) });
const db = admin.firestore();

const APPLY = process.argv.includes('--apply');
const PROJECT_ARG = (process.argv.find((a) => a.startsWith('--project=')) || '').split('=')[1] || '';
const ALL = process.argv.includes('--all');
const BACKUP_DIR = path.join(__dirname, '..', '_backup', 'nonproduct-cleanup-2026-06-03');
const JUNK_THRESHOLD = 25;
const DOC_COLLECTIONS = ['invoices', 'proposals', 'purchaseOrders'];

function junkScore(title) {
  const t = String(title || '').trim();
  if (!t) return 0;
  let score = 0;
  if (/^(weight|wattage|total wattage|top to center|extension|height|width|depth|overall weight)/i.test(t)) score += 50;
  if (/weight\s*:/i.test(t)) score += 40;
  if (/wattage|watts\b/i.test(t) && t.length < 80) score += 35;
  if (/provide satisfying|contrast\./i.test(t)) score += 45;
  if (/speak for itself|perfectly together|fluted brass body/i.test(t)) score += 45;
  if (/\d+(\.\d+)?["″'′]?\s*[x×]\s*\d+/i.test(t) && t.length < 55) score += 40;
  if (t.length < 55 && /\.\.\.|…/.test(t)) score += 35;
  if (/top to center/i.test(t)) score += 40;
  if (/cm\)|in \(\d|\blbs\.?\s*$/i.test(t) && t.length < 70) score += 25;
  if (/takes \d+x|not included|socket type|plug in no/i.test(t)) score += 30;
  if (/cracked edge\.?$/i.test(t) || /^licorice$/i.test(t)) score += 35;
  if (/illuminating |vaudeville|become a go-to/i.test(t)) score += 40;
  if (t.length < 12 && /lbs|watt|inch|cm/i.test(t)) score += 20;
  if (t.length > 120 && !/\b(pendant|sconce|chandelier|mirror|sofa|chair|table|lamp|fixture|mount)\b/i.test(t)) score += 15;
  return score;
}

function isClipperSource(data) {
  const src = String(data.source || '').trim().toLowerCase();
  return src === 'cch-studio-clipper' || src === 'clipper';
}

function clipHasDocMarker(data) {
  data = data || {};
  if (data._docLinkedAt || data._frozenOnDocAt) return true;
  return !!String(
    data.invoiceNum || data.houzzInvoice || data.proposalNum || data.poNum
    || data.invoiceId || data.proposalId || data.poId || ''
  ).trim();
}

/** Port of platform isRealProduct + install/service title patterns missing from UI filter. */
function isRealProduct(p) {
  p = p || {};
  const _kind = String(p.libraryItemKind || p.itemKind || '').toLowerCase();
  if (_kind === 'design_service' || _kind === 'expense' || _kind === 'labor' || _kind === 'service') return false;
  const rawTitle = String(p.title || p.name || '').trim();
  const t = rawTitle.toLowerCase();
  if (!t || t === 'untitled') return false;
  if (t === 'clip' || t === 'change password' || t.indexOf('change password') >= 0) return false;
  if (rawTitle.length > 100) return false;
  if (t.indexOf('butterfly motifs are brought to life') === 0) return false;
  if (t === 'expense' || t === 'expenses' || t === 'labor' || t === 'labour' || t === 'services' || t === 'service'
    || t === 'design services' || t === 'design service') return false;
  if (rawTitle.charAt(0) === '&') return false;
  if (t.startsWith('po ') || t.startsWith('po-') || t.match(/^po\s*po-/i)) return false;
  if (/^\$[\d,.]+$/.test(t)) return false;
  if (/^\s*[+\-−]\s*\$[\d,.]+\s*(usd)?\s*$/.test(t)) return false;
  if (/^\s*\$[\d,.]+\s*usd\s*$/.test(t)) return false;
  if (/^\d+\s+(n\.?|s\.?|e\.?|w\.?)\s+\w/.test(t) || t.includes('santa ana') || t.includes('california')) return false;
  if (/\bbackflow\b/.test(t) || /\bcheck valve\b/.test(t) || /\bfactory installed\b/.test(t)) return false;
  if (/\binstall(?:ed|ation)\s+(?:fee|labor|service|charge)\b/.test(t)) return false;
  const cat = String(p.category || '').toLowerCase().trim();
  const rm = String(p.room || '').toLowerCase().trim();
  const _badSvc = ['service', 'labor', 'fee', 'services', 'fees', 'labour', 'taxes', 'shipping',
    'delivery', 'installation', 'design fee', 'design fees', 'design services', 'design service', 'professional services',
    'project management', 'admin', 'time billing', 'time', 'billing', 'retainer',
    'consulting', 'consultation', 'uncategorized', 'blended design fees', 'blended design services',
    'designer fee', 'designer fees', 'time track', 'time tracking', 'expense', 'expenses',
    'cch design services', 'cch design service', 'cch project management',
    'etails', 'details', 'etail', 'retail'];
  if (_badSvc.indexOf(cat) >= 0 || _badSvc.indexOf(rm) >= 0) return false;
  const serviceTerms = ['freight', 'delivery charge', 'delivery fee', 'installation', 'install labor',
    'labor', 'labour', 'design fee', 'design service', 'interior design service',
    'consultation', 'consult fee', 'project management', 'admin fee', 'rush fee', 'restocking',
    'shipping', 'shipping charge', 'handling', 's&h', 's & h',
    'travel', 'mileage', 'site visit', 'site visits', 'supervision', 'coordination',
    'white glove', 'assembly', 'receiving fee', 'storage fee', 'storage charge',
    'crating', 'return fee', 'disposal', 'demolition', 'removal',
    'electrical work', 'plumbing work', 'painting labor', 'drywall', 'carpentry',
    'tile installation', 'wallpaper installation', 'wall paper installation',
    'window treatment installation', 'shade installation', 'blind installation',
    'upholstery labor', 'reupholstery', 'refinishing', 'touch up', 'touch-up', 'repair labor',
    'alteration', 'hem ', 'hemming', 'monogram', 'custom fabrication labor', 'sewing',
    'hourly rate', 'flat fee', 'flat rate', 'retainer', 'service fee', 'service charge',
    'professional fee', 'management fee', 'procurement fee', 'sourcing fee',
    'deposit', 'progress payment', 'final payment', 'balance due', 'balance payment',
    'credit', 'credit memo', 'adjustment', 'price adjustment',
    'discount', 'tax', 'sales tax', 'pre paid tax', 'prepaid tax', 'surcharge',
    'expense', 'expenses',
    'permit', 'permit fee', 'overtime', 'after hours', 'expedite fee', 'expediting',
    'setup', 'set up', 'set-up', 'breakdown', 'clean up', 'cleanup', 'clean-up',
    'project fee', 'design retainer', 'monthly retainer', 'hourly fee',
    'contractor', 'subcontractor', 'sub contractor',
    'blended services', 'client project services', 'project meetings',
    'design concepts & mood boards', 'concepts & mood boards', 'base model'];
  if (serviceTerms.some(function (s) {
    return t === s || new RegExp('\\b' + s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b').test(t);
  })) return false;
  if (t.startsWith('cch ') && (t.includes('service') || t.includes('meeting') || t.includes('concepts') || t.includes('billing'))) return false;
  if (t.includes('cch design inc')) return false;
  const v = String(p.vendor || '').toLowerCase();
  const _mfg = String(p.manufacturer || '').trim();
  const _sku = String(p.sku || '').trim();
  const _costN = parseFloat(p.cost || p.costPrice || p.unitCost || p.totalCost || p.tradeCost);
  const _sellN = parseFloat(p.clientPrice || p.sell || p.sellPrice || p.totalSelling || p.totalSell || p.price);
  const hasIdOrMoney = !!(String(p.vendor || '').trim() || _mfg || _sku || (!isNaN(_costN) && _costN > 0) || (!isNaN(_sellN) && _sellN > 0));
  const hasProductImage = !!(String(p.image || p.imageUrl || p.heroImageUrl || p.thumbUrl || '').trim());
  if (!hasIdOrMoney && hasProductImage && t.length >= 3 && !/^(quick\s*clip|untitled|item|product)$/i.test(rawTitle)) {
    return true;
  }
  if (!v && !_mfg && !_sku && (isNaN(_costN) || _costN <= 0) && (isNaN(_sellN) || _sellN <= 0)) return false;
  return true;
}

function isSpecJunk(data) {
  return junkScore(data.title) >= JUNK_THRESHOLD;
}

function classifyClip(data, docClipIds, clipId) {
  if (isClipperSource(data)) return { action: 'keep', reason: 'clipper' };
  if (docClipIds.has(clipId)) return { action: 'keep', reason: 'doc-line-ref' };
  if (clipHasDocMarker(data)) return { action: 'keep', reason: 'doc-marker-on-clip' };
  if (isSpecJunk(data)) return { action: 'delete', reason: 'spec-junk', score: junkScore(data.title) };
  if (!isRealProduct(data)) return { action: 'delete', reason: 'non-product' };
  return { action: 'keep', reason: 'product' };
}

async function buildDocClipIndex(projectId) {
  const clipIds = new Set();
  const refs = [];
  for (const coll of DOC_COLLECTIONS) {
    const snap = await db.collection('boards').doc(projectId).collection(coll).get();
    for (const doc of snap.docs) {
      const x = doc.data() || {};
      const docNum = String(x.invoiceNum || x.proposalNum || x.poNum || x.number || x.name || doc.id).trim();
      const items = Array.isArray(x.items) ? x.items : [];
      items.forEach((line, idx) => {
        const cid = String(line && (line.clipId || line.sourceClipId) || '').trim();
        if (!cid) return;
        clipIds.add(cid);
        refs.push({ clipId: cid, docType: coll, docId: doc.id, docNum, lineIndex: idx, title: String(line.title || '').slice(0, 80) });
      });
    }
  }
  return { clipIds, refs };
}

async function listProjectIds() {
  if (PROJECT_ARG) return [PROJECT_ARG];
  if (ALL) {
    const snap = await db.collection('boards').get();
    return snap.docs.map((d) => d.id);
  }
  console.error('Specify --project=BOARD_ID or --all');
  process.exit(1);
}

async function clearCatalogRoomForClip(projectId, clipData) {
  const ts = new Date().toISOString();
  const patch = {
    room: admin.firestore.FieldValue.delete(),
    updatedAt: ts,
    _nonProductRoomClearedAt: ts,
    _nonProductRoomClearedBy: 'cleanup-nonproduct-clips_BY_CLAUDE_2026-06-03',
  };
  const libId = String(clipData.libraryProductId || clipData.libraryId || '').trim();
  const clipId = String(clipData._clipId || '').trim();
  let n = 0;
  if (libId && libId !== clipId) {
    for (const coll of ['products', 'productLibrary']) {
      try {
        await db.collection(coll).doc(libId).update(patch);
        n++;
      } catch (_e) {}
    }
  }
  return n;
}

async function processProject(projectId) {
  const boardSnap = await db.collection('boards').doc(projectId).get();
  if (!boardSnap.exists) return { projectId, skipped: true, reason: 'board missing' };

  const projName = String((boardSnap.data() || {}).name || '').trim();
  const docIndex = await buildDocClipIndex(projectId);
  const clipSnap = await db.collection('boards').doc(projectId).collection('clips').get();

  const toDelete = [];
  const skippedDoc = [];
  const kept = [];

  clipSnap.forEach((d) => {
    const data = d.data() || {};
    const cls = classifyClip(data, docIndex.clipIds, d.id);
    const row = {
      id: d.id,
      title: data.title,
      room: data.room,
      source: data.source,
      category: data.category,
      libraryProductId: data.libraryProductId,
      reason: cls.reason,
      score: cls.score,
    };
    if (cls.action === 'delete') toDelete.push({ id: d.id, ref: d.ref, data, meta: row });
    else if (cls.reason === 'doc-line-ref' || cls.reason === 'doc-marker-on-clip') skippedDoc.push(row);
    else kept.push(row);
  });

  // Dedupe non-product duplicates same lib+room (only among delete candidates, never doc-linked)
  const dupeGroups = new Map();
  for (const c of toDelete) {
    const lib = String(c.data.libraryProductId || '').trim();
    const room = String(c.data.room || '').trim().toLowerCase();
    if (!lib || !room) continue;
    const key = lib + '|' + room;
    if (!dupeGroups.has(key)) dupeGroups.set(key, []);
    dupeGroups.get(key).push(c);
  }
  const dupeExtraDelete = [];
  dupeGroups.forEach((group) => {
    if (group.length < 2) return;
    group.sort((a, b) => String(a.data.addedAt || '').localeCompare(String(b.data.addedAt || '')));
    for (let i = 1; i < group.length; i++) {
      dupeExtraDelete.push(Object.assign({}, group[i].meta, { reason: 'duplicate-nonproduct' }));
      if (!toDelete.find((x) => x.id === group[i].id)) {
        toDelete.push(group[i]);
      }
    }
  });

  const result = {
    projectId,
    projectName: projName,
    clipsBefore: clipSnap.size,
    docLinkedClipCount: docIndex.clipIds.size,
    toDelete: toDelete.map((c) => c.meta),
    skippedDocLinked: skippedDoc.slice(0, 50),
    skippedDocLinkedTotal: skippedDoc.length,
    dupeExtraDelete,
    deletedCount: 0,
    catalogRoomClears: 0,
  };

  if (!APPLY) return result;

  for (const c of toDelete) {
    const payload = Object.assign({}, c.data, { _clipId: c.id });
    result.catalogRoomClears += await clearCatalogRoomForClip(projectId, payload);
    await c.ref.delete();
    result.deletedCount++;
  }

  const after = await db.collection('boards').doc(projectId).collection('clips').get();
  result.clipsAfter = after.size;
  return result;
}

(async () => {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const projectIds = await listProjectIds();
  console.log(APPLY ? '=== APPLY ===' : '=== DRY RUN ===');
  console.log('Projects:', projectIds.length);

  const allResults = [];
  let totalDelete = 0;
  let totalDeleted = 0;

  for (const pid of projectIds) {
    const r = await processProject(pid);
    allResults.push(r);
    if (r.skipped) {
      console.log('\n', pid, '— skipped:', r.reason);
      continue;
    }
    totalDelete += (r.toDelete || []).length;
    totalDeleted += r.deletedCount || 0;
    console.log('\n', pid, r.projectName ? '(' + r.projectName + ')' : '');
    console.log('  clips:', r.clipsBefore, '| doc-linked refs:', r.docLinkedClipCount);
    console.log('  to delete:', (r.toDelete || []).length, '| doc-protected:', r.skippedDocLinkedTotal || 0);
    if ((r.toDelete || []).length) {
      r.toDelete.slice(0, 5).forEach((c, i) => {
        console.log('   ', i + 1, c.reason, '|', String(c.title || '').slice(0, 55), '|', c.room);
      });
    }
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    mode: APPLY ? 'apply' : 'dry-run',
    projectCount: projectIds.length,
    totalToDelete: totalDelete,
    totalDeleted: totalDeleted,
    projects: allResults,
  };

  const reportName = APPLY ? 'apply-report.json' : 'dry-run-report.json';
  const reportPath = path.join(BACKUP_DIR, reportName);
  fs.writeFileSync(reportPath, JSON.stringify(summary, null, 2));
  console.log('\nReport:', reportPath);
  console.log('Total to delete:', totalDelete);
  if (!APPLY) console.log('\nRun with --apply to execute.');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
