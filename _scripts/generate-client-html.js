#!/usr/bin/env node
/**
 * generate-client-html.js — builds platform/client.html (lightweight client portal)
 * from platform/index.html.
 *
 * WHY: clients were downloading the entire 4.8MB Studio app (plus ~3MB of admin JS)
 * just to view their portal on a phone. client.html ships ONLY the portal code
 * (~0.6MB raw, ~130KB gzipped) — loads in 1-2s on cell.
 *
 * HOW IT WORKS:
 *  1. Extracts the main inline <script> from index.html.
 *  2. Parses it with acorn; indexes top-level functions + window assignments.
 *  3. Seeds from the CLIENT PORTAL region (between the two section markers below)
 *     and walks the dependency closure. Admin-only bridges are stubbed.
 *  4. Emits client.html: head + full static <style> + portal code + mini router.
 *
 * RUN:  cd cch-deploy && npm i acorn && node _scripts/generate-client-html.js
 * RE-RUN whenever the CLIENT PORTAL section of index.html changes.
 * Cowork built this 2026-07-10; see _DEPLOY_QUEUE.md entry of the same date.
 */
const fs = require('fs');
const path = require('path');
let acorn;
try { acorn = require('acorn'); }
catch (e) { try { acorn = require('/tmp/cch-tools/node_modules/acorn'); } catch (e2) { console.error('npm i acorn first'); process.exit(1); } }

const ROOT = path.resolve(__dirname, '..');
const CANDIDATES = [path.join(ROOT, 'platform', 'index.html'), process.argv[2]].filter(Boolean);
let INDEX = null;
for (const c of [process.argv[2], path.join(ROOT, 'platform', 'index.html')].filter(Boolean)) {
  if (fs.existsSync(c)) { INDEX = c; break; }
}
if (!INDEX) { console.error('index.html not found; pass path as arg'); process.exit(1); }
const OUT = process.argv[3] || path.join(path.dirname(INDEX), 'client.html');
const BUILD = '20260710cp' + (process.env.CP_BUILD_N || '1');

const html = fs.readFileSync(INDEX, 'utf8');

// ---- locate pieces ----
const styleStart = html.indexOf('<style>');
const styleEnd = html.indexOf('</style>') + '</style>'.length;
if (styleStart < 0 || styleEnd < 8) throw new Error('static <style> block not found');
const styleBlock = html.slice(styleStart, styleEnd);

// main inline script = the LARGEST <script>...</script> block
let mainScript = null, msFrom = -1;
const scriptRe = /<script>([\s\S]*?)<\/script>/g; let sm;
while ((sm = scriptRe.exec(html))) if (!mainScript || sm[1].length > mainScript.length) { mainScript = sm[1]; msFrom = sm.index; }
if (!mainScript || mainScript.length < 1000000) throw new Error('main inline script not found/too small');
const src = mainScript;

const REGION_START = src.indexOf('// ==================== CLIENT PORTAL (Programa-style');
const REGION_END = src.indexOf('// ==================== LEGACY CLIENT VIEW');
if (REGION_START < 0 || REGION_END < 0 || REGION_END <= REGION_START) throw new Error('portal region markers not found');

// ---- index top-level declarations ----
const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'script' });
const all = new Map(); const tops = new Map();
for (const n of ast.body) {
  if (n.type === 'FunctionDeclaration' && n.id) all.set(n.id.name, [n.start, n.end]);
  else if (n.type === 'VariableDeclaration') for (const d of n.declarations) { if (d.id.type === 'Identifier') tops.set(d.id.name, [n.start, n.end]); }
  else if (n.type === 'ExpressionStatement' && n.expression.type === 'AssignmentExpression') {
    const L = n.expression.left; let name = null;
    if (L.type === 'MemberExpression' && L.object.name === 'window' && L.property.type === 'Identifier') name = L.property.name;
    else if (L.type === 'Identifier') name = L.name;
    if (name && !all.has(name)) all.set(name, [n.start, n.end]);
  }
}

// ---- closure from portal region ----
const region = new Set([...all.keys()].filter(n => all.get(n)[0] >= REGION_START && all.get(n)[1] <= REGION_END));
const STUBS = new Set(['navigate', 'renderProjectDetail', 'renderClientView',
  'cpAdminOpenFeaturedConceptBoardsModal', 'cpAdminOpenHeroImageModal', 'cpAdminOpenPostDecisionModal',
  'cpAdminOpenShareDocumentModal', 'cpAdminOpenWhatsNewModal', 'cpAdminOpenProgressModal', '_cpFeaturedConceptSave']);
