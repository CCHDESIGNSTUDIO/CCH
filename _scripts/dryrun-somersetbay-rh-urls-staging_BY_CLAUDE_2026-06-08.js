'use strict';
/**
 * DRY RUN (read-only) — show the EXACT image URLs that would be attached to the
 * Somerset Bay / Cloud-Rolling-Hills items. Items: STAGING Firestore. Photo files +
 * download tokens: PROD Storage (houzz-products/{houzzId}/). ZERO writes.
 */
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const KEY_DIR = path.join(__dirname, '..', '_debug', 'service-account.json');
const prodKey = require(path.join(KEY_DIR, 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json'));
const stgKey = require(path.join(KEY_DIR, 'cch-studio-staging-firebase-adminsdk-fbsvc-b93c6f1cf4.json'));
const BUCKET = 'cch-design-boards.firebasestorage.app';
const prodApp = admin.initializeApp({ credential: admin.credential.cert(prodKey), storageBucket: BUCKET }, 'prod');
const prodBucket = prodApp.storage().bucket();
const stgDb = admin.initializeApp({ credential: admin.credential.cert(stgKey) }, 'stg').firestore();

const PROJECT = 'cloud-rolling-hills';
const VENDOR_RE = /somerset\s*bay/i;
const IMG_RE = /\.(jpe?g|png|webp|gif)$/i;
const str = (v) => String(v == null ? '' : v).trim();
const houzzIdOf = (o) => str(o && (o.houzzId || o.houzzProductId || o.catalogId));
const dlUrl = (p, t) => 'https://firebasestorage.googleapis.com/v0/b/' + BUCKET + '/o/' + encodeURIComponent(p) + '?alt=media&token=' + t;

function curImgs(o) {
  const s = new Set();
  const add = (u) => { u = str(typeof u === 'string' ? u : (u && (u.url || u.imageUrl || u.src))); if (u && u.indexOf('data:') !== 0) s.add(u); };
  if (o) { add(o.imageUrl); add(o.image); ['images', 'imageUrls', 'gallery', 'photos'].forEach((k) => { if (Array.isArray(o[k])) o[k].forEach(add); }); }
  return [...s];
}
async function storageUrlsFor(hid) {
  if (!hid) return [];
  const [files] = await prodBucket.getFiles({ prefix: 'houzz-products/' + hid + '/', maxResults: 32 });
  const imgs = files.filter((f) => IMG_RE.test(f.name)).sort((a, b) => (parseInt(path.basename(a.name), 10) || 0) - (parseInt(path.basename(b.name), 10) || 0) || a.name.localeCompare(b.name));
  const out = [];
  for (const f of imgs) {
    try { const [m] = await f.getMetadata(); let t = m.metadata && m.metadata.firebaseStorageDownloadTokens; t = t ? String(t).split(',')[0] : ''; out.push({ file: path.basename(f.name), url: t ? dlUrl(f.name, t) : '(NO download token — ' + f.name + ')' }); }
    catch (e) { out.push({ file: path.basename(f.name), url: '(metadata error)' }); }
  }
  return out;
}

(async () => {
  const snap = await stgDb.collection('boards').doc(PROJECT).collection('clips').get();
  const items = [];
  snap.forEach((d) => { const c = d.data() || {}; if (VENDOR_RE.test(str(c.vendor))) items.push({ clipId: d.id, title: str(c.title || c.name), room: str(c.room), houzzId: houzzIdOf(c), currentCount: curImgs(c).length }); });
  const byHid = {};
  items.forEach((it) => { (byHid[it.houzzId] = byHid[it.houzzId] || []).push(it); });

  const report = { date: '2026-06-08', dryRun: true, note: 'READ-ONLY. URLs = what an APPLY would attach to images[]. Zero writes.', project: PROJECT, vendor: 'Somerset Bay', groups: [] };
  console.log('=== Somerset Bay / RH — exact image URLs available to attach (read-only) ===\n');
  for (const hid of Object.keys(byHid)) {
    const urls = hid ? await storageUrlsFor(hid) : [];
    report.groups.push({ houzzId: hid || '(none)', items: byHid[hid], storageImageCount: urls.length, storageUrls: urls });
    console.log('houzzId ' + (hid || '(none)') + '  | ' + byHid[hid].map((i) => i.title).join('  /  ') + '  | now: ' + byHid[hid][0].currentCount + ' | available: ' + urls.length);
    urls.forEach((u, i) => console.log('   [' + (i + 1) + '] ' + u.url));
    console.log('');
  }
  const outDir = path.join(__dirname, '..', '_backup', 'somersetbay-rh-gallery-dryrun-2026-06-08');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'DRYRUN_somersetbay_rh_gallery_URLS_BY_CLAUDE_2026-06-08.json'), JSON.stringify(report, null, 2));
  console.log('Full report (exact URLs):', path.join(outDir, 'DRYRUN_somersetbay_rh_gallery_URLS_BY_CLAUDE_2026-06-08.json'));
  process.exit(0);
})().catch((e) => { console.error('ERROR', e); process.exit(1); });
