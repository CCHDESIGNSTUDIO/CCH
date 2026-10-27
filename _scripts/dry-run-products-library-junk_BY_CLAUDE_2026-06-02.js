#!/usr/bin/env node
'use strict';
/**
 * DRY RUN — merged Product Library (products + productLibrary), no writes.
 *
 * Flags rows that should be quarantined/removed using:
 *   - platform isRealProduct()
 *   - spec-junk junkScore (clip cleanup rules)
 *   - classifyJunk (quarantine script)
 *
 * Usage (from cch-deploy/):
 *   node _scripts/dry-run-products-library-junk_BY_CLAUDE_2026-06-02.js
 *   node _scripts/dry-run-products-library-junk_BY_CLAUDE_2026-06-02.js --project="Cloud - Rolling Hills"
 *   node _scripts/dry-run-products-library-junk_BY_CLAUDE_2026-06-02.js --csv
 */
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const WRITE_CSV = process.argv.includes('--csv');
const PROJECT_FILTER = (() => {
  const m = process.argv.find((a) => a.startsWith('--project='));
  return m ? m.split('=').slice(1).join('=').trim() : '';
})();

const KEY = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');

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
    'productLifecycle', 'libraryItemKind', 'source']);
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
  return { isJunk, hasHouzz, hasProductCode, fields };
}

function mergeRow(existing, incoming) {
  if (!incoming) return existing;
  if (!existing) return Object.assign({ id: incoming.id }, incoming);
  return Object.assign({}, existing, incoming);
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
  const remove = reasons.length > 0;
  return { remove, reasons, junkScore: js, classifyJunk: cj };
}

async function main() {
  if (!fs.existsSync(KEY)) {
    console.error('Missing service account:', KEY);
    process.exit(2);
  }
  admin.initializeApp({ credential: admin.credential.cert(require(KEY)) });
  const db = admin.firestore();
  const mergeMap = {};

  console.log('DRY RUN — merged products + productLibrary');
  if (PROJECT_FILTER) console.log('Project filter:', PROJECT_FILTER);
  console.log('No Firestore writes.\n');

  const [prodSnap, libSnap] = await Promise.all([
    db.collection('products').get(),
    db.collection('productLibrary').get()
  ]);

  prodSnap.forEach((d) => {
    mergeMap[d.id] = mergeRow(mergeMap[d.id], Object.assign({ id: d.id, _inProducts: true }, d.data()));
  });
  libSnap.forEach((d) => {
    mergeMap[d.id] = mergeRow(mergeMap[d.id], Object.assign({ id: d.id, _inProductLibrary: true }, d.data()));
  });

  const all = Object.values(mergeMap);
  const filtered = PROJECT_FILTER
    ? all.filter((r) => projectLabel(r).toLowerCase().includes(PROJECT_FILTER.toLowerCase())
      || str(r.projectId).toLowerCase().includes(PROJECT_FILTER.toLowerCase().replace(/\s+/g, '-')))
    : all;

  const wouldRemove = [];
  const wouldKeep = [];
  const byReason = {};

  filtered.forEach((row) => {
    const c = classifyRow(row);
    if (c.remove) {
      c.reasons.forEach((r) => { byReason[r] = (byReason[r] || 0) + 1; });
      wouldRemove.push({
        id: row.id,
        title: str(row.title || row.name) || '(no title)',
        vendor: str(row.vendor || row.manufacturer) || '',
        project: projectLabel(row),
        room: str(row.room),
        category: str(row.category),
        sku: str(row.sku),
        reasons: c.reasons,
        junkScore: c.junkScore,
        inProducts: !!row._inProducts,
        inProductLibrary: !!row._inProductLibrary,
        imageUrl: str(row.imageUrl || row.image).slice(0, 80)
      });
    } else {
      wouldKeep.push(row.id);
    }
  });

  wouldRemove.sort((a, b) => (b.junkScore || 0) - (a.junkScore || 0) || a.title.localeCompare(b.title));

  console.log('=== COUNTS ===');
  console.log('products docs:', prodSnap.size);
  console.log('productLibrary docs:', libSnap.size);
  console.log('merged unique ids:', all.length);
  console.log('scoped rows:', filtered.length);
  console.log('would REMOVE (any rule):', wouldRemove.length);
  console.log('would KEEP:', wouldKeep.length);
  console.log('\nBy reason (rows may have multiple):');
  Object.keys(byReason).sort((a, b) => byReason[b] - byReason[a]).forEach((k) => {
    console.log(' ', k + ':', byReason[k]);
  });

  console.log('\n=== SAMPLE REMOVALS (first 40) ===');
  wouldRemove.slice(0, 40).forEach((r) => {
    console.log('-', r.id);
    console.log('   ', JSON.stringify(r.title), '|', r.vendor || '(no vendor)', '|', r.project || '(no project)');
    console.log('    reasons:', r.reasons.join(', '));
  });
  if (wouldRemove.length > 40) console.log('… and', wouldRemove.length - 40, 'more in report file');

  const rhOnly = wouldRemove.filter((r) => /rolling hills/i.test(r.project));
  console.log('\nCloud - Rolling Hills tagged:', rhOnly.length);

  const backupDir = path.join(__dirname, '..', '_backup', 'products-library-dryrun-2026-06-02');
  fs.mkdirSync(backupDir, { recursive: true });
  const reportPath = path.join(backupDir, 'dry-run-products-library-junk_BY_CLAUDE_2026-06-02.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    at: new Date().toISOString(),
    projectFilter: PROJECT_FILTER || null,
    productsCount: prodSnap.size,
    productLibraryCount: libSnap.size,
    mergedCount: all.length,
    scopedCount: filtered.length,
    removeCount: wouldRemove.length,
    keepCount: wouldKeep.length,
    byReason,
    rollingHillsRemoveCount: rhOnly.length,
    remove: wouldRemove
  }, null, 2));
  console.log('\nReport:', reportPath);

  if (WRITE_CSV) {
    const csvPath = path.join(backupDir, 'dry-run-products-library-junk_BY_CLAUDE_2026-06-02.csv');
    const lines = ['id,title,vendor,project,room,category,reasons,junkScore,inProducts,inProductLibrary'];
    wouldRemove.forEach((r) => {
      lines.push([
        r.id,
        '"' + r.title.replace(/"/g, '""') + '"',
        '"' + r.vendor.replace(/"/g, '""') + '"',
        '"' + r.project.replace(/"/g, '""') + '"',
        '"' + r.room.replace(/"/g, '""') + '"',
        '"' + r.category.replace(/"/g, '""') + '"',
        '"' + r.reasons.join(';').replace(/"/g, '""') + '"',
        r.junkScore,
        r.inProducts ? 'Y' : 'N',
        r.inProductLibrary ? 'Y' : 'N'
      ].join(','));
    });
    fs.writeFileSync(csvPath, lines.join('\n'));
    console.log('CSV:', csvPath);
  }

  console.log('\nIf approved, quarantine via:');
  console.log('  node _scripts/cleanup-productlibrary-duplicates_BY_CLAUDE_2026-06-01.js --apply --backup');
  console.log('(review report first; script uses its own classifyJunk — align ids with this list)');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
