/* CCH Client Portal — Pepper message relay (WO-089 + Aug 6 header dock)
 * Acknowledge-only. No AI answers. Relays to project messages + Team Chat (Cindy & Vanessa).
 * Docked in portal navy top header (not bottom corner). Panel includes a side chat log.
 * Build 20260806cp090
 */
(function () {
  'use strict';
  if (window._cchClientPepperLoaded) return;
  window._cchClientPepperLoaded = true;

  var BUILD = '20260806cp090';
  var ACK = "Thank you — I'll pass this along to the CCH team.";
  var COOLDOWN_MS = 20000;
  var AVATAR = 'assets/pepper-avatar-chip.png?v=20260806final2';
  var AVATAR_FULL = 'assets/pepper-avatar.png?v=20260806final2';
  var lastSendAt = 0;
  var ctx = { projectId: '', projectName: '', clientName: '', clientEmail: '' };

  function cpDb() {
    try { return (typeof db !== 'undefined' && db) || firebase.firestore(); } catch (e) { return null; }
  }
  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }
  function relTime(ts) {
    if (!ts) return '';
    var d = new Date(ts);
    if (isNaN(d.getTime())) return '';
    var diff = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
    if (diff < 604800) return Math.floor(diff / 86400) + 'd ago';
    return d.toLocaleDateString();
  }

  function injectStyles() {
    if (document.getElementById('cchCpPepperStyles')) return;
    var s = document.createElement('style');
    s.id = 'cchCpPepperStyles';
    s.textContent =
      /* Header host — sits in navy portal bar next to brand */
      '#cchCpPepperHost{display:flex;align-items:center;flex-shrink:0;margin-left:4px;}' +
      '#cchCpPepperFab{width:52px;height:52px;padding:0;border:1px solid #C4A464;background:#0A1F3D;cursor:pointer;' +
      'flex-shrink:0;display:block;}' +
      '#cchCpPepperFab.in-header{position:static;right:auto;bottom:auto;z-index:auto;box-shadow:none;width:48px;height:48px;}' +
      '#cchCpPepperFab.float-fallback{position:fixed;right:20px;bottom:20px;z-index:9000;' +
      'box-shadow:0 6px 20px rgba(10,31,61,.2);width:56px;height:56px;}' +
      '#cchCpPepperFab img{width:100%;height:100%;object-fit:cover;display:block;}' +
      '#cchCpPepperFab:hover{border-color:#FFFFFF;}' +
      '#cchCpPepperPanel{position:fixed;right:20px;top:64px;z-index:9001;width:min(380px,calc(100vw - 32px));' +
      'max-height:calc(100vh - 88px);background:#FFFEFB;border:1px solid #0A1F3D;border-top:3px solid #C4A464;' +
      'display:none;flex-direction:column;box-shadow:0 10px 32px rgba(10,31,61,.18);font-family:"DM Sans",sans-serif;}' +
      '#cchCpPepperPanel.open{display:flex;}' +
      '#cchCpPepperHead{display:flex;align-items:center;gap:12px;padding:14px 16px;background:#0A1F3D;color:#fff;flex-shrink:0;}' +
      '#cchCpPepperHead img{width:72px;height:72px;object-fit:cover;border:1px solid #C4A464;flex-shrink:0;}' +
      '#cchCpPepperHead .t{font-family:"Playfair Display",serif;font-size:18px;}' +
      '#cchCpPepperHead .s{display:block;font-size:11px;color:#C4A464;margin-top:2px;font-family:"DM Sans",sans-serif;}' +
      '#cchCpPepperClose{margin-left:auto;background:none;border:none;color:#C4A464;font-size:20px;cursor:pointer;line-height:1;align-self:flex-start;}' +
      '#cchCpPepperLog{flex:1 1 auto;min-height:120px;max-height:220px;overflow-y:auto;padding:12px 14px;' +
      'border-bottom:1px solid #E2E2E2;background:#FAFAF8;}' +
      '#cchCpPepperLog .cch-cp-log-empty{font-size:12px;color:#5C6B80;line-height:1.45;font-style:italic;}' +
      '#cchCpPepperLog .cch-cp-log-row{margin-bottom:10px;padding-bottom:10px;border-bottom:1px solid #EFEFEA;}' +
      '#cchCpPepperLog .cch-cp-log-row:last-child{border-bottom:none;margin-bottom:0;padding-bottom:0;}' +
      '#cchCpPepperLog .cch-cp-log-who{font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:#C4A464;font-weight:600;}' +
      '#cchCpPepperLog .cch-cp-log-text{font-size:13px;color:#0A1F3D;line-height:1.4;margin-top:3px;white-space:pre-wrap;}' +
      '#cchCpPepperLog .cch-cp-log-when{font-size:10px;color:#9CA3AF;margin-top:3px;}' +
      '#cchCpPepperBody{padding:14px;display:flex;flex-direction:column;gap:10px;flex-shrink:0;}' +
      '#cchCpPepperBody p{margin:0;font-size:13px;line-height:1.45;color:#0A1F3D;}' +
      '#cchCpPepperBody textarea{width:100%;min-height:88px;border:1px solid #E2E2E2;padding:10px;font:inherit;font-size:13px;' +
      'color:#0A1F3D;resize:vertical;box-sizing:border-box;background:#fff;}' +
      '#cchCpPepperBody textarea:focus{outline:none;border-color:#C4A464;}' +
      '#cchCpPepperSend{align-self:flex-end;border:none;background:#0A1F3D;color:#C4A464;padding:12px 18px;cursor:pointer;' +
      'font-size:12px;letter-spacing:.06em;text-transform:uppercase;font-weight:600;}' +
      '#cchCpPepperSend:disabled{opacity:.45;cursor:not-allowed;}' +
      '#cchCpPepperAck{display:none;font-size:12px;color:#5C6B80;line-height:1.45;font-style:italic;}' +
      '#cchCpPepperAck.show{display:block;}' +
      '.cp-top-header{min-height:64px;}' +
      '@media (max-width:520px){' +
      '#cchCpPepperPanel{right:12px;left:12px;width:auto;top:72px;max-height:calc(100vh - 96px);}' +
      '#cchCpPepperFab.in-header{width:44px;height:44px;}' +
      '}';
    document.head.appendChild(s);
  }

  function ensureHost() {
    var host = document.getElementById('cchCpPepperHost');
    if (host && host.isConnected) return host;
    var header = document.querySelector('.cp-top-header');
    if (!header) return null;
    host = document.createElement('div');
    host.id = 'cchCpPepperHost';
    var brand = header.querySelector('.cp-top-header-k');
    if (brand && brand.parentNode === header) {
      var left = document.createElement('div');
      left.className = 'cp-top-header-left';
      left.style.cssText = 'display:flex;align-items:center;gap:14px;min-width:0;';
      header.insertBefore(left, brand);
      left.appendChild(brand);
      left.appendChild(host);
    } else if (brand && brand.parentNode) {
      brand.parentNode.insertBefore(host, brand.nextSibling);
    } else {
      header.insertBefore(host, header.firstChild);
    }
    return host;
  }

  function applyDock() {
    var fab = document.getElementById('cchCpPepperFab');
    if (!fab) return;
    var host = ensureHost();
    if (host) {
      fab.classList.add('in-header');
      fab.classList.remove('float-fallback');
      if (fab.parentNode !== host) host.appendChild(fab);
    } else {
      fab.classList.remove('in-header');
      fab.classList.add('float-fallback');
      if (fab.parentNode !== document.body) document.body.appendChild(fab);
    }
  }

  function ensureDom() {
    injectStyles();
    if (!document.getElementById('cchCpPepperFab')) {
      var fab = document.createElement('button');
      fab.type = 'button';
      fab.id = 'cchCpPepperFab';
      fab.title = 'Message CCH Design — Pepper';
      fab.setAttribute('aria-label', 'Message CCH Design');
      fab.innerHTML = '<img src="' + AVATAR + '" alt="Pepper">';
      fab.onclick = function () { togglePanel(); };
      document.body.appendChild(fab);
    }
    if (!document.getElementById('cchCpPepperPanel')) {
      var panel = document.createElement('div');
      panel.id = 'cchCpPepperPanel';
      panel.innerHTML =
        '<div id="cchCpPepperHead">' +
          '<img src="' + AVATAR_FULL + '" alt="">' +
          '<div><div class="t">Pepper</div><span class="s">CCH Design Studio</span></div>' +
          '<button type="button" id="cchCpPepperClose" title="Close">&times;</button>' +
        '</div>' +
        '<div id="cchCpPepperLog"><div class="cch-cp-log-empty">Loading your notes…</div></div>' +
        '<div id="cchCpPepperBody">' +
          '<p>Share a note for the CCH team. I\'ll pass it along — I can\'t answer questions here.</p>' +
          '<textarea id="cchCpPepperInput" placeholder="Type your message…" maxlength="2000"></textarea>' +
          '<div id="cchCpPepperAck"></div>' +
          '<button type="button" id="cchCpPepperSend">Send</button>' +
        '</div>';
      document.body.appendChild(panel);
      document.getElementById('cchCpPepperClose').onclick = function () { closePanel(); };
      document.getElementById('cchCpPepperSend').onclick = function () { void sendMessage(); };
    }
    applyDock();
  }

  function togglePanel() {
    ensureDom();
    var panel = document.getElementById('cchCpPepperPanel');
    if (!panel) return;
    if (panel.classList.contains('open')) closePanel();
    else {
      panel.classList.add('open');
      void refreshChatLog();
    }
  }
  function closePanel() {
    var panel = document.getElementById('cchCpPepperPanel');
    if (panel) panel.classList.remove('open');
  }

  async function refreshChatLog() {
    var log = document.getElementById('cchCpPepperLog');
    if (!log || !ctx.projectId) return;
    var database = cpDb();
    if (!database) {
      log.innerHTML = '<div class="cch-cp-log-empty">Unable to load notes right now.</div>';
      return;
    }
    try {
      var snap;
      try {
        snap = await database.collection('boards').doc(ctx.projectId).collection('messages')
          .orderBy('createdAt', 'desc').limit(40).get();
      } catch (_eOrd) {
        snap = await database.collection('boards').doc(ctx.projectId).collection('messages').limit(60).get();
      }
      var rows = [];
      snap.forEach(function (d) {
        var m = d.data() || {};
        var from = String(m.from || '').toLowerCase();
        var author = String(m.author || '');
        var isClient = from === 'client' || m.type === 'client' || m.source === 'client_pepper' || /^client$/i.test(author);
        if (!isClient && m.published !== true && !m.fromClient) return;
        rows.push({
          who: isClient ? 'You' : (author || 'CCH'),
          text: String(m.text || m.body || '').trim(),
          when: m.createdAt || m.timestamp || ''
        });
      });
      rows = rows.filter(function (r) { return r.text; });
      rows.sort(function (a, b) { return String(a.when).localeCompare(String(b.when)); });
      if (rows.length > 40) rows = rows.slice(-40);
      if (!rows.length) {
        log.innerHTML = '<div class="cch-cp-log-empty">No notes yet — send one below. Your team sees these in Communications.</div>';
        return;
      }
      log.innerHTML = rows.map(function (r) {
        return '<div class="cch-cp-log-row">' +
          '<div class="cch-cp-log-who">' + esc(r.who) + '</div>' +
          '<div class="cch-cp-log-text">' + esc(r.text) + '</div>' +
          '<div class="cch-cp-log-when">' + esc(relTime(r.when)) + '</div>' +
          '</div>';
      }).join('');
      log.scrollTop = log.scrollHeight;
    } catch (e) {
      console.warn('[CCH ClientPepper] chat log', e);
      log.innerHTML = '<div class="cch-cp-log-empty">Notes will appear here after you send. Saved notes also live under Messages.</div>';
    }
  }

  async function writeProjectMessage(database, text) {
    await database.collection('boards').doc(ctx.projectId).collection('messages').add({
      text: text,
      author: 'Client',
      from: 'client',
      createdAt: new Date().toISOString(),
      type: 'client',
      source: 'client_pepper'
    });
  }

  /** Team Chat drop — both Cindy & Vanessa unread. May fail if rules not deployed yet. */
  async function writeStaffChatRelay(database, text) {
    var now = new Date().toISOString();
    var room = database.collection('internal').doc('staffChat');
    var label = (ctx.clientName || 'Client') + (ctx.projectName ? (' · ' + ctx.projectName) : '');
    var body = text;
    if (ctx.clientName || ctx.clientEmail) {
      body = '[' + label + (ctx.clientEmail ? (' · ' + ctx.clientEmail) : '') + ']\n' + text;
    }
    await room.collection('messages').add({
      text: body,
      authorRole: 'client',
      authorName: ctx.clientName || 'Client (portal)',
      authorEmail: ctx.clientEmail || '',
      createdAt: now,
      fromClient: true,
      source: 'client_pepper',
      projectId: ctx.projectId,
      projectName: ctx.projectName || ctx.projectId
    });
    var preview = body.length > 100 ? body.slice(0, 99) + '\u2026' : body;
    await room.set({
      lastMessage: {
        text: preview,
        authorRole: 'client',
        at: now,
        hasImage: false,
        fromClient: true
      },
      unreadBy: { owner: true, vanessa: true },
      updatedAt: now
    }, { merge: true });
  }

  async function sendMessage() {
    var ta = document.getElementById('cchCpPepperInput');
    var btn = document.getElementById('cchCpPepperSend');
    var ack = document.getElementById('cchCpPepperAck');
    if (!ta || !ctx.projectId) return;
    var text = String(ta.value || '').trim();
    if (!text) return;
    if (/^(blob:|data:)/i.test(text)) {
      if (ack) {
        ack.textContent = 'Please type a message without local file links.';
        ack.classList.add('show');
      }
      return;
    }
    var now = Date.now();
    if (now - lastSendAt < COOLDOWN_MS) {
      if (ack) {
        ack.textContent = 'One moment — you can send another note shortly.';
        ack.classList.add('show');
      }
      return;
    }
    var database = cpDb();
    if (!database) {
      if (ack) {
        ack.textContent = 'Unable to send right now. Please try again in a moment.';
        ack.classList.add('show');
      }
      return;
    }
    if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }
    try {
      await writeProjectMessage(database, text);
      var staffOk = false;
      try {
        await writeStaffChatRelay(database, text);
        staffOk = true;
      } catch (eStaff) {
        console.warn('[CCH ClientPepper] staffChat relay (may need rules deploy)', eStaff);
      }
      try {
        if (typeof cpPortalLogClientActivity === 'function') {
          await cpPortalLogClientActivity(
            'message',
            'pepper_relay',
            'sent a message via Pepper: "' + text.slice(0, 120) + '"',
            ctx.projectId,
            ctx.projectName || ctx.projectId,
            { via: 'client_pepper', staffChat: staffOk }
          );
        }
      } catch (_eAct) { /* */ }
      lastSendAt = now;
      ta.value = '';
      if (ack) {
        ack.textContent = ACK;
        ack.classList.add('show');
      }
      void refreshChatLog();
    } catch (e) {
      console.error('[CCH ClientPepper] send', e);
      if (ack) {
        ack.textContent = 'Something went wrong sending your note. Please try again, or use Messages in the menu.';
        ack.classList.add('show');
      }
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Send'; }
    }
  }

  window.cchClientPepperMount = function (opts) {
    opts = opts || {};
    ctx.projectId = String(opts.projectId || '').trim();
    ctx.projectName = String(opts.projectName || '').trim();
    ctx.clientName = String(opts.clientName || 'Client').trim() || 'Client';
    ctx.clientEmail = String(opts.clientEmail || '').trim();
    if (!ctx.projectId) {
      window.cchClientPepperUnmount();
      return;
    }
    ensureDom();
    applyDock();
    var fab = document.getElementById('cchCpPepperFab');
    if (fab) fab.style.display = '';
    /* Re-dock after portal re-renders wipe the host */
    setTimeout(applyDock, 50);
    setTimeout(applyDock, 300);
  };

  window.cchClientPepperUnmount = function () {
    closePanel();
    var fab = document.getElementById('cchCpPepperFab');
    var panel = document.getElementById('cchCpPepperPanel');
    if (fab) fab.style.display = 'none';
    if (panel) panel.classList.remove('open');
    ctx = { projectId: '', projectName: '', clientName: '', clientEmail: '' };
  };

  console.info('[CCH ClientPepper] build ' + BUILD + ' — header dock + chat log');
})();
