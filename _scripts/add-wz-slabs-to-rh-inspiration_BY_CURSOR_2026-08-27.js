/**
 * PRODUCTION — add Walker Zanger slab photos (Jeanette email 2026-08-27)
 * to Cloud Rolling Hills Inspiration board "Slabs".
 *
 * Matches Studio paste-URL / upload shape (ibAddExternalUrl + ibProcessImageFiles):
 *   imageUrl (hosted), sourceUrl (original S3), vendor '', showSource true.
 *
 * Default DRY RUN:
 *   node _scripts/add-wz-slabs-to-rh-inspiration_BY_CURSOR_2026-08-27.js
 * Apply:
 *   node _scripts/add-wz-slabs-to-rh-inspiration_BY_CURSOR_2026-08-27.js --apply
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');
const http = require('http');
const admin = require('firebase-admin');

const APPLY = process.argv.includes('--apply');
const KEY = path.join(
  __dirname,
  '..',
  '_debug',
  'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json'
);
const PROJECT_ID = 'cloud-rolling-hills';
const KNOWN_SLABS_ID = '5zLV53Y6IBMkPGDgKHaM';
const BUCKET = 'cch-design-boards.firebasestorage.app';

const SLABS = [
  { caption: 'Matise 3/4 2 CM', url: 'https://s3.us-east-1.amazonaws.com/walkerzanger-prod-sps-files/6306771_27_2SLACPI2CMP_52435.jpg' },
  { caption: 'Matise 3/4 2 CM', url: 'https://s3.us-east-1.amazonaws.com/walkerzanger-prod-sps-files/6306771_28_2SLACPI2CMP_52436.jpg' },
  { caption: 'Matise 3/4 2 CM', url: 'https://s3.us-east-1.amazonaws.com/walkerzanger-prod-sps-files/6306771_29_2SLACPI2CMP_52437.jpg' },
  { caption: 'Matise 3/4 2 CM', url: 'https://s3.us-east-1.amazonaws.com/walkerzanger-prod-sps-files/6306771_7_2slacpizcmp_52415.jpg' },
  { caption: 'Matise 3/4 2 CM', url: 'https://s3.us-east-1.amazonaws.com/walkerzanger-prod-sps-files/6306771_8_2slacpizcmp_52416.jpg' },
  { caption: 'North Hills', url: 'https://s3.us-east-1.amazonaws.com/walkerzanger-prod-sps-files/6306771_9_2SLACPI2CMP_52417.jpg' },
  { caption: 'North Hills', url: 'https://s3.us-east-1.amazonaws.com/walkerzanger-prod-sps-files/6306771_10_2SLACPI2CMP_52418.jpg' },
  { caption: 'North Hills', url: 'https://s3.us-east-1.amazonaws.com/walkerzanger-prod-sps-files/6306771_11_2slacpizcmp_52419.jpg' },
  { caption: 'North Hills', url: 'https://s3.us-east-1.amazonaws.com/walkerzanger-prod-sps-files/6306771_12_2slacpi2cmp_52420.jpg' },
  { caption: 'Calacatta Gold Extreme', url: 'https://s3.us-east-1.amazonaws.com/walkerzanger-prod-sps-files/6308576_7_109922.jpg' },
  { caption: 'Calacatta Vintage', url: 'https://s3.us-east-1.amazonaws.com/walkerzanger-prod-sps-files/6312875_23_2SLACVIHO2CM_340326.jpg' },
  { caption: 'Calacatta Vintage', url: 'https://s3.us-east-1.amazonaws.com/walkerzanger-prod-sps-files/6312875_24_2SLACVIHO2CM_340327.jpg' }
];

if (!fs.existsSync(KEY)) {
  console.error('Missing service account:', KEY);
  process.exit(1);
}

const app = admin.initializeApp({
  credential: admin.credential.cert(require(KEY)),
  storageBucket: BUCKET
}, 'wzSlabsRh');
const db = app.firestore();
const bucket = app.storage().bucket();

function fileKey(u) {
  try {
    const p = new URL(u).pathname;
    return decodeURIComponent(p.split('/').pop() || '').toLowerCase();
  } catch (_e) {
    return String(u || '').toLowerCase();
  }
}

function fetchBuffer(url) {
  return new Promise(function (resolve, reject) {
    const lib = url.startsWith('https:') ? https : http;
    const req = lib.get(url, {
      headers: { 'User-Agent': 'CCH-Studio/1.0 (inspiration import)' }
    }, function (res) {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return fetchBuffer(res.headers.location).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error('HTTP ' + res.statusCode + ' ' + url));
      }
      const chunks = [];
      res.on('data', function (c) { chunks.push(c); });
      res.on('end', function () {
        resolve({
          buf: Buffer.concat(chunks),
          contentType: String(res.headers['content-type'] || 'image/jpeg').split(';')[0].trim()
        });
      });
    });
    req.on('error', reject);
    req.setTimeout(60000, function () { req.destroy(new Error('timeout ' + url)); });
  });
}

function newImageKey() {
  try { return crypto.randomUUID(); } catch (_e) {
    return 'ik_' + Math.random().toString(36).slice(2, 11) + Date.now().toString(36);
  }
}

function storageDownloadUrl(storagePath, token) {
  return 'https://firebasestorage.googleapis.com/v0/b/' + BUCKET + '/o/' +
    encodeURIComponent(storagePath) + '?alt=media&token=' + token;
}

(async function main() {
  console.log(APPLY ? 'MODE: APPLY (production write)' : 'MODE: dry-run');
  const proj = await db.collection('boards').doc(PROJECT_ID).get();
  if (!proj.exists) throw new Error('project missing: ' + PROJECT_ID);
  console.log('Project:', proj.data().name || PROJECT_ID);

  const ibSnap = await db.collection('boards').doc(PROJECT_ID).collection('ideabooks').get();
  const books = [];
  ibSnap.forEach(function (d) {
    const data = d.data() || {};
    books.push({
      id: d.id,
      name: String(data.name || data.title || ''),
      n: Array.isArray(data.images) ? data.images.length : 0
    });
  });
  books.sort(function (a, b) { return a.name.localeCompare(b.name); });
  console.log('Ideabooks:');
  books.forEach(function (b) {
    console.log('  ', b.id, '|', b.name, '|', b.n, 'images');
  });

  const byName = books.find(function (b) {
    const n = b.name.toLowerCase();
    return n.indexOf('slab') >= 0 && n.indexOf('inspir') >= 0;
  }) || books.find(function (b) { return b.name.toLowerCase() === 'slabs'; }) ||
    books.find(function (b) { return b.id === KNOWN_SLABS_ID; });
  if (!byName) throw new Error('Could not find Slabs / Slab Inspiration ideabook');
  console.log('Target board:', byName.id, byName.name, byName.n, 'existing');

  const ibRef = db.collection('boards').doc(PROJECT_ID).collection('ideabooks').doc(byName.id);
  const ib = (await ibRef.get()).data() || {};
  const images = Array.isArray(ib.images) ? ib.images.slice() : [];
  const existingKeys = new Set();
  images.forEach(function (im) {
    ['imageUrl', 'sourceUrl', 'pageUrl', 'url'].forEach(function (k) {
      const fk = fileKey(im && im[k]);
      if (fk) existingKeys.add(fk);
    });
  });

  const unique = [];
  const seen = new Set();
  SLABS.forEach(function (row) {
    const fk = fileKey(row.url);
    if (seen.has(fk)) {
      console.log('SKIP duplicate in email:', fk);
      return;
    }
    seen.add(fk);
    if (existingKeys.has(fk)) {
      console.log('SKIP already on board:', fk);
      return;
    }
    unique.push(row);
  });
  console.log('Will add', unique.length, 'image(s)');

  if (!APPLY) {
    unique.forEach(function (r) { console.log('  +', r.caption, r.url); });
    console.log('Dry-run only. Pass --apply to write.');
    process.exit(0);
  }

  const added = [];
  for (let i = 0; i < unique.length; i++) {
    const row = unique[i];
    console.log('Fetch', i + 1, '/', unique.length, row.caption);
    const { buf, contentType } = await fetchBuffer(row.url);
    if (!buf || buf.length < 500) throw new Error('tiny file: ' + row.url);
    const ext = (contentType.indexOf('png') >= 0) ? 'png' : (contentType.indexOf('webp') >= 0) ? 'webp' : 'jpg';
    const ts = Date.now() + '-' + i + '-' + crypto.randomBytes(4).toString('hex');
    const storagePath = 'images/ideabooks/' + PROJECT_ID + '/' + byName.id + '/' + ts + '.' + ext;
    const token = crypto.randomUUID();
    await bucket.file(storagePath).save(buf, {
      contentType: contentType || 'image/jpeg',
      metadata: { metadata: { firebaseStorageDownloadTokens: token } }
    });
    const hosted = storageDownloadUrl(storagePath, token);
    added.push({
      imageUrl: hosted,
      thumbnailUrl: hosted,
      caption: row.caption,
      vendor: '',
      showPrice: true,
      showSource: true,
      sourceUrl: row.url,
      pageUrl: row.url,
      feedback: { stars: [], comments: [] },
      imageKey: newImageKey(),
      tags: [],
      addedAt: new Date().toISOString(),
      importedFrom: 'wz-email-2026-08-27',
      source: 'upload'
    });
  }

  const next = images.concat(added);
  await ibRef.update({
    images: next,
    updatedAt: new Date().toISOString()
  });
  console.log('DONE. Added', added.length, '→ board now', next.length, 'images.');
  console.log('Hard-refresh production Inspiration → Slabs.');
  process.exit(0);
})().catch(function (e) {
  console.error(e);
  process.exit(1);
});
