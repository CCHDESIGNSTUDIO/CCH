/* CCH Studio — Staff chat (WO-063 / FT-018)
 * One firm thread for Cindy ↔ Vanessa. Pure Firestore. No LLM.
 * Build 20260727sc3 — image attachments (Storage images/staffChat/)
 */
(function () {
  'use strict';
  if (window._cchStaffChatLoaded) return;
  window._cchStaffChatLoaded = true;

  var BUILD = '20260806sc089';
  var POLL_MS = 45000;
  var ROOM_PATH = 'internal/staffChat';
  var MAX_IMAGE_BYTES = 10 * 1024 * 1024;
  var scState = {
    messages: [],
    projects: [],
    unread: false,
    pollTimer: null,
    unsub: null,
    panelOpen: false,
    fabHost: null,
    pendingImage: null,
    hydrated: false,
    loadError: ''
  };

  /** index.html keeps currentUser in script scope — never bare-ref it (login-page ReferenceError). */
  function scAuthUser() {
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
  function scDb() {
    try { return (typeof db !== 'undefined' && db) || firebase.firestore(); } catch (e) { return null; }
  }
  function scEsc(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }
  function scEscAttr(s) { return scEsc(s).replace(/"/g, '&quot;'); }
  function scToast(msg, type) {
    if (typeof showToast === 'function') showToast(msg, type || 'info');
  }
  function scFmtDate(ts) {
    if (!ts) return '';
    try {
      var d = new Date(ts);
      if (isNaN(d.getTime())) return String(ts);
      return d.toLocaleString();
    } catch (e) { return String(ts); }
  }
  function scMemberName() {
    try {
      if (typeof currentUserName === 'string' && currentUserName) return currentUserName;
      var u = scAuthUser();
      if (u && u.displayName) return u.displayName;
      if (u && u.email) return String(u.email).split('@')[0];
    } catch (e) { /* */ }
    return '';
  }
  function scEmail() {
    try {
      var u = scAuthUser();
      return String((u && u.email) || '').toLowerCase().trim();
    } catch (e) { return ''; }
  }
  function scIsTeam() {
    var e = scEmail();
    if (!e) return false;
    if (typeof ADMIN_EMAILS !== 'undefined' && ADMIN_EMAILS.indexOf(e) >= 0) return true;
    if (typeof VANESSA_EMAILS !== 'undefined' && VANESSA_EMAILS.indexOf(e) >= 0) return true;
    if (e.indexOf('vanessa') >= 0 && e.indexOf('@cchdesign.com') > 0) return true;
    if (e.indexOf('@cchdesign.com') > 0 && (e.indexOf('cindy') >= 0 || e.indexOf('cynthia') >= 0)) return true;
    return false;
  }
  function scMyRole() {
    var e = scEmail();
    if (typeof VANESSA_EMAILS !== 'undefined' && VANESSA_EMAILS.indexOf(e) >= 0) return 'vanessa';
    if (e.indexOf('vanessa') >= 0) return 'vanessa';
    return 'owner';
  }
  function scOtherRole(role) {
    return role === 'vanessa' ? 'owner' : 'vanessa';
  }
  function scIsStudioRoute() {
    var h = String(location.hash || '');
    if (h.indexOf('clientview') >= 0 || h.indexOf('client/') >= 0) return false;
    return true;
  }
  function scRoomRef() {
    var database = scDb();
    if (!database) return null;
    return database.collection('internal').doc('staffChat');
  }
  function scMsgsRef() {
    var room = scRoomRef();
    return room ? room.collection('messages') : null;
  }

  function scInjectStyles() {
    if (document.getElementById('cchScStyles')) return;
    var style = document.createElement('style');
    style.id = 'cchScStyles';
    style.textContent =
      '#cchScPage{max-width:720px;margin:0 auto;}' +
      '#cchScThread{display:flex;flex-direction:column;gap:8px;min-height:320px;max-height:min(58vh,560px);overflow-y:auto;' +
      'padding:12px;border:1px solid rgba(15,26,46,0.12);background:#fff;margin-bottom:12px;}' +
      '.cch-sc-bubble{max-width:82%;padding:8px 10px;font-size:13px;line-height:1.45;border:1px solid rgba(15,26,46,0.1);border-radius:0;}' +
      '.cch-sc-bubble.mine{align-self:flex-end;background:rgba(200,169,126,0.12);border-color:#C8A97E;}' +
      '.cch-sc-bubble.theirs{align-self:flex-start;background:#F7F7F5;}' +
      '.cch-sc-bubble.from-client{align-self:flex-start;background:rgba(196,164,100,0.10);border-color:#C4A464;}' +
      '.cch-sc-bubble-meta{font-size:9px;color:#A3A39C;margin-top:4px;}' +
      '.cch-sc-tag{display:inline-block;font-size:9px;letter-spacing:.04em;text-transform:uppercase;color:#0F1A2E;' +
      'background:rgba(15,26,46,0.06);padding:2px 6px;margin-top:4px;}' +
      '.cch-sc-tag.client{background:rgba(196,164,100,0.18);color:#0A1F3D;}' +
      '#cchScComposer{display:flex;flex-direction:column;gap:8px;padding:12px;border:1px solid rgba(15,26,46,0.12);background:#FAFAF8;}' +
      '#cchScComposer textarea{width:100%;min-height:72px;border:1px solid #CFD6E0;padding:8px 10px;font-family:inherit;font-size:13px;resize:vertical;box-sizing:border-box;}' +
      '#cchScComposerRow{display:flex;gap:8px;align-items:center;flex-wrap:wrap;}' +
      '#cchScComposerRow select{flex:1;min-width:160px;border:1px solid #CFD6E0;padding:8px 10px;font-size:12px;}' +
      '#cchScEmpty{font-size:13px;color:#7A7A7A;padding:24px 8px;text-align:center;}' +
      '.cch-sc-img{display:block;max-width:100%;max-height:220px;margin:4px 0 2px;border:1px solid rgba(15,26,46,0.12);cursor:pointer;}' +
      '.cch-sc-img-wrap{margin-top:2px;}' +
      '.cch-sc-img-actions{margin-top:4px;}' +
      '.cch-sc-copy-img{border:1px solid #CFD6E0;background:#fff;padding:2px 8px;font-size:10px;cursor:pointer;color:#0F1A2E;}' +
      '.cch-sc-copy-img:hover{border-color:#C8A97E;}' +
      '.cch-sc-pending{display:none;align-items:center;gap:10px;padding:8px;border:1px solid rgba(15,26,46,0.12);background:#fff;}' +
      '.cch-sc-pending.on{display:flex;}' +
      '.cch-sc-pending img{max-height:64px;max-width:96px;border:1px solid #CFD6E0;}' +
      '.cch-sc-pending .cch-sc-pending-meta{flex:1;font-size:11px;color:#7A7A7A;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}' +
      '.cch-sc-pending button{border:1px solid #CFD6E0;background:#fff;padding:4px 8px;font-size:11px;cursor:pointer;}' +
      '#cchScFabChat{display:flex;flex-direction:column;gap:8px;height:100%;min-height:280px;}' +
      '#cchScFabThread{flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:6px;max-height:260px;' +
      'padding:6px;border:1px solid rgba(15,26,46,0.1);background:#fff;}' +
      '#cchScFabChat textarea{width:100%;min-height:56px;border:1px solid #CFD6E0;padding:6px 8px;font-size:12px;box-sizing:border-box;font-family:inherit;}' +
      '#cchScFabChat .cch-sc-fab-row{display:flex;gap:6px;align-items:center;}' +
      '#cchScFabChat select{flex:1;min-width:0;border:1px solid #CFD6E0;padding:6px;font-size:11px;}' +
      '#cchScFabThread .cch-sc-img{max-height:140px;}';
    document.head.appendChild(style);
  }

  function scInjectNavBadge(on) {
    var badge = document.getElementById('cchScNavBadge');
    if (!badge) return;
    if (on) {
      badge.textContent = '1';
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
  }

  async function scRefreshUnread() {
    if (!scIsTeam()) {
      scInjectNavBadge(false);
      return false;
    }
    var room = scRoomRef();
    if (!room) return false;
    try {
      var snap = await room.get();
      var data = snap.exists ? (snap.data() || {}) : {};
      var ub = data.unreadBy || {};
      var on = !!ub[scMyRole()];
      scState.unread = on;
      scInjectNavBadge(on);
      if (typeof window.cchFbRefreshTeamFabBadge === 'function') window.cchFbRefreshTeamFabBadge();
      return on;
    } catch (e) {
      console.warn('[CCH StaffChat] unread', e);
      return false;
    }
  }

  async function scMarkRead() {
    var room = scRoomRef();
    if (!room || !scIsTeam()) return;
    var myRole = scMyRole();
    try {
      var snap = await room.get();
      var data = snap.exists ? (snap.data() || {}) : {};
      var ub = Object.assign({ owner: false, vanessa: false }, data.unreadBy || {});
      if (!ub[myRole]) {
        scInjectNavBadge(false);
        return;
      }
      ub[myRole] = false;
      await room.set({
        unreadBy: ub,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      scState.unread = false;
      scInjectNavBadge(false);
    } catch (e) {
      console.warn('[CCH StaffChat] markRead', e);
    }
  }

  /** Quiet activity write — no Teams (unlike logActivity). */
  async function scMirrorActivity(msg) {
    if (!msg || !msg.projectId) return;
    var database = scDb();
    if (!database) return;
    var now = new Date().toISOString();
    var who = msg.authorName || msg.authorRole || 'Staff';
    var clip = String(msg.text || '').trim();
    if (!clip && msg.imageUrl) clip = '[photo]';
    if (clip.length > 120) clip = clip.slice(0, 119) + '…';
    try {
      await database.collection('activity').add({
        type: 'staff_chat',
        action: 'note',
        description: 'Staff chat · ' + who + ': ' + clip,
        projectId: String(msg.projectId || ''),
        projectName: String(msg.projectName || ''),
        user: msg.authorEmail || scEmail() || 'staff',
        timestamp: now,
        createdAt: now,
        meta: {
          source: 'staff_chat',
          staffOnly: true,
          clientSafe: false,
          staffChatMessageId: msg.id || '',
          skipTeams: true,
          hasImage: !!msg.imageUrl
        }
      });
    } catch (e) {
      console.warn('[CCH StaffChat] activity mirror', e);
    }
  }

  function scClearPendingImage() {
    if (scState.pendingImage && scState.pendingImage.previewUrl) {
      try { URL.revokeObjectURL(scState.pendingImage.previewUrl); } catch (e) { /* */ }
    }
    scState.pendingImage = null;
    scRenderPendingPreview();
    var fileInputs = document.querySelectorAll('.cch-sc-file');
    for (var i = 0; i < fileInputs.length; i++) fileInputs[i].value = '';
  }

  function scRenderPendingPreview() {
    var boxes = document.querySelectorAll('.cch-sc-pending');
    var p = scState.pendingImage;
    for (var i = 0; i < boxes.length; i++) {
      var box = boxes[i];
      var img = box.querySelector('img');
      var meta = box.querySelector('.cch-sc-pending-meta');
      if (!p) {
        box.classList.remove('on');
        if (img) { img.removeAttribute('src'); img.alt = ''; }
        if (meta) meta.textContent = '';
        continue;
      }
      box.classList.add('on');
      if (img) {
        img.src = p.previewUrl;
        img.alt = p.file && p.file.name ? p.file.name : 'Pending photo';
      }
      if (meta) meta.textContent = (p.file && p.file.name ? p.file.name : 'Photo') + ' · ready to send';
    }
  }

  function scSetPendingFile(file) {
    if (!file) return;
    if (!String(file.type || '').match(/^image\//i)) {
      scToast('Images only (JPG, PNG, WebP, GIF)', 'error');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      scToast('Image must be under 10MB', 'error');
      return;
    }
    scClearPendingImage();
    scState.pendingImage = {
      file: file,
      previewUrl: URL.createObjectURL(file)
    };
    scRenderPendingPreview();
  }

  async function scUploadPendingImage() {
    var p = scState.pendingImage;
    if (!p || !p.file) return null;
    if (typeof firebase === 'undefined' || !firebase.storage) {
      throw new Error('Storage unavailable');
    }
    var safe = String(p.file.name || 'photo.jpg').replace(/[^a-zA-Z0-9._-]/g, '_');
    var path = 'images/staffChat/' + Date.now() + '_' + safe;
    var ref = firebase.storage().ref(path);
    var snap = await ref.put(p.file, { contentType: p.file.type || 'image/jpeg' });
    var url = await snap.ref.getDownloadURL();
    return {
      imageUrl: url,
      imageName: p.file.name || safe,
      storagePath: path,
      imageType: p.file.type || '',
      imageSize: p.file.size || 0
    };
  }

  function scTakeImageFromClipboard(ev) {
    try {
      var cd = ev && ev.clipboardData;
      if (!cd) return null;
      if (cd.files && cd.files.length) {
        for (var f = 0; f < cd.files.length; f++) {
          if (cd.files[f] && String(cd.files[f].type || '').indexOf('image/') === 0) {
            return cd.files[f];
          }
        }
      }
      var items = cd.items;
      if (!items) return null;
      for (var i = 0; i < items.length; i++) {
        if (items[i].type && items[i].type.indexOf('image/') === 0) {
          return items[i].getAsFile();
        }
      }
    } catch (e) { /* */ }
    return null;
  }

  function scNormalizePasteFile(blob) {
    if (!blob) return null;
    if (blob.name) return blob;
    try {
      return new File([blob], 'pasted-image.png', { type: blob.type || 'image/png' });
    } catch (eFile) {
      return blob;
    }
  }

  /** Returns true if an image was accepted from the paste event. */
  function scAcceptPasteImage(ev, opts) {
    var quiet = opts && opts.quiet;
    var file = scTakeImageFromClipboard(ev);
    if (!file) return false;
    ev.preventDefault();
    scSetPendingFile(scNormalizePasteFile(file));
    if (!quiet) scToast('Photo ready — tap Send', 'info');
    return true;
  }

  function scChatUiOpen() {
    if (scState.panelOpen) return true;
    return String(location.hash || '').indexOf('staffchat') >= 0;
  }

  function scOnDocPaste(ev) {
    if (!scIsTeam() || !scIsStudioRoute() || !scChatUiOpen()) return;
    var t = ev.target;
    var inSc = false;
    try {
      inSc = !!(t && t.closest && (
        t.closest('#cchScPage') ||
        t.closest('#cchScComposer') ||
        t.closest('#cchScFabChat') ||
        t.closest('#cchFbPanel')
      ));
    } catch (e0) { inSc = false; }
    if (!inSc) {
      var tag = (t && t.tagName) ? String(t.tagName).toLowerCase() : '';
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || (t && t.isContentEditable)) return;
    }
    scAcceptPasteImage(ev);
  }

  async function scCopyImageToClipboard(url) {
    if (!url) {
      scToast('No image to copy', 'error');
      return;
    }
    try {
      if (navigator.clipboard && window.ClipboardItem) {
        var res = await fetch(url, { mode: 'cors' });
        if (!res.ok) throw new Error('fetch ' + res.status);
        var blob = await res.blob();
        var type = blob.type || 'image/png';
        if (type.indexOf('image/') !== 0) type = 'image/png';
        await navigator.clipboard.write([new ClipboardItem((function () {
          var o = {};
          o[type] = blob;
          return o;
        })())]);
        scToast('Image copied — Ctrl+V to paste', 'success');
        return;
      }
    } catch (e) {
      console.warn('[CCH StaffChat] copy image blob', e);
    }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
        scToast('Image link copied', 'success');
        return;
      }
    } catch (e2) {
      console.warn('[CCH StaffChat] copy url', e2);
    }
    scToast('Could not copy — open image and copy from there', 'error');
  }

  function scWireThreadActions(el) {
    if (!el || el._cchScActionsWired) return;
    el._cchScActionsWired = true;
    el.addEventListener('click', function (ev) {
      var btn = ev.target && ev.target.closest ? ev.target.closest('.cch-sc-copy-img') : null;
      if (!btn) return;
      ev.preventDefault();
      ev.stopPropagation();
      var url = btn.getAttribute('data-url') || '';
      scCopyImageToClipboard(url);
    });
  }

  function scWireComposerExtras(scopeId) {
    var root = scopeId ? document.getElementById(scopeId) : document;
    if (!root) return;
    var file = root.querySelector('.cch-sc-file');
    var photoBtn = root.querySelector('.cch-sc-photo-btn');
    var clearBtn = root.querySelector('.cch-sc-pending-clear');
    var ta = root.querySelector('textarea');
    if (photoBtn && file) {
      photoBtn.onclick = function () { file.click(); };
      file.onchange = function () {
        var f = file.files && file.files[0];
        if (f) scSetPendingFile(f);
      };
    }
    if (clearBtn) clearBtn.onclick = function () { scClearPendingImage(); };
    if (!root._cchScPasteWired) {
      root._cchScPasteWired = true;
      root.addEventListener('paste', function (ev) {
        scAcceptPasteImage(ev);
      });
    }
    if (ta && !ta._cchScPasteWired) {
      ta._cchScPasteWired = true;
      ta.addEventListener('paste', function (ev) {
        scAcceptPasteImage(ev);
      });
    }
    scRenderPendingPreview();
  }

  async function scLoadProjects() {
    var database = scDb();
    if (!database) return [];
    try {
      var snap = await database.collection('boards').limit(300).get();
      var rows = [];
      snap.forEach(function (d) {
        var x = d.data() || {};
        rows.push({
          id: d.id,
          name: x.name || x.projectName || x.title || d.id
        });
      });
      rows.sort(function (a, b) { return String(a.name).localeCompare(String(b.name)); });
      scState.projects = rows;
      return rows;
    } catch (e) {
      console.warn('[CCH StaffChat] projects', e);
      scState.projects = [];
      return [];
    }
  }

  function scBubbleHtml(m, myRole) {
    var fromClient = !!(m.fromClient || m.source === 'client_pepper' || m.authorRole === 'client');
    var mine = !fromClient && m.authorRole === myRole;
    var tag = '';
    if (fromClient) {
      tag = '<div class="cch-sc-tag client">Client · Pepper' +
        (m.projectName || m.projectId ? (' · ' + scEsc(m.projectName || m.projectId)) : '') +
        '</div>';
    } else if (m.projectId) {
      tag = '<div class="cch-sc-tag">' + scEsc(m.projectName || m.projectId) + '</div>';
    }
    var body = '';
    if (m.imageUrl) {
      body += '<div class="cch-sc-img-wrap"><a href="' + scEscAttr(m.imageUrl) + '" target="_blank" rel="noopener noreferrer">' +
        '<img class="cch-sc-img" src="' + scEscAttr(m.imageUrl) + '" alt="' + scEscAttr(m.imageName || 'Photo') + '" loading="lazy"></a>' +
        '<div class="cch-sc-img-actions"><button type="button" class="cch-sc-copy-img" data-url="' + scEscAttr(m.imageUrl) + '">Copy image</button></div></div>';
    }
    if (m.text) body += '<div>' + scEsc(m.text) + '</div>';
    if (!body) body = '<div style="color:#A3A39C;">(empty)</div>';
    var klass = fromClient ? 'from-client' : (mine ? 'mine' : 'theirs');
    return '<div class="cch-sc-bubble ' + klass + '">' +
      body +
      tag +
      '<div class="cch-sc-bubble-meta">' + scEsc(m.authorName || m.authorRole || '') +
      ' · ' + scEsc(scFmtDate(m.createdAt)) + '</div></div>';
  }

  function scThreadEls() {
    var out = [];
    var a = document.getElementById('cchScThread');
    var b = document.getElementById('cchScFabThread');
    if (a) out.push(a);
    if (b && b !== a) out.push(b);
    return out;
  }

  function scApplyMessages(rows, opts) {
    opts = opts || {};
    if (Array.isArray(rows)) scState.messages = rows;
    if (opts.hydrated) scState.hydrated = true;
    if (opts.error != null) scState.loadError = String(opts.error || '');
    else if (opts.clearError) scState.loadError = '';
    scRenderThreadEl();
  }

  function scRenderThreadEl() {
    var els = scThreadEls();
    if (!els.length) return;
    var myRole = scMyRole();
    var msgs = scState.messages || [];
    var html;
    if (!scState.hydrated && !msgs.length) {
      html = '<div id="cchScEmpty">Loading…</div>';
    } else if (scState.loadError && !msgs.length) {
      html = '<div id="cchScEmpty">Could not load chat history. <button type="button" class="btn btn-sm" id="cchScRetryLoad">Retry</button><div style="margin-top:8px;font-size:11px;color:#A3A39C;">' +
        scEsc(scState.loadError) + '</div></div>';
    } else if (!msgs.length) {
      html = '<div id="cchScEmpty">No messages yet. Say hi — one shared thread for the studio.</div>';
    } else {
      html = msgs.map(function (m) { return scBubbleHtml(m, myRole); }).join('');
    }
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      scWireThreadActions(el);
      el.innerHTML = html;
      if (msgs.length) el.scrollTop = el.scrollHeight;
      var retry = el.querySelector('#cchScRetryLoad');
      if (retry) {
        retry.onclick = function () {
          scState.hydrated = false;
          scState.loadError = '';
          scRenderThreadEl();
          scAttachListener(true);
          scLoadMessagesOnce();
        };
      }
    }
  }

  function scDetachListener() {
    if (scState.unsub) {
      try { scState.unsub(); } catch (e0) { /* */ }
      scState.unsub = null;
    }
  }

  function scAttachListener(force) {
    if (scState.unsub && !force) {
      scRenderThreadEl();
      return;
    }
    scDetachListener();
    var ref = scMsgsRef();
    if (!ref) return;
    try {
      scState.unsub = ref.orderBy('createdAt', 'asc').limit(400).onSnapshot(function (snap) {
        var rows = [];
        snap.forEach(function (d) {
          rows.push(Object.assign({ id: d.id }, d.data() || {}));
        });
        scApplyMessages(rows, { hydrated: true, clearError: true });
      }, function (err) {
        console.warn('[CCH StaffChat] onSnapshot', err);
        scState.loadError = (err && err.message) ? err.message : String(err || 'listener error');
        scLoadMessagesOnce();
      });
    } catch (e) {
      console.warn('[CCH StaffChat] listener', e);
      scState.loadError = (e && e.message) ? e.message : String(e || 'listener error');
      scLoadMessagesOnce();
    }
  }

  async function scLoadMessagesOnce() {
    var ref = scMsgsRef();
    if (!ref) return;
    try {
      var snap = await ref.orderBy('createdAt', 'asc').limit(400).get();
      var rows = [];
      snap.forEach(function (d) {
        rows.push(Object.assign({ id: d.id }, d.data() || {}));
      });
      scApplyMessages(rows, { hydrated: true, clearError: true });
    } catch (e) {
      try {
        var snap2 = await ref.limit(400).get();
        var rows2 = [];
        snap2.forEach(function (d) {
          rows2.push(Object.assign({ id: d.id }, d.data() || {}));
        });
        rows2.sort(function (a, b) {
          return String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
        });
        scApplyMessages(rows2, { hydrated: true, clearError: true });
      } catch (e2) {
        console.warn('[CCH StaffChat] load messages', e2);
        scState.hydrated = true;
        scState.loadError = (e2 && e2.message) ? e2.message : String(e2 || 'load failed');
        // Keep any cached messages — do not wipe the running log on a failed reload
        scRenderThreadEl();
        if (!scState.messages.length) {
          scToast('Staff chat could not reload history', 'error');
        }
      }
    }
  }

  async function scSend() {
    var ta = document.getElementById('cchScInput') || document.getElementById('cchScFabInput');
    var sel = document.getElementById('cchScProject') || document.getElementById('cchScFabProject');
    if (!ta) return;
    var text = String(ta.value || '').trim();
    var hasImage = !!(scState.pendingImage && scState.pendingImage.file);
    if (!text && !hasImage) {
      scToast('Type a message or add a photo', 'error');
      return;
    }
    var ref = scMsgsRef();
    var room = scRoomRef();
    if (!ref || !room) {
      scToast('Chat unavailable — check sign-in', 'error');
      return;
    }
    var sendBtns = document.querySelectorAll('#cchScSend, #cchScFabSend');
    for (var bi = 0; bi < sendBtns.length; bi++) {
      sendBtns[bi].disabled = true;
      sendBtns[bi].textContent = hasImage ? 'Uploading…' : 'Sending…';
    }
    var myRole = scMyRole();
    var other = scOtherRole(myRole);
    var now = new Date().toISOString();
    var projectId = sel ? String(sel.value || '').trim() : '';
    var projectName = '';
    if (projectId) {
      var hit = null;
      var plist = scState.projects || [];
      for (var i = 0; i < plist.length; i++) {
        if (plist[i].id === projectId) { hit = plist[i]; break; }
      }
      projectName = hit ? hit.name : projectId;
    }
    try {
      var imageMeta = null;
      if (hasImage) {
        imageMeta = await scUploadPendingImage();
      }
      var payload = {
        text: text,
        authorRole: myRole,
        authorName: scMemberName() || scEmail(),
        authorEmail: scEmail(),
        createdAt: now
      };
      if (imageMeta) {
        payload.imageUrl = imageMeta.imageUrl;
        payload.imageName = imageMeta.imageName;
        payload.storagePath = imageMeta.storagePath;
        payload.imageType = imageMeta.imageType;
        payload.imageSize = imageMeta.imageSize;
      }
      if (projectId) {
        payload.projectId = projectId;
        payload.projectName = projectName;
      }
      var docRef = await ref.add(payload);
      payload.id = docRef.id;
      var preview = text;
      if (!preview && imageMeta) preview = '[photo]';
      if (preview.length > 100) preview = preview.slice(0, 99) + '…';
      var ub = { owner: false, vanessa: false };
      ub[other] = true;
      ub[myRole] = false;
      await room.set({
        lastMessage: {
          text: preview,
          authorRole: myRole,
          at: now,
          hasImage: !!imageMeta
        },
        unreadBy: ub,
        updatedAt: now
      }, { merge: true });
      ta.value = '';
      if (sel) sel.value = '';
      scClearPendingImage();
      if (projectId) await scMirrorActivity(payload);
      scToast('Sent', 'success');
      if (typeof window.cchFbRefreshTeamFabBadge === 'function') window.cchFbRefreshTeamFabBadge();
    } catch (e) {
      console.error('[CCH StaffChat] send', e);
      scToast('Could not send: ' + (e.message || e), 'error');
    } finally {
      for (var bj = 0; bj < sendBtns.length; bj++) {
        sendBtns[bj].disabled = false;
        sendBtns[bj].textContent = 'Send';
      }
    }
  }

  /** Compact chat for the combined Team FAB (Chat | Bugs). */
  async function scRenderFabChat(container) {
    if (!container) return;
    scInjectStyles();
    scState.fabHost = container;
    scState.panelOpen = true;
    container.innerHTML =
      '<div id="cchScFabChat">' +
        '<div id="cchScFabThread"><div id="cchScEmpty">Loading…</div></div>' +
        '<textarea id="cchScFabInput" placeholder="Ctrl+V to paste a photo…"></textarea>' +
        '<div class="cch-sc-pending">' +
          '<img alt="">' +
          '<div class="cch-sc-pending-meta"></div>' +
          '<button type="button" class="cch-sc-pending-clear">Remove</button>' +
        '</div>' +
        '<div class="cch-sc-fab-row">' +
          '<select id="cchScFabProject"><option value="">No project tag</option></select>' +
          '<button type="button" class="btn btn-sm cch-sc-photo-btn" title="Add photo">Photo</button>' +
          '<input type="file" class="cch-sc-file" accept="image/*" style="display:none">' +
          '<button type="button" class="btn btn-primary btn-sm" id="cchScFabSend">Send</button>' +
        '</div>' +
        '<div style="font-size:10px;color:#A3A39C;">Running studio log · or open <a href="#/staffchat" id="cchScFabFullLink" style="color:#0F1A2E;font-weight:600;">full Staff chat</a></div>' +
      '</div>';
    // Paint cached history immediately so reopen never looks wiped
    scRenderThreadEl();
    await scLoadProjects();
    var sel = document.getElementById('cchScFabProject');
    if (sel) {
      (scState.projects || []).forEach(function (p) {
        var opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.name;
        sel.appendChild(opt);
      });
    }
    scWireComposerExtras('cchScFabChat');
    var sendBtn = document.getElementById('cchScFabSend');
    if (sendBtn) sendBtn.onclick = function () { scSend(); };
    var full = document.getElementById('cchScFabFullLink');
    if (full) {
      full.onclick = function (ev) {
        ev.preventDefault();
        if (typeof window.cchFbCloseTeamPanel === 'function') window.cchFbCloseTeamPanel();
        if (typeof navigate === 'function') navigate('#/staffchat');
      };
    }
    await scMarkRead();
    scAttachListener(false);
    scLoadMessagesOnce();
    if (typeof window.cchFbRefreshTeamFabBadge === 'function') window.cchFbRefreshTeamFabBadge();
  }

  function scCloseFabChat() {
    scState.panelOpen = false;
    scState.fabHost = null;
    // Do NOT unsubscribe — keep the running log warm so reopen shows history instantly.
  }

  async function renderStaffChatPage() {
    if (typeof setBreadcrumb === 'function') {
      setBreadcrumb([{ label: 'Staff chat' }]);
    }
    if (typeof setTopbarActions === 'function') setTopbarActions('');
    var C = document.getElementById('contentArea');
    if (!C) return;
    if (!scIsTeam()) {
      C.innerHTML = '<div class="notice error" style="margin:24px;">Staff chat is for CCH team members only.</div>';
      return;
    }
    scInjectStyles();
    C.innerHTML =
      '<div id="cchScPage">' +
        '<div style="margin-bottom:14px;">' +
          '<div style="font-family:\'Playfair Display\',Georgia,serif;font-size:22px;color:#0F1A2E;">Staff chat</div>' +
          '<div style="font-size:12px;color:#7A7A7A;margin-top:4px;">Running studio log · photos + optional project tag (admin activity only · never client-facing)</div>' +
        '</div>' +
        '<div id="cchScThread"><div id="cchScEmpty">Loading…</div></div>' +
        '<div id="cchScComposer">' +
          '<textarea id="cchScInput" placeholder="Ctrl+V to paste a photo or type a message…"></textarea>' +
          '<div class="cch-sc-pending">' +
            '<img alt="">' +
            '<div class="cch-sc-pending-meta"></div>' +
            '<button type="button" class="cch-sc-pending-clear">Remove</button>' +
          '</div>' +
          '<div id="cchScComposerRow">' +
            '<select id="cchScProject"><option value="">No project tag</option></select>' +
            '<button type="button" class="btn cch-sc-photo-btn" title="Add photo">Photo</button>' +
            '<input type="file" class="cch-sc-file" accept="image/*" style="display:none">' +
            '<button type="button" class="btn btn-primary" id="cchScSend">Send</button>' +
          '</div>' +
          '<div style="font-size:10px;color:#A3A39C;">Copy / paste photos (Ctrl+V). Messages are a permanent studio log (cannot be unsent). Project tags appear on admin Recent Activity only.</div>' +
        '</div>' +
      '</div>';

    scRenderThreadEl();
    await scLoadProjects();
    var sel = document.getElementById('cchScProject');
    if (sel) {
      (scState.projects || []).forEach(function (p) {
        var opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.name;
        sel.appendChild(opt);
      });
    }
    scWireComposerExtras('cchScComposer');
    var sendBtn = document.getElementById('cchScSend');
    if (sendBtn) sendBtn.onclick = function () { scSend(); };
    var ta = document.getElementById('cchScInput');
    if (ta) {
      ta.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) {
          ev.preventDefault();
          scSend();
        }
      });
    }
    await scMarkRead();
    scAttachListener(false);
    scLoadMessagesOnce();
  }

  function scWrapNavigate() {
    if (typeof window.navigate !== 'function' || window.navigate._cchScWrapped) return;
    var orig = window.navigate;
    window.navigate = function () {
      var result = orig.apply(this, arguments);
      setTimeout(function () {
        scRefreshUnread();
        // Only drop the listener when leaving Studio entirely (client portal routes).
        if (!scIsStudioRoute() && scState.unsub) {
          scDetachListener();
        }
      }, 80);
      return result;
    };
    window.navigate._cchScWrapped = true;
  }

  function scStartPoll() {
    if (scState.pollTimer) clearInterval(scState.pollTimer);
    scState.pollTimer = setInterval(function () {
      if (scAuthUser() && scIsTeam() && scIsStudioRoute()) scRefreshUnread();
    }, POLL_MS);
  }

  function scInit() {
    scWrapNavigate();
    scInjectStyles();
    if (!document._cchScDocPaste) {
      document._cchScDocPaste = true;
      document.addEventListener('paste', scOnDocPaste);
    }
    if (typeof auth !== 'undefined' && auth.onAuthStateChanged) {
      auth.onAuthStateChanged(function (user) {
        if (user && scIsTeam()) {
          scRefreshUnread();
          // Warm the running log as soon as the team member is signed in
          scAttachListener(false);
          scLoadMessagesOnce();
        } else {
          scDetachListener();
          scState.messages = [];
          scState.hydrated = false;
          scState.loadError = '';
          scInjectNavBadge(false);
        }
      });
    }
    var tries = 0;
    var wt = setInterval(function () {
      if (scAuthUser() && scIsTeam()) {
        scRefreshUnread();
        clearInterval(wt);
      }
      if (++tries > 40) clearInterval(wt);
    }, 500);
    scStartPoll();
  }

  window.renderStaffChatPage = renderStaffChatPage;
  window.cchScRefreshUnread = scRefreshUnread;
  window.cchScIsUnread = function () { return !!scState.unread; };
  window.cchScRenderFabChat = scRenderFabChat;
  window.cchScCloseFabChat = scCloseFabChat;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scInit);
  else scInit();

  console.info('[CCH Staff Chat] build ' + BUILD + ' - persistent running log');
})();
