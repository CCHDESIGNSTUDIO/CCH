// ==================== CCH BUGS & REQUESTS (WO-017) ====================
// Threaded in-app feedback on existing feedbackRequests collection.
// Spec: loop/WO-017_bugs-requests-functional_CW_Jul11.md
// Build 20260713fb5 — WO-025 Fix-It LLM bot

(function() {
  'use strict';

  if (window._cchBugsRequestsLoaded) return;
  window._cchBugsRequestsLoaded = true;

  var BUILD = '20260811fb147';
  var POLL_MS = 45000;
  var MIGRATE_KEY = 'cchFbMigratedV1';

  var fbState = {
    unreadCount: 0,
    panelOpen: false,
    activeThreadId: null,
    requests: [],
    pollTimer: null,
    teamTab: 'chat'
  };

  /** index.html keeps currentUser in script scope — never bare-ref it (login-page ReferenceError). */
  function fbAuthUser() {
    try {
      if (typeof window !== 'undefined' && window.currentUser) return window.currentUser;
    } catch (e0) { /* */ }
    try {
      if (typeof currentUser !== 'undefined' && currentUser) return currentUser;
    } catch (e1) { /* */ }
    try {
      if (typeof auth !== 'undefined' && auth.currentUser) return auth.currentUser;
    } catch (e2) { /* */ }
    try {
      if (typeof firebase !== 'undefined' && firebase.auth) return firebase.auth().currentUser;
    } catch (e3) { /* */ }
    return null;
  }

  function fbDb() {
    try { return (typeof db !== 'undefined' && db) || firebase.firestore(); } catch (e) { return null; }
  }

  function fbEsc(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function fbEscAttr(s) { return fbEsc(s).replace(/"/g, '&quot;'); }

  function fbToast(msg, type) {
    if (typeof showToast === 'function') showToast(msg, type);
  }

  function fbFmtDate(ts) {
    if (typeof formatDate === 'function') return formatDate(ts);
    if (!ts) return '';
    try { return new Date(ts).toLocaleDateString(); } catch (e) { return ''; }
  }

  function fbMemberName() {
    if (typeof currentMemberName === 'function') return currentMemberName() || '';
    return '';
  }

  function fbEmail() {
    var u = fbAuthUser();
    return String((u && u.email) || '').toLowerCase().trim();
  }

  function fbIsAdminEmail(email) {
    var e = String(email || '').toLowerCase().trim();
    try {
      if (typeof ADMIN_EMAILS !== 'undefined' && ADMIN_EMAILS.indexOf(e) >= 0) return true;
    } catch (err) {}
    return false;
  }

  function fbIsVanessaEmail(email) {
    var e = String(email || '').toLowerCase().trim();
    try {
      if (typeof VANESSA_EMAILS !== 'undefined' && VANESSA_EMAILS.indexOf(e) >= 0) return true;
    } catch (err) {}
    return e.indexOf('vanessa') >= 0 && e.indexOf('@cchdesign.com') > 0;
  }

  function fbIsTeamMember() {
    var u = fbAuthUser();
    if (!u || !u.email) return false;
    var e = fbEmail();
    return fbIsAdminEmail(e) || fbIsVanessaEmail(e);
  }

  function fbMyRole() {
    if (fbIsVanessaEmail(fbEmail()) && !fbIsAdminEmail(fbEmail())) return 'vanessa';
    return 'owner';
  }

  function fbOtherRole(role) {
    return role === 'vanessa' ? 'owner' : 'vanessa';
  }

  function fbDefaultUnreadBy(forRole) {
    return { owner: forRole !== 'owner', vanessa: forRole !== 'vanessa' };
  }

  function fbNormalizeUnreadBy(obj) {
    return {
      owner: !!(obj && obj.owner),
      vanessa: !!(obj && obj.vanessa)
    };
  }

  function fbIsStudioRoute() {
    try {
      var hash = String(window.location.hash || '#/projects');
      var page = hash.replace(/^#\/?/, '').split('/').filter(Boolean)[0] || 'projects';
      page = page.toLowerCase();
      return page !== 'clientview' && page !== 'clientboard' && page !== 'clientportal';
    } catch (e) { return true; }
  }

  function fbCaptureContext() {
    var hash = String(window.location.hash || '#/projects');
    var parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
    var page = (parts[0] || 'projects').toLowerCase();
    var projectSlug = null;
    if (page === 'project' && parts[1]) projectSlug = parts[1];
    var labels = {
      projects: 'Projects',
      project: 'Project',
      dashboard: 'Dashboard',
      invoices: 'Invoices',
      proposals: 'Proposals',
      pos: 'Purchase Orders',
      vendors: 'Vendors',
      clients: 'Clients',
      followups: 'Follow-Ups',
      feedbackrequests: 'Bugs & Requests',
      smarttime: 'Smart Time',
      reports: 'Reports',
      settings: 'Settings',
      team: 'Team & Contacts',
      allffe: 'FFE Schedule',
      ordermanagement: 'Order Management',
      inspiration: 'Inspiration',
      designboards: 'Design Boards',
      releasenotes: "What's New",
      platformstatus: 'Platform Status'
    };
    var pageLabel = labels[page] || (page.charAt(0).toUpperCase() + page.slice(1));
    if (page === 'project' && parts[1]) pageLabel = 'Project · ' + parts[1];
    return { route: hash, pageLabel: pageLabel, projectSlug: projectSlug };
  }

  function fbAssistantAckText(data) {
    data = data || {};
    var mod = String(data.module || (data.context && data.context.pageLabel) || 'Studio').trim();
    var typ = String(data.type || 'Bug').trim();
    var st = String(data.status || 'New').trim();
    var title = String(data.title || '').trim();
    var lines = [
      'Got it — I logged this as a ' + typ + ' in ' + mod + '.',
      title ? ('"' + fbTrunc(title, 60) + '" is in the queue with status ' + st + '.') : ('Status: ' + st + '.'),
      'Cindy reviews every report here. Simple bugs get fixed straight to production; bigger features go staging first.',
      'Reply in this thread anytime — you\'ll see updates when status changes.'
    ];
    return lines.join('\n\n');
  }

  async function fbHasAssistantMessage(database, requestId) {
    try {
      var snap = await database.collection('feedbackRequests').doc(requestId).collection('messages')
        .where('authorRole', '==', 'assistant').limit(1).get();
      return !snap.empty;
    } catch (e) {
      var msgs = await fbLoadMessages(requestId);
      return msgs.some(function(m) { return m.authorRole === 'assistant'; });
    }
  }

  async function fbInvokeFixItBot(requestId, trigger) {
    if (!requestId) return false;
    var fn;
    try {
      fn = firebase.app().functions('us-central1').httpsCallable('cchFixItBot');
    } catch (e) {
      console.warn('[CCH Bugs] Fix-It callable unavailable', e);
      return false;
    }
    try {
      var res = await fn({ requestId: requestId, trigger: trigger || 'new' });
      var d = (res && res.data) || {};
      if (d.skipped) return true;
      return !!d.ok;
    } catch (e) {
      console.warn('[CCH Bugs] Fix-It bot failed', e);
      return false;
    }
  }

  async function fbPostAssistantAck(database, requestId, data, afterIso, opts) {
    if (!database || !requestId) return false;
    if (await fbHasAssistantMessage(database, requestId)) return false;
    opts = opts || {};
    if (opts.useBot !== false) {
      var botOk = await fbInvokeFixItBot(requestId, 'new');
      if (botOk) return true;
    }
    var now = afterIso || new Date().toISOString();
    var ack = fbAssistantAckText(data);
    var creatorRole = String((data && data.createdByRole) || 'owner');
    if (creatorRole !== 'owner' && creatorRole !== 'vanessa') creatorRole = 'owner';
    var ub = fbNormalizeUnreadBy(data && data.unreadBy);
    ub[creatorRole] = true;
    try {
      await database.collection('feedbackRequests').doc(requestId).collection('messages').add({
        authorRole: 'assistant',
        authorName: 'CCH Fix-It',
        authorEmail: '',
        text: ack,
        createdAt: now
      });
      await database.collection('feedbackRequests').doc(requestId).update({
        lastMessage: fbLastMessageFrom(fbTrunc(ack, 100), 'assistant', now),
        updatedAt: now,
        received: true,
        unreadBy: ub
      });
      return true;
    } catch (e) {
      console.warn('[CCH Bugs] assistant ack failed', e);
      return false;
    }
  }

  /** Post assistant ack for any thread missing one — so the list shows the reply before open. */
  async function fbEnsureAssistantAcks(requestRows) {
    var database = fbDb();
    if (!database || !requestRows || !requestRows.length) return 0;
    var posted = 0;
    for (var i = 0; i < requestRows.length; i++) {
      var row = requestRows[i] || {};
      var id = row.id;
      var data = row.data || row;
      if (!id) continue;
      // Fast path: parent doc already has assistant lastMessage — skip messages subcollection query
      var lm = data && data.lastMessage;
      if (lm && String(lm.authorRole || '') === 'assistant') continue;
      var did = await fbPostAssistantAck(database, id, data, new Date().toISOString(), { useBot: false });
      if (did) posted++;
    }
    if (posted > 0) await fbRefreshUnread();
    return posted;
  }

  function fbBubbleClass(m, myRole) {
    if (m.authorRole === 'assistant') return 'assistant';
    return m.authorRole === myRole ? 'mine' : 'theirs';
  }

  function fbBubbleLabel(m) {
    if (m.authorRole === 'assistant') return 'CCH Fix-It';
    return m.authorName || m.authorRole || '';
  }

  function fbTrunc(text, max) {
    var t = String(text || '').trim();
    if (t.length <= max) return t;
    return t.slice(0, max - 1) + '…';
  }

  function fbLastMessageFrom(text, authorRole, at) {
    return {
      text: fbTrunc(text, 100),
      authorRole: authorRole || 'owner',
      at: at || new Date().toISOString()
    };
  }

  async function fbLoadRequests() {
    var database = fbDb();
    if (!database) return [];
    var requests = [];
    try {
      var snap = await database.collection('feedbackRequests').orderBy('createdAt', 'desc').get();
      snap.forEach(function(d) { requests.push({ id: d.id, ref: d.ref, data: d.data() }); });
    } catch (e) {
      try {
        var snap2 = await database.collection('feedbackRequests').get();
        snap2.forEach(function(d) { requests.push({ id: d.id, ref: d.ref, data: d.data() }); });
        requests.sort(function(a, b) {
          return String((b.data.createdAt || '')).localeCompare(String((a.data.createdAt || '')));
        });
      } catch (e2) {}
    }
    return requests;
  }

  async function fbMigrateDoc(req) {
    var database = fbDb();
    if (!database || !req || !req.id) return;
    var data = req.data || req;
    var id = req.id;
    var updates = {};
    if (!data.createdByRole) updates.createdByRole = 'owner';
    if (!data.unreadBy) updates.unreadBy = { owner: false, vanessa: false };

    var msgsSnap = await database.collection('feedbackRequests').doc(id).collection('messages').limit(1).get();
    var hasMessages = !msgsSnap.empty;
    var legacyResponse = String(data.response || '').trim();

    if (!hasMessages && legacyResponse) {
      await database.collection('feedbackRequests').doc(id).collection('messages').add({
        authorRole: 'owner',
        authorName: data.respondedBy || 'CCH Dev',
        authorEmail: '',
        text: legacyResponse,
        createdAt: data.respondedAt || data.updatedAt || data.createdAt || new Date().toISOString()
      });
      updates.lastMessage = fbLastMessageFrom(
        legacyResponse,
        'owner',
        data.respondedAt || data.updatedAt || data.createdAt
      );
    }

    if (Object.keys(updates).length) {
      try { await database.collection('feedbackRequests').doc(id).update(updates); } catch (e) {
        console.warn('[CCH Bugs] migrate update failed', id, e);
      }
    }
  }

  async function fbMigrateAllOnce() {
    if (window._cchFbMigrationDone) return;
    try {
      if (localStorage.getItem(MIGRATE_KEY) === BUILD) {
        window._cchFbMigrationDone = true;
        return;
      }
    } catch (e) {}
    var rows = await fbLoadRequests();
    for (var i = 0; i < rows.length; i++) {
      await fbMigrateDoc(rows[i]);
    }
    window._cchFbMigrationDone = true;
    try { localStorage.setItem(MIGRATE_KEY, BUILD); } catch (e2) {}
  }

  async function fbCountUnread() {
    if (!fbIsTeamMember()) return 0;
    var myRole = fbMyRole();
    var rows = await fbLoadRequests();
    var n = 0;
    rows.forEach(function(r) {
      var d = r.data;
      var ub = fbNormalizeUnreadBy(d.unreadBy);
      if (ub[myRole]) n++;
    });
    fbState.unreadCount = n;
    return n;
  }

  function fbInjectNavBadge(count) {
    var badge = document.getElementById('cchFbNavBadge');
    if (!badge) return;
    if (count > 0) {
      badge.textContent = String(count);
      badge.style.display = '';
      badge.style.marginLeft = 'auto';
      badge.style.background = '#E86F45';
      badge.style.color = '#fff';
      badge.style.fontSize = '9px';
      badge.style.fontWeight = '700';
      badge.style.padding = '1px 7px';
      badge.style.borderRadius = '8px';
    } else {
      badge.style.display = 'none';
    }
    fbRefreshTeamFabBadge(count);
  }

  function fbRefreshTeamFabBadge(bugCount) {
    var fabBadge = document.getElementById('cchFbFabBadge');
    if (!fabBadge) return;
    var bugs = typeof bugCount === 'number' ? bugCount : (fbState.unreadCount || 0);
    var chatUnread = typeof window.cchScIsUnread === 'function' ? !!window.cchScIsUnread() : false;
    var n = bugs + (chatUnread ? 1 : 0);
    if (n > 0) {
      fabBadge.textContent = n > 9 ? '9+' : String(n);
      fabBadge.style.display = 'flex';
    } else {
      fabBadge.style.display = 'none';
    }
  }
  window.cchFbRefreshTeamFabBadge = function () {
    fbRefreshTeamFabBadge(fbState.unreadCount);
  };

  async function fbRefreshUnread() {
    var n = await fbCountUnread();
    fbInjectNavBadge(n);
    if (typeof window.cchScRefreshUnread === 'function') {
      window.cchScRefreshUnread().then(function () { fbRefreshTeamFabBadge(n); });
    }
    return n;
  }

  function fbInjectStyles() {
    if (document.getElementById('cchFbStyles')) return;
    var style = document.createElement('style');
    style.id = 'cchFbStyles';
    style.textContent =
      '#cchFbFab{position:fixed;bottom:22px;right:22px;z-index:9998;width:52px;height:52px;border-radius:0;' +
      'border:2px solid #C8A97E;background:#0F1A2E;color:#C8A97E;font-size:20px;cursor:pointer;box-shadow:0 4px 14px rgba(15,26,46,0.25);' +
      'display:inline-flex;align-items:center;justify-content:center;padding:0;}' +
      '#cchFbFab:hover{background:#152238;}' +
      '#cchFbFab.in-header{position:static;bottom:auto;right:auto;width:34px;height:34px;font-size:16px;' +
      'box-shadow:none;border-width:1px;}' +
      '#cchFbFabBadge{position:absolute;top:-4px;right:-4px;min-width:18px;height:18px;border-radius:9px;' +
      'background:#E86F45;color:#fff;font-size:10px;font-weight:700;display:none;align-items:center;justify-content:center;padding:0 4px;}' +
      '#cchFbFab.in-header #cchFbFabBadge{top:-6px;right:-6px;}' +
      '#cchFbPanel{position:fixed;bottom:84px;right:22px;z-index:9999;width:360px;max-width:calc(100vw - 32px);' +
      'max-height:min(520px,calc(100vh - 120px));background:#FFFFFF;border:2px solid #0F1A2E;box-shadow:0 8px 28px rgba(15,26,46,0.18);' +
      'display:none;flex-direction:column;overflow:hidden;}' +
      '#cchFbPanel.from-header{right:24px;bottom:auto;top:58px;}' +
      '#cchFbPanel.open{display:flex;}' +
      '.cch-fb-panel-head{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;' +
      'background:#0F1A2E;color:#FFFFFF;font-size:12px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;}' +
      '.cch-fb-panel-body{flex:1;overflow-y:auto;padding:10px;}' +
      '.cch-fb-inbox-item{padding:8px 10px;border:1px solid rgba(15,26,46,0.1);margin-bottom:6px;cursor:pointer;}' +
      '.cch-fb-inbox-item.unread{border-left:3px solid #C8A97E;background:rgba(200,169,126,0.06);}' +
      '.cch-fb-inbox-title{font-size:12px;font-weight:600;color:#0F1A2E;}' +
      '.cch-fb-inbox-preview{font-size:11px;color:#7A7A7A;margin-top:2px;}' +
      '.cch-fb-thread-modal .modal{border-radius:0;max-width:640px;}' +
      '.cch-fb-thread-msgs{max-height:340px;overflow-y:auto;padding:8px 4px;display:flex;flex-direction:column;gap:8px;}' +
      '.cch-fb-bubble{max-width:82%;padding:8px 10px;font-size:12px;line-height:1.45;border:1px solid rgba(15,26,46,0.1);}' +
      '.cch-fb-bubble.mine{align-self:flex-end;background:rgba(200,169,126,0.12);border-color:#C8A97E;}' +
      '.cch-fb-bubble.theirs{align-self:flex-start;background:#F7F7F5;}' +
      '.cch-fb-bubble.assistant{align-self:flex-start;background:rgba(200,169,126,0.08);border-color:#C8A97E;}' +
      '.cch-fb-bubble-meta{font-size:9px;color:#A3A39C;margin-top:4px;}' +
      '.cch-fb-row-click{cursor:pointer;}' +
      '.cch-fb-row-click:hover{background:rgba(200,169,126,0.04)!important;}' +
      '.cch-fb-team-tabs{display:flex;gap:0;border-bottom:1px solid rgba(15,26,46,0.1);}' +
      '.cch-fb-team-tab{flex:1;border:none;background:#F7F7F5;color:#0F1A2E;font-size:10px;letter-spacing:0.06em;' +
      'text-transform:uppercase;padding:8px 6px;cursor:pointer;border-radius:0;}' +
      '.cch-fb-team-tab.active{background:#0F1A2E;color:#C8A97E;}';
    document.head.appendChild(style);
  }

  function fbRemoveFab() {
    var fab = document.getElementById('cchFbFab');
    var panel = document.getElementById('cchFbPanel');
    if (fab) fab.remove();
    if (panel) panel.remove();
    fbState.panelOpen = false;
  }

  function fbApplyDock(dock, assistHost) {
    if (dock !== 'header' && dock !== 'float' && dock !== 'right' && dock !== 'minimized') {
      dock = (typeof window.cchPepperGetDock === 'function') ? window.cchPepperGetDock() : 'header';
    }
    /* Legacy minimized → header; right → float */
    if (dock === 'minimized') dock = 'header';
    if (dock === 'right') dock = 'float';
    var preferHeader = dock === 'header' && fbIsStudioRoute();
    var fab = document.getElementById('cchFbFab');
    var panel = document.getElementById('cchFbPanel');
    var assist = assistHost || document.getElementById('cchStudioAssistHost');
    /* Create topbar host without re-entering applyPepperDock (avoids recursion). */
    if (preferHeader && !assist && typeof window.cchPepperEnsureAssistHost === 'function') {
      try { assist = window.cchPepperEnsureAssistHost(); } catch (eM) { /* */ }
    }
    var inHeader = !!(preferHeader && assist);
    if (fab) {
      fab.classList.remove('minimized', 'dock-left');
      fab.classList.toggle('in-header', inHeader);
      fab.title = 'Team — Staff chat & Bugs';
      if (inHeader) {
        if (fab.parentNode !== assist) assist.appendChild(fab);
      } else if (fab.parentNode !== document.body) {
        document.body.appendChild(fab);
      }
    }
    if (panel) {
      panel.classList.remove('dock-left');
      panel.classList.toggle('from-header', inHeader);
    }
  }
  window.cchFbApplyDock = fbApplyDock;

  function fbInjectFab() {
    if (!fbAuthUser() || !fbIsTeamMember() || !fbIsStudioRoute()) {
      fbRemoveFab();
      return;
    }
    fbInjectStyles();
    if (!document.getElementById('cchFbFab')) {
      var wrap = document.createElement('div');
      wrap.style.position = 'fixed';
      wrap.style.bottom = '22px';
      wrap.style.right = '22px';
      wrap.style.zIndex = '9998';
      wrap.innerHTML =
        '<button type="button" id="cchFbFab" title="Team — Staff chat & Bugs" style="position:relative;">' +
          '\uD83D\uDCAC' +
          '<span id="cchFbFabBadge"></span>' +
        '</button>' +
        '<div id="cchFbPanel">' +
          '<div class="cch-fb-panel-head"><span>Team · Chat & Bugs</span>' +
            '<button type="button" class="btn btn-secondary btn-sm" id="cchFbPanelClose" style="font-size:10px;padding:2px 8px;">\u00D7</button></div>' +
          '<div class="cch-fb-team-tabs" id="cchFbTeamTabs">' +
            '<button type="button" class="cch-fb-team-tab active" data-tab="chat">Chat</button>' +
            '<button type="button" class="cch-fb-team-tab" data-tab="bugs">Bugs</button>' +
          '</div>' +
          '<div class="cch-fb-panel-body" id="cchFbPanelBody"></div>' +
        '</div>';
      document.body.appendChild(wrap.firstElementChild);
      document.body.appendChild(wrap.lastElementChild);
      var fabEl = document.getElementById('cchFbFab');
      fabEl.onclick = function() { fbTogglePanel(); };
      document.getElementById('cchFbPanelClose').onclick = function() { fbClosePanel(); };
      document.querySelectorAll('#cchFbTeamTabs .cch-fb-team-tab').forEach(function(tab) {
        tab.onclick = function() {
          fbState.teamTab = tab.getAttribute('data-tab') || 'chat';
          document.querySelectorAll('#cchFbTeamTabs .cch-fb-team-tab').forEach(function(t) {
            t.classList.toggle('active', t === tab);
          });
          fbRenderTeamPanelBody();
        };
      });
    }
    fbApplyDock((typeof window.cchPepperGetDock === 'function') ? window.cchPepperGetDock() : 'header');
    fbRefreshUnread();
  }

  function fbClosePanel() {
    var panel = document.getElementById('cchFbPanel');
    if (panel) panel.classList.remove('open');
    fbState.panelOpen = false;
    if (typeof window.cchScCloseFabChat === 'function') window.cchScCloseFabChat();
  }
  window.cchFbCloseTeamPanel = fbClosePanel;

  async function fbTogglePanel() {
    var panel = document.getElementById('cchFbPanel');
    if (!panel) return;
    if (fbState.panelOpen) {
      fbClosePanel();
      return;
    }
    // WO-086 Part 1: only one assist panel open — Pepper shares the same from-header slot
    if (typeof window.cchPepperClosePanel === 'function') {
      try { window.cchPepperClosePanel(); } catch (_eClosePepper) { /* */ }
    }
    fbState.panelOpen = true;
    panel.classList.add('open');
    if (!fbState.teamTab) fbState.teamTab = 'chat';
    document.querySelectorAll('#cchFbTeamTabs .cch-fb-team-tab').forEach(function(t) {
      t.classList.toggle('active', t.getAttribute('data-tab') === fbState.teamTab);
    });
    await fbRenderTeamPanelBody();
  }

  async function fbRenderTeamPanelBody() {
    var body = document.getElementById('cchFbPanelBody');
    if (!body) return;
    if (fbState.teamTab === 'chat') {
      if (typeof window.cchScRenderFabChat === 'function') {
        await window.cchScRenderFabChat(body);
      } else {
        body.innerHTML = '<div style="padding:12px;font-size:12px;color:#7A7A7A;">Staff chat loading… hard refresh if this stays.</div>' +
          '<button type="button" class="btn btn-secondary btn-sm" onclick="navigate(\'#/staffchat\')">Open Staff chat</button>';
      }
      return;
    }
    if (typeof window.cchScCloseFabChat === 'function') window.cchScCloseFabChat();
    await fbRenderPanelBody();
  }

  async function fbRenderPanelBody() {
    var body = document.getElementById('cchFbPanelBody');
    if (!body) return;
    body.innerHTML = '<div style="text-align:center;padding:20px;color:#A3A39C;">Loading…</div>';
    var rows = await fbLoadRequests();
    var myRole = fbMyRole();
    var openRows = rows.filter(function(r) {
      var st = r.data.status;
      return st !== 'Done' && st !== 'Closed';
    });
    var unreadRows = rows.filter(function(r) {
      return fbNormalizeUnreadBy(r.data.unreadBy)[myRole];
    });

    var showInbox = unreadRows.length > 0 || openRows.length > 0;
    if (showInbox) {
      var list = (unreadRows.length ? unreadRows : openRows).slice(0, 8);
      body.innerHTML =
        '<div style="font-size:10px;color:#A3A39C;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.06em;">Recent threads</div>' +
        list.map(function(r) {
          var d = r.data;
          var lm = d.lastMessage || {};
          var isUnread = fbNormalizeUnreadBy(d.unreadBy)[myRole];
          var preview = lm.text || d.description || d.title || '';
          return '<div class="cch-fb-inbox-item' + (isUnread ? ' unread' : '') + '" data-fb-id="' + fbEscAttr(r.id) + '">' +
            '<div class="cch-fb-inbox-title">' + fbEsc(d.title || 'Untitled') + '</div>' +
            '<div class="cch-fb-inbox-preview">' + fbEsc(fbTrunc(preview, 80)) + '</div></div>';
        }).join('') +
        '<div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap;">' +
          '<button type="button" class="btn btn-primary btn-sm" id="cchFbNewReport">+ New report</button>' +
          '<button type="button" class="btn btn-secondary btn-sm" id="cchFbOpenFull">Open full page</button>' +
        '</div>';
      body.querySelectorAll('.cch-fb-inbox-item').forEach(function(el) {
        el.onclick = function() {
          var id = el.getAttribute('data-fb-id');
          fbClosePanel();
          fbOpenThread(id);
        };
      });
      var newBtn = document.getElementById('cchFbNewReport');
      if (newBtn) newBtn.onclick = function() { fbRenderComposer(body); };
      var fullBtn = document.getElementById('cchFbOpenFull');
      if (fullBtn) fullBtn.onclick = function() {
        fbClosePanel();
        if (typeof navigate === 'function') navigate('#/feedbackrequests');
      };
    } else {
      fbRenderComposer(body);
    }
  }

  function fbRenderComposer(container) {
    var ctx = fbCaptureContext();
    container.innerHTML =
      '<div style="font-size:10px;color:#A3A39C;margin-bottom:8px;">From: ' + fbEsc(ctx.pageLabel) + '</div>' +
      '<div style="display:flex;gap:6px;margin-bottom:8px;">' +
        '<button type="button" class="btn btn-secondary btn-sm cch-fb-type-btn" data-type="Bug" style="flex:1;background:#C8A97E;color:#fff;">🐛 Bug</button>' +
        '<button type="button" class="btn btn-secondary btn-sm cch-fb-type-btn" data-type="Feature" style="flex:1;">✨ Feature</button>' +
      '</div>' +
      '<textarea class="form-textarea" id="cchFbQuickMsg" rows="4" placeholder="What happened? What should happen?" style="width:100%;margin-bottom:8px;"></textarea>' +
      '<div style="display:flex;gap:6px;">' +
        '<button type="button" class="btn btn-primary btn-sm" id="cchFbQuickSend" style="flex:1;">Send</button>' +
        '<button type="button" class="btn btn-secondary btn-sm" id="cchFbFullModal">More fields</button>' +
      '</div>';
    var selectedType = 'Bug';
    container.querySelectorAll('.cch-fb-type-btn').forEach(function(btn) {
      btn.onclick = function() {
        selectedType = btn.getAttribute('data-type');
        container.querySelectorAll('.cch-fb-type-btn').forEach(function(b) {
          b.style.background = b === btn ? '#C8A97E' : '';
          b.style.color = b === btn ? '#fff' : '';
        });
      };
    });
    document.getElementById('cchFbQuickSend').onclick = function() {
      var text = (document.getElementById('cchFbQuickMsg').value || '').trim();
      if (!text) {
        fbToast('Please describe the issue', 'error');
        return;
      }
      fbQuickSubmit(selectedType, text, ctx);
    };
    document.getElementById('cchFbFullModal').onclick = function() {
      fbClosePanel();
      if (typeof showNewFeedbackModal === 'function') {
        showNewFeedbackModal({
          type: selectedType,
          description: (document.getElementById('cchFbQuickMsg').value || '').trim(),
          module: ctx.pageLabel,
          pageUrl: ctx.route,
          _context: ctx
        });
      }
    };
  }

  async function fbQuickSubmit(type, text, ctx) {
    var database = fbDb();
    var u = fbAuthUser();
    if (!database || !u) return;
    var myRole = fbMyRole();
    var other = fbOtherRole(myRole);
    var now = new Date().toISOString();
    var title = fbTrunc(text.split('\n')[0], 80) || 'New ' + type;
    var data = {
      type: type,
      title: title,
      description: text,
      priority: 'Medium',
      module: ctx.pageLabel || '',
      pageUrl: ctx.route || '',
      context: ctx,
      createdByRole: myRole,
      unreadBy: { owner: other === 'owner', vanessa: other === 'vanessa' },
      lastMessage: fbLastMessageFrom(text, myRole, now),
      status: 'New',
      submittedBy: fbMemberName() || u.email,
      submittedByEmail: u.email,
      ownerName: fbMemberName() || '',
      ownerEmail: u.email || '',
      createdAt: now,
      updatedAt: now
    };
    try {
      var ref = await database.collection('feedbackRequests').add(data);
      await database.collection('feedbackRequests').doc(ref.id).collection('messages').add({
        authorRole: myRole,
        authorName: fbMemberName() || u.email,
        authorEmail: u.email,
        text: text,
        createdAt: now
      });
      await fbPostAssistantAck(database, ref.id, data, now);
      fbToast('Request submitted', 'success');
      fbClosePanel();
      await fbRefreshUnread();
      if (typeof renderFeedbackRequests === 'function' && String(window.location.hash || '').indexOf('feedbackrequests') >= 0) {
        renderFeedbackRequests();
      }
      fbOpenThread(ref.id);
    } catch (e) {
      if (typeof cchAlert === 'function') cchAlert('Error saving: ' + e.message, 'Error');
      else console.error(e);
    }
  }

  async function fbLoadMessages(requestId) {
    var database = fbDb();
    if (!database) return [];
    var msgs = [];
    try {
      var snap = await database.collection('feedbackRequests').doc(requestId).collection('messages')
        .orderBy('createdAt', 'asc').get();
      snap.forEach(function(d) { msgs.push({ id: d.id, ...d.data() }); });
    } catch (e) {
      try {
        var snap2 = await database.collection('feedbackRequests').doc(requestId).collection('messages').get();
        snap2.forEach(function(d) { msgs.push({ id: d.id, ...d.data() }); });
        msgs.sort(function(a, b) { return String(a.createdAt || '').localeCompare(String(b.createdAt || '')); });
      } catch (e2) {}
    }
    return msgs;
  }

  async function fbMarkRead(requestId) {
    var database = fbDb();
    if (!database) return;
    var myRole = fbMyRole();
    var doc = await database.collection('feedbackRequests').doc(requestId).get();
    if (!doc.exists) return;
    var ub = fbNormalizeUnreadBy(doc.data().unreadBy);
    if (!ub[myRole]) return;
    ub[myRole] = false;
    try {
      await database.collection('feedbackRequests').doc(requestId).update({ unreadBy: ub });
      await fbRefreshUnread();
    } catch (e) { console.warn('[CCH Bugs] mark read failed', e); }
  }

  function fbStatusOptions(current) {
    var statuses = ['New', 'Received', 'In Progress', 'Done', 'Blocked', 'Closed'];
    return statuses.map(function(s) {
      return '<option value="' + s + '"' + (current === s ? ' selected' : '') + '>' + s + '</option>';
    }).join('');
  }

  function fbPriorityOptions(current, disabled) {
    var priorities = ['Low', 'Medium', 'High', 'Critical'];
    return priorities.map(function(p) {
      return '<option value="' + p + '"' + (current === p || (!current && p === 'Medium') ? ' selected' : '') + '>' + p + '</option>';
    }).join('');
  }

  async function fbOpenThread(requestId) {
    var database = fbDb();
    if (!database) return;
    fbState.activeThreadId = requestId;
    var doc = await database.collection('feedbackRequests').doc(requestId).get();
    if (!doc.exists) {
      if (typeof cchAlert === 'function') cchAlert('Request not found.', 'Error');
      return;
    }
    var data = { id: doc.id, ...doc.data() };
    await fbMigrateDoc({ id: doc.id, data: data });
    var messages = await fbLoadMessages(requestId);
    await fbPostAssistantAck(database, requestId, data, new Date().toISOString());
    messages = await fbLoadMessages(requestId);
    await fbMarkRead(requestId);
    fbRenderThreadModal(data, messages);
  }

  function fbRenderThreadModal(data, messages) {
    var myRole = fbMyRole();
    var isOwner = myRole === 'owner';
    var statusColors = { 'New': '#D4A574', 'Received': '#C4A464', 'In Progress': '#C4A464', 'Done': '#3E8E5C', 'Closed': '#A3A39C', 'Blocked': '#E16A5B' };
    var typeIcons = { 'Bug': '🐛', 'Feature': '✨', 'Improvement': '🔧', 'Question': '❓' };
    var ctx = data.context || {};
    var ctxLine = ctx.pageLabel ? (' · ' + fbEsc(ctx.pageLabel)) : (data.pageUrl ? (' · ' + fbEsc(data.pageUrl)) : '');

    var bubbles = messages.length ? messages.map(function(m) {
      return '<div class="cch-fb-bubble ' + fbBubbleClass(m, myRole) + '">' +
        fbEsc(m.text || '') +
        '<div class="cch-fb-bubble-meta">' + fbEsc(fbBubbleLabel(m)) + ' · ' + fbFmtDate(m.createdAt) + '</div>' +
      '</div>';
    }).join('') : '<div style="font-size:12px;color:#A3A39C;padding:8px;">No messages yet.</div>';

    var container = document.getElementById('modalContainer');
    if (!container) return;
    container.innerHTML =
      '<div class="modal-overlay cch-fb-thread-modal" onclick="if(event.target===this)closeModal()">' +
      '<div class="modal" style="width:640px;max-height:90vh;overflow-y:auto;border-radius:0;">' +
        '<div class="modal-header"><div class="modal-title">' + (typeIcons[data.type] || '📋') + ' ' + fbEsc(data.title || '') + '</div>' +
          '<button class="modal-close" onclick="closeModal()">&times;</button></div>' +
        '<div class="modal-body">' +
          '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:10px;">' +
            '<span style="font-size:11px;font-weight:600;padding:3px 8px;background:' + (statusColors[data.status] || '#A3A39C') + ';color:#fff;">' + fbEsc(data.status || 'New') + '</span>' +
            (data.description ? '<span style="font-size:11px;color:#7A7A7A;">' + fbEsc(fbTrunc(data.description, 120)) + '</span>' : '') +
            (ctxLine ? '<span style="font-size:10px;color:#A3A39C;">' + ctxLine + '</span>' : '') +
          '</div>' +
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">' +
            '<div class="form-group"><label class="form-label">Status</label>' +
              '<select class="form-input" id="cchFbThreadStatus">' + fbStatusOptions(data.status) + '</select></div>' +
            '<div class="form-group"><label class="form-label">Priority' + (isOwner ? '' : ' (view only)') + '</label>' +
              '<select class="form-input" id="cchFbThreadPriority"' + (isOwner ? '' : ' disabled') + '>' +
                fbPriorityOptions(data.priority, !isOwner) + '</select></div>' +
          '</div>' +
          '<div class="cch-fb-thread-msgs" id="cchFbThreadMsgs">' + bubbles + '</div>' +
          '<div class="form-group" style="margin-top:10px;"><label class="form-label">Reply</label>' +
            '<textarea class="form-textarea" id="cchFbThreadReply" rows="3" placeholder="Type your reply…"></textarea></div>' +
        '</div>' +
        '<div class="modal-footer">' +
          '<button class="btn btn-secondary" onclick="closeModal()">Close</button>' +
          '<button class="btn btn-secondary" id="cchFbThreadSaveMeta">Save status</button>' +
          '<button class="btn btn-primary" id="cchFbThreadSend">Send reply</button>' +
        '</div>' +
      '</div></div>';

    var msgsEl = document.getElementById('cchFbThreadMsgs');
    if (msgsEl) msgsEl.scrollTop = msgsEl.scrollHeight;

    document.getElementById('cchFbThreadSend').onclick = function() { fbSendThreadReply(data.id); };
    document.getElementById('cchFbThreadSaveMeta').onclick = function() { fbSaveThreadMeta(data.id); };
  }

  async function fbSendThreadReply(requestId) {
    var database = fbDb();
    if (!database) return;
    var text = (document.getElementById('cchFbThreadReply').value || '').trim();
    if (!text) {
      fbToast('Enter a reply', 'error');
      return;
    }
    var myRole = fbMyRole();
    var other = fbOtherRole(myRole);
    var now = new Date().toISOString();
    var ub = { owner: other === 'owner', vanessa: other === 'vanessa' };
    try {
      var uMsg = fbAuthUser();
      await database.collection('feedbackRequests').doc(requestId).collection('messages').add({
        authorRole: myRole,
        authorName: fbMemberName() || (uMsg && uMsg.email) || '',
        authorEmail: (uMsg && uMsg.email) || '',
        text: text,
        createdAt: now
      });
      var meta = {
        unreadBy: ub,
        lastMessage: fbLastMessageFrom(text, myRole, now),
        updatedAt: now,
        received: true,
        receivedAt: now
      };
      if (myRole === 'owner') meta.respondedAt = now;
      await database.collection('feedbackRequests').doc(requestId).update(meta);
      document.getElementById('cchFbThreadReply').value = '';
      if (myRole === 'vanessa') {
        await fbInvokeFixItBot(requestId, 'reply');
      }
      var messages = await fbLoadMessages(requestId);
      var doc = await database.collection('feedbackRequests').doc(requestId).get();
      fbRenderThreadModal({ id: doc.id, ...doc.data() }, messages);
      await fbRefreshUnread();
      if (typeof renderFeedbackRequests === 'function' && String(window.location.hash || '').indexOf('feedbackrequests') >= 0) {
        renderFeedbackRequests();
      }
      fbToast('Reply sent', 'success');
    } catch (e) {
      if (typeof cchAlert === 'function') cchAlert('Error: ' + e.message, 'Error');
    }
  }

  async function fbSaveThreadMeta(requestId) {
    var database = fbDb();
    if (!database) return;
    var status = document.getElementById('cchFbThreadStatus').value;
    var priorityEl = document.getElementById('cchFbThreadPriority');
    var update = { status: status, updatedAt: new Date().toISOString() };
    if (fbMyRole() === 'owner' && priorityEl && !priorityEl.disabled) {
      update.priority = priorityEl.value;
    }
    try {
      await database.collection('feedbackRequests').doc(requestId).update(update);
      fbToast('Status updated', 'success');
      if (typeof renderFeedbackRequests === 'function') renderFeedbackRequests();
    } catch (e) {
      if (typeof cchAlert === 'function') cchAlert('Error: ' + e.message, 'Error');
    }
  }

  function fbRenderLastMessageCell(r, myRole) {
    var lm = r.lastMessage || {};
    var preview = lm.text || r.response || '';
    var isUnread = fbNormalizeUnreadBy(r.unreadBy)[myRole];
    if (!preview) {
      return '<button class="btn btn-sm" style="font-size:10px;padding:2px 8px;background:rgba(196,164,100,0.1);color:#C4A464;border:1px solid rgba(196,164,100,0.2);" onclick="event.stopPropagation();cchFbOpenThread(\'' + r.id + '\')">💬 Open thread</button>';
    }
    var roleLabel = lm.authorRole === 'assistant' ? 'CCH Fix-It' : (lm.authorRole || '');
    return '<div style="font-size:11px;color:#0F1A2E;max-width:200px;' + (isUnread ? 'font-weight:700;' : '') + '">' +
      (isUnread ? '<span style="display:inline-block;font-size:9px;font-weight:700;color:#fff;background:#E86F45;padding:1px 6px;border-radius:8px;margin-right:6px;vertical-align:middle;">NEW</span>' : '') +
      fbEsc(fbTrunc(preview, 90)) +
      (roleLabel ? '<div style="font-size:9px;color:' + (isUnread ? '#C4A464' : 'var(--gray-400)') + ';margin-top:2px;font-weight:' + (isUnread ? '600' : '400') + ';">' + fbEsc(roleLabel) + ' · ' + fbFmtDate(lm.at) + '</div>' : '') +
    '</div>';
  }

  function fbWrapFunctions() {
    if (window._cchFbWrapped) return;
    window._cchFbWrapped = true;

    window.cchFbEnhanceNewDoc = function(data) {
      var myRole = fbMyRole();
      var other = fbOtherRole(myRole);
      var ctx = window._cchFbPendingContext || fbCaptureContext();
      var now = new Date().toISOString();
      data.createdByRole = myRole;
      data.context = ctx;
      data.unreadBy = { owner: other === 'owner', vanessa: other === 'vanessa' };
      var seed = data.description || data.title || '';
      data.lastMessage = fbLastMessageFrom(seed, myRole, now);
      return data;
    };

    window.cchFbAfterNewDoc = async function(docId, data) {
      var database = fbDb();
      if (!database || !docId) return;
      var text = (data.description || data.title || '').trim();
      if (!text) return;
      var myRole = fbMyRole();
      try {
        var uSeed = fbAuthUser();
        await database.collection('feedbackRequests').doc(docId).collection('messages').add({
          authorRole: myRole,
          authorName: fbMemberName() || (uSeed && uSeed.email) || '',
          authorEmail: (uSeed && uSeed.email) || '',
          text: text,
          createdAt: data.createdAt || new Date().toISOString()
        });
        await fbPostAssistantAck(database, docId, data, data.createdAt || new Date().toISOString());
      } catch (e) { console.warn('[CCH Bugs] seed message failed', e); }
      await fbRefreshUnread();
    };
  }

  function fbWrapNavigate() {
    if (!window.navigate || window.navigate._cchFbWrapped) return;
    var orig = window.navigate;
    window.navigate = function(hash) {
      var result = orig.apply(this, arguments);
      setTimeout(function() {
        fbInjectFab();
        if (fbState.panelOpen && !fbIsStudioRoute()) fbClosePanel();
      }, 50);
      return result;
    };
    window.navigate._cchFbWrapped = true;
  }

  function fbStartPoll() {
    if (fbState.pollTimer) clearInterval(fbState.pollTimer);
    fbState.pollTimer = setInterval(function() {
      if (fbAuthUser() && fbIsTeamMember()) fbRefreshUnread();
    }, POLL_MS);
  }

  function fbInit() {
    fbWrapFunctions();
    fbWrapNavigate();
    fbInjectStyles();
    if (typeof auth !== 'undefined' && auth.onAuthStateChanged) {
      auth.onAuthStateChanged(function(user) {
        if (user && fbIsTeamMember()) {
          fbInjectFab();
          fbMigrateAllOnce().then(fbRefreshUnread);
        } else {
          fbRemoveFab();
        }
      });
    }
    var tries = 0;
    var wt = setInterval(function() {
      if (fbAuthUser() && fbIsTeamMember()) {
        fbInjectFab();
        fbRefreshUnread();
        clearInterval(wt);
      }
      if (++tries > 30) clearInterval(wt);
    }, 500);
    fbStartPoll();
  }

  window.cchFbEnsureAssistantAcks = fbEnsureAssistantAcks;
  window.cchFbOpenThread = fbOpenThread;
  window.cchFbRenderLastMessageCell = function(r) { return fbRenderLastMessageCell(r, fbMyRole()); };
  window.cchFbMigrateAllOnce = fbMigrateAllOnce;
  window.cchFbRefreshUnread = fbRefreshUnread;
  window.cchFbCaptureContext = fbCaptureContext;
  window.cchFbMyRole = fbMyRole;
  window.cchFbQuickSubmit = fbQuickSubmit;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fbInit);
  else fbInit();

  console.info('[CCH Bugs & Requests] build ' + BUILD + ' — Team FAB Chat|Bugs');
})();
