#!/usr/bin/env node
'use strict';
/**
 * Move junk rows from active Product Library → Junk Library (quarantine), locked for review.
 *
 *   productLibrary/{id}  → productLibrary_archive/{id}  (deleted from active)
 *   products/{id}        → products_archive/{id}        (deleted from active)
 *
 * Default: does NOT disconnect invoice/proposal/PO library links (review first).
 *
 * Usage (from cch-deploy/):
 *   node _scripts/quarantine-products-library_BY_CLAUDE_2026-06-02.js
 *   node _scripts/quarantine-products-library_BY_CLAUDE_2026-06-02.js --project="Cloud - Rolling Hills"
 *   node _scripts/quarantine-products-library_BY_CLAUDE_2026-06-02.js --apply --backup
 *   node _scripts/quarantine-products-library_BY_CLAUDE_2026-06-02.js --apply --backup --disconnect
 */
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const argv = process.argv.slice(2);
const APPLY = argv.includes('--apply');
const BACKUP = argv.includes('--backup') || APPLY;
const SKIP_DISCONNECT = !argv.includes('--disconnect');
const PROJECT_FILTER = (() => {
  const m = argv.find((a) => a.startsWith('--project='));
  return m ? m.split('=').slice(1).join('=').trim() : '';
})();
const FROM_REPORT = (() => {
  const m = argv.find((a) => a.startsWith('--from-report='));
  return m ? m.split('=').slice(1).join('=').trim() : '';
})();

const KEY = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
const ARCHIVE_LIB = 'productLibrary_archive';
const ARCHIVE_PROD = 'products_archive';
const BATCH_SIZE = 400;
const SCRIPT_TAG = 'quarantine-products-library_BY_CLAUDE_2026-06-02.js';
const BACKUP_TAG = 'products-library-quarantine-2026-06-02';

const JUNK_THRESHOLD = 25;

function str(v) {
  return String(v == null ? '' : v).trim();
}

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
  if (/\bbackflow\b/.test(t) || /\bcheck valve\b/.test(t) || /\bfactory installed\b/.test(t)) return false;
  if (/\binstall(?:ed|ation)\s+(?:fee|labor|service|charge)\b/.test(t)) return false;
  if (/^\$[\d,.]+$/.test(t)) return false;
  if (/^\s*[+\-−]\s*\$[\d,.]+\s*(usd)?\s*$/.test(t)) return false;
  if (/^\s*\$[\d,.]+\s*usd\s*$/.test(t)) return false;
  if (/^\d+\s+(n\.?|s\.?|e\.?|w\.?)\s+\w/.test(t) || t.includes('santa ana') || t.includes('california')) return false;
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

