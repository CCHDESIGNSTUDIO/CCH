// ==================== CCH PROJECT SUB-PANEL NAV (WO-004) ====================
// Houzz-style project sub-panel — panel #2 only. Does NOT touch the CCH Studio rail (#1).
// Spec: Docs/NAV_SPEC_FOR_CURSOR.png + Docs/NAV_SUBPANEL_SPEC_CW_Jul11_v1.2.html
// Feature-flagged: OFF only when localStorage cchNavPanel=0. Admin default ON all hosts.
// Build 20260711sp5 — admin default ON staging + production (Cindy prod roll Jul 11)

(function() {
  'use strict';

  if (window._cchProjSubPanelLoaded) return;
  window._cchProjSubPanelLoaded = true;

  var PANEL_W = 216;
  var spState = { projId: null, woCount: 0, filesBadge: 0 };

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function spIsStaging() {
    try {
      return (typeof CCH_ENV !== 'undefined' && CCH_ENV === 'staging') ||
        (typeof window._cchEnv !== 'undefined' && window._cchEnv === 'staging') ||
        /cch-platform-staging\.web\.app/i.test(location.hostname || '');
    } catch (e) { return false; }
  }

  function spEnabled() {
    try {
      if (localStorage.getItem('cchNavPanel') === '0') return false;
      if (localStorage.getItem('cchNavPanel') === '1') return true;
      if (/[?&]nav=panel\b/i.test(location.search || '')) {
        localStorage.setItem('cchNavPanel', '1');
        return true;
      }
      // Admin: sub-panel #2 ON by default (staging + production). Opt out: cchSetNavPanel(false).
      if (spIsAdmin()) return true;
    } catch (e) {}
    return false;
  }

  window.cchSetNavPanel = function(on) {
    try {
      if (on) localStorage.setItem('cchNavPanel', '1');
      else localStorage.setItem('cchNavPanel', '0');
    } catch (e) {}
    if (typeof renderProjectDetail === 'function') renderProjectDetail();
    else location.reload();
  };

  function spIsAdmin() {
    try {
      return !!(currentUser && typeof ADMIN_EMAILS !== 'undefined' &&
        ADMIN_EMAILS.includes((currentUser.email || '').toLowerCase()));
    } catch (e) { return false; }
  }

  function spIsClientShell() {
    try {
      return !!(currentUser && !currentUser.isAnonymous &&
        typeof isClientProjectGuestSession === 'function' && isClientProjectGuestSession());
    } catch (e) { return false; }
  }

  function spIsLibraryProject() {
    try {
      return currentProjectId === '_lib_designer';
    } catch (e) { return false; }
  }

  function spOnProjectPage() {
    var parts = (location.hash || '').replace(/^#\/?/, '').split('/').filter(Boolean);
    return parts[0] === 'project' && parts[1] && parts[1] !== '_lib_designer';
  }

  function spInspirationBadge(projId) {
    var ib = (window._ibProjActivityCounts && window._ibProjActivityCounts[projId]) || {};
    return (ib.nStarImg || 0) + (ib.nCom || 0);
  }

  function spCaBadges() {
    if (typeof window._cchCaGetBadgeCounts === 'function') {
      var c = window._cchCaGetBadgeCounts();
      if (c && c.projId === spState.projId) return { decisions: c.openDecisions || 0, comms: c.unread || 0 };
    }
    return { decisions: 0, comms: 0 };
  }

  async function spLoadCounts(projId) {
    spState.projId = projId;
    spState.woCount = 0;
    spState.filesBadge = 0;
    try {
      var database = (typeof db !== 'undefined' && db) || firebase.firestore();
      var woSnap = await database.collection('boards').doc(projId).collection('workOrders').limit(200).get();
      spState.woCount = woSnap.size;
    } catch (e) {}
    try {
      var database2 = (typeof db !== 'undefined' && db) || firebase.firestore();
      var docSnap = await database2.collection('boards').doc(projId).collection('clientDocuments').limit(200).get();
      var n = 0;
      docSnap.forEach(function(d) {
        var x = d.data() || {};
        if (String(x.status || '').toLowerCase() === 'pending' || x.clientReviewPending) n++;
      });
      spState.filesBadge = n;
    } catch (e) {}
  }

  function spInjectStyles() {
    if (document.getElementById('cchProjSubPanelStyles')) return;
    var st = document.createElement('style');
    st.id = 'cchProjSubPanelStyles';
    st.textContent =
      '#cchProjSubPanel{position:fixed;left:var(--sidebar-w,220px);top:var(--cch-staging-banner-h,0px);width:' + PANEL_W + 'px;height:calc(100vh - var(--cch-staging-banner-h,0px));background:#fff;border-right:1px solid #E2E2E2;z-index:900;display:flex;flex-direction:column;overflow-y:auto;font-family:var(--font-body,"DM Sans",sans-serif);}' +
      '#cchProjSubPanel .cch-sp-ph{padding:12px 18px 10px;border-bottom:1px solid #F0F0F0;flex-shrink:0;}' +
      '#cchProjSubPanel .cch-sp-nm{font-family:var(--font-display,"Playfair Display",serif);font-size:16px;color:#0A1F3D;line-height:1.25;}' +
      '#cchProjSubPanel .cch-sp-cl{font-size:11px;color:#9CA3AF;margin-top:2px;}' +
      '#cchProjSubPanel .cch-sp-grp{font-size:9px;letter-spacing:.16em;text-transform:uppercase;color:#9CA3AF;font-weight:700;padding:16px 18px 5px;}' +
      '#cchProjSubPanel .cch-sp-item{display:flex;align-items:center;gap:8px;padding:7px 18px;font-size:12.5px;color:#1B3352;background:transparent;border:none;width:100%;text-align:left;cursor:pointer;font-family:inherit;}' +
      '#cchProjSubPanel .cch-sp-item:hover{background:#FCFBF8;}' +
      '#cchProjSubPanel .cch-sp-item.on{background:#FBF7EE;border-left:2px solid #C9A96E;padding-left:16px;font-weight:600;color:#0A1F3D;}' +
      '#cchProjSubPanel .cch-sp-item.ghost{opacity:.45;cursor:not-allowed;}' +
      '#cchProjSubPanel .cch-sp-item .cch-sp-b{margin-left:auto;background:#C9A96E;color:#0E1629;font-size:9.5px;font-weight:700;padding:1px 7px;border-radius:8px;min-width:18px;text-align:center;}' +
      '#cchProjSubPanel .cch-sp-item .cch-sp-b.hot{background:#E86F45;color:#fff;}' +
      '#cchProjSubPanel .cch-sp-item .cch-sp-b.mut{background:#EEE9DD;color:#8A7030;}' +
      '.main.cch-nav-panel-on{margin-left:calc(var(--sidebar-w,220px) + ' + PANEL_W + 'px) !important;}' +
      '#contentArea .project-tabs.cch-sp-hidden{display:none !important;}' +
      '@media (max-width:900px){#cchProjSubPanel{width:100%;left:0;right:0;height:auto;max-height:42vh;position:relative;border-right:none;border-bottom:1px solid #E2E2E2;flex-direction:row;flex-wrap:nowrap;overflow-x:auto;overflow-y:hidden;}' +
      '#cchProjSubPanel .cch-sp-ph{display:none;}' +
      '#cchProjSubPanel .cch-sp-grp{display:none;}' +
      '#cchProjSubPanel .cch-sp-scroll{display:flex;flex-direction:row;flex-wrap:nowrap;}' +
      '#cchProjSubPanel .cch-sp-item{white-space:nowrap;flex-shrink:0;padding:10px 14px;border-left:none !important;}' +
      '.main.cch-nav-panel-on{margin-left:var(--sidebar-w,220px) !important;flex-direction:column;}' +
      '.main.cch-nav-panel-on .content{display:flex;flex-direction:column;}}';
    document.head.appendChild(st);
  }

  function escJs(s) {
    return String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  }

  function spBadgeHtml(n, hot, mut) {
    if (!n) return '';
    var cls = 'cch-sp-b' + (hot ? ' hot' : mut ? ' mut' : '');
    return '<span class="' + cls + '">' + esc(String(n)) + '</span>';
  }

  function spItem(label, tabKey, opts) {
    opts = opts || {};
    var active = (typeof currentProjectTab !== 'undefined' && currentProjectTab === tabKey) ? ' on' : '';
    var ghost = opts.ghost ? ' ghost' : '';
    var badge = opts.badge ? spBadgeHtml(opts.badge, opts.hot, opts.mut) : '';
    var onclick = opts.ghost
      ? 'return false;'
      : (opts.external
        ? "window.open('" + escJs(opts.href || '#') + "','_blank');return false;"
        : (opts.href
          ? "if(typeof navigate==='function')navigate('" + escJs(opts.href) + "');return false;"
          : "if(typeof switchProjectTab==='function')switchProjectTab('" + escJs(tabKey) + "');return false;"));
    return '<button type="button" class="cch-sp-item' + active + ghost + '" onclick="' + onclick + '" title="' + esc(opts.title || label) + '">' +
      '<span>' + esc(label) + (opts.external ? ' ↗' : '') + '</span>' + badge + '</button>';
  }

  function spRenderPanel(proj) {
    spInjectStyles();
    var panel = document.getElementById('cchProjSubPanel');
    if (!panel) {
      panel = document.createElement('nav');
      panel.id = 'cchProjSubPanel';
      panel.setAttribute('aria-label', 'Project navigation');
      var mainEl = document.querySelector('.main');
      if (mainEl && mainEl.parentNode) mainEl.parentNode.insertBefore(panel, mainEl);
    }
    panel.style.display = 'flex';

    var main = document.querySelector('.main');
    if (main) main.classList.add('cch-nav-panel-on');

    var tabs = document.querySelector('#contentArea .project-tabs');
    if (tabs) tabs.classList.add('cch-sp-hidden');

    var ca = spCaBadges();
    var insp = spInspirationBadge(proj.id);
    var isAdmin = spIsAdmin();
    var clientLine = proj.clientName ? ('For ' + proj.clientName) : '';
    if (proj.projectAddress) clientLine += (clientLine ? ' · ' : '') + proj.projectAddress;

    var html = '<div class="cch-sp-ph"><div class="cch-sp-nm">' + esc(proj.name || proj.id) + '</div>';
    if (clientLine) html += '<div class="cch-sp-cl">' + esc(clientLine) + '</div>';
    html += '</div><div class="cch-sp-scroll">';

    html += spItem('Overview', 'overview');
    var fuBadge = (typeof window._cchFuGetBadgeCounts === 'function') ? window._cchFuGetBadgeCounts(proj.id) : { total: 0, hot: 0 };
    html += spItem('Follow-Ups', 'followups', { badge: fuBadge.total, hot: fuBadge.hot > 0, title: 'Follow-Ups — stalled handoffs' });
    html += spItem('Tasks', 'tasks');

    html += '<div class="cch-sp-grp">Design</div>';
    html += spItem('Inspiration', 'ideabooks', { badge: insp, mut: true });
    html += spItem('Selections', 'selections');
    html += spItem('Room Boards', 'boards');
    html += spItem('Design Boards', 'designboards');
    html += spItem('Work Orders', 'workorders', { badge: spState.woCount, mut: true });

    html += '<div class="cch-sp-grp">Client</div>';
    html += spItem('Decisions', 'decisions', {
      href: '#/clientview/' + proj.id + '/decisions',
      badge: ca.decisions
    });
    html += spItem('Proposals', 'proposals');
    html += spItem('Communications', 'comms', { badge: ca.comms, hot: ca.comms > 0 });
    html += spItem('Client Portal', 'clientportal', {
      external: false,
      href: '#/clientview/' + proj.id
    });
    html += spItem('Files & Docs', 'files', { badge: spState.filesBadge });

    html += '<div class="cch-sp-grp">Money</div>';
    html += spItem('Invoices', 'invoices');
    html += spItem('Purchase Orders', 'pos');
    html += spItem('Bill Variances', 'discrepancies');
    if (isAdmin) html += spItem('Financials', 'financials');

    html += '<div class="cch-sp-grp">Operations</div>';
    html += spItem('FFE Tracker', 'ffe');
    html += spItem('Spec Book', 'specbook');
    html += spItem('Time', 'time');
    html += spItem('Notes', 'notes');

    html += '</div>';
    panel.innerHTML = html;
  }

  function spInjectToggle() {
    if (!spIsAdmin() || !spOnProjectPage() || spIsLibraryProject()) return;
    var actions = document.getElementById('topbarActions');
    if (!actions) return;
    var btn = document.getElementById('cchNavPanelToggle');
    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'cchNavPanelToggle';
      btn.type = 'button';
      btn.className = 'btn btn-secondary btn-sm';
      btn.style.marginRight = '6px';
      actions.insertBefore(btn, actions.firstChild);
    }
    var on = spEnabled();
    btn.textContent = on ? '▤ Tabs' : '☰ Panel';
    btn.title = on ? 'Switch back to horizontal tab bar' : 'Show project panel navigation (WO-004 mockup)';
    btn.onclick = function() { window.cchSetNavPanel(!on); };
  }

  function spTeardown() {
    var panel = document.getElementById('cchProjSubPanel');
    if (panel) panel.style.display = 'none';
    var main = document.querySelector('.main');
    if (main) main.classList.remove('cch-nav-panel-on');
    var tabs = document.querySelector('#contentArea .project-tabs');
    if (tabs) tabs.classList.remove('cch-sp-hidden');
    spState.projId = null;
    var tgl = document.getElementById('cchNavPanelToggle');
    if (tgl) tgl.remove();
  }

  function spAfterRender(proj) {
    spInjectToggle();
    if (!spEnabled() || !spOnProjectPage() || spIsLibraryProject() || spIsClientShell()) {
      spTeardown();
      return;
    }
    spLoadCounts(proj.id).then(function() { spRenderPanel(proj); });
    if (typeof window._cchFuPrefetch === 'function') window._cchFuPrefetch(proj.id).then(function() { spRenderPanel(proj); });
    spRenderPanel(proj);
  }

  function spWrapRenderProjectDetail() {
    if (typeof window.renderProjectDetail !== 'function') return;
    var orig = window.renderProjectDetail;
    if (orig._cchSpWrapped) return;
    var wrapped = async function() {
      var out = await orig.apply(this, arguments);
      try {
        if (window._currentProject && spEnabled() && spOnProjectPage()) spAfterRender(window._currentProject);
        else spTeardown();
      } catch (e) { console.warn('[project sub-panel] hook', e); }
      return out;
    };
    wrapped._cchSpWrapped = true;
    window.renderProjectDetail = wrapped;
  }

  function spWrapSwitchProjectTab() {
    if (window._cchSpSptWrapped || typeof window.switchProjectTab !== 'function') return;
    window._cchSpSptWrapped = true;
    var orig = window.switchProjectTab;
    window.switchProjectTab = function(tab) {
      var out = orig.apply(this, arguments);
      try {
        setTimeout(function() {
          if (window._currentProject && spEnabled() && spOnProjectPage()) {
            spRenderPanel(window._currentProject);
            var tabs = document.querySelector('#contentArea .project-tabs');
            if (tabs) tabs.classList.add('cch-sp-hidden');
          }
        }, 50);
      } catch (e) { console.warn('[project sub-panel] tab hook', e); }
      return out;
    };
  }

  function spInit() {
    spWrapRenderProjectDetail();
    spWrapSwitchProjectTab();
    window.addEventListener('hashchange', function() {
      setTimeout(function() {
        if (!spOnProjectPage()) spTeardown();
      }, 300);
    });
    var tries = 0;
    var wt = setInterval(function() {
      spWrapRenderProjectDetail();
      spWrapSwitchProjectTab();
      if (++tries > 20) clearInterval(wt);
    }, 500);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', spInit);
  else spInit();

  console.info('[CCH Project Sub-Panel] build 20260711sp5');
})();