const identRe = /([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/g;
const depsOf = n => { const [s, e] = all.get(n); const b = src.slice(s, e); const out = new Set(); let m;
  identRe.lastIndex = 0; while ((m = identRe.exec(b))) { if (all.has(m[1]) && m[1] !== n) out.add(m[1]); } return out; };
const inc = new Set(); const todo = [...region];
while (todo.length) { const n = todo.pop(); if (inc.has(n) || STUBS.has(n)) continue; inc.add(n); for (const d of depsOf(n)) if (!inc.has(d) && !STUBS.has(d)) todo.push(d); }
const ordered = [...inc].sort((a, b) => all.get(a)[0] - all.get(b)[0]);
let portalCode = ''; let last = -1;
for (const n of ordered) { const [s, e] = all.get(n); if (s < last) continue; portalCode += src.slice(s, e) + '\n\n'; last = e; }
console.log('closure:', inc.size, 'items,', Math.round(portalCode.length / 1024) + 'KB');

// ---- prologue (config/init/staging banner) ----
const pa = src.indexOf('// ==================== CONFIG');
let pb = src.indexOf("padding:4px 12px;');"); pb = src.indexOf('\n', pb) + 1;
const prologue = src.slice(pa, pb) + '    }\n';

// ---- top vars needed by closure ----
const NEED_EXPLICIT = ['ADMIN_EMAILS', 'USE_NEW_PORTAL', 'TEAM_CONFIG', 'currentUser', 'currentProjectId', 'currentProjectTab', 'projects', 'timeEntries', 'libraryProducts'];
const needVars = new Set(NEED_EXPLICIT.filter(v => tops.has(v)));
for (const v of tops.keys()) {
  if (['db', 'auth', 'storage', 'firebaseConfig', 'CCH_ENV', 'CCH_BUILD'].includes(v)) continue;
  if (needVars.has(v)) continue;
  if (new RegExp('\\b' + v.replace(/\$/g, '\\$') + '\\b').test(portalCode)) needVars.add(v);
}
const varRanges = new Map();  // dedupe: multi-declarator statements share one range
for (const v of needVars) { const r = tops.get(v); varRanges.set(r[0] + ':' + r[1], r); }
const varsJs = [...varRanges.values()].sort((a, b) => a[0] - b[0])
  .map(r => '    ' + src.slice(r[0], r[1]).trim()).join('\n') + '\n';
console.log('top vars:', [...needVars].join(', '));

// ---- static text pieces ----
const head = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <title>CCH Design — Client Portal</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect fill='%231B3352' width='32' height='32' rx='4'/><text x='50%25' y='55%25' font-family='Georgia' font-size='20' fill='%23C4A464' text-anchor='middle' dominant-baseline='middle'>C</text></svg>">
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400&family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
`;
const body = `</head>
<body style="background:#FFFFFF;">
  <div id="appShell" style="display:block;">
    <div class="main" style="margin:0;padding:0;max-width:100%;">
      <div id="contentArea">
        <div style="max-width:420px;margin:140px auto;text-align:center;font-family:'DM Sans',sans-serif;">
          <div style="font-family:'Playfair Display',Georgia,serif;font-size:26px;letter-spacing:2px;color:#0A1F3D;">CCH DESIGN</div>
          <div style="margin-top:12px;font-size:12px;letter-spacing:0.15em;text-transform:uppercase;color:#9CA3AF;">Loading your project&hellip;</div>
        </div>
      </div>
    </div>
  </div>
  <div id="modalContainer"></div>
`;
const sdkAndOpen = `  <script src="https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.8.0/firebase-auth-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.8.0/firebase-storage-compat.js"></script>
  <script>
    // ==================== CCH DESIGN — LIGHTWEIGHT CLIENT PORTAL ====================
    // GENERATED FILE — do not hand-edit. Rebuild with: node _scripts/generate-client-html.js
    // Source of truth: the CLIENT PORTAL section of platform/index.html. Build: ${BUILD}
    if (typeof firebase === 'undefined') {
      var _fbFail = function() { var T = document.getElementById('contentArea');
        if (T) T.innerHTML = '<div style="max-width:420px;margin:140px auto;text-align:center;font-family:\\'DM Sans\\',sans-serif;">' +
          '<div style="font-family:\\'Playfair Display\\',Georgia,serif;font-size:26px;letter-spacing:2px;color:#0A1F3D;">CCH DESIGN</div>' +
          '<div style="margin-top:14px;font-size:13px;color:#6B7280;line-height:1.7;">We couldn&#39;t connect just now.<br>Please check your connection and refresh the page.</div></div>'; };
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _fbFail); else _fbFail();
      throw new Error('[CCH Client Portal] Firebase SDK failed to load');
    }
`;
const stubs = `
    // ==================== STUBS (admin surface lives in the Studio app) ====================
    function renderProjectDetail() { /* no-op in client portal */ }
    function renderClientView(projectId) { return renderClientPortal(projectId); }
    function _cchStudioOnlyToast() { if (typeof showToast === 'function') showToast('Open CCH Studio to edit this — this is the client view.', 3200); }
    function cpAdminOpenFeaturedConceptBoardsModal() { _cchStudioOnlyToast(); }
    function cpAdminOpenHeroImageModal() { _cchStudioOnlyToast(); }
    function cpAdminOpenPostDecisionModal() { _cchStudioOnlyToast(); }
    function cpAdminOpenShareDocumentModal() { _cchStudioOnlyToast(); }
    function cpAdminOpenWhatsNewModal() { _cchStudioOnlyToast(); }
    function cpAdminOpenProgressModal() { _cchStudioOnlyToast(); }
    function _cpFeaturedConceptSave() { _cchStudioOnlyToast(); }
    /** Mini router — client routes only. */
    function navigate(hash) {
      var h = String(hash || '');
      if (!/^#\\/?(clientview|clientboard|clientportal)\\//.test(h)) { _cchStudioOnlyToast(); return; }
      h = h.replace(/^#(?!\\/)/, '#/');
      if (location.hash === h) { cchClientRoute(); } else { location.hash = h; }
    }
`;
const boot = `
    // ==================== BOOTSTRAP ====================
    function cchClientRoute() {
      var parts = (location.hash || '').replace(/^#\\/?/, '').split('/').filter(Boolean);
      var page = (parts[0] || '').toLowerCase();
      var T = document.getElementById('contentArea');
      try {
        if (page === 'clientview' && parts[1]) {
          var prop = (String(parts[2] || '').toLowerCase() === 'proposal' && parts[3]) ? parts[3] : null;
          renderClientPortal(parts[1], prop);
        } else if (page === 'clientboard' && parts[1] && typeof openClientBoard === 'function') {
          openClientBoard(parts[1], parts[2]);
        } else if (page === 'clientportal') {
          renderClientParentPortal(parts[1] || '');
        } else if (T) {
          T.innerHTML = '<div style="max-width:420px;margin:120px auto;text-align:center;font-family:\\'DM Sans\\',sans-serif;color:#0A1F3D;">' +
            '<div style="font-family:\\'Playfair Display\\',Georgia,serif;font-size:26px;letter-spacing:2px;">CCH DESIGN</div>' +
            '<div style="margin-top:14px;font-size:13px;color:#6B7280;line-height:1.6;">This portal link looks incomplete.<br>Please use the link from your CCH Design email.</div></div>';
        }
      } catch (e) {
        console.error('[client portal] route', e);
        if (T) T.innerHTML = '<div style="max-width:420px;margin:120px auto;text-align:center;font-family:\\'DM Sans\\',sans-serif;color:#6B7280;font-size:13px;">Something went wrong loading your portal. Please refresh, or contact CCH Design.</div>';
      }
    }
    window.addEventListener('hashchange', cchClientRoute);
    var _cchBooted = false;
    function _cchBootOnce() { if (_cchBooted) return; _cchBooted = true; cchClientRoute(); }
    try {
      auth.onAuthStateChanged(function(u) { currentUser = u || null; _cchBootOnce(); });
    } catch (e) { console.warn('[client portal] auth listener', e); }
    setTimeout(_cchBootOnce, 1600); // never block clients on auth
    console.info('[CCH Client Portal] lightweight build ${BUILD}');
  </script>
`;
const out = head + styleBlock + '\n' + body + sdkAndOpen + prologue + '\n' + varsJs + stubs + '\n' + portalCode + boot +
  `  <script src="cch-progress-updates.js?v=20260712pu1"></script>\n` +
  `  <script src="cch-client-board.js?v=${BUILD}"></script>\n</body>\n</html>\n`;
fs.writeFileSync(OUT, out);
console.log('wrote', OUT, Math.round(out.length / 1024) + 'KB');
// self-check: inline script parses
const chk = out.match(/<script>\n([\s\S]*?)<\/script>/);
acorn.parse(chk[1].replace(/^\s*\/\/ =+ CCH DESIGN[\s\S]*?Build: \S+\n/, ''), { ecmaVersion: 'latest' });
console.log('self-check: inline script parses OK');