function hasHttpImage(data) {
  const u = str(data.imageUrl || data.image || data.thumbnail || data.hero);
  return !!(u && /^https?:\/\//i.test(u));
}

function meaningfulFieldCount(data) {
  const skip = new Set(['updatedAt', 'createdAt', 'owner', 'archivedAt', 'reason', '_archiveMeta',
    'productLifecycle', 'libraryItemKind', 'source', '_quarantineLocked']);
  let n = 0;
  Object.keys(data || {}).forEach((k) => {
    if (skip.has(k)) return;
    const v = data[k];
    if (v == null || v === '') return;
    if (typeof v === 'string' && !v.trim()) return;
    if (Array.isArray(v) && !v.length) return;
    n++;
  });
  return n;
}

function classifyJunk(data) {
  const title = str(data.title || data.name);
  const vendor = str(data.vendor || data.manufacturer);
  const hasHouzz = !!(str(data.houzzId || data.houzzProductId || data.catalogId));
  const hasProductCode = !!str(data.productCode);
  const hasSku = !!str(data.sku);
  const hasUrl = !!str(data.productUrl || data.vendorUrl || data.pageUrl || data.clippedFromUrl);
  const hasCost = parseFloat(data.costPrice || data.unitCost || data.cost) > 0;
  const hasSell = parseFloat(data.sellPrice || data.price || data.clientPrice) > 0;
  const hasImage = hasHttpImage(data);
  const fields = meaningfulFieldCount(data);
  const hasUsefulIdentity = title.length >= 3 && vendor.length >= 2;
  const hasUsefulCommerce = hasSku || hasUrl || hasCost || hasSell;
  let isJunk = !hasHouzz && !hasProductCode;
  if (isJunk) {
    if (!hasUsefulIdentity) isJunk = true;
    else if (!hasImage && !hasUsefulCommerce && fields < 8) isJunk = true;
    else if (fields < 6) isJunk = true;
  }
  return { isJunk, fields };
}

function projectLabel(data) {
  return str(data.project || data.projectName || data.projectId);
}

function classifyRow(data) {
  const title = str(data.title || data.name);
  const reasons = [];
  if (!isRealProduct(data)) reasons.push('not-real-product');
  const js = junkScore(title);
  if (js >= JUNK_THRESHOLD) reasons.push('spec-junk:' + js);
  const cj = classifyJunk(data);
  if (cj.isJunk) reasons.push('quarantine-classify');
  if (/^(total\s+)?wattage\s*:/i.test(title)) reasons.push('title-wattage-line');
  if (/^weight\s*:/i.test(title)) reasons.push('title-weight-line');
  if (/^provide\s+satisfying/i.test(title)) reasons.push('title-marketing-fragment');
  if (title.length > 0 && title.length < 8 && !/\d/.test(title)) reasons.push('title-too-short');
  return { remove: reasons.length > 0, reasons, junkScore: js };
}

function mergeRow(existing, incoming) {
  if (!incoming) return existing;
  if (!existing) return Object.assign({ id: incoming.id }, incoming);
  return Object.assign({}, existing, incoming);
}

function buildArchiveMeta(row, ts, projectId) {
  return {
    archivedAt: ts,
    archivedBy: SCRIPT_TAG,
    reason: (row.reasons || []).join(', '),
    junkScore: row.junkScore || 0,
    projectId,
    junkLibrary: true,
    reviewRequired: true
  };
}

function lockPayload(data, meta, ts) {
  return Object.assign({}, data, {
    productLifecycle: 'junk',
    libraryItemKind: 'junk',
    _quarantineLocked: true,
    _quarantineLockedAt: ts,
    _archiveMeta: meta,
    updatedAt: ts
  });
}

async function buildPlan(db) {
  if (FROM_REPORT && fs.existsSync(FROM_REPORT)) {
    const rep = JSON.parse(fs.readFileSync(FROM_REPORT, 'utf8'));
    return (rep.remove || []).map((r) => ({
      id: r.id,
      title: r.title,
      vendor: r.vendor,
      project: r.project,
      reasons: r.reasons || [],
      junkScore: r.junkScore || 0
    }));
  }

  const [prodSnap, libSnap] = await Promise.all([
    db.collection('products').get(),
    db.collection('productLibrary').get()
  ]);
  const mergeMap = {};
  prodSnap.forEach((d) => {
    mergeMap[d.id] = mergeRow(mergeMap[d.id], Object.assign({ id: d.id }, d.data()));
  });
  libSnap.forEach((d) => {
    mergeMap[d.id] = mergeRow(mergeMap[d.id], Object.assign({ id: d.id }, d.data()));
  });

  const plan = [];
  Object.values(mergeMap).forEach((row) => {
    if (PROJECT_FILTER) {
      const pl = projectLabel(row).toLowerCase();
      if (!pl.includes(PROJECT_FILTER.toLowerCase())) return;
    }
    const c = classifyRow(row);
    if (!c.remove) return;
    plan.push({
      id: row.id,
      title: str(row.title || row.name) || '(no title)',
      vendor: str(row.vendor || row.manufacturer),
      project: projectLabel(row),
      reasons: c.reasons,
      junkScore: c.junkScore
    });
  });
  return plan;
}

async function main() {
  if (!fs.existsSync(KEY)) {
    console.error('Missing service account:', KEY);
    process.exit(2);
  }
  const keyJson = require(KEY);
  admin.initializeApp({ credential: admin.credential.cert(keyJson) });
  const db = admin.firestore();
  const projectId = keyJson.project_id || '(unknown)';

  console.log('Product Library quarantine');
  console.log('Project:', projectId);
  console.log('Mode:', APPLY ? 'APPLY' : 'DRY-RUN');
  if (PROJECT_FILTER) console.log('Scope:', PROJECT_FILTER);
  if (SKIP_DISCONNECT) console.log('Doc/clip library links: LEFT INTACT (review in Junk Library)');
  console.log('');

  const plan = await buildPlan(db);
  const quarantineIds = new Set(plan.map((p) => p.id));

  console.log('Candidates to quarantine:', plan.length);
  if (plan.length) {
    plan.slice(0, 8).forEach((p) => {
      console.log(' ', p.id, '|', JSON.stringify(p.title).slice(0, 50), '|', p.reasons.join(', '));
    });
    if (plan.length > 8) console.log(' …', plan.length - 8, 'more');
  }

  const backupDir = path.join(__dirname, '..', '_backup', BACKUP_TAG);
  if (BACKUP) {
    fs.mkdirSync(backupDir, { recursive: true });
    fs.writeFileSync(
      path.join(backupDir, 'quarantine-plan-' + (APPLY ? 'applied' : 'dryrun') + '_BY_CLAUDE_2026-06-02.json'),
      JSON.stringify({
        script: SCRIPT_TAG,
        at: new Date().toISOString(),
        projectId,
        mode: APPLY ? 'apply' : 'dry-run',
        scope: PROJECT_FILTER || 'all',
        skipDisconnect: SKIP_DISCONNECT,
        archiveCollections: { library: ARCHIVE_LIB, products: ARCHIVE_PROD },
        count: plan.length,
        plan
      }, null, 2)
    );
    console.log('Plan saved:', backupDir);
  }

  if (!APPLY) {
    console.log('\nDry-run only. Run with --apply --backup to move rows to Junk Library.');
    console.log('In Studio: Product Library → 🗑️ Junk Library');
    return;
  }

  if (!plan.length) {
    console.log('Nothing to quarantine.');
    return;
  }

  if (!SKIP_DISCONNECT) {
    console.warn('--disconnect: run cleanup-productlibrary-duplicates script separately if you need link stripping.');
  }

  const ts = new Date().toISOString();
  const preDump = [];
  let moved = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < plan.length; i += BATCH_SIZE) {
    const chunk = plan.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    let batchOps = 0;

    for (const row of chunk) {
      try {
        const meta = buildArchiveMeta(row, ts, projectId);
        const libRef = db.collection('productLibrary').doc(row.id);
        const prodRef = db.collection('products').doc(row.id);
        const [libDoc, prodDoc] = await Promise.all([libRef.get(), prodRef.get()]);

        if (!libDoc.exists && !prodDoc.exists) {
          skipped++;
          continue;
        }

        if (libDoc.exists) {
          const data = libDoc.data() || {};
          preDump.push({ id: row.id, collection: 'productLibrary', data });
          batch.set(db.collection(ARCHIVE_LIB).doc(row.id), lockPayload(data, meta, ts), { merge: false });
          batch.delete(libRef);
          batchOps += 2;
        }

        if (prodDoc.exists) {
          const pdata = prodDoc.data() || {};
          preDump.push({ id: row.id, collection: 'products', data: pdata });
          batch.set(db.collection(ARCHIVE_PROD).doc(row.id), lockPayload(pdata, meta, ts), { merge: false });
          batch.delete(prodRef);
          batchOps += 2;
        }

        moved++;
      } catch (e) {
        errors++;
        console.warn('Prepare failed', row.id, e.message || e);
      }
    }

    if (batchOps) await batch.commit();
    console.log('Batch', Math.min(i + BATCH_SIZE, plan.length), '/', plan.length);
  }

  if (BACKUP && preDump.length) {
    fs.writeFileSync(
      path.join(backupDir, 'quarantine-pre-apply_BY_CLAUDE_2026-06-02.json'),
      JSON.stringify(preDump, null, 2)
    );
  }

  console.log('\n=== DONE ===');
  console.log('Quarantined (locked in Junk Library):', moved);
  console.log('Skipped (already gone):', skipped);
  console.log('Errors:', errors);
  console.log('Browse: Studio → Product Library → 🗑️ Junk Library');
  console.log('Restore one row: open detail → ↩ Restore to active catalog');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
