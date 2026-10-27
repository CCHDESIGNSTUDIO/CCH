'use strict';
/** READ-ONLY: builds a self-contained visual review page of Somerset Bay junk for Cynthia.
 *  Section A = already in products_archive (the 26 I moved). Section B = proposed to junk from
 *  productLibrary/ (the 37 cross-collection dups). Writes an .html she opens directly. No writes to Firestore. */
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const KEY = require(path.join(__dirname, '..', '_debug', 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json'));
const db = admin.initializeApp({ credential: admin.credential.cert(KEY) }, 'PROD').firestore();
const str = (v) => String(v == null ? '' : v).trim();
const hz = (o) => str(o && (o.houzzId || o.houzzProductId || o.catalogId));
const RE = /somerset\s*bay/i;
function imgList(o) { const a = []; const add = (u) => { u = str(typeof u === 'string' ? u : (u && (u.url || u.imageUrl || u.src))); if (u && u.indexOf('data:') !== 0) a.push(u); }; add(o.imageUrl); add(o.image); ['images', 'imageUrls', 'gallery', 'photos'].forEach((k) => { if (Array.isArray(o[k])) o[k].forEach(add); }); return [...new Set(a)]; }
const esc = (s) => str(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
async function rows(coll) { const snap = await db.collection(coll).get(); const out = []; snap.forEach((d) => { const p = d.data() || {}; if (RE.test(str(p.vendor))) out.push(Object.assign({ _id: d.id }, p)); }); return out; }
function card(p, note) {
  const imgs = imgList(p);
  const thumbs = imgs.length ? imgs.slice(0, 6).map((u, i) => '<img src="' + esc(u) + '" loading="lazy" title="img ' + (i + 1) + '" onerror="this.classList.add(\'broken\')">').join('') : '<div class="noimg">no image on record</div>';
  return '<div class="card"><div class="thumbs">' + thumbs + '</div><div class="meta"><div class="title">' + esc(p.title || p.name || '(untitled)') + '</div>' +
    '<div class="sub">houzzId: ' + esc(hz(p) || '—') + ' &nbsp;·&nbsp; ' + imgs.length + ' image(s) &nbsp;·&nbsp; id ' + esc(p._id) + '</div>' +
    (note ? '<div class="note">' + note + '</div>' : '') + '</div></div>';
}
(async () => {
  const arch = await rows('products_archive');                 // already junked (26)
  const lib = await rows('productLibrary');                     // proposed to junk (legacy dups)
  // keeper map from the dry-run manifest
  let removedSet = {}; try { const m = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '_backup', 'PRODUCTION-vendor-dedup-BOTH-2026-06-08', 'DRYRUN_Somerset_Bay.json'), 'utf8')); m.removed.forEach((r) => { if (r.coll === 'productLibrary') removedSet[r.id] = r; }); } catch (e) {}
  const proposed = lib.filter((p) => removedSet[p._id]);
  const secA = arch.map((p) => card(p, 'Already in Junk — reason: ' + esc((p._archiveMeta && p._archiveMeta.reason) || 'duplicate'))).join('');
  const secB = proposed.map((p) => card(p, 'Proposed → Junk · duplicate of <b>' + esc((removedSet[p._id] || {}).keepId ? '' : '') + (lib.find((x) => false) ? '' : '') + esc((removedSet[p._id] && removedSet[p._id].keepId) || '') + '</b>')).join('');
  const html = '<!doctype html><meta charset="utf-8"><title>Somerset Bay — Junk Review</title><style>' +
    'body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#f6f7f9;color:#15233a;margin:0;padding:24px}' +
    'h1{font-size:22px;margin:0 0 4px}h2{font-size:16px;margin:28px 0 12px;border-bottom:2px solid #d9dee6;padding-bottom:6px}' +
    '.lead{color:#5a6b85;margin:0 0 8px}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:14px}' +
    '.card{background:#fff;border:1px solid #e3e7ee;border-radius:10px;overflow:hidden;display:flex;flex-direction:column}' +
    '.thumbs{display:flex;flex-wrap:wrap;gap:4px;padding:8px;background:#fafbfc;min-height:96px}' +
    '.thumbs img{width:88px;height:88px;object-fit:cover;border-radius:6px;border:1px solid #e3e7ee;background:#eee}' +
    '.thumbs img.broken{opacity:.25;filter:grayscale(1)}.noimg{color:#9aa7bd;font-size:12px;padding:34px 8px}' +
    '.meta{padding:10px 12px}.title{font-weight:600;font-size:14px}.sub{color:#7a8aa3;font-size:11px;margin-top:3px}' +
    '.note{margin-top:6px;font-size:12px;color:#8a5a00;background:#fff7e6;border:1px solid #ffe0a3;border-radius:6px;padding:5px 8px}' +
    '</style>' +
    '<h1>Somerset Bay — Junk Review (production)</h1>' +
    '<p class="lead">Read-only snapshot built ' + '2026-06-08' + '. Tell Claude which to KEEP (restore) or which are correctly junk. Nothing is deleted.</p>' +
    '<h2>A · Already moved to Junk (' + arch.length + ') — in products_archive now</h2><div class="grid">' + secA + '</div>' +
    '<h2>B · Proposed to move to Junk (' + proposed.length + ') — legacy productLibrary duplicates</h2><div class="grid">' + secB + '</div>';
  const out = path.join('C:', 'Users', 'cindy', 'Dropbox', 'Claude - CCH studio', 'Somerset-Bay-JUNK-REVIEW.html');
  fs.writeFileSync(out, html);
  console.log('Wrote review page:', out);
  console.log('Section A (already junked):', arch.length, '| Section B (proposed):', proposed.length);
  process.exit(0);
})().catch((e) => { console.error('ERROR', e.message || e); process.exit(1); });
