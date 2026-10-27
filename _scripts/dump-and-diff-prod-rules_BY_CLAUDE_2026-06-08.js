'use strict';
/** READ-ONLY: fetch the live deployed prod ruleset, write it to a file, and diff (line-level)
 *  against the repo firestore.rules so we see EXACTLY what a rules deploy would change. No writes. */
const fs = require('fs');
const path = require('path');
const https = require('https');
const admin = require('firebase-admin');
const KEY = require(path.join(__dirname, '..', '_debug', 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json'));
const app = admin.initializeApp({ credential: admin.credential.cert(KEY) }, 'PROD');
function get(url, token) { return new Promise((res, rej) => { https.get(url, { headers: { Authorization: 'Bearer ' + token } }, (r) => { let d = ''; r.on('data', (c) => d += c); r.on('end', () => res({ status: r.statusCode, body: d })); }).on('error', rej); }); }
(async () => {
  const tok = (await app.options.credential.getAccessToken()).access_token;
  const rel = JSON.parse((await get('https://firebaserules.googleapis.com/v1/projects/cch-design-boards/releases/cloud.firestore', tok)).body);
  const rs = JSON.parse((await get('https://firebaserules.googleapis.com/v1/' + rel.rulesetName, tok)).body);
  const deployed = (rs.source.files || []).map((f) => f.content).join('\n');
  const repo = fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8');
  fs.writeFileSync(path.join(__dirname, '..', '_backup', 'PROD-DEPLOYED-firestore.rules.txt'), deployed);
  const dLines = deployed.split(/\r?\n/), rLines = repo.split(/\r?\n/);
  const dSet = new Set(dLines.map((l) => l.trim()).filter(Boolean));
  const rSet = new Set(rLines.map((l) => l.trim()).filter(Boolean));
  const onlyInRepo = [...rSet].filter((l) => !dSet.has(l));      // would be ADDED to prod
  const onlyInProd = [...dSet].filter((l) => !rSet.has(l));      // would be REMOVED from prod
  console.log('Deployed prod rules:', dLines.length, 'lines | Repo rules:', rLines.length, 'lines\n');
  console.log('=== Lines the deploy would ADD to production (' + onlyInRepo.length + ') ===');
  onlyInRepo.forEach((l) => console.log('  + ' + l));
  console.log('\n=== Lines the deploy would REMOVE from production (' + onlyInProd.length + ') ===');
  onlyInProd.forEach((l) => console.log('  - ' + l));
  console.log('\nDeployed prod rules saved to _backup/PROD-DEPLOYED-firestore.rules.txt');
  process.exit(0);
})().catch((e) => { console.error('ERROR', e.message || e); process.exit(1); });
