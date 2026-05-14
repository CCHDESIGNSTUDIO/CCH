#!/usr/bin/env node
/**
 * Copy **Bugletrail inspiration boards only** (Firestore `ideabooks` under one project).
 * This is NOT a full production dump — one project path, inspiration subcollection only
 * (unless you also sync the parent doc; see flags below).
 *
 * Writes to staging Firestore (`cch-studio-staging`):
 *   Default (`--apply`):
 *     - `boards/7225-bugletrail`  (parent project doc — so the project exists on staging)
 *     - `boards/7225-bugletrail/ideabooks/*`  (each inspiration section / board)
 *   With `--ideabooks-only` (`--apply --ideabooks-only`):
 *     - **Only** `boards/7225-bugletrail/ideabooks/*`  (no overwrite of parent project fields)
 *     - Requires `boards/7225-bugletrail` to already exist on staging (create once or use default apply first).
 *
 * Does **not** copy: other projects, `clips`, `proposals`, `invoices`, POs, Storage, Auth, etc.
 *
 * Auth:
 *  - PROD read: firebase-admin with the local prod service account key.
 *  - STAGING write: Firestore REST API authenticated with Cindy's
 *    Firebase CLI OAuth refresh token (stored at
 *    C:/Users/cindy/.config/configstore/firebase-tools.json).
 *
 * Run: node _scripts/copy-bugletrail-to-staging.js
 *      node _scripts/copy-bugletrail-to-staging.js --apply
 *      node _scripts/copy-bugletrail-to-staging.js --apply --ideabooks-only
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const admin = require('firebase-admin');

const PROD_KEY = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
const CLI_AUTH = 'C:/Users/cindy/.config/configstore/firebase-tools.json';
const SOURCE_PROJECT = 'cch-design-boards';
const TARGET_PROJECT = 'cch-studio-staging';
const BOARD_ID = '7225-bugletrail';
const APPLY = process.argv.includes('--apply');
const IDEABOOKS_ONLY = process.argv.includes('--ideabooks-only');

// firebase-tools' OAuth client (publicly known — used by every firebase CLI install).
const FIREBASE_TOOLS_CLIENT_ID = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
const FIREBASE_TOOLS_CLIENT_SECRET = 'j9iVZfS8kkCEFUPaAeJV0sAi';

function httpJson(opts, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: data ? JSON.parse(data) : {} }); }
        catch (e) { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function getStagingAccessToken() {
  const cli = JSON.parse(fs.readFileSync(CLI_AUTH, 'utf8'));
  if (!cli.tokens || !cli.tokens.refresh_token) throw new Error('No refresh_token in firebase-tools.json');
  const body = new URLSearchParams({
    client_id: FIREBASE_TOOLS_CLIENT_ID,
    client_secret: FIREBASE_TOOLS_CLIENT_SECRET,
    refresh_token: cli.tokens.refresh_token,
    grant_type: 'refresh_token'
  }).toString();
  const r = await httpJson({
    hostname: 'oauth2.googleapis.com', path: '/token', method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) }
  }, body);
  if (r.status !== 200 || !r.body.access_token) {
    throw new Error('Failed to refresh CLI token: ' + JSON.stringify(r.body));
  }
  return r.body.access_token;
}

// Convert a JS value to Firestore REST `Value` representation.
function toFsValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') {
    if (Number.isInteger(v) && Math.abs(v) < 2**53) return { integerValue: String(v) };
    return { doubleValue: v };
  }
  if (typeof v === 'string') return { stringValue: v };
  if (v && typeof v.toDate === 'function') {
    try { return { timestampValue: v.toDate().toISOString() }; } catch (e) { return { stringValue: String(v) }; }
  }
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toFsValue) } };
  if (typeof v === 'object') {
    const fields = {};
    for (const k of Object.keys(v)) fields[k] = toFsValue(v[k]);
    return { mapValue: { fields } };
  }
  return { stringValue: String(v) };
}

function dataToFsFields(obj) {
  const fields = {};
  for (const k of Object.keys(obj || {})) fields[k] = toFsValue(obj[k]);
  return fields;
}

function encodeFirestoreDocumentPath(relPath) {
  return String(relPath || '').split('/').map(encodeURIComponent).join('/');
}

async function writeDoc(accessToken, parentPath, docId, data) {
  const fields = dataToFsFields(data);
  const url = `/v1/projects/${TARGET_PROJECT}/databases/(default)/documents/${parentPath}?documentId=${encodeURIComponent(docId)}`;
  const body = JSON.stringify({ fields });
  const r = await httpJson({
    hostname: 'firestore.googleapis.com', path: url, method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + accessToken,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body)
    }
  }, body);
  if (r.status === 200) return r;
  const errStr = r.body && r.body.error ? JSON.stringify(r.body.error) : '';
  const alreadyExists = r.status === 409 || /ALREADY_EXISTS|already exists/i.test(errStr);
  if (alreadyExists) {
    return patchDoc(accessToken, parentPath + '/' + docId, data);
  }
  return r;
}

async function patchDoc(accessToken, relPath, data) {
  const fields = dataToFsFields(data);
  const enc = encodeFirestoreDocumentPath(relPath);
  const url = `/v1/projects/${TARGET_PROJECT}/databases/(default)/documents/${enc}`;
  const body = JSON.stringify({ fields });
  const r = await httpJson({
    hostname: 'firestore.googleapis.com', path: url, method: 'PATCH',
    headers: {
      'Authorization': 'Bearer ' + accessToken,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body)
    }
  }, body);
  return r;
}

(async () => {
  console.log('Mode:', APPLY ? 'APPLY (writes to staging)' : 'DRY-RUN');
  if (IDEABOOKS_ONLY) console.log('Scope:     --ideabooks-only (inspiration board docs only; no parent boards/* doc)');
  console.log('Source: prod  /', SOURCE_PROJECT);
  console.log('Target: stag  /', TARGET_PROJECT);
  console.log('Board:        ', BOARD_ID);
  console.log('');

  // 1. Prod read via admin SDK
  admin.initializeApp({ credential: admin.credential.cert(require(PROD_KEY)) });
  const db = admin.firestore();

  let boardData = null;
  if (!IDEABOOKS_ONLY) {
    console.log('Reading prod board doc...');
    const boardSnap = await db.collection('boards').doc(BOARD_ID).get();
    if (!boardSnap.exists) throw new Error('Prod board not found: ' + BOARD_ID);
    boardData = boardSnap.data();
    console.log(`  name="${boardData.name}" client="${boardData.clientName}" clipCount=${boardData.clipCount}`);
  } else {
    console.log('Skipping prod parent board doc read (--ideabooks-only).');
  }

  console.log('Reading prod ideabooks subcollection (Inspiration boards)...');
  const ideabookSnap = await db.collection('boards').doc(BOARD_ID).collection('ideabooks').get();
  console.log(`  ${ideabookSnap.size} ideabooks`);
  const ideabooks = [];
  for (const d of ideabookSnap.docs) {
    const x = d.data();
    const imgs = Array.isArray(x.images) ? x.images.length : 0;
    console.log(`    ${d.id}  "${(x.name || x.title || '').slice(0,40)}"  ${imgs} images  hiddenInNav=${!!x.hiddenInNav}`);
    ideabooks.push({ id: d.id, data: x });
  }

  if (!APPLY) {
    console.log('\nDRY-RUN. Would write to staging:');
    if (!IDEABOOKS_ONLY) console.log('  - 1 parent doc: boards/' + BOARD_ID);
    console.log('  - ' + ideabooks.length + ' ideabook docs: boards/' + BOARD_ID + '/ideabooks/*');
    if (IDEABOOKS_ONLY) {
      console.log('\n(--ideabooks-only) Staging must already have boards/' + BOARD_ID + ' or subcollection writes may still succeed but Studio may not list the project.)');
    }
    console.log('\nRe-run with --apply' + (IDEABOOKS_ONLY ? ' --ideabooks-only' : '') + ' to actually write.');
    process.exit(0);
  }

  // 2. Get staging access token
  console.log('\nMinting staging access token from CLI refresh_token...');
  const stagingToken = await getStagingAccessToken();
  console.log('  Got token (' + stagingToken.length + ' chars)');

  // 3. Write parent board doc (skip if --ideabooks-only)
  if (!IDEABOOKS_ONLY) {
    console.log('\nWriting board doc to staging...');
    const wr1 = await writeDoc(stagingToken, 'boards', BOARD_ID, boardData);
    console.log(`  boards/${BOARD_ID}: HTTP ${wr1.status}${wr1.status >= 400 ? ' ' + JSON.stringify(wr1.body).slice(0, 300) : ' ✓'}`);
  } else {
    console.log('\nSkipping parent board doc (--ideabooks-only).');
  }

  // 4. Write each ideabook (inspiration board doc)
  console.log('\nWriting ideabook docs...');
  let ok = 0, fail = 0;
  for (const ib of ideabooks) {
    const wr = await writeDoc(stagingToken, `boards/${BOARD_ID}/ideabooks`, ib.id, ib.data);
    if (wr.status === 200) { ok++; console.log(`  + ${ib.id}: ✓`); }
    else { fail++; console.log(`  × ${ib.id}: HTTP ${wr.status} ${JSON.stringify(wr.body).slice(0, 200)}`); }
  }

  console.log(`\nDone. ${ok} ok, ${fail} failed.`);
  console.log('Studio project (Inspiration boards tab):');
  console.log('  https://cch-platform-staging.web.app/#/project/7225-bugletrail/ideabooks');
  console.log('Client portal (Inspirations):');
  console.log('  https://cch-platform-staging.web.app/#/clientview/7225-bugletrail/inspiration');
  process.exit(0);
})().catch(e => { console.error('FATAL:', e); process.exit(1); });
