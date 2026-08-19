/* CCH Client Portal — Pepper message relay + WO-104 open-items greeting
 * Acknowledge-only. No AI answers. Relays to project messages + Team Chat.
 * WO-104: live exact counts from portal snapshot (never invent / never approximate).
 * Build 20260809cp104d — Elise + Talk + deflect + open-items; forced auto-open (inline display)
 */
(function () {
  'use strict';
  if (window._cchClientPepperLoaded) return;
  window._cchClientPepperLoaded = true;

  var BUILD = '20260809cp104d';
  var ACK = "Thank you. I'm still in training. Happy to pass this message on for you.";
  var DEFLECT = "I wish I could answer... hopefully soon! I'll let the team know :-)";
  var HELLO_FALLBACK = "Hi! I'm Pepper, design assistant in training. Type a note or tap Talk and speak. I'll pass it to Cindy or Vanessa.";
  var ELISE_VOICE_ID = 'EST9Ui6982FZPSi7gCHi';
  var COOLDOWN_MS = 20000;
  var AVATAR = 'assets/pepper-avatar-chip.png?v=20260812';
  var AVATAR_FULL = 'assets/pepper-avatar.png?v=20260812';
  var lastSendAt = 0;
  var ctx = {
    projectId: '',
    projectName: '',
    clientName: '',
    clientEmail: '',
    baseHash: '',
    openCounts: null,
    proposalNudges: [],
    whatsNew: null
  };
  var listening = false;
  var recognition = null;
  var baseTranscript = '';
  var voicedHelloForProject = '';
  var pepperAudioEl = null;
  var voiceMuted = false;
  /* Reset on hard refresh. Only X/close counts as dismiss — remounts must re-open. */
  var userDismissedThisLoad = false;
  var spokeGreetingThisLoad = false;
  try { voiceMuted = sessionStorage.getItem('cchCpPepperMute') === '1'; } catch (_eM) { /* */ }

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
  function nInt(v) {
    var n = parseInt(v, 10);
    return isFinite(n) && n > 0 ? n : 0;
  }
  function sessionKey(suffix) {
    return 'cchCpPepper_' + suffix + '_' + String(ctx.projectId || '');
  }
  function sessionGet(suffix) {
    try { return sessionStorage.getItem(sessionKey(suffix)) || ''; } catch (_e) { return ''; }
  }
  function sessionSet(suffix, val) {
    try { sessionStorage.setItem(sessionKey(suffix), String(val)); } catch (_e) { /* */ }
  }

  function injectStyles() {
    if (document.getElementById('cchCpPepperStyles')) return;
    var s = document.createElement('style');
    s.id = 'cchCpPepperStyles';
    s.textContent =
      '#cchCpPepperHost{display:flex;align-items:center;flex-shrink:0;margin-left:4px;position:relative;}' +
      '#cchCpPepperFab{width:52px;height:52px;padding:0;border:1px solid #C4A464;background:#0A1F3D;cursor:pointer;' +
      'flex-shrink:0;display:block;position:relative;}' +
      '#cchCpPepperFab.in-header{position:relative;right:auto;bottom:auto;z-index:auto;box-shadow:none;width:48px;height:48px;}' +
      '#cchCpPepperFab.float-fallback{position:fixed;right:20px;bottom:20px;z-index:9000;' +
      'box-shadow:0 6px 20px rgba(10,31,61,.2);width:56px;height:56px;}' +
      '#cchCpPepperFab img{width:100%;height:100%;object-fit:cover;display:block;}' +
      '#cchCpPepperFab:hover{border-color:#FFFFFF;}' +
      '#cchCpPepperWaitBadge{display:none;position:absolute;top:-4px;right:-4px;min-width:18px;height:18px;padding:0 5px;' +
      'background:#C4A464 !important;color:#0A1F3D !important;font-size:10px;font-weight:700;line-height:18px;text-align:center;' +
      'border:1px solid #0A1F3D;font-family:"DM Sans",sans-serif;}' +
      '#cchCpPepperWaitBadge.show{display:block;}' +
      '#cchCpPepperPanel{position:fixed;right:20px;top:72px;z-index:100050 !important;width:min(380px,calc(100vw - 32px));' +
      'max-height:calc(100vh - 96px);background:#FFFEFB;border:1px solid #0A1F3D;border-top:3px solid #C4A464;' +
      'display:none;flex-direction:column;box-shadow:0 10px 32px rgba(10,31,61,.18);font-family:"DM Sans",sans-serif;}' +
      '#cchCpPepperPanel.open{display:flex !important;}' +
      '#cchCpPepperHead{display:flex;align-items:center;gap:12px;padding:14px 16px;background:#0A1F3D;color:#fff;flex-shrink:0;}' +
      '#cchCpPepperHead img{width:72px;height:72px;object-fit:cover;border:1px solid #C4A464;flex-shrink:0;}' +
      '#cchCpPepperHead .t{font-family:"Playfair Display",serif;font-size:18px;}' +
      '#cchCpPepperHead .s{display:block;font-size:11px;color:#C4A464;margin-top:2px;font-family:"DM Sans",sans-serif;}' +
      '#cchCpPepperClose{margin-left:auto;background:none;border:none;color:#C4A464;font-size:20px;cursor:pointer;line-height:1;align-self:flex-start;}' +
      '#cchCpPepperGreeting{display:none;padding:12px 14px;border-bottom:1px solid #E2E2E2;background:#FAFAF8;flex-shrink:0;}' +
      '#cchCpPepperGreeting.show{display:block;}' +
      '#cchCpPepperGreeting .g-text{font-size:13px;line-height:1.45;color:#0A1F3D;margin:0 0 10px;}' +
      '#cchCpPepperGreeting .g-nudge{font-size:12px;line-height:1.4;color:#5C6B80;margin:0 0 8px;}' +
      '#cchCpPepperGreeting .g-chips{display:flex;flex-wrap:wrap;gap:6px;}' +
      '#cchCpPepperGreeting .g-chip{border:1px solid #0A1F3D;background:#fff;color:#0A1F3D;padding:6px 10px;font-size:11px;' +
      'font-weight:600;letter-spacing:.04em;text-transform:uppercase;cursor:pointer;font-family:inherit;}' +
      '#cchCpPepperGreeting .g-chip:hover{border-color:#C4A464;color:#C4A464;}' +
      '#cchCpPepperLog{flex:1 1 auto;min-height:100px;max-height:180px;overflow-y:auto;padding:12px 14px;' +
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
      '#cchCpPepperBody textarea.listening{border-color:#C4A464;box-shadow:0 0 0 2px rgba(196,164,100,.28);}' +
      '#cchCpPepperActions{display:flex;align-items:center;justify-content:flex-end;gap:10px;flex-wrap:wrap;}' +
      '#cchCpPepperMic{border:1px solid #0A1F3D;background:#fff;color:#0A1F3D;padding:12px 14px;cursor:pointer;' +
      'font-size:12px;letter-spacing:.06em;text-transform:uppercase;font-weight:600;font-family:inherit;display:inline-flex;' +
      'align-items:center;gap:8px;}' +
      '#cchCpPepperMic:hover{border-color:#C4A464;color:#C4A464;}' +
      '#cchCpPepperMic.listening{background:#0A1F3D;color:#C4A464;border-color:#C4A464;animation:cchCpMicPulse 1.2s ease-in-out infinite;}' +
      '#cchCpPepperMic .cch-cp-mic-dot{width:8px;height:8px;border-radius:50%;background:#C4A464;display:inline-block;}' +
      '#cchCpPepperMic.listening .cch-cp-mic-dot{background:#fff;}' +
      '@keyframes cchCpMicPulse{0%,100%{box-shadow:0 0 0 0 rgba(196,164,100,.45);}70%{box-shadow:0 0 0 8px rgba(196,164,100,0);}}' +
      '#cchCpPepperSend{border:none;background:#0A1F3D;color:#C4A464;padding:12px 18px;cursor:pointer;' +
      'font-size:12px;letter-spacing:.06em;text-transform:uppercase;font-weight:600;font-family:inherit;}' +
      '#cchCpPepperSend:disabled{opacity:.45;cursor:not-allowed;}' +
      '#cchCpPepperAck{display:none;font-size:12px;color:#5C6B80;line-height:1.45;font-style:italic;}' +
      '#cchCpPepperAck.show{display:block;}' +
      '#cchCpPepperListenHint{display:none;font-size:12px;color:#C4A464;font-weight:600;line-height:1.4;}' +
      '#cchCpPepperListenHint.show{display:block;}' +
      '#cchCpPepperMute{border:1px solid #E2E2E2;background:#fff;color:#6B7280;padding:8px 10px;cursor:pointer;' +
      'font-size:10px;letter-spacing:.05em;text-transform:uppercase;font-weight:600;font-family:inherit;margin-right:auto;}' +
      '#cchCpPepperMute:hover,#cchCpPepperMute.on{border-color:#C4A464;color:#0A1F3D;}' +
      '.cp-top-header{min-height:64px;}' +
      '@media (max-width:520px){' +
      '#cchCpPepperPanel{right:12px;left:12px;width:auto;top:72px;max-height:calc(100vh - 96px);}' +
      '#cchCpPepperFab.in-header{width:44px;height:44px;}' +
      '}';
    document.head.appendChild(s);
  }

  function speechCtor() {
    return window.SpeechRecognition || window.webkitSpeechRecognition || null;
  }
  function stopSpeaking() {
    try {
      if (pepperAudioEl) {
        pepperAudioEl.pause();
        pepperAudioEl.removeAttribute('src');
        try { pepperAudioEl.load(); } catch (_e0) { /* */ }
        pepperAudioEl = null;
      }
    } catch (_e1) { /* */ }
    try {
      if (window.speechSynthesis) window.speechSynthesis.cancel();
    } catch (_eC) { /* */ }
  }
  function speakPepperBrowserFallback(text) {
    if (!window.speechSynthesis || typeof window.SpeechSynthesisUtterance !== 'function') return;
    try {
      var u = new SpeechSynthesisUtterance(String(text || ''));
      u.lang = 'en-US';
      u.rate = 0.98;
      u.pitch = 1.08;
      window.speechSynthesis.speak(u);
    } catch (eSpeak) {
      console.warn('[CCH ClientPepper] browser speak fallback', eSpeak);
    }
  }
  async function speakPepperElise(text) {
    if (typeof firebase === 'undefined' || !firebase.app) throw new Error('Firebase not ready');
    if (!firebase.functions) throw new Error('Firebase Functions SDK not loaded');
    var fn = firebase.app().functions('us-central1').httpsCallable('cchPepperSpeak');
    var res = await fn({ text: text, voiceId: ELISE_VOICE_ID, clientPortal: true });
    var data = (res && res.data) || {};
    var b64 = String(data.audioBase64 || '');
    var mime = String(data.mimeType || 'audio/mpeg');
    if (!b64) throw new Error('No audio returned');
    var bin = atob(b64);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    var blob = new Blob([bytes], { type: mime });
    var url = URL.createObjectURL(blob);
    stopSpeaking();
    var audio = new Audio(url);
    pepperAudioEl = audio;
    audio.onended = function () {
      try { URL.revokeObjectURL(url); } catch (_eR) { /* */ }
      if (pepperAudioEl === audio) pepperAudioEl = null;
    };
    audio.onerror = function () {
      try { URL.revokeObjectURL(url); } catch (_eR2) { /* */ }
      if (pepperAudioEl === audio) pepperAudioEl = null;
    };
    await audio.play();
  }
  function speakPepper(text) {
    var line = String(text || '').trim();
    if (!line || voiceMuted) return;
    stopSpeaking();
    speakPepperElise(line).catch(function (e) {
      console.warn('[CCH ClientPepper] Elise speak', e);
      speakPepperBrowserFallback(line);
    });
  }
  function syncMuteBtn() {
    var btn = document.getElementById('cchCpPepperMute');
    if (!btn) return;
    btn.classList.toggle('on', voiceMuted);
    btn.textContent = voiceMuted ? 'Sound off' : 'Hear Pepper';
    btn.title = voiceMuted
      ? 'Pepper voice is muted — click to hear her'
      : 'Pepper will speak (click to mute)';
  }
  function toggleMute() {
    voiceMuted = !voiceMuted;
    try { sessionStorage.setItem('cchCpPepperMute', voiceMuted ? '1' : '0'); } catch (_eS) { /* */ }
    if (voiceMuted) stopSpeaking();
    syncMuteBtn();
    setAck(voiceMuted ? 'Okay. I\'ll stay quiet.' : 'I\'ll speak again when I have something to say.', { speak: !voiceMuted });
  }
  function setAck(msg, opts) {
    opts = opts || {};
    var ack = document.getElementById('cchCpPepperAck');
    if (!ack) return;
    ack.textContent = String(msg || '');
    ack.classList.toggle('show', !!msg);
    if (opts.speak && msg) speakPepper(msg);
  }

  /** Total waiting items — exact sum of live non-zero buckets only. */
  function waitingTotal() {
    var c = ctx.openCounts;
    if (!c || c.loadError) return 0;
    return nInt(c.decisions) + nInt(c.proposals) + nInt(c.invoices);
  }

  /**
   * Build spoken/written greeting from LIVE snapshot only.
   * Never invents counts. Zero buckets omitted. loadError → honest fail line.
   */
  /** First name for greeting: real client, or Cindy/Vanessa when staff is Previewing. */
  function greetFirstName() {
    try {
      var staffOk = typeof isCCHStudioStaffSession === 'function' && isCCHStudioStaffSession();
      if (staffOk) {
        var mn = typeof currentMemberName === 'function' ? String(currentMemberName() || '') : '';
        var staffFirst = mn.trim().split(/\s+/)[0];
        if (staffFirst) return staffFirst;
        /* client.html has no currentMemberName — map auth email via TEAM_CONFIG */
        var em = '';
        try { em = String(((firebase.auth().currentUser || {}).email) || '').toLowerCase(); } catch (_e2) { em = ''; }
        if (em && typeof TEAM_CONFIG !== 'undefined' && TEAM_CONFIG) {
          if (TEAM_CONFIG.owner && (TEAM_CONFIG.owner.names || []).some(function (n) { return n && em.indexOf(n) >= 0; })) {
            return String((TEAM_CONFIG.owner.label || 'Cindy').split(/\s+/)[0]);
          }
          var cs = TEAM_CONFIG.contractors || [];
          for (var ci = 0; ci < cs.length; ci++) {
            if ((cs[ci].names || []).some(function (n) { return n && em.indexOf(n) >= 0; })) {
              return String((cs[ci].label || 'Vanessa').split(/\s+/)[0]);
            }
          }
        }
        if (em.indexOf('vanessa') >= 0) return 'Vanessa';
        if (em.indexOf('cindy') >= 0 || em.indexOf('cynthia') >= 0) return 'Cindy';
      }
    } catch (_e) { /* */ }
    var raw = String(ctx.clientName || 'there').trim();
    if (/^studio\b/i.test(raw) || /^client$/i.test(raw)) return 'there';
    return raw.split(/\s+/)[0] || 'there';
  }

  function buildGreetingText() {
    var first = greetFirstName();
    var c = ctx.openCounts;
    if (!c) {
      return 'Hi ' + first + ', it\'s Pepper. I couldn\'t pull your open items just now. You can still send me a note below.';
    }
    if (c.loadError) {
      return 'Hi ' + first + ', it\'s Pepper. I couldn\'t pull your open items just now. Please check Home, or send me a note.';
    }
    var parts = [];
    var d = nInt(c.decisions);
    var p = nInt(c.proposals);
    var inv = nInt(c.invoices);
    if (d) parts.push(d === 1 ? '1 decision to make' : (d + ' decisions to make'));
    if (p) parts.push(p === 1 ? '1 proposal to review' : (p + ' proposals to review'));
    if (inv) parts.push(inv === 1 ? '1 invoice open' : (inv + ' invoices open'));

    var text;
    if (!parts.length) {
      text = 'Hi ' + first + ', it\'s Pepper. You\'re all caught up. Nothing needs you right now.';
    } else if (parts.length === 1) {
      text = 'Hi ' + first + ', it\'s Pepper. You have ' + parts[0] + '. Tap below and I\'ll take you right to it.';
    } else if (parts.length === 2) {
      text = 'Hi ' + first + ', it\'s Pepper. You have ' + parts[0] + ', and ' + parts[1] + '. Tap below and I\'ll take you right to it.';
    } else {
      text = 'Hi ' + first + ', it\'s Pepper. You have ' + parts[0] + ', ' + parts[1] + ', and ' + parts[2] + '. Tap below and I\'ll take you right to it.';
    }

    var nudges = Array.isArray(ctx.proposalNudges) ? ctx.proposalNudges : [];
    if (nudges.length) {
      var n0 = nudges[0];
      var label = String(n0.num || 'Proposal').trim() || 'Proposal';
      if (n0.readyForFinal) {
        text += ' ' + label + ' is ready for final approval.';
      } else if (nInt(n0.pending) > 0) {
        text += ' ' + label + ' has ' + nInt(n0.pending) + ' line' + (nInt(n0.pending) === 1 ? '' : 's') +
          ' still pending your decision. You\'ve approved ' + nInt(n0.approved) +
          ', declined ' + nInt(n0.declined) + '.';
      }
    }

    var wn = ctx.whatsNew;
    if (wn && wn.text && sessionGet('wn_' + String(wn.id || '')) !== '1') {
      var bit = String(wn.speakText || wn.text || '').trim();
      if (bit) text += ' And, new this week: ' + bit;
    }
    return text;
  }

  function navigatePortal(slug) {
    var base = String(ctx.baseHash || ('#/clientview/' + ctx.projectId)).replace(/\/$/, '');
    var hash = slug ? (base + '/' + slug) : base;
    if (typeof window.navigate === 'function') window.navigate(hash);
    else window.location.hash = hash;
  }

  function updateWaitBadge() {
    var badge = document.getElementById('cchCpPepperWaitBadge');
    var fab = document.getElementById('cchCpPepperFab');
    if (!badge || !fab) return;
    var total = waitingTotal();
    if (total > 0) {
      badge.textContent = total > 99 ? '99+' : String(total);
      badge.classList.add('show');
      fab.title = 'Pepper · ' + total + ' waiting';
      fab.setAttribute('aria-label', 'Pepper, ' + total + ' items waiting');
    } else {
      badge.textContent = '';
      badge.classList.remove('show');
      fab.title = 'Pepper · Design assistant in training';
      fab.setAttribute('aria-label', 'Message Pepper, design assistant in training');
    }
  }

  function renderGreetingBlock() {
    var el = document.getElementById('cchCpPepperGreeting');
    if (!el) return;
    var text = buildGreetingText();
    var chips = '';
    var c = ctx.openCounts || {};
    if (nInt(c.decisions)) {
      chips += '<button type="button" class="g-chip" data-cp-pepper-nav="decisions">Decisions (' + nInt(c.decisions) + ')</button>';
    }
    if (nInt(c.proposals)) {
      chips += '<button type="button" class="g-chip" data-cp-pepper-nav="proposals">Proposals (' + nInt(c.proposals) + ')</button>';
    }
    if (nInt(c.invoices)) {
      chips += '<button type="button" class="g-chip" data-cp-pepper-nav="invoices">Invoices (' + nInt(c.invoices) + ')</button>';
    }
    var nudgesHtml = '';
    (ctx.proposalNudges || []).slice(0, 2).forEach(function (n) {
      var label = esc(String(n.num || 'Proposal'));
      if (n.readyForFinal) {
        nudgesHtml += '<p class="g-nudge">' + label + ' is ready for final approval.</p>';
      } else if (nInt(n.pending) > 0) {
        nudgesHtml += '<p class="g-nudge">' + label + ': ' + nInt(n.pending) + ' pending · ' +
          nInt(n.approved) + ' approved · ' + nInt(n.declined) + ' declined.</p>';
      }
    });
    el.innerHTML = '<p class="g-text">' + esc(text) + '</p>' + nudgesHtml +
      (chips ? '<div class="g-chips">' + chips + '</div>' : '');
    el.classList.add('show');
    el.querySelectorAll('[data-cp-pepper-nav]').forEach(function (btn) {
      btn.onclick = function () {
        navigatePortal(btn.getAttribute('data-cp-pepper-nav'));
        closePanel();
      };
    });
    var wn = ctx.whatsNew;
    if (wn && wn.id) sessionSet('wn_' + String(wn.id), '1');
  }

  function openPanelWithGreeting(opts) {
    opts = opts || {};
    ensureDom();
    var panel = document.getElementById('cchCpPepperPanel');
    if (!panel) {
      console.warn('[CCH ClientPepper] open failed — panel missing after ensureDom');
      return;
    }
    /* Inline display beats any portal CSS that might override .open */
    panel.classList.add('open');
    panel.style.display = 'flex';
    panel.style.zIndex = '100050';
    panel.style.visibility = 'visible';
    panel.style.opacity = '1';
    void refreshChatLog();
    syncMuteBtn();
    renderGreetingBlock();
    updateWaitBadge();
    console.info('[CCH ClientPepper] panel OPEN', BUILD, ctx.projectId, buildGreetingText().slice(0, 80));
    if (opts.speak && !spokeGreetingThisLoad) {
      spokeGreetingThisLoad = true;
      voicedHelloForProject = ctx.projectId;
      var line = buildGreetingText();
      setTimeout(function () { speakPepper(line); }, 320);
    }
  }

  /** Cindy: she must pop open with the greeting — never require a click (unless they hit X). */
  function maybeSessionGreeting() {
    if (!ctx.projectId) return;
    updateWaitBadge();
    if (userDismissedThisLoad) {
      renderGreetingBlock();
      return;
    }
    openPanelWithGreeting({ speak: !spokeGreetingThisLoad });
  }

  function setListenHint(on, text) {
    var hint = document.getElementById('cchCpPepperListenHint');
    if (!hint) return;
    if (text) hint.textContent = text;
    hint.classList.toggle('show', !!on);
  }
  function stopListening() {
    listening = false;
    var mic = document.getElementById('cchCpPepperMic');
    var ta = document.getElementById('cchCpPepperInput');
    if (recognition) {
      var rec = recognition;
      recognition = null;
      try { rec.abort(); } catch (e1) {
        try { rec.stop(); } catch (e2) { /* */ }
      }
    }
    if (mic) {
      mic.classList.remove('listening');
      mic.setAttribute('aria-pressed', 'false');
      mic.title = 'Talk to Pepper (I\'ll write it down — then hit Send)';
      mic.innerHTML = '<span class="cch-cp-mic-dot" aria-hidden="true"></span> Talk';
    }
    if (ta) {
      ta.classList.remove('listening');
      ta.value = String(ta.value || '').replace(/\s+$/, '');
    }
    setListenHint(false);
  }
  function startRecognitionSession() {
    var Ctor = speechCtor();
    var ta = document.getElementById('cchCpPepperInput');
    if (!Ctor || !listening || !ta) return;
    var rec = new Ctor();
    recognition = rec;
    rec.lang = 'en-US';
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.onresult = function (ev) {
      if (!listening || !ta) return;
      var interim = '';
      var finalBit = '';
      for (var i = ev.resultIndex; i < ev.results.length; i++) {
        var piece = ev.results[i][0] ? (ev.results[i][0].transcript || '') : '';
        if (ev.results[i].isFinal) finalBit += piece;
        else interim += piece;
      }
      if (finalBit) {
        baseTranscript = (baseTranscript + finalBit).replace(/\s+/g, ' ');
        if (baseTranscript && baseTranscript.charAt(baseTranscript.length - 1) !== ' ') baseTranscript += ' ';
      }
      ta.value = (baseTranscript + interim).replace(/\s+/g, ' ').replace(/^\s+/, '');
      try { ta.dispatchEvent(new Event('input', { bubbles: true })); } catch (eIn) { /* */ }
    };
    rec.onerror = function (ev) {
      var err = (ev && ev.error) || '';
      if (err === 'no-speech' || err === 'aborted' || err === 'audio-capture') return;
      if (err === 'not-allowed') {
        stopListening();
        setAck('Microphone is blocked for this site. Allow the mic in your browser, then try Talk again.');
        return;
      }
      if (err === 'network') {
        setAck('Voice needs a network connection (Chrome speech). Check your connection and try again.');
      }
    };
    rec.onend = function () {
      if (recognition === rec) recognition = null;
      if (!listening) return;
      setTimeout(function () {
        if (!listening) return;
        try { startRecognitionSession(); } catch (eR) { console.warn('[CCH ClientPepper] mic restart', eR); }
      }, 80);
    };
    try {
      rec.start();
    } catch (eStart) {
      setTimeout(function () {
        if (!listening) return;
        try { startRecognitionSession(); } catch (e2) {
          stopListening();
          setAck('Could not start the microphone. Chrome works best. Allow mic, then try Talk again.');
        }
      }, 200);
    }
  }
  function toggleListen() {
    var ta = document.getElementById('cchCpPepperInput');
    var mic = document.getElementById('cchCpPepperMic');
    if (!ta || !mic) return;
    var Ctor = speechCtor();
    if (!Ctor) {
      setAck('Voice works best in Chrome (or Safari on iPhone). You can still type below anytime.');
      return;
    }
    if (listening) {
      stopListening();
      setAck('Got it. Edit if you like, then hit Send and I\'ll pass it along.', { speak: true });
      return;
    }
    baseTranscript = String(ta.value || '').replace(/\s+$/, '');
    if (baseTranscript) baseTranscript += ' ';
    listening = true;
    mic.classList.add('listening');
    mic.setAttribute('aria-pressed', 'true');
    mic.title = 'Listening — tap to stop';
    mic.innerHTML = '<span class="cch-cp-mic-dot" aria-hidden="true"></span> Listening…';
    ta.classList.add('listening');
    setListenHint(true, 'I\'m listening... speak naturally, then tap Listening when you\'re done ;-)');
    setAck('');
    startRecognitionSession();
  }
  function wireVoiceControls() {
    var body = document.getElementById('cchCpPepperBody');
    if (!body) return;
    if (!document.getElementById('cchCpPepperListenHint')) {
      var hint = document.createElement('div');
      hint.id = 'cchCpPepperListenHint';
      var ta = document.getElementById('cchCpPepperInput');
      if (ta && ta.parentNode === body) body.insertBefore(hint, ta.nextSibling);
      else body.appendChild(hint);
    }
    var micBtn = document.getElementById('cchCpPepperMic');
    if (micBtn && !micBtn._cchWired) {
      micBtn._cchWired = true;
      micBtn.onclick = function () { toggleListen(); };
    }
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
    if (!document.getElementById('cchCpPepperWaitBadge')) {
      var badge = document.createElement('span');
      badge.id = 'cchCpPepperWaitBadge';
      badge.setAttribute('aria-hidden', 'true');
      fab.appendChild(badge);
    }
  }

  function ensureDom() {
    injectStyles();
    if (!document.getElementById('cchCpPepperFab')) {
      var fab = document.createElement('button');
      fab.type = 'button';
      fab.id = 'cchCpPepperFab';
      fab.title = 'Pepper · Design assistant in training';
      fab.setAttribute('aria-label', 'Message Pepper, design assistant in training');
      fab.innerHTML = '<img src="' + AVATAR + '" alt="Pepper"><span id="cchCpPepperWaitBadge" aria-hidden="true"></span>';
      fab.onclick = function () { togglePanel(); };
      document.body.appendChild(fab);
    }
    if (!document.getElementById('cchCpPepperPanel')) {
      var panel = document.createElement('div');
      panel.id = 'cchCpPepperPanel';
      panel.innerHTML =
        '<div id="cchCpPepperHead">' +
          '<img src="' + AVATAR_FULL + '" alt="">' +
          '<div><div class="t">Pepper</div><span class="s">Design assistant in training ;-)</span></div>' +
          '<button type="button" id="cchCpPepperClose" title="Close">&times;</button>' +
        '</div>' +
        '<div id="cchCpPepperGreeting"></div>' +
        '<div id="cchCpPepperLog"><div class="cch-cp-log-empty">Loading your notes…</div></div>' +
        '<div id="cchCpPepperBody">' +
          '<p>I\'m Pepper, CCH Design\'s studio assistant. Type a note, or tap <strong>Talk</strong> and speak. I\'ll write it down, then hit <strong>Send</strong> and I\'ll pass it to Cindy or Vanessa. I can\'t answer questions myself... yet ;-)</p>' +
          '<textarea id="cchCpPepperInput" placeholder="Type or tap Talk and speak…" maxlength="2000"></textarea>' +
          '<div id="cchCpPepperListenHint"></div>' +
          '<div id="cchCpPepperAck"></div>' +
          '<div id="cchCpPepperActions">' +
            '<button type="button" id="cchCpPepperMute" title="Pepper will speak (click to mute)">Hear Pepper</button>' +
            '<button type="button" id="cchCpPepperMic" title="Talk to Pepper (I\'ll write it down — then hit Send)" aria-pressed="false"><span class="cch-cp-mic-dot" aria-hidden="true"></span> Talk</button>' +
            '<button type="button" id="cchCpPepperSend">Send</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(panel);
      document.getElementById('cchCpPepperClose').onclick = function () { closePanel({ userDismiss: true }); };
      document.getElementById('cchCpPepperSend').onclick = function () { void sendMessage(); };
      var muteNew = document.getElementById('cchCpPepperMute');
      if (muteNew) muteNew.onclick = function () { toggleMute(); };
      var micNew = document.getElementById('cchCpPepperMic');
      if (micNew) {
        micNew._cchWired = true;
        micNew.onclick = function () { toggleListen(); };
      }
      syncMuteBtn();
    }
    wireVoiceControls();
    applyDock();
  }

  function togglePanel() {
    ensureDom();
    var panel = document.getElementById('cchCpPepperPanel');
    if (!panel) return;
    if (panel.classList.contains('open')) closePanel({ userDismiss: true });
    else {
      userDismissedThisLoad = false;
      openPanelWithGreeting({
        speak: !!ctx.projectId && !spokeGreetingThisLoad
      });
    }
  }
  function closePanel(opts) {
    opts = opts || {};
    stopListening();
    stopSpeaking();
    var panel = document.getElementById('cchCpPepperPanel');
    if (panel) {
      panel.classList.remove('open');
      panel.style.display = 'none';
    }
    if (opts.userDismiss) userDismissedThisLoad = true;
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
        log.innerHTML = '<div class="cch-cp-log-empty">No notes yet. Send one below and your design team sees it in Communications.</div>';
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

  function looksLikeWantsPepperAnswer(text) {
    var t = String(text || '').trim().toLowerCase();
    if (!t) return false;
    if (/\bpepper\b/.test(t)) return true;
    if (/\b(who are you|what are you|are you (a |an )?(bot|ai|real|human|assistant)|what can you (do|answer|say)|do you (know|understand|remember|think)|tell me a joke|chat with me|talk to me|let's chat|lets chat|your (opinion|thoughts)|what do you think|can you answer|answer me)\b/.test(t)) {
      return true;
    }
    if (/\b(hey|hi|hello)\b/.test(t) && t.length < 48 && (/\?$/.test(t) || /\b(there|you)\b/.test(t))) return true;
    if (/\b(can you|could you|will you)\b/.test(t) && /\b(answer|decide|tell me|explain|figure|guess|recommend for me)\b/.test(t)) return true;
    return false;
  }

  async function sendMessage() {
    var ta = document.getElementById('cchCpPepperInput');
    var btn = document.getElementById('cchCpPepperSend');
    if (!ta || !ctx.projectId) return;
    stopListening();
    var text = String(ta.value || '').trim();
    if (!text) return;
    if (/^(blob:|data:)/i.test(text)) {
      setAck('Please type a message without local file links.');
      return;
    }
    var now = Date.now();
    if (now - lastSendAt < COOLDOWN_MS) {
      setAck('One moment. You can send another note shortly.');
      return;
    }
    var database = cpDb();
    if (!database) {
      setAck('Unable to send right now. Please try again in a moment.');
      return;
    }
    var wantsChat = looksLikeWantsPepperAnswer(text);
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
            wantsChat ? 'pepper_deflect' : 'pepper_relay',
            'sent a message via Pepper: "' + text.slice(0, 120) + '"',
            ctx.projectId,
            ctx.projectName || ctx.projectId,
            { via: 'client_pepper', staffChat: staffOk, voice: false, deflect: wantsChat }
          );
        }
      } catch (_eAct) { /* */ }
      lastSendAt = now;
      ta.value = '';
      setAck(wantsChat ? DEFLECT : ACK, { speak: true });
      void refreshChatLog();
    } catch (e) {
      console.error('[CCH ClientPepper] send', e);
      setAck('Something went wrong sending your note. Please try again, or use Messages in the menu.');
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
    ctx.baseHash = String(opts.baseHash || ('#/clientview/' + ctx.projectId)).trim();
    /* WO-104 accuracy: counts come from portal snapshot — Pepper never invents them. */
    if (opts.openCounts && typeof opts.openCounts === 'object') {
      ctx.openCounts = {
        decisions: nInt(opts.openCounts.decisions),
        proposals: nInt(opts.openCounts.proposals),
        invoices: nInt(opts.openCounts.invoices),
        loadError: !!opts.openCounts.loadError
      };
    } else {
      ctx.openCounts = { decisions: 0, proposals: 0, invoices: 0, loadError: true };
    }
    ctx.proposalNudges = Array.isArray(opts.proposalNudges) ? opts.proposalNudges.slice(0, 3) : [];
    ctx.whatsNew = opts.whatsNew && typeof opts.whatsNew === 'object' ? opts.whatsNew : null;
    if (!ctx.projectId) {
      window.cchClientPepperUnmount();
      return;
    }
    ensureDom();
    wireVoiceControls();
    applyDock();
    updateWaitBadge();
    var fab = document.getElementById('cchCpPepperFab');
    if (fab) fab.style.display = '';
    /* Open immediately + retry after header dock — portal re-renders must not require a click. */
    maybeSessionGreeting();
    setTimeout(function () { applyDock(); maybeSessionGreeting(); }, 50);
    setTimeout(function () { applyDock(); maybeSessionGreeting(); }, 300);
    setTimeout(maybeSessionGreeting, 800);
  };

  window.cchClientPepperUnmount = function () {
    closePanel({ userDismiss: false });
    var fab = document.getElementById('cchCpPepperFab');
    var panel = document.getElementById('cchCpPepperPanel');
    if (fab) fab.style.display = 'none';
    if (panel) panel.classList.remove('open');
    ctx = {
      projectId: '', projectName: '', clientName: '', clientEmail: '',
      baseHash: '', openCounts: null, proposalNudges: [], whatsNew: null
    };
  };

  console.info('[CCH ClientPepper] build ' + BUILD + ' — WO-104 auto-open (no click)');
})();
