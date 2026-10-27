'use strict';
/** READ-ONLY: fetch the ACTUALLY-DEPLOYED Firestore ruleset for cch-design-boards (prod) and check
 *  whether *_archive reads are allowed. Uses the admin service-account token. No writes. */
const path = require('path');
const https = require('https');
const admin = require('firebase-admin');
const KEY = require(path.join(__dirname, '..', '_debug', 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json'));
const app = admin.initializeApp({ credential: admin.credential.cert(KEY) }, 'PROD');
function get(url, token) { return new Promise((res, rej) => { https.get(url, { headers: { Authorization: 'Bearer ' + token } }, (r) => { let d = ''; r.on('data', (c) => d += c); r.on('end', () => res({ status: r.statusCode, body: d })); }).on('error', rej); }); }
(async () => {
  const tok = (await app.options.credential.getAccessToken()).access_token;
  const rel = await get('https://firebaserules.googleapis.com/v1/projects/cch-design-boards/releases/cloud.firestore', tok);
  if (rel.status !== 200) { console.log('release fetch status', rel.status, rel.body.slice(0, 400)); process.exit(0); }
  const rulesetName = JSON.parse(rel.body).rulesetName;
  console.log('Active ruleset:', rulesetName);
  const rs = await get('https://firebaserules.googleapis.com/v1/' + rulesetName, tok);
  if (rs.status !== 200) { console.log('ruleset fetch status', rs.status, rs.body.slice(0, 400)); process.exit(0); }
  const files = JSON.parse(rs.body).source.files || [];
  const src = files.map((f) => f.content).join('\n');
  const hasProdArch = /match\s+\/products_archive\//.test(src);
  const hasLibArch = /match\s+\/productLibrary_archive\//.test(src);
  console.log('\n=== DEPLOYED PROD RULES — archive access ===');
  console.log('products_archive match block present:       ', hasProdArch);
  console.log('productLibrary_archive match block present: ', hasLibArch);
  if (hasProdArch || hasLibArch) {
    const idx = src.search(/match\s+\/products_archive\//);
    const idx2 = src.search(/match\s+\/productLibrary_archive\//);
    console.log('\n--- relevant rules excerpt ---');
    console.log(src.slice(Math.max(0, Math.min(idx, idx2) - 60), Math.max(idx, idx2) + 220));
  } else {
    console.log('\n>>> archive rules are NOT in the deployed prod ruleset — Junk tab reads are DENIED on prod.');
  }
  process.exit(0);
})().catch((e) => { console.error('ERROR', e.message || e); process.exit(1); });
