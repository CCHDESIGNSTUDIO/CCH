#!/usr/bin/env node
'use strict';
/** Phase 1 staging smoke — static + optional runtime checks (read-only). */
const https = require('https');

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let d = '';
      res.on('data', (c) => { d += c; });
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    }).on('error', reject);
  });
}

(async () => {
  const base = 'https://cch-platform-staging.web.app';
  const iso = await get(base + '/cch-doc-isolation.js');
  const idx = await get(base + '/index.html');
  const checks = [];

  function pass(name, ok, detail) {
    checks.push({ name, ok, detail });
    console.log((ok ? 'PASS' : 'FAIL') + ' | ' + name + (detail ? ' — ' + detail : ''));
  }

  pass('isolation.js HTTP 200', iso.status === 200, String(iso.status));
  pass('v20260603d loaded log', /loaded v20260603d/.test(iso.body));
  pass('cchGuardCrossEntitySync exported', /global\.cchGuardCrossEntitySync/.test(iso.body));
  pass('cchGuardLibraryWrite exported', /global\.cchGuardLibraryWrite/.test(iso.body));
  pass('cchNoBackSyncFromDoc true', /function cchNoBackSyncFromDoc\(\)\s*\{\s*return true/.test(iso.body));

  pass('index.html HTTP 200', idx.status === 200, String(idx.status));
  const guardCount = (idx.body.match(/cchGuardCrossEntitySync/g) || []).length;
  pass('index guard refs >= 4', guardCount >= 4, 'count=' + guardCount);
  pass('index loads isolation ?v=20260603d', /cch-doc-isolation\.js\?v=20260603d/.test(idx.body));

  const syncStart = idx.body.indexOf('async function syncProductToClips');
  const syncChunk = syncStart >= 0 ? idx.body.slice(syncStart, syncStart + 900) : '';
  pass('syncProductToClips is no-op return', /return \{ updated: 0/.test(syncChunk));
  pass('syncProductToClips NOT old clip loop', !/getCachedBoards\(\)[\s\S]{0,400}collection\('clips'\)/.test(syncChunk));

  const declineFix = idx.body.includes('NEVER overwrite with \'pending\'');
  pass('RB-2 decline fix present', declineFix);

  const suppressFix = idx.body.includes('_cchSuppressClipsRefreshUntil');
  pass('RB-1 listener suppress present', suppressFix);

  const enrichFix = idx.body.includes('A real client decision wins');
  pass('RB-2b enrichClips fix present', enrichFix);

  const failed = checks.filter((c) => !c.ok);
  console.log('\n=== SUMMARY: ' + (checks.length - failed.length) + '/' + checks.length + ' passed ===');
  if (failed.length) {
    process.exitCode = 1;
    failed.forEach((f) => console.log('  FAILED:', f.name));
  }
})().catch((e) => { console.error(e); process.exit(1); });
