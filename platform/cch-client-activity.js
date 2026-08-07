// ==================== CCH CLIENT ACTIVITY & DECISION BADGES ====================
// Project-page (Studio admin) wiring for data the client portal already writes:
//   1. Design Boards tab badge  — open clientDecisions + tasks flagged needs_input (mirrors portal count)
//   2. Communications tab badge — unread client activity (activity docs, meta.source=client_portal, read:false)
//   3. "Client activity" panel  — Niice-style right slide-over feed per project, with filter dropdown
// NO new Firestore schema. Reads: activity, boards/{id}/clientDecisions, boards/{id}/tasks.
// Writes: only activity.read=true when Communications is opened (same idea as Activity Feed briefings).
// Built by Cowork (Fable) Jul 10 2026 per Cindy + Cursor handoff. Build 20260710ca3.

(function() {
  'use strict';

  if (window._cchClientActivityLoaded) return;
  window._cchClientActivityLoaded = true;

  var caState = {
    projId: null,
    openDecisions: 0,
    unread: 0,
    items: [],          // sorted client activity docs {id, data}
    loading: false,
    loadedFor: null,
    filter: 'all',
    panelOpen: false,
    retryTimer: null
  };

  // ---------- helpers ----------
  function caDb() { try { return (typeof db !== 'undefined' && db) || firebase.firestore(); } catch (e) { return null; } }
  function esc(s) { var d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; }

  function caProjIdFromHash() {
    var parts = (location.hash || '').replace(/^#\/?/, '').split('/').filter(Boolean);
    if (parts[0] !== 'project' || !parts[1]) return null;
    return decodeURIComponent(parts[1]);
  }

  function caTs(d) {
    var t = d.timestamp || d.createdAt || '';
    var ms = Date.parse(t);
    return isFinite(ms) ? ms : 0;
  }

  function caRelTime(ms) {
    if (!ms) return '';
    var s = Math.floor((Date.now() - ms) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s / 60) + 'm ago';
    if (s < 86400) return Math.floor(s / 3600) + 'h ago';
    if (s < 86400 * 30) return Math.floor(s / 86400) + 'd ago';
    return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function caIsClientDoc(d) {
    if (!d) return false;
    if (d.meta && (d.meta.staffOnly === true || d.meta.source === 'staff_chat')) return false;
    if (String(d.type || '').toLowerCase() === 'staff_chat') return false;
    var src = d.meta && d.meta.source;
    if (src === 'client_portal') return true;
    // older client-portal writes may predate meta.source — fall back to type family
    var t = String(d.type || '').toLowerCase();
    return t === 'client_portal' || t === 'client_first_visit' || t === 'inspiration' || t === 'message';
  }

  function caIsDerivedItem(it) {
    return String((it && it.id) || '').indexOf('derived-') === 0;
  }

  function caCoerceImages(val) {
    if (typeof _coerceImageIterable === 'function') return _coerceImageIterable(val);
    return Array.isArray(val) ? val : [];
  }

  function caMaterializeItem(item) {
    if (typeof _ibMaterializeItemFeedbackRead === 'function') {
      return _ibMaterializeItemFeedbackRead(typeof item === 'string' ? { imageUrl: item } : item);
    }
    if (typeof item === 'string') return { imageUrl: item };
    return item || {};
  }

  function caStarsFromItem(item) {
    if (typeof _ibStarsListFromItem === 'function') return _ibStarsListFromItem(item);
    var o = caMaterializeItem(item);
    return (o.feedback && o.feedback.stars) ? o.feedback.stars.slice() : [];
  }

  /** Client favorites on inspiration images — includes legacy migrated stars (legacy@cch.studio). */
  function caStarIsClientFavorite(st) {
    if (!st) return false;
    var t = String(st.authorType || 'client').toLowerCase();
    if (t === 'client' || !st.authorType) return true;
    if (t === 'designer' && String(st.authorEmail || '').trim().toLowerCase() === 'legacy@cch.studio') return true;
    return false;
  }

  /** Activity query: newest first, paginated — unsorted limit(500) dropped older star events on busy projects. */
  async function caFetchProjectActivity(database, projId) {
    var items = [];
    var lastDoc = null;
    var page = 0;
    var pageSize = 500;
    var maxPages = 8;
    while (page < maxPages) {
      var snap;
      try {
        var q = database.collection('activity').where('projectId', '==', projId).orderBy('timestamp', 'desc').limit(pageSize);
        if (lastDoc) q = q.startAfter(lastDoc);
        snap = await q.get();
      } catch (eOrder) {
        if (page > 0) break;
        snap = await database.collection('activity').where('projectId', '==', projId).limit(pageSize).get();
      }
      if (!snap || snap.empty) break;
      snap.forEach(function(doc) {
        var d = doc.data() || {};
        if (caIsClientDoc(d) || CA_DECISION_ACTIONS[String(d.action || '')]) items.push({ id: doc.id, data: d });
      });
      if (snap.size < pageSize) break;
      lastDoc = snap.docs[snap.docs.length - 1];
      page++;
    }
    return items;
  }

  /**
   * Stars on ideabook images are the source of truth for client favorites; the activity log can miss
   * stars logged before instrumentation, failed writes, or rows dropped by capped unsorted queries.
   */
  async function caSupplementInspirationFromIdeabooks(database, projId, items) {
    var loggedStarImages = {};
    items.forEach(function(it) {
      var d = it.data || {};
      if (String(d.action || '') !== 'star_added') return;
      if (caCategory(d) !== 'inspiration') return;
      var m = d.meta || {};
      if (m.sectionId != null && m.imageIndex != null) {
        loggedStarImages[String(m.sectionId) + ':' + String(m.imageIndex)] = true;
      }
    });

    var projName = '';
    try {
      var pdoc = await database.collection('boards').doc(projId).get();
      projName = pdoc.exists ? (pdoc.data().name || projId) : projId;
    } catch (_eP) {}

    var secSnap = await database.collection('boards').doc(projId).collection('ideabooks').get();
    secSnap.forEach(function(doc) {
      var secData = doc.data() || {};
      var secId = doc.id;
      var secName = secData.name || secData.title || 'Inspiration';
      caCoerceImages(secData.images).forEach(function(img, idx) {
        var item = caMaterializeItem(img);
        var caption = item.caption || item.title || 'image';
        var starList = caStarsFromItem(item);
        starList.forEach(function(st, si) {
          if (!caStarIsClientFavorite(st)) return;
          var imgKey = secId + ':' + idx;
          if (loggedStarImages[imgKey]) return;
          var cName = String(st.authorName || st.authorEmail || 'Client').trim();
          var cEmail = String(st.authorEmail || '').trim().toLowerCase();
          var ts = st.createdAt || st.date || '';
          items.push({
            id: 'derived-insp-star:' + secId + ':' + idx + ':' + si,
            data: {
              type: 'inspiration',
              action: 'star_added',
              description: cName + ' starred "' + caption + '" · ' + secName,
              projectId: projId,
              projectName: projName,
              user: cEmail || 'Client',
              timestamp: ts,
              createdAt: ts,
              read: true,
              meta: {
                source: 'client_portal',
                sectionId: secId,
                imageIndex: idx,
                boardSectionName: secName,
                imageUrl: item.imageUrl || '',
                authorName: cName,
                authorType: 'client',
                derivedFromIdeabook: true
              }
            }
          });
          loggedStarImages[imgKey] = true;
        });
      });
    });
  }

  var CA_DECISION_ACTIONS = { line_approved: 1, line_declined: 1, proposal_total_approved: 1 };
  function caCategory(d) {
    var a = String(d.action || '').toLowerCase();
    var t = String(d.type || '').toLowerCase();
    if (CA_DECISION_ACTIONS[a] || a.indexOf('decision') >= 0) return 'decisions';
    if (a === 'message_sent' || t === 'message') return 'messages';
    if (t === 'inspiration' || a.indexOf('star') >= 0 || a.indexOf('comment') >= 0) return 'inspiration';
    return 'portal'; // opens, views, tab visits, documents
  }

  function caIcon(cat, action) {
    if (cat === 'decisions') return String(action || '').indexOf('declined') >= 0 ? '✕' : '◆';
    if (cat === 'messages') return '💬';
    if (cat === 'inspiration') return '★';
    if (String(action || '').indexOf('document') >= 0) return '📄';
    return '👁';
  }

  // ---------- data ----------
  async function caLoadCounts(projId) {
    var database = caDb();
    if (!database || !projId) return;
    caState.loading = true;
    var openDec = 0;
    try {
      var decSnap = await database.collection('boards').doc(projId).collection('clientDecisions').get();
      decSnap.forEach(function(doc) {
        var st = String((doc.data() || {}).status || 'open').toLowerCase();
        if (st === 'open' || st === 'changes_requested') openDec++;
      });
    } catch (e) { console.warn('[client activity] decisions load', e); }
    try {
      var taskSnap = await database.collection('boards').doc(projId).collection('tasks').get();
      taskSnap.forEach(function(doc) {
        var t = doc.data() || {};
        if (String(t.clientFlag || '') === 'needs_input' && !t.clientResponse) openDec++;
      });
    } catch (e) { /* tasks may be absent on some projects */ }

    var items = [];
    try {
      items = await caFetchProjectActivity(database, projId);
      await caSupplementInspirationFromIdeabooks(database, projId, items);
      items.sort(function(a, b) { return caTs(b.data) - caTs(a.data); });
    } catch (e) { console.warn('[client activity] activity load', e); }

    // Ignore stale responses if user switched projects mid-fetch.
    if (caState.projId !== projId) return;

    caState.openDecisions = openDec;
    caState.items = items;
    caState.unread = items.filter(function(it) { return it.data.read === false && !caIsDerivedItem(it); }).length;
    caState.loading = false;
    caState.loadedFor = projId;
    caInjectBadges();
    if (typeof window._cchSpRefreshBadges === 'function') window._cchSpRefreshBadges(projId);
    if (caState.panelOpen) caRenderPanelList();
  }

  async function caMarkCommsRead(projId) {
    var database = caDb();
    if (!database || !projId) return;
    var unreadDocs = caState.items.filter(function(it) { return it.data.read === false && !caIsDerivedItem(it); });
    if (!unreadDocs.length) return;
    try {
      var batch = database.batch();
      var n = 0;
      unreadDocs.forEach(function(it) {
        if (n >= 400) return;
        if (caIsDerivedItem(it)) return;
        batch.update(database.collection('activity').doc(it.id), { read: true });
        it.data.read = true;
        n++;
      });
      await batch.commit();
      caState.unread = caState.items.filter(function(it) { return it.data.read === false && !caIsDerivedItem(it); }).length;
      caInjectBadges();
    } catch (e) { console.warn('[client activity] mark read', e); }
  }

  // ---------- badges ----------
  function caTabButton(tabKey) {
    var btns = document.querySelectorAll('.project-tab[onclick*="switchProjectTab(\'' + tabKey + '\')"]');
    return btns.length ? btns[0] : null;
  }

  function caSetTabBadge(tabKey, count, title) {
    var btn = caTabButton(tabKey);
    if (!btn) return;
    var badge = btn.querySelector('.cch-ca-badge');
    if (!count) { if (badge) badge.remove(); return; }
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'project-tab-badge cch-ca-badge';
      btn.appendChild(badge);
    }
    badge.textContent = count;
    badge.title = title || '';
  }

  function caCountsReady() {
    return !!(caState.projId && caState.loadedFor === caState.projId && !caState.loading);
  }

  function caInjectBadges() {
    if (!caState.projId) return;
    var ready = caCountsReady();
    caSetTabBadge('designboards', ready ? caState.openDecisions : 0, 'Client decisions awaiting a response');
    caSetTabBadge('comms', ready ? caState.unread : 0, 'Unread client activity');
    caInjectActivityButton();
  }

  function caEnsureTabBarWrap(bar) {
    if (bar.parentElement && bar.parentElement.id === 'cchCaTabWrap') return bar.parentElement;
    var wrap = document.createElement('div');
    wrap.id = 'cchCaTabWrap';
    wrap.className = 'cch-ca-tab-wrap';
    wrap.style.cssText = 'display:flex;align-items:stretch;margin-bottom:18px;border-bottom:2px solid rgba(15,26,46,0.1);background:#fff;';
    bar.parentNode.insertBefore(wrap, bar);
    wrap.appendChild(bar);
    bar.style.marginBottom = '0';
    bar.style.borderBottom = 'none';
    bar.style.flex = '1';
    bar.style.minWidth = '0';
    return wrap;
  }

  function caInjectHeaderButton() {
    var hdr = document.querySelector('#contentArea .page-header');
    if (!hdr) return;
    var btn = document.getElementById('cchCaHeaderBtn');
    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'cchCaHeaderBtn';
      btn.type = 'button';
      btn.className = 'btn btn-secondary btn-sm';
      btn.onclick = function() { caTogglePanel(); };
      hdr.style.display = 'flex';
      hdr.style.flexWrap = 'wrap';
      hdr.style.alignItems = 'flex-start';
      hdr.style.gap = '8px';
      hdr.appendChild(btn);
    }
    var ready = caCountsReady();
    btn.innerHTML = '<span style="font-size:12px;">👁</span> Client activity' +
      (ready && caState.unread ? '<span class="project-tab-badge cch-ca-badge">' + caState.unread + '</span>' : '');
  }

  // ---------- Client activity button + slide-over panel ----------
  function caInjectActivityButton() {
    var stale = document.getElementById('cchCaBtn');
    if (stale) stale.remove();
    caInjectHeaderButton();
  }

  function caEnsurePanel() {
    var panel = document.getElementById('cchCaPanel');
    if (panel) return panel;
    if (!document.getElementById('cchCaStyles')) {
      var st = document.createElement('style');
      st.id = 'cchCaStyles';
      st.textContent =
        '#cchCaPanel{position:fixed;top:0;right:-380px;width:360px;height:100vh;background:#fff;border-left:1px solid #E2E2E2;box-shadow:-8px 0 32px rgba(10,31,61,0.12);z-index:99990;display:flex;flex-direction:column;transition:right .22s ease;font-family:"DM Sans",sans-serif;}' +
        '#cchCaPanel.cch-ca-open{right:0;}' +
        '.cch-ca-head{padding:16px 18px 12px;border-bottom:1px solid #E2E2E2;display:flex;align-items:center;justify-content:space-between;gap:8px;}' +
        '.cch-ca-title{font-size:11px;letter-spacing:0.14em;text-transform:uppercase;font-weight:600;color:#0A1F3D;}' +
        '.cch-ca-filter{font-size:12px;padding:5px 8px;border:1px solid #E2E2E2;background:#fff;color:#0A1F3D;}' +
        '.cch-ca-list{flex:1;overflow-y:auto;padding:6px 0;}' +
        '.cch-ca-row{display:flex;gap:10px;padding:10px 18px;border-bottom:1px solid #F0F0F0;align-items:flex-start;}' +
        '.cch-ca-row.cch-ca-unread{background:#FCF9F2;}' +
        '.cch-ca-ic{width:26px;height:26px;min-width:26px;border:1px solid #E2E2E2;display:flex;align-items:center;justify-content:center;font-size:12px;color:#0A1F3D;background:#FAFAFA;}' +
        '.cch-ca-desc{font-size:12.5px;color:#1B3352;line-height:1.45;}' +
        '.cch-ca-when{font-size:10.5px;color:#9CA3AF;margin-top:2px;}' +
        '.cch-ca-empty{padding:48px 24px;text-align:center;color:#9CA3AF;font-size:12px;line-height:1.6;}' +
        '.cch-ca-x{border:none;background:transparent;font-size:16px;cursor:pointer;color:#6B7280;padding:2px 6px;}' +
        '.cch-ca-tab-wrap .cch-ca-tab-btn{padding:8px 12px;font-size:10px;font-weight:600;color:#0F1A2E;cursor:pointer;border:none;background:#fff;border-left:1px solid rgba(15,26,46,0.1);display:inline-flex;align-items:center;gap:6px;flex-shrink:0;font-family:var(--font-body,"DM Sans",sans-serif);white-space:nowrap;letter-spacing:0.2px;}' +
        '.cch-ca-tab-wrap .cch-ca-tab-btn:hover{background:#FAFAFA;color:var(--gold,#C4A464);}' +
        '#cchCaHeaderBtn{margin-left:auto;align-self:flex-start;}';
      document.head.appendChild(st);
    }
    panel = document.createElement('div');
    panel.id = 'cchCaPanel';
    panel.innerHTML =
      '<div class="cch-ca-head">' +
        '<span class="cch-ca-title">Client Activity</span>' +
        '<span style="display:flex;align-items:center;gap:8px;">' +
          '<select class="cch-ca-filter" id="cchCaFilter">' +
            '<option value="all">All activity</option>' +
            '<option value="decisions">Decisions</option>' +
            '<option value="portal">Portal opens & views</option>' +
            '<option value="messages">Messages</option>' +
            '<option value="inspiration">Inspiration</option>' +
          '</select>' +
          '<button type="button" class="cch-ca-x" title="Close" id="cchCaClose">✕</button>' +
        '</span>' +
      '</div>' +
      '<div class="cch-ca-list" id="cchCaList"></div>';
    document.body.appendChild(panel);
    document.getElementById('cchCaFilter').onchange = function() {
      caState.filter = this.value;
      caRenderPanelList();
    };
    document.getElementById('cchCaClose').onclick = function() { caTogglePanel(false); };
    return panel;
  }

  function caRenderPanelList() {
    var list = document.getElementById('cchCaList');
    if (!list) return;
    if (caState.loading) {
      list.innerHTML = '<div class="cch-ca-empty">Loading client activity…</div>';
      return;
    }
    var items = caState.items;
    if (caState.filter !== 'all') {
      items = items.filter(function(it) { return caCategory(it.data) === caState.filter; });
    }
    if (!items.length) {
      list.innerHTML = '<div class="cch-ca-empty">No client activity yet.<br>Portal opens, decisions, stars and messages will appear here as your client engages.</div>';
      return;
    }
    var html = '';
    var listLimit = caState.filter === 'inspiration' ? 300 : 150;
    items.slice(0, listLimit).forEach(function(it) {
      var d = it.data;
      var cat = caCategory(d);
      html += '<div class="cch-ca-row' + (d.read === false ? ' cch-ca-unread' : '') + '">' +
        '<div class="cch-ca-ic">' + caIcon(cat, d.action) + '</div>' +
        '<div><div class="cch-ca-desc">' + esc(d.description || String(d.action || '').replace(/_/g, ' ')) + '</div>' +
        '<div class="cch-ca-when">' + esc(caRelTime(caTs(d))) + (d.projectName ? ' · ' + esc(d.projectName) : '') + '</div></div>' +
      '</div>';
    });
    list.innerHTML = html;
  }

  function caTogglePanel(force) {
    var panel = caEnsurePanel();
    var open = force != null ? !!force : !caState.panelOpen;
    caState.panelOpen = open;
    panel.classList.toggle('cch-ca-open', open);
    if (open) {
      caRenderPanelList();
      if (caState.projId && caState.loadedFor !== caState.projId) caLoadCounts(caState.projId);
    }
  }
  /** Project left-panel "Client activity" nav — open slide-over (option A, Aug 6). */
  window._cchCaOpenPanel = function () {
    if (caState.projId && caState.loadedFor !== caState.projId) caLoadCounts(caState.projId);
    caTogglePanel(true);
  };

  // ---------- lifecycle hooks ----------
  function caOnProjectPage() {
    var projId = caProjIdFromHash();
    if (!projId || projId === '_lib_designer') { caTeardown(); return; }
    var isNew = projId !== caState.projId;
    caState.projId = projId;
    if (isNew) {
      caState.openDecisions = 0;
      caState.unread = 0;
      caState.items = [];
      caState.loadedFor = null;
      caState.loading = true;
      caInjectBadges();
      if (typeof window._cchSpRefreshBadges === 'function') window._cchSpRefreshBadges(projId);
    }
    // tab bar renders async — retry injection briefly
    var tries = 0;
    if (caState.retryTimer) clearInterval(caState.retryTimer);
    caState.retryTimer = setInterval(function() {
      tries++;
      if (document.querySelector('.project-tab')) {
        caInjectBadges();
        if (tries > 8 || document.getElementById('cchCaHeaderBtn')) { clearInterval(caState.retryTimer); caState.retryTimer = null; }
      }
      if (tries > 12) { clearInterval(caState.retryTimer); caState.retryTimer = null; }
    }, 700);
    if (isNew || caState.loadedFor !== projId) caLoadCounts(projId);
  }

  function caTeardown() {
    caState.projId = null;
    caState.panelOpen = false;
    var p = document.getElementById('cchCaPanel');
    if (p) p.classList.remove('cch-ca-open');
    if (caState.retryTimer) { clearInterval(caState.retryTimer); caState.retryTimer = null; }
  }

  // wrap renderProjectDetail (async) — must run AFTER cch-design-board.js (it also wraps this fn)
  function caWrapRenderProjectDetail() {
    if (typeof window.renderProjectDetail !== 'function') return;
    var orig = window.renderProjectDetail;
    if (orig._cchCaWrapped) return;
    var wrapped = async function() {
      var out = await orig.apply(this, arguments);
      try { caOnProjectPage(); } catch (e) { console.warn('[client activity] hook', e); }
      return out;
    };
    wrapped._cchCaWrapped = true;
    window.renderProjectDetail = wrapped;
    window._cchCaRpdWrapped = true;
  }

  // wrap switchProjectTab — re-inject after tab redraws + mark comms read
  function caWrapSwitchProjectTab() {
    if (window._cchCaSptWrapped || typeof window.switchProjectTab !== 'function') return;
    window._cchCaSptWrapped = true;
    var orig = window.switchProjectTab;
    window.switchProjectTab = function(tab) {
      var out = orig.apply(this, arguments);
      try {
        setTimeout(function() { caInjectBadges(); }, 600);
        if (tab === 'comms' && caState.projId) caMarkCommsRead(caState.projId);
      } catch (e) { console.warn('[client activity] tab hook', e); }
      return out;
    };
  }

  function caInit() {
    caWrapRenderProjectDetail();
    caWrapSwitchProjectTab();
    window.addEventListener('hashchange', function() {
      setTimeout(function() {
        if (caProjIdFromHash()) caOnProjectPage(); else caTeardown();
      }, 400);
    });
    // if we loaded onto an already-rendered project page
    if (caProjIdFromHash()) setTimeout(caOnProjectPage, 800);
    // late-defined globals (module load order): retry wraps briefly
    var wrapTries = 0;
    var wt = setInterval(function() {
      caWrapRenderProjectDetail();
      caWrapSwitchProjectTab();
      if ((window._cchCaRpdWrapped && window._cchCaSptWrapped) || ++wrapTries > 20) clearInterval(wt);
    }, 500);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', caInit);
  else caInit();

  window._cchCaGetBadgeCounts = function() {
    if (!caCountsReady()) {
      return { projId: caState.projId, openDecisions: 0, unread: 0, loadedFor: caState.loadedFor };
    }
    return { projId: caState.projId, openDecisions: caState.openDecisions, unread: caState.unread, loadedFor: caState.loadedFor };
  };

  console.info('[CCH Client Activity] build 20260806ca2 — Client activity left-nav open + slide-over');
})();

// ==================== SIDEBAR READABILITY (added by Cowork Jul 11 2026) ====================
// Cindy: "I can't read the CCH left panel." Base CSS has nav items at 62% white @ 11px,
// icons at 45%, section labels inline-styled 8px @ 20% white, and the staging banner
// overlaps the fixed sidebar's logo. Injected here because this module already loads on
// every Studio page — fold these rules into index.html's static <style> block whenever
// convenient, then delete this block. Build 20260711sb1.
(function () {
  'use strict';
  /* WO-070: keep staging-banner offset only. Brand gold = #C4A464 (not #C9A96E).
     Nav contrast lives in index.html static CSS — do not re-inject competing colors. */
  var css =
    '.sidebar{top:var(--cch-staging-banner-h, 0px) !important;}' +
    '.sidebar .nav-item.active{color:var(--gold, #C4A464) !important;}' +
    '.sidebar .sidebar-nav-section{color:rgba(196,164,100,0.95) !important;font-size:10px !important;opacity:0.95 !important;}';
  function cchInjectSidebarPolish() {
    if (document.getElementById('cchSidebarPolish')) return;
    var st = document.createElement('style');
    st.id = 'cchSidebarPolish';
    st.textContent = css;
    document.head.appendChild(st);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', cchInjectSidebarPolish);
  else cchInjectSidebarPolish();
  console.info('[CCH UI] sidebar polish 20260803wo070 (banner offset + brand gold; contrast in index.html)');
})();
