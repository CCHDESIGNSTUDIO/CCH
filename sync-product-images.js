/**
 * CCH Studio — Product Image Sync Script
 *
 * What this does:
 * 1. Reads all clips from Firestore boards (public — no auth needed)
 * 2. Matches clips to products in productLibrary by title
 * 3. Copies real imageUrls from clips to products missing images
 * 4. For products with a sourceUrl, scrapes og:image from the product page
 * 5. Downloads images and uploads to Firebase Storage permanently
 * 6. Updates productLibrary with final Firebase Storage URLs
 *
 * Run: node sync-product-images.js
 */

const https = require('https');
const http = require('http');
const readline = require('readline');

// ── Firebase config ────────────────────────────────────────────────────────
const PROJECT_ID   = 'cch-design-boards';
const API_KEY      = 'AIzaSyAd24U5ArVGrA24IxNcYD2NYiTVycyF4og';
const STORAGE_BUCKET = 'cch-design-boards.firebasestorage.app';

// ── Helpers ────────────────────────────────────────────────────────────────
function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans.trim()); }));
}

function fetchJson(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const options = { method: opts.method || 'GET', headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) } };
    const req = lib.request(url, options, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch(e) { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (opts.body) req.write(typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body));
    req.end();
  });
}

function fetchRaw(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,*/*',
        'Referer': url
      }
    }, res => {
      // Follow redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchRaw(res.headers.location).then(resolve).catch(reject);
        return;
      }
      const chunks = [];
      res.on('data', d => chunks.push(d));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks), headers: res.headers }));
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

// ── Firebase Auth ──────────────────────────────────────────────────────────
async function signIn(email, password) {
  const res = await fetchJson(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
    { method: 'POST', body: { email, password, returnSecureToken: true } }
  );
  if (res.body.error) throw new Error('Login failed: ' + res.body.error.message);
  console.log('✅ Signed in as', email);
  return res.body.idToken;
}

// ── Firestore REST helpers ─────────────────────────────────────────────────
const FS_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

function fsVal(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(fsVal) } };
  if (typeof v === 'object') return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k,x]) => [k, fsVal(x)])) } };
  return { stringValue: String(v) };
}

function fsRead(field) {
  if (!field) return null;
  if ('stringValue' in field) return field.stringValue;
  if ('integerValue' in field) return parseFloat(field.integerValue);
  if ('doubleValue' in field) return field.doubleValue;
  if ('booleanValue' in field) return field.booleanValue;
  if ('nullValue' in field) return null;
  if ('arrayValue' in field) return (field.arrayValue.values || []).map(fsRead);
  if ('mapValue' in field) return Object.fromEntries(Object.entries(field.mapValue.fields || {}).map(([k,v]) => [k, fsRead(v)]));
  return null;
}

function fsDocToObj(doc) {
  const obj = { _id: doc.name.split('/').pop() };
  Object.entries(doc.fields || {}).forEach(([k, v]) => { obj[k] = fsRead(v); });
  return obj;
}

async function fsGetCollection(path, token, pageSize = 300) {
  const docs = [];
  let pageToken = null;
  do {
    const url = `${FS_BASE}/${path}?pageSize=${pageSize}${pageToken ? '&pageToken=' + pageToken : ''}`;
    const headers = token ? { Authorization: 'Bearer ' + token } : {};
    const res = await fetchJson(url, { headers });
    if (!res.body.documents) break;
    res.body.documents.forEach(d => docs.push(fsDocToObj(d)));
    pageToken = res.body.nextPageToken || null;
  } while (pageToken);
  return docs;
}

async function fsUpdate(path, fields, token) {
  const fieldMask = Object.keys(fields).join(',');
  const url = `${FS_BASE}/${path}?updateMask.fieldPaths=${fieldMask.split(',').join('&updateMask.fieldPaths=')}`;
  const body = { fields: Object.fromEntries(Object.entries(fields).map(([k,v]) => [k, fsVal(v)])) };
  const res = await fetchJson(url, {
    method: 'PATCH',
    headers: { Authorization: 'Bearer ' + token },
    body
  });
  return res;
}

// ── Firebase Storage upload ─────────────────────────────────────────────────
async function uploadToStorage(imageBuffer, filename, contentType, token) {
  return new Promise((resolve, reject) => {
    const encodedPath = encodeURIComponent('product-images/' + filename);
    const url = `https://firebasestorage.googleapis.com/v0/b/${STORAGE_BUCKET}/o?uploadType=media&name=${encodedPath}`;
    const options = {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': contentType || 'image/jpeg',
        'Content-Length': imageBuffer.length
      }
    };
    const req = https.request(url, options, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.name) {
            const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${STORAGE_BUCKET}/o/${encodeURIComponent(result.name)}?alt=media&token=${result.downloadTokens || ''}`;
            resolve(publicUrl);
          } else {
            reject(new Error('Upload failed: ' + data));
          }
        } catch(e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(imageBuffer);
    req.end();
  });
}

// ── og:image extractor ──────────────────────────────────────────────────────
function extractOgImage(html) {
  // Try og:image first (best quality)
  let m = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
  if (!m) m = html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  if (m) return m[1].replace(/&amp;/g, '&');
  // Try twitter:image
  m = html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);
  if (!m) m = html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i);
  if (m) return m[1].replace(/&amp;/g, '&');
  return null;
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n🖼️  CCH Studio — Product Image Sync\n');

  // Auth
  const email = await ask('Admin email (cindy@cchdesign.com): ') || 'cindy@cchdesign.com';
  const password = await ask('Password: ');
  const token = await signIn(email, password);

  // Step 1: Load all clips from boards (publicly readable)
  console.log('\n📦 Loading clips from all project boards...');
  const boards = await fsGetCollection('boards', null, 50);
  console.log(`   Found ${boards.length} boards`);

  const clipsByTitle = new Map(); // title.toLowerCase() → clip
  let totalClips = 0;
  for (const board of boards) {
    try {
      const clips = await fsGetCollection(`boards/${board._id}/clips`, null, 500);
      for (const clip of clips) {
        if (!clip.title) continue;
        const key = clip.title.toLowerCase().trim();
        const imgUrl = clip.imageUrl || clip.image || '';
        // Only store clip if it has a real image URL
        if (imgUrl && imgUrl.startsWith('http') && !clipsByTitle.has(key)) {
          clipsByTitle.set(key, clip);
        }
        // Always store sourceUrl even if no image
        if (!clipsByTitle.has(key) && (clip.pageUrl || clip.sourceUrl)) {
          clipsByTitle.set(key, clip);
        }
      }
      totalClips += clips.length;
    } catch(e) { /* skip inaccessible boards */ }
  }
  console.log(`   Processed ${totalClips} clips — ${clipsByTitle.size} unique products with images/URLs`);

  // Step 2: Load all products from productLibrary
  console.log('\n📚 Loading product library...');
  const products = await fsGetCollection('productLibrary', token, 500);
  console.log(`   Found ${products.length} products`);

  const needsImage = products.filter(p => {
    const img = p.imageUrl || p.image || '';
    return !img || !img.startsWith('http');
  });
  console.log(`   ${needsImage.length} products missing real image URLs`);

  if (needsImage.length === 0) {
    console.log('\n✅ All products already have images!');
    return;
  }

  // Step 3: Match and update
  console.log('\n🔄 Matching clips to products and fetching images...\n');
  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const product of needsImage) {
    const key = (product.title || '').toLowerCase().trim();
    const clip = clipsByTitle.get(key);
    const sourceUrl = clip?.pageUrl || clip?.sourceUrl || product.sourceUrl || product.url || '';
    let finalImageUrl = '';

    process.stdout.write(`  [${updated + skipped + failed + 1}/${needsImage.length}] ${(product.title || '?').slice(0, 40).padEnd(40)} `);

    // Try 1: use clip's existing imageUrl
    const clipImg = clip?.imageUrl || clip?.image || '';
    if (clipImg && clipImg.startsWith('http')) {
      try {
        // Download and re-upload to Firebase Storage for permanence
        const imgRes = await fetchRaw(clipImg);
        if (imgRes.status === 200 && imgRes.body.length > 1000) {
          const ext = (imgRes.headers['content-type'] || 'image/jpeg').includes('png') ? 'png' : 'jpg';
          const filename = product._id + '.' + ext;
          const contentType = imgRes.headers['content-type'] || 'image/jpeg';
          finalImageUrl = await uploadToStorage(imgRes.body, filename, contentType, token);
          process.stdout.write('✅ from clip\n');
        }
      } catch(e) {
        // Clip URL failed, will try og:image below
      }
    }

    // Try 2: scrape og:image from source URL
    if (!finalImageUrl && sourceUrl && sourceUrl.startsWith('http')) {
      try {
        const pageRes = await fetchRaw(sourceUrl);
        if (pageRes.status === 200) {
          const html = pageRes.body.toString('utf8', 0, Math.min(pageRes.body.length, 50000));
          const ogImg = extractOgImage(html);
          if (ogImg) {
            const imgRes = await fetchRaw(ogImg.startsWith('//') ? 'https:' + ogImg : ogImg);
            if (imgRes.status === 200 && imgRes.body.length > 1000) {
              const ext = (imgRes.headers['content-type'] || 'image/jpeg').includes('png') ? 'png' : 'jpg';
              const filename = product._id + '.' + ext;
              finalImageUrl = await uploadToStorage(imgRes.body, filename, imgRes.headers['content-type'] || 'image/jpeg', token);
              process.stdout.write('✅ og:image\n');
            }
          }
        }
      } catch(e) { /* skip */ }
    }

    if (finalImageUrl) {
      // Update Firestore product with permanent image URL + sourceUrl
      const updateFields = { imageUrl: finalImageUrl };
      if (sourceUrl && !product.sourceUrl) updateFields.sourceUrl = sourceUrl;
      await fsUpdate(`productLibrary/${product._id}`, updateFields, token);
      updated++;
    } else {
      // Still update sourceUrl if we found one (useful for future scraping)
      if (sourceUrl && !product.sourceUrl && clip) {
        await fsUpdate(`productLibrary/${product._id}`, { sourceUrl }, token);
      }
      process.stdout.write('⚠️  no image found\n');
      skipped++;
    }

    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 150));
  }

  console.log(`\n✅ Done!`);
  console.log(`   Updated: ${updated} products with Firebase Storage images`);
  console.log(`   Skipped: ${skipped} products (no image source found)`);
  console.log(`   Refresh the Product Library to see results.`);
}

main().catch(err => {
  console.error('\n❌ Error:', err.message);
  process.exit(1);
});
