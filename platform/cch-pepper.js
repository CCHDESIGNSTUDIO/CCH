/**
 * Pepper — floating staff assistant panel.
 * Digests: decisions, Follow-Ups, activity, unbilled time, design boards, inspiration boards,
 * OM firm-wide (Fable D/B + Bugletrail).
 * Vendor follow-up: window.cchPepperVendorFollowUp (OM/PO primary; chat preset secondary).
 * Feature G (v1.2): tap-to-talk SpeechRecognition → input only; Speak toggle (default off) → speechSynthesis.
 */
(function () {
  'use strict';
  if (window._cchPepperLoaded) return;
  window._cchPepperLoaded = true;

  var STUDIO_TEAM_EMAILS = [
    'cindy@cchdesign.com', 'cynthia@cchdesign.com', 'cynthiacbh@gmail.com',
    'vanessa@cchdesign.com', 'vanessaholliday@cchdesign.com', 'vholliday@cchdesign.com',
  ];
  var ORDERS_EMAIL = 'orders@cchdesign.com';
  var FIRM = 'CCH Design Inc.';
  var PEPPER_DECISION_ACTIONS = { line_approved: 1, line_declined: 1, proposal_total_approved: 1 };

  var BUILD = '20260817reach1';

  /** Cap digest size — huge firm digests can trip callable/gateway failures. */
  function pepperCapDigest(text, maxChars) {
    var s = String(text || '');
    var max = maxChars || 48000;
    if (s.length <= max) return s;
    return s.slice(0, max) + '\n\n… [digest truncated for Pepper — open a project or OM tab for a tighter list]';
  }
  function isClientRoute() { return /#\/clientview\//i.test(window.location.hash || ''); }
  function currentEmail() {
    try { return ((firebase.auth().currentUser || {}).email || '').toLowerCase().trim(); }
    catch (e) { return ''; }
  }
  function isStaff() { return STUDIO_TEAM_EMAILS.indexOf(currentEmail()) !== -1; }
  function projIdFromHash() {
    var m = /#\/project\/([^\/\?]+)/.exec(window.location.hash || '');
    return m ? decodeURIComponent(m[1]) : '';
  }
  /** Firestore PO doc id from #/project/{id}/po/{poId} */
  function poIdFromHash() {
    var m = /#\/project\/[^\/\?]+\/po\/([^\/\?]+)/i.exec(window.location.hash || '');
    return m ? decodeURIComponent(m[1]) : '';
  }
  function poNumberFromDom() {
    var els = document.querySelectorAll('h1, h2, h3, .page-title, .cch-doc-view-title, [class*="doc-view"]');
    for (var i = 0; i < els.length; i++) {
      var t = String(els[i].textContent || '').replace(/\s+/g, ' ').trim();
      var m = /\b(PO[-\s]?\d+)\b/i.exec(t);
      if (m) return m[1].replace(/\s+/g, '').replace(/^po/i, 'PO');
    }
    var bodyBit = String((document.getElementById('app') || document.body).innerText || '').slice(0, 800);
    var m2 = /\bPURCHASE ORDER\s+(PO[-\s]?\d+)\b/i.exec(bodyBit) || /\b(PO[-\s]?\d+)\b/.exec(bodyBit);
    return m2 ? m2[1].replace(/\s+/g, '').replace(/^po/i, 'PO') : '';
  }
  function isOmRoute() {
    return /#\/ordermanagement(\/|$|\?)/i.test(window.location.hash || '');
  }
  function isFollowupsRoute() {
    return /#\/followups(\/|$|\?)/i.test(window.location.hash || '');
  }
  function isAllTasksRoute() {
    return /#\/alltasks(\/|$|\?)/i.test(window.location.hash || '');
  }
  function isTimeRoute() {
    var h = window.location.hash || '';
    if (/#\/(timereconciliation|timetracker|timeledger|time)(\/|$|\?)/i.test(h)) return true;
    try {
      if (typeof window.smartTimeTab === 'string' && window.smartTimeTab &&
          /reconciliation|ledger|activity/i.test(window.smartTimeTab) &&
          /#\/(time|timetracker|timereconciliation|timeledger)/i.test(h)) return true;
    } catch (e) { /* */ }
    return false;
  }
  function omTabFromHash() {
    var m = /#\/ordermanagement\/([^\/\?]+)/i.exec(window.location.hash || '');
    return m ? String(m[1] || '').toLowerCase() : 'open';
  }
  function pageTitleText() {
    var el = document.querySelector('.page-title') || document.querySelector('h1.page-title');
    return el ? String(el.textContent || '').replace(/\s+/g, ' ').trim() : '';
  }
  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }
  function pepperDb() {
    return (typeof window.db !== 'undefined' && window.db) || firebase.firestore();
  }
  function pepperIsClientDoc(d) {
    if (!d) return false;
    var src = d.meta && d.meta.source;
    if (src === 'client_portal') return true;
    var t = String(d.type || '').toLowerCase();
    return t === 'client_portal' || t === 'client_first_visit' || t === 'inspiration' || t === 'message';
  }
  function pepperFormatWhen(d) {
    var ts = d.timestamp || d.createdAt || d.date || '';
    if (ts && typeof ts.toDate === 'function') return ts.toDate().toISOString().slice(0, 10);
    var ms = Date.parse(ts);
    return isFinite(ms) ? new Date(ms).toISOString().slice(0, 10) : '';
  }
  /** Prefer ledger `date`, then created/timestamp — for unbilled age + year window. */
  function pepperTimeEntryMs(t) {
    if (!t) return NaN;
    var raw = t.date != null && t.date !== '' ? t.date : (t.timestamp || t.createdAt || '');
    if (raw && typeof raw.toDate === 'function') {
      try { return raw.toDate().getTime(); } catch (_e) { return NaN; }
    }
    if (typeof raw === 'number' && isFinite(raw)) return raw < 1e12 ? raw * 1000 : raw;
    var s = String(raw || '').trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
      var p = Date.parse(s.slice(0, 10) + 'T12:00:00');
      if (isFinite(p)) return p;
    }
    var ms = Date.parse(s);
    return isFinite(ms) ? ms : NaN;
  }
  /** Cindy Aug 10: plate/unbilled = this calendar year only (no 2021 ghosts). */
  function pepperUnbilledYearStartMs() {
    return new Date(new Date().getFullYear(), 0, 1).getTime();
  }
  function pepperUnbilledYearStartStr() {
    return String(new Date().getFullYear()) + '-01-01';
  }
  function pepperIsInUnbilledWindow(t) {
    var ms = pepperTimeEntryMs(t);
    if (!isFinite(ms)) return false;
    return ms >= pepperUnbilledYearStartMs();
  }
  function pepperIsBillableEntry(t) {
    if (typeof window._isBillableEntry === 'function') return window._isBillableEntry(t);
    if (t && t.billable === false) return false;
    return true;
  }

  /* ── WO-105: signed-in staff agenda (login = who; Firestore fields = whose plate) ── */
  function resolveSignedInStaff() {
    var em = currentEmail();
    var label = '';
    try {
      if (typeof window.currentMemberName === 'function') label = String(window.currentMemberName() || '').trim();
    } catch (_e) { /* */ }
    var lane = '';
    if (em.indexOf('vanessa') >= 0 || /vanessa/i.test(label)) lane = 'vanessa';
    else if (em.indexOf('cindy') >= 0 || em.indexOf('cynthia') >= 0 || /cindy|cynthia/i.test(label)) lane = 'cindy';
    if (!lane && label) {
      if (/holliday/i.test(label)) lane = 'vanessa';
      else if (/holloway/i.test(label)) lane = 'cindy';
    }
    if (!label) {
      if (lane === 'vanessa') label = 'Vanessa Holliday';
      else if (lane === 'cindy') label = 'Cindy Holloway';
      else label = em ? em.split('@')[0] : 'there';
    }
    var first = label.split(/\s+/)[0] || 'there';
    var tokens = [label, first];
    if (lane === 'vanessa') tokens = tokens.concat(['Vanessa Holliday', 'Vanessa', 'vanessa', 'vholliday']);
    if (lane === 'cindy') tokens = tokens.concat(['Cindy Holloway', 'Cindy', 'Cynthia', 'cindy', 'cynthia']);
    tokens = tokens.map(function (t) { return String(t || '').trim(); }).filter(Boolean);
    return { email: em, label: label, first: first, lane: lane || 'staff', tokens: tokens };
  }

  function attributionMatchesStaff(raw, person) {
    if (!person || !person.tokens || !person.tokens.length) return false;
    var s = String(raw || '').toLowerCase().trim();
    if (!s) return false;
    for (var i = 0; i < person.tokens.length; i++) {
      var tok = String(person.tokens[i] || '').toLowerCase();
      if (tok && s.indexOf(tok) >= 0) return true;
    }
    return false;
  }

  function timeEntryMatchesStaff(t, person) {
    if (!t || !person) return false;
    var blob = [t.member, t.userName, t.user, t.email, t.memberEmail, t.loggedBy].join(' ');
    return attributionMatchesStaff(blob, person);
  }

  function agendaDayKey() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function agendaAlreadySurfacedToday() {
    try { return localStorage.getItem('cchPepperAgendaDay') === agendaDayKey(); } catch (_e) { return false; }
  }

  function markAgendaSurfacedToday() {
    try { localStorage.setItem('cchPepperAgendaDay', agendaDayKey()); } catch (_e) { /* */ }
  }

  async function loadMyUnbilledSummary(person) {
    var out = {
      hours: 0, dollars: 0, entries: 0, oldest: '', loadError: false,
      windowFrom: pepperUnbilledYearStartStr(), year: new Date().getFullYear()
    };
    if (!person) { out.loadError = true; return out; }
    try {
      var database = pepperDb();
      var byId = {};
      async function ingest(q) {
        try {
          var snap = await q;
          (snap.docs || []).forEach(function (doc) {
            byId[doc.id] = Object.assign({ id: doc.id }, doc.data() || {});
          });
        } catch (_e) { /* index / permission */ }
      }
      var uniqNames = [];
      person.tokens.forEach(function (t) {
        if (t && uniqNames.indexOf(t) < 0 && t.length > 2) uniqNames.push(t);
      });
      var yearStart = pepperUnbilledYearStartStr();
      for (var i = 0; i < Math.min(uniqNames.length, 6); i++) {
        /* Prefer this-year query so limit(800) is not wasted on 2021 rows. */
        await ingest(database.collection('timeEntries').where('member', '==', uniqNames[i]).where('date', '>=', yearStart).limit(800).get());
        await ingest(database.collection('timeEntries').where('member', '==', uniqNames[i]).limit(400).get());
      }
      if (person.email) {
        await ingest(database.collection('timeEntries').where('email', '==', person.email).where('date', '>=', yearStart).limit(400).get());
        await ingest(database.collection('timeEntries').where('email', '==', person.email).limit(200).get());
      }
      var unbilled = Object.keys(byId).map(function (k) { return byId[k]; }).filter(function (t) {
        if (!timeEntryMatchesStaff(t, person)) return false;
        if (!pepperIsBillableEntry(t)) return false;
        if (t.invoiced === true || t.invoiceId) return false;
        if ((parseFloat(t.hours) || 0) <= 0) return false;
        return pepperIsInUnbilledWindow(t);
      });
      var oldestMs = Infinity;
      unbilled.forEach(function (t) {
        var h = parseFloat(t.hours) || 0;
        var rate = parseFloat(t.rate || t.hourlyRate || t.billableRate) || 0;
        out.hours += h;
        out.dollars += h * rate;
        out.entries += 1;
        var ms = pepperTimeEntryMs(t);
        var when = isFinite(ms) ? new Date(ms).toISOString().slice(0, 10) : pepperFormatWhen(t);
        if (isFinite(ms) && ms < oldestMs) {
          oldestMs = ms;
          out.oldest = when;
        }
      });
      out.hours = Math.round(out.hours * 10) / 10;
      out.dollars = Math.round(out.dollars);
    } catch (e) {
      console.warn('[cchPepper] my unbilled', e);
      out.loadError = true;
    }
    return out;
  }

  function countFromFinancialCaches(person) {
    var invs = window._cachedInvoices || [];
    var props = window._cachedProposals || [];
    var draftInv = 0;
    var openAr = 0;
    var openAr$ = 0;
    invs.forEach(function (inv) {
      var st = String(inv.status || '').trim();
      var stL = st.toLowerCase();
      if (stL === 'draft' || stL === 'unsent') draftInv++;
      else if (stL !== 'paid' && stL !== 'cancelled' && stL !== 'canceled' && stL !== 'void' && stL !== 'voided') {
        var total = parseFloat(inv.total) || 0;
        var paid = (inv.payments || []).reduce(function (s, p) { return s + (parseFloat(p.amount) || 0); }, 0);
        if (stL === 'paid') return;
        var bal = Math.max(0, total - paid);
        if (bal > 0 || stL === 'sent' || stL === 'unpaid' || stL === 'partial' || stL === 'overdue' || stL === 'due') {
          openAr++;
          openAr$ += bal || total;
        }
      }
    });
    var propsToSend = 0;
    props.forEach(function (p) {
      if (!p) return;
      if (String(p.importedFrom || '').toLowerCase() === 'houzz') return;
      var st = String(p.status || '').toLowerCase();
      if (st === 'invoiced' || st === 'declined' || st === 'cancelled') return;
      if (!p.published || st === 'draft') propsToSend++;
    });
    var poConfirm = 0;
    var pos = (window._omPosCache && window._omPosCache.pos) || window._cachedPOs || [];
    if (pos.length) {
      pos.forEach(function (po) {
        if (typeof window.cchOmIsHouzzPo === 'function' && window.cchOmIsHouzzPo(po)) return;
        if (typeof window.cchOmIsOpenPo === 'function' && !window.cchOmIsOpenPo(po)) return;
        if (typeof window.cchOmNeedsConfirmation === 'function' && window.cchOmNeedsConfirmation(po)) poConfirm++;
      });
    }
    return {
      invoicesLoaded: invs.length > 0,
      proposalsLoaded: props.length > 0,
      draftInvoices: draftInv,
      openArCount: openAr,
      openArDollars: Math.round(openAr$),
      proposalsToSend: propsToSend,
      poNeedsConfirm: poConfirm,
      posLoaded: pos.length > 0
    };
  }

  async function buildMyAgendaBrief(opts) {
    opts = opts || {};
    var person = resolveSignedInStaff();
    var allTeam = !!opts.allTeam;
    var unbilled = allTeam
      ? { hours: 0, dollars: 0, entries: 0, oldest: '', loadError: true }
      : await loadMyUnbilledSummary(person);
    var fin = countFromFinancialCaches(person);
    var summaryDoc = null;
    try {
      var snap = await pepperDb().collection('_cache').doc('financialSummary').get();
      if (snap.exists) summaryDoc = snap.data() || null;
    } catch (_eS) { /* */ }

    /* Spoken "you have…" = person plate only (fingerprints). Firm caches stay in digest context, not claimed as yours. */
    var parts = [];
    if (!allTeam) {
      if (unbilled.loadError) {
        parts.push('I couldn\'t pull your unbilled hours just now');
      } else if (unbilled.entries > 0) {
        var ub = unbilled.hours + ' unbilled hours this year';
        if (unbilled.dollars > 0) ub += ' (about $' + unbilled.dollars.toLocaleString() + ')';
        if (unbilled.oldest) ub += ', oldest ' + unbilled.oldest;
        parts.push(ub);
      }
      if (!fin.proposalsLoaded) {
        parts.push('proposals cache not loaded yet (open Financials once to refresh)');
      }
      if (fin.invoicesLoaded && fin.openArCount > 0) {
        parts.push(fin.openArCount === 1
          ? ('1 open invoice (~$' + fin.openArDollars.toLocaleString() + ' AR in cache)')
          : (fin.openArCount + ' open invoices (~$' + fin.openArDollars.toLocaleString() + ' AR in cache)'));
      }
      if (fin.proposalsLoaded && fin.proposalsToSend > 0) {
        parts.push(fin.proposalsToSend === 1 ? '1 proposal to send' : (fin.proposalsToSend + ' proposals to send'));
      }
      if (fin.posLoaded && fin.poNeedsConfirm > 0) {
        parts.push(fin.poNeedsConfirm === 1 ? '1 PO needs vendor confirmation' : (fin.poNeedsConfirm + ' POs need vendor confirmation'));
      }
    }

    var spoken;
    if (!parts.length) {
      spoken = 'Hi ' + person.first + ', it\'s Pepper. You\'re clear on the money loop I can see right now. Ask anytime: what\'s on my agenda.';
    } else if (parts.length === 1) {
      spoken = 'Hi ' + person.first + ', it\'s Pepper. You have ' + parts[0] + '.';
    } else if (parts.length === 2) {
      spoken = 'Hi ' + person.first + ', it\'s Pepper. You have ' + parts[0] + ', and ' + parts[1] + '.';
    } else {
      spoken = 'Hi ' + person.first + ', it\'s Pepper. You have ' + parts.slice(0, -1).join(', ') + ', and ' + parts[parts.length - 1] + '.';
    }
    spoken += ' Want to start with the top money item?';

    var digestLines = [
      'MY AGENDA — PERSON-SCOPED to signed-in staff: ' + person.label + ' (' + person.email + ') via currentMemberName / auth email + timeEntries.member fingerprints',
      'Lane: ' + person.lane,
      'RULE: Answer THIS person\'s plate. Do not describe everyone\'s work as theirs. All Team only if they asked.',
      'Unbilled (MY fingerprints only, ' + (unbilled.windowFrom || pepperUnbilledYearStartStr()) + ' forward — prior years excluded): ' + (unbilled.loadError ? 'load error' : (unbilled.entries + ' entries, ' + unbilled.hours + 'h, ~$' + unbilled.dollars + (unbilled.oldest ? ', oldest ' + unbilled.oldest : ''))),
      'Proposals to send (studio cache — firm list, NOT yet fingerprint-filtered; do not claim as "yours" until WO-106): ' + (fin.proposalsLoaded ? fin.proposalsToSend + ' draft/unpublished in cache' : 'cache empty — say proposals cache not loaded'),
      'Invoices draft/AR (studio cache — firm list, NOT yet fingerprint-filtered): ' + (fin.invoicesLoaded ? (fin.draftInvoices + ' draft, ' + fin.openArCount + ' open / ~$' + fin.openArDollars) : 'cache empty'),
      'POs needing confirmation (OM cache when warm): ' + (fin.posLoaded ? fin.poNeedsConfirm : 'cache empty — open Order Management once'),
      summaryDoc ? ('Firm financialSummary context (NOT personal plate): openInv ' + (summaryDoc.openInvoiceCount || 0) + ' · openPO ' + (summaryDoc.openPOCount || 0) + ' · proposals total ' + (summaryDoc.proposalCount || 0) + ' · updated ' + (summaryDoc.updatedAt || '?')) : 'Firm financialSummary: not loaded',
      '',
      'Spoken brief (person only):',
      spoken,
      '',
      'Accuracy: live where loaded; if a cache is empty Pepper says so — never invents. Draft-only.'
    ];
    return { person: person, spoken: spoken, digest: digestLines.join('\n'), parts: parts, unbilled: unbilled, fin: fin };
  }

  function looksLikeMyAgendaAsk(text) {
    var t = String(text || '').toLowerCase();
    if (!t) return false;
    /* Do NOT match bare "open items" / "what else" — those are project email drafts (Cindy Aug 17). */
    return /\b(what'?s on my (agenda|plate)|my agenda|my plate|what should i (tackle|do) first|what did i leave open|what needs me|what else is open|what'?s on my list)\b/.test(t);
  }

  function wantsFirmWideAsk(text) {
    var t = String(text || '').toLowerCase();
    return /\b(all team|firm[- ]?wide|everywhere|across (all )?projects|whole firm|all projects)\b/.test(t) ||
      looksLikeMyAgendaAsk(t);
  }

  async function pepperFetchProjectActivity(database, projId) {
    var items = [];
    var lastDoc = null;
    var page = 0;
    /* Staff Pepper: recent project activity (not client-portal-only). Cap after gather. */
    while (page < 4) {
      var snap;
      try {
        var q = database.collection('activity').where('projectId', '==', projId).orderBy('timestamp', 'desc').limit(100);
        if (lastDoc) q = q.startAfter(lastDoc);
        snap = await q.get();
      } catch (eOrder) {
        if (page > 0) break;
        snap = await database.collection('activity').where('projectId', '==', projId).limit(100).get();
      }
      if (!snap || snap.empty) break;
      snap.forEach(function (doc) {
        items.push({ id: doc.id, data: doc.data() || {} });
      });
      if (snap.size < 100 || items.length >= 80) break;
      lastDoc = snap.docs[snap.docs.length - 1];
      page++;
    }
    return items;
  }

  async function buildDecisionsDigest(projectId) {
    if (!projectId) return '';
    try {
      var snap = await pepperDb().collection('boards').doc(projectId).collection('clientDecisions').get();
      var open = [];
      snap.forEach(function (doc) {
        var d = doc.data() || {};
        var st = String(d.status || 'open').toLowerCase();
        if (st === 'open' || st === 'changes_requested') {
          open.push({
            title: d.title || d.name || 'Decision',
            status: st,
            when: pepperFormatWhen(d),
            room: d.room || d.area || ''
          });
        }
      });
      if (!open.length) return 'Open client decisions: none.';
      var lines = ['Open client decisions (' + open.length + '):'];
      open.slice(0, 30).forEach(function (o) {
        lines.push('- [' + (o.when || '?') + '] ' + o.title +
          (o.room ? ' · ' + o.room : '') + ' · ' + o.status);
      });
      return lines.join('\n');
    } catch (e) {
      console.warn('[cchPepper] decisions digest', e);
      return '';
    }
  }

  async function buildActivityDigest(projectId) {
    if (!projectId) return '';
    try {
      var fetchFn = typeof window.caFetchProjectActivity === 'function'
        ? window.caFetchProjectActivity
        : pepperFetchProjectActivity;
      var items = await fetchFn(pepperDb(), projectId);
      /* Prefer full staff feed when caFetch is still client-filtered. */
      try {
        var staffItems = await pepperFetchProjectActivity(pepperDb(), projectId);
        if (staffItems && staffItems.length > (items || []).length) items = staffItems;
      } catch (_eStaff) { /* keep first fetch */ }
      if (!items.length) return 'Recent project activity: (none found).';
      var lines = ['Recent project activity (newest first — staff + client):'];
      items.slice(0, 40).forEach(function (it) {
        var d = it.data || {};
        var detail = d.summary || d.title || d.docType || d.description || d.details || '';
        lines.push('- [' + pepperFormatWhen(d) + '] ' + (d.action || d.type || 'activity') + ': ' + detail);
      });
      if (items.length > 40) lines.push('- … +' + (items.length - 40) + ' more');
      return lines.join('\n');
    } catch (e) {
      console.warn('[cchPepper] activity digest', e);
      return '';
    }
  }

  async function buildProjectTasksDigest(projectId) {
    if (!projectId) return '';
    try {
      var snap = await pepperDb().collection('boards').doc(projectId).collection('tasks').get();
      var list = [];
      snap.forEach(function (doc) {
        list.push(Object.assign({ id: doc.id }, doc.data() || {}));
      });
      if (!list.length) return 'Project tasks: none on this project.';
      var active = list.filter(function (t) {
        return String(t.status || '') !== 'Done';
      });
      var done = list.length - active.length;
      var priOrder = { Urgent: 0, High: 1, Medium: 2, Low: 3 };
      active.sort(function (a, b) {
        var pa = priOrder[a.priority] != null ? priOrder[a.priority] : 2;
        var pb = priOrder[b.priority] != null ? priOrder[b.priority] : 2;
        if (pa !== pb) return pa - pb;
        return String(a.dueDate || '').localeCompare(String(b.dueDate || ''));
      });
      var lines = [
        'Project tasks (' + active.length + ' open · ' + done + ' done · ' + list.length + ' total):'
      ];
      if (!active.length) {
        lines.push('- (no open tasks)');
      } else {
        active.slice(0, 40).forEach(function (t) {
          var who = t.assignee || t.assignedTo || t.owner || '';
          lines.push('- [' + (t.priority || 'Medium') + '] ' + (t.title || t.name || 'task') +
            ' · ' + (t.status || '—') +
            (who ? ' · ' + who : '') +
            (t.dueDate ? ' · due ' + t.dueDate : ''));
        });
        if (active.length > 40) lines.push('- … +' + (active.length - 40) + ' more open');
      }
      lines.push('When asked what needs attention: Urgent/High + overdue first. Draft only; never claim you completed a task.');
      return lines.join('\n');
    } catch (e) {
      console.warn('[cchPepper] project tasks digest', e);
      return 'Project tasks: could not load.';
    }
  }

  async function buildFollowUpsDigest(projectId) {
    if (!projectId) return '';
    if (typeof window._cchFuPepperDigest === 'function') {
      try { return await window._cchFuPepperDigest(projectId); } catch (e) { /* fall through */ }
    }
    return '';
  }

  /** Design Boards inventory — presentation boards (not Inspiration / Room Boards). */
  async function buildDesignBoardsDigest(projectId) {
    if (!projectId) return '';
    try {
      var snap = await pepperDb().collection('boards').doc(projectId).collection('designBoards').get();
      if (!snap || snap.empty) return 'Design boards inventory: none on this project.';
      var rows = [];
      snap.forEach(function (doc) {
        var d = doc.data() || {};
        var title = String(d.title || d.name || 'Untitled').trim() || 'Untitled';
        var room = String(d.room || '').trim();
        var elN = Array.isArray(d.elements) ? d.elements.length : 0;
        var when = '';
        try {
          when = pepperFormatWhen({ timestamp: d.updatedAt || d.createdAt || d.updated || d.created });
        } catch (_eW) { when = ''; }
        rows.push({
          title: title,
          room: room,
          elN: elN,
          when: when,
          sort: String(d.updatedAt || d.createdAt || '')
        });
      });
      rows.sort(function (a, b) {
        return String(b.sort).localeCompare(String(a.sort));
      });
      var lines = ['Design boards inventory (' + rows.length + ') — presentation boards on Design Boards tab:'];
      rows.slice(0, 60).forEach(function (r) {
        lines.push('- ' + r.title +
          (r.room ? ' · room: ' + r.room : '') +
          ' · ' + r.elN + ' element' + (r.elN === 1 ? '' : 's') +
          (r.when ? ' · updated ' + r.when : ''));
      });
      if (rows.length > 60) lines.push('- … +' + (rows.length - 60) + ' more');
      lines.push('If staff says boards are missing from a digest or email draft, cross-check this list — do not invent boards not listed.');
      return lines.join('\n');
    } catch (e) {
      console.warn('[cchPepper] design boards digest', e);
      return 'Design boards inventory: could not load.';
    }
  }

  /** Inspiration / ideabooks inventory (mood boards — separate from Design Boards). */
  async function buildInspirationBoardsDigest(projectId) {
    if (!projectId) return '';
    try {
      var snap = await pepperDb().collection('boards').doc(projectId).collection('ideabooks').get();
      if (!snap || snap.empty) return 'Inspiration boards inventory: none on this project.';
      var rows = [];
      snap.forEach(function (doc) {
        var d = doc.data() || {};
        var title = String(d.name || d.title || 'Untitled').trim() || 'Untitled';
        var imgs = Array.isArray(d.images) ? d.images.length : 0;
        rows.push({ title: title, imgs: imgs });
      });
      rows.sort(function (a, b) {
        return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
      });
      var lines = ['Inspiration boards inventory (' + rows.length + ') — Inspiration tab (not Design Boards):'];
      rows.slice(0, 40).forEach(function (r) {
        lines.push('- ' + r.title + ' · ' + r.imgs + ' image' + (r.imgs === 1 ? '' : 's'));
      });
      if (rows.length > 40) lines.push('- … +' + (rows.length - 40) + ' more');
      return lines.join('\n');
    } catch (e) {
      console.warn('[cchPepper] inspiration boards digest', e);
      return '';
    }
  }

  async function buildUnbilledTimeDigest(projectId, opts) {
    opts = opts || {};
    if (!projectId) return '';
    try {
      var database = pepperDb();
      var byId = {};
      async function ingest(q) {
        try {
          var snap = await q;
          (snap.docs || []).forEach(function (doc) {
            byId[doc.id] = Object.assign({ id: doc.id }, doc.data() || {});
          });
        } catch (e) { /* index / missing */ }
      }
      var projName = '';
      try {
        var pSnap = await database.collection('boards').doc(projectId).get();
        if (pSnap.exists) projName = String((pSnap.data() || {}).name || '').trim();
      } catch (e0) { /* */ }
      await ingest(database.collection('timeEntries').where('projectId', '==', projectId).limit(1000).get());
      if (projName) await ingest(database.collection('timeEntries').where('project', '==', projName).limit(1000).get());
      await ingest(database.collection('timeEntries').where('project', '==', projectId).limit(500).get());

      var invoiced = Object.create(null);
      try {
        var invSnap = await database.collection('boards').doc(projectId).collection('invoices').get();
        invSnap.forEach(function (doc) {
          var inv = doc.data() || {};
          (inv.timeEntryIds || []).forEach(function (id) {
            if (id) invoiced[String(id)] = true;
          });
        });
      } catch (eInv) { /* */ }

      var person = (!opts.allTeam && opts.scopeToSignedIn !== false) ? resolveSignedInStaff() : null;
      var unbilled = Object.keys(byId).map(function (k) { return byId[k]; }).filter(function (t) {
        if (!pepperIsBillableEntry(t)) return false;
        if (invoiced[String(t.id)]) return false;
        if (t.invoiced === true || t.invoiceId) return false;
        if ((parseFloat(t.hours) || 0) <= 0) return false;
        if (!pepperIsInUnbilledWindow(t)) return false;
        /* WO-105: default to signed-in member; All Team only when opts.allTeam */
        if (person && person.lane !== 'staff' && !timeEntryMatchesStaff(t, person)) return false;
        return true;
      });

      if (!unbilled.length) {
        return person && person.lane !== 'staff'
          ? ('Unbilled time for ' + person.first + ' this year (' + pepperUnbilledYearStartStr() + '+): none on this project.')
          : 'Unbilled time this year (' + pepperUnbilledYearStartStr() + '+): none found (billable hours not already on an invoice).';
      }
      var byPerson = {};
      var totalH = 0;
      var total$ = 0;
      unbilled.forEach(function (t) {
        var who = String(t.member || t.userName || t.user || t.email || 'Unknown').trim();
        var h = parseFloat(t.hours) || 0;
        var rate = parseFloat(t.rate || t.hourlyRate || t.billableRate) || 0;
        totalH += h;
        total$ += h * rate;
        if (!byPerson[who]) byPerson[who] = { hours: 0, n: 0 };
        byPerson[who].hours += h;
        byPerson[who].n += 1;
      });
      var lines = [
        'Unbilled billable time THIS YEAR (' + pepperUnbilledYearStartStr() + '+; prior years excluded) — ' +
          unbilled.length + ' entries, ' + totalH.toFixed(1) + ' hrs' +
          (total$ > 0 ? ', ~$' + Math.round(total$) : '') + ':'
      ];
      Object.keys(byPerson).sort().forEach(function (who) {
        var p = byPerson[who];
        lines.push('- ' + who + ': ' + p.hours.toFixed(1) + ' hrs (' + p.n + ' entries)');
      });
      unbilled.slice(0, 20).forEach(function (t) {
        lines.push('  · [' + pepperFormatWhen(t) + '] ' +
          (t.member || t.userName || '') + ' ' + (parseFloat(t.hours) || 0) + 'h — ' +
          (t.notes || t.description || t.task || ''));
      });
      if (unbilled.length > 20) lines.push('  · … +' + (unbilled.length - 20) + ' more');
      return lines.join('\n');
    } catch (e) {
      console.warn('[cchPepper] unbilled digest', e);
      return 'Unbilled time: could not load.';
    }
  }

  function pepperMoneyFmt(n) {
    var x = Math.round(parseFloat(n) || 0);
    return '$' + x.toLocaleString();
  }

  function pepperDocPaidSum(doc) {
    return (doc.payments || []).reduce(function (s, p) {
      return s + (parseFloat(p.amount) || 0);
    }, 0);
  }

  function pepperDocTotal(doc) {
    var t = parseFloat(doc.total);
    if (!isNaN(t) && t > 0) return t;
    t = parseFloat(doc.grandTotal);
    if (!isNaN(t) && t > 0) return t;
    t = parseFloat(doc.amount);
    if (!isNaN(t) && t > 0) return t;
    return 0;
  }

  function pepperPoNotReceivedYet(po) {
    if (!po) return false;
    if (typeof window.cchOmIsOpenPo === 'function' && !window.cchOmIsOpenPo(po)) return false;
    if (typeof window.cchOmIsHouzzPo === 'function' && window.cchOmIsHouzzPo(po)) return false;
    var ship = '';
    try {
      if (typeof window.cchPoShippingStatus === 'function') {
        ship = String(window.cchPoShippingStatus(po, po.items || []) || '');
      }
    } catch (_e) { ship = ''; }
    if (!ship) ship = String(po.shippingStatus || po.status || '');
    var s = ship.toLowerCase();
    if (/received|installed|cancelled|canceled|closed|paid/.test(s) && !/partially\s*received|partial\b/.test(s)) {
      return false;
    }
    return true;
  }

  /**
   * Project money chase — proposals / invoices / POs (numbers + status + $, not every line).
   * Priority for Pepper: AR balance → drafts to send → order follow-up flags.
   */
  async function buildProjectMoneyDigest(projectId) {
    if (!projectId) return '';
    try {
      var board = pepperDb().collection('boards').doc(projectId);
      var propSnap = await board.collection('proposals').get();
      var invSnap = await board.collection('invoices').get();
      var poSnap = await board.collection('purchaseOrders').get();

      var props = [];
      propSnap.forEach(function (doc) {
        props.push(Object.assign({ id: doc.id }, doc.data() || {}));
      });
      var invs = [];
      invSnap.forEach(function (doc) {
        invs.push(Object.assign({ id: doc.id }, doc.data() || {}));
      });
      var pos = [];
      poSnap.forEach(function (doc) {
        pos.push(Object.assign({ id: doc.id }, doc.data() || {}));
      });

      var propChase = [];
      props.forEach(function (p) {
        if (String(p.importedFrom || '').toLowerCase() === 'houzz') return;
        var st = String(p.status || 'Draft').trim();
        var stL = st.toLowerCase();
        if (stL === 'invoiced' || stL === 'declined' || stL === 'cancelled' || stL === 'canceled') return;
        var num = p.number || p.num || p.id;
        var total = pepperDocTotal(p);
        var flag = '';
        if (!p.published || stL === 'draft') flag = 'needs send / publish';
        else if (stL === 'published' || stL === 'in review' || stL === 'in_review' || stL === 'sent') flag = 'waiting on client';
        else if (stL === 'approved' || stL.indexOf('partial') >= 0) flag = 'approved — convert / invoice next?';
        else flag = 'open';
        propChase.push({ num: num, st: st, total: total, flag: flag, published: !!p.published });
      });

      var draftInv = [];
      var openAr = [];
      invs.forEach(function (inv) {
        var st = String(inv.status || 'Draft').trim();
        var stL = st.toLowerCase();
        if (stL === 'void' || stL === 'voided' || stL === 'cancelled' || stL === 'canceled') return;
        var num = inv.number || inv.num || inv.id;
        var total = pepperDocTotal(inv);
        var paid = pepperDocPaidSum(inv);
        var bal = Math.max(0, total - paid);
        if (stL === 'paid' || bal <= 0.01) return;
        var row = {
          num: num,
          st: st,
          total: total,
          bal: bal,
          qb: !!(inv.qbDocId || inv.qbId)
        };
        if (stL === 'draft' || stL === 'unsent' || (stL === 'published' && !inv.sentAt)) draftInv.push(row);
        else openAr.push(row);
      });
      openAr.sort(function (a, b) { return b.bal - a.bal; });
      draftInv.sort(function (a, b) { return b.total - a.total; });

      var noConfirm = [];
      var noBill = [];
      var notRecv = [];
      var openPos = [];
      pos.forEach(function (po) {
        if (typeof window.cchOmIsHouzzPo === 'function' && window.cchOmIsHouzzPo(po)) return;
        var isOpen = typeof window.cchOmIsOpenPo === 'function' ? window.cchOmIsOpenPo(po) : true;
        if (!isOpen) return;
        openPos.push(po);
        var num = po.number || po.num || po.id;
        var vendor = po._displayVendor || po.vendor || '—';
        var total = pepperDocTotal(po);
        var row = { num: num, vendor: vendor, total: total, st: po.status || '—' };
        if (typeof window.cchOmNeedsConfirmation === 'function' && window.cchOmNeedsConfirmation(po)) {
          noConfirm.push(row);
        }
        if (typeof window.cchOmNeedsBill === 'function' && window.cchOmNeedsBill(po)) {
          noBill.push(row);
        }
        if (pepperPoNotReceivedYet(po)) {
          var ship = '';
          try {
            ship = typeof window.cchPoShippingStatusLabel === 'function'
              ? window.cchPoShippingStatusLabel(po, po.items || [])
              : (po.shippingStatus || po.status || '');
          } catch (_e2) { ship = po.shippingStatus || po.status || ''; }
          notRecv.push(Object.assign({}, row, { ship: ship || '—' }));
        }
      });

      var arSum = openAr.reduce(function (s, r) { return s + r.bal; }, 0);
      var lines = [
        'PROJECT MONEY + ORDER CHASE (proactive — money first, then vendor/order follow-up):',
        'Counts: ' + props.length + ' proposals · ' + invs.length + ' invoices · ' + pos.length + ' POs (' + openPos.length + ' open Studio)',
        'Open AR on this project: ' + openAr.length + ' invoice(s) · ~' + pepperMoneyFmt(arSum),
        'Draft/unsent invoices: ' + draftInv.length,
        'Proposals still in play: ' + propChase.length,
        'POs missing confirmation: ' + noConfirm.length + ' · missing bills: ' + noBill.length + ' · not fully received (Studio shipping): ' + notRecv.length,
        '',
        'When asked what needs attention: (1) open AR / draft invoices (2) proposals waiting send or client (3) unbilled time if present (4) PO confirmation / ETA / bills (5) not-received goods. Draft only — never claim you emailed, invoiced, or pushed QB.'
      ];

      function pushRows(title, rows, limit, fmt) {
        lines.push('');
        lines.push(title + ' (' + rows.length + '):');
        if (!rows.length) {
          lines.push('- (none)');
          return;
        }
        rows.slice(0, limit || 25).forEach(function (r) { lines.push(fmt(r)); });
        if (rows.length > (limit || 25)) lines.push('- … +' + (rows.length - (limit || 25)) + ' more');
      }

      pushRows('Open AR — invoices with balance (chase money)', openAr, 30, function (r) {
        return '- ' + r.num + ' · ' + r.st + ' · balance ' + pepperMoneyFmt(r.bal) +
          ' of ' + pepperMoneyFmt(r.total) + (r.qb ? ' · QB synced' : ' · not on QB yet');
      });
      pushRows('Draft / unsent invoices', draftInv, 20, function (r) {
        return '- ' + r.num + ' · ' + r.st + ' · ' + pepperMoneyFmt(r.total);
      });
      pushRows('Proposals still open (not invoiced/declined)', propChase, 25, function (r) {
        return '- ' + r.num + ' · ' + r.st +
          (r.published ? ' · published' : ' · unpublished') +
          ' · ' + pepperMoneyFmt(r.total) + ' · ' + r.flag;
      });
      pushRows('POs — missing vendor confirmation', noConfirm, 25, function (r) {
        return '- ' + r.num + ' · ' + r.vendor + ' · ' + r.st + ' · ' + pepperMoneyFmt(r.total);
      });
      pushRows('POs — missing vendor bills', noBill, 20, function (r) {
        return '- ' + r.num + ' · ' + r.vendor + ' · ' + r.st + ' · ' + pepperMoneyFmt(r.total);
      });
      pushRows('POs — not fully received yet (Studio shippingStatus — Airtable check-ins not live here)', notRecv, 25, function (r) {
        return '- ' + r.num + ' · ' + r.vendor + ' · ship: ' + r.ship + ' · ' + pepperMoneyFmt(r.total);
      });

      if (typeof window.cchOmNeedsConfirmation !== 'function') {
        lines.push('');
        lines.push('Note: OM helpers not loaded this session — confirmation/bill flags may be incomplete. Open Order Management once to warm helpers, or trust shipping/status fields above.');
      }
      return lines.join('\n');
    } catch (e) {
      console.warn('[cchPepper] project money digest', e);
      return 'PROJECT MONEY + ORDER CHASE: could not load.';
    }
  }

  async function buildPoNudgeDigest(projectId, poId) {
    if (!projectId || !poId) return '';
    try {
      var snap = await pepperDb().collection('boards').doc(projectId).collection('purchaseOrders').doc(poId).get();
      if (!snap.exists) return '';
      var po = Object.assign({ id: snap.id }, snap.data() || {});
      var num = po.number || po.num || po.id;
      var needsConf = typeof window.cchOmNeedsConfirmation === 'function' && window.cchOmNeedsConfirmation(po);
      var needsBill = typeof window.cchOmNeedsBill === 'function' && window.cchOmNeedsBill(po);
      var missEta = typeof window.cchOmMissingEtaLineCount === 'function' ? window.cchOmMissingEtaLineCount(po) : 0;
      var lines = [
        'OPEN PO PAGE — staff is viewing this purchase order right now. Do not ask which PO.',
        'PO for vendor follow-up / status:',
        '- PO #: ' + num,
        '- Firestore id: ' + poId,
        '- Vendor: ' + (po.vendor || po._displayVendor || '—'),
        '- Status: ' + (po.status || '—'),
        '- Needs confirmation: ' + (needsConf ? 'yes' : 'no'),
        '- Needs vendor bill: ' + (needsBill ? 'yes' : 'no'),
        '- Not fully received (Studio): ' + (pepperPoNotReceivedYet(po) ? 'yes' : 'no'),
        '- Lines missing ETA: ' + missEta
      ];
      (po.items || []).slice(0, 20).forEach(function (it, i) {
        lines.push('  · L' + (i + 1) + ' ' + (it.title || it.name || 'item') +
          (it.qty != null ? ' qty ' + it.qty : '') +
          (it.eta || it.deliveryDate ? ' ETA ' + (it.eta || it.deliveryDate) : ' (no ETA)'));
      });
      if (!(po.items || []).length) lines.push('  · (no line items on this PO doc)');
      return lines.join('\n');
    } catch (e) {
      return '';
    }
  }

  function buildOmDigest(opts) {
    opts = opts || {};
    var cache = window._omPosCache;
    var pos = (cache && Array.isArray(cache.pos)) ? cache.pos : [];
    if (!pos.length) {
      return 'Order Management: PO cache not loaded yet. Stay on Order Management until the table finishes loading, then ask again.';
    }
    var open = pos.filter(function (p) {
      return typeof window.cchOmIsOpenPo === 'function' ? window.cchOmIsOpenPo(p) : true;
    }).filter(function (p) {
      return typeof window.cchOmIsHouzzPo === 'function' ? !window.cchOmIsHouzzPo(p) : true;
    });
    var noConfirm = open.filter(function (p) {
      return typeof window.cchOmNeedsConfirmation === 'function' && window.cchOmNeedsConfirmation(p);
    });
    var noBill = open.filter(function (p) {
      return typeof window.cchOmNeedsBill === 'function' && window.cchOmNeedsBill(p);
    });
    var missEtaLines = 0;
    var missEtaPos = [];
    open.forEach(function (p) {
      var n = typeof window.cchOmMissingEtaLineCount === 'function' ? window.cchOmMissingEtaLineCount(p) : 0;
      if (n > 0) {
        missEtaLines += n;
        missEtaPos.push(p);
      }
    });
    var tab = omTabFromHash();
    var lines = [
      'Firm-wide Order Management digest (not a single project).',
      'Active OM tab: ' + tab,
      'Open Studio POs: ' + open.length,
      'Missing confirmation: ' + noConfirm.length,
      'POs with lines missing ETA: ' + missEtaPos.length + ' (' + missEtaLines + ' lines)',
      'Missing bills: ' + noBill.length,
      '',
      'When asked which vendors need a follow-up email, prioritize Missing confirmation and Missing ETA. List PO #, vendor, project. Do not invent rows not listed. For a single email draft, pick ONE PO unless the user names one.'
    ];
    function pushList(title, rows, limit) {
      lines.push('');
      lines.push(title + ' (' + rows.length + '):');
      if (!rows.length) {
        lines.push('- (none)');
        return;
      }
      rows.slice(0, limit || 30).forEach(function (po) {
        var num = po.number || po.num || po.id;
        var vendor = po._displayVendor || po.vendor || '—';
        var proj = po.projectName || po.projectId || '—';
        var miss = typeof window.cchOmMissingEtaLineCount === 'function' ? window.cchOmMissingEtaLineCount(po) : 0;
        var flags = [];
        if (typeof window.cchOmNeedsConfirmation === 'function' && window.cchOmNeedsConfirmation(po)) flags.push('needs confirmation');
        if (miss > 0) flags.push(miss + ' lines w/o ETA');
        if (typeof window.cchOmNeedsBill === 'function' && window.cchOmNeedsBill(po)) flags.push('needs bill');
        lines.push('- ' + num + ' · ' + vendor + ' · ' + proj +
          (po.status ? ' · ' + po.status : '') +
          (flags.length ? ' · ' + flags.join(', ') : ''));
      });
      if (rows.length > (limit || 30)) lines.push('- … +' + (rows.length - (limit || 30)) + ' more');
    }
    if (tab === 'noconfirm') pushList('Missing confirmation (current tab)', noConfirm, 40);
    else if (tab === 'noeta') pushList('POs with missing ETA (current tab)', missEtaPos, 40);
    else if (tab === 'nobill') pushList('Missing bills (current tab)', noBill, 40);
    else {
      pushList('Missing confirmation', noConfirm, 25);
      pushList('POs with missing ETA', missEtaPos, 25);
      if (opts.includeBills !== false) pushList('Missing bills', noBill, 20);
    }
    return lines.join('\n');
  }

  async function buildFullDigest(projectId, opts) {
    opts = opts || {};
    var parts = [];
    if (opts.poId) {
      var poBit = await buildPoNudgeDigest(projectId, opts.poId);
      if (poBit) parts.push(poBit);
    }
    if (projectId) {
      var money = await buildProjectMoneyDigest(projectId);
      var a = await buildDecisionsDigest(projectId);
      var b = await buildFollowUpsDigest(projectId);
      var c = await buildActivityDigest(projectId);
      var d = await buildUnbilledTimeDigest(projectId);
      var e = await buildDesignBoardsDigest(projectId);
      var f = await buildInspirationBoardsDigest(projectId);
      var g = await buildProjectTasksDigest(projectId);
      if (money) parts.push(money);
      if (a) parts.push(a);
      if (g) parts.push(g);
      if (b) parts.push(b);
      if (c) parts.push(c);
      if (d && (opts.includeUnbilled !== false)) parts.push(d);
      if (e) parts.push(e);
      if (f) parts.push(f);
    }
    return parts.filter(Boolean).join('\n\n');
  }

  function buildSmartTimeDigest() {
    var lines = [
      'Smart Time page digest (Pepper does not see screen pixels — this text is scraped from the open page):',
      'Page title: ' + (pageTitleText() || 'Smart Time')
    ];
    try {
      if (typeof window.smartTimeTab === 'string' && window.smartTimeTab) {
        lines.push('Active tab: ' + window.smartTimeTab);
      }
    } catch (e0) { /* */ }
    var chips = [];
    try {
      document.querySelectorAll('div').forEach(function (el) {
        if (el.children && el.children.length > 2) return;
        var t = String(el.textContent || '').replace(/\s+/g, ' ').trim();
        if (t.length < 12 || t.length > 90) return;
        if (/no time logged|only [\d.]+h logged/i.test(t)) chips.push(t.replace(/^⚠️\s*|^⏱\s*/, ''));
      });
    } catch (e1) { /* */ }
    // Dedupe
    var seen = Object.create(null);
    chips = chips.filter(function (c) {
      if (seen[c]) return false;
      seen[c] = 1;
      return true;
    });
    if (chips.length) {
      lines.push('');
      lines.push('Missing Time Alerts (' + chips.length + '):');
      chips.slice(0, 40).forEach(function (c) { lines.push('- ' + c); });
      if (chips.length > 40) lines.push('- … +' + (chips.length - 40) + ' more');
    } else {
      lines.push('');
      lines.push('No Missing Time Alert chips found on the page right now (empty alerts, or still loading).');
    }
    lines.push('');
    lines.push('Answer from this digest. Do not ask the user to paste a digest — digests are automatic.');
    return lines.join('\n');
  }

  function buildGenericPageDigest() {
    var title = pageTitleText() || 'Studio page';
    var h = window.location.hash || '';
    return [
      'Studio page context (supplemental — firm-wide digest should also be attached):',
      'Title: ' + title,
      'Route: ' + h,
      '',
      'Do not ask the user to open a project first. Prefer the FIRM-WIDE STAFF DIGEST.'
    ].join('\n');
  }

  /**
   * WO-105 Phase A: no project required, never "working blind."
   * Default = PERSON plate (signed-in). All Team = opt-in firm dump.
   */
  async function buildFirmWideStaffDigest(opts) {
    opts = opts || {};
    var allTeam = !!opts.allTeam;
    var person = resolveSignedInStaff();
    var parts = [
      allTeam
        ? 'ALL-TEAM DIGEST — staff asked for the whole firm. Still never invent numbers.'
        : 'MY PLATE DIGEST — no project selected is fine. Answer for ' + person.first + ' (' + person.label + ') only.',
      'Do NOT say you are working blind. Do NOT require opening a project first.',
      allTeam
        ? 'They asked All Team — firm context is allowed.'
        : 'Do NOT describe firm-wide tasks/follow-ups/OM as theirs. Person plate first. Say "ask for All Team" if they want everyone\'s.'
    ];
    try {
      var brief = await buildMyAgendaBrief({ allTeam: allTeam });
      if (brief && brief.digest) parts.push(brief.digest);
    } catch (e0) {
      console.warn('[cchPepper] firm agenda', e0);
      parts.push('MY AGENDA: could not load.');
    }
    /* Always include MY tasks (assignee fingerprint). Full active list only for All Team. */
    try {
      var tasks = await buildFirmTasksDigest({ forceMine: !allTeam });
      if (tasks) parts.push(tasks);
    } catch (e3) { /* */ }
    if (allTeam) {
      try {
        var snap = await pepperDb().collection('_cache').doc('financialSummary').get();
        if (snap.exists) {
          var s = snap.data() || {};
          parts.push([
            'FIRM FINANCIAL SUMMARY (_cache/financialSummary, updatedAt: ' + (s.updatedAt || '?') + '):',
            '- Open invoices: ' + (s.openInvoiceCount || 0) + (s.openInvoiceAmount != null ? (' · ~$' + Math.round(s.openInvoiceAmount).toLocaleString()) : ''),
            '- Open POs: ' + (s.openPOCount || 0) + (s.openPOAmount != null ? (' · ~$' + Math.round(s.openPOAmount).toLocaleString()) : ''),
            '- Proposals (total count only, not draft-vs-sent): ' + (s.proposalCount || 0),
            '- Billable value (firm): ~$' + Math.round(s.billableValue || 0).toLocaleString(),
            'If draft/sent proposal split is missing, say so — never invent a to-send count from total alone.'
          ].join('\n'));
        }
      } catch (e1) { /* */ }
      try {
        var fu = await buildFirmFollowUpsDigest();
        if (fu) parts.push(fu);
      } catch (e2) { /* */ }
      try {
        var om = buildOmDigest({ includeBills: true });
        if (om) parts.push(om);
      } catch (e4) { /* */ }
    } else {
      /* Person plate: include firm OM confirm + bills when cache warm (money/order chase). */
      try {
        var omV = buildOmDigest({ includeBills: true });
        if (omV && omV.indexOf('not loaded') < 0) {
          parts.push('OM ORDER CHASE (firm cache — confirmation / ETA / bills; proactive follow-up):\n' + omV);
        }
      } catch (eOm) { /* */ }
    }
    return parts.filter(Boolean).join('\n\n');
  }

  async function buildFirmFollowUpsDigest() {
    if (typeof window._cchFuPepperDigest === 'function') {
      try {
        var t = await window._cchFuPepperDigest('');
        if (t) return t;
      } catch (e) {
        console.warn('[cchPepper] firm follow-ups digest', e);
      }
    }
    return 'FIRM-WIDE FOLLOW-UPS — digest unavailable (Follow-Ups module not loaded). Stay on Follow-Ups and hard refresh, then ask again.';
  }

  async function buildFirmTasksDigest(opts) {
    opts = opts || {};
    var forceMine = !!opts.forceMine;
    var person = resolveSignedInStaff();
    var lines = [
      forceMine
        ? ('MY TASKS — assignee matched to ' + person.first + '. Do not list other people\'s tasks as theirs.')
        : 'FIRM-WIDE TASKS — big picture. Do not ask them to open a project first.'
    ];
    var cached = window._cchPepperAllTasksCache;
    var list = (cached && Array.isArray(cached.tasks)) ? cached.tasks.slice() : null;
    if (!list) {
      try {
        var database = pepperDb();
        var boards = [];
        if (typeof window.getCachedBoards === 'function') {
          var snap = await window.getCachedBoards();
          snap.forEach(function (d) {
            if (d.id === '_lib_designer') return;
            boards.push({ id: d.id, name: (d.data() || {}).name || d.id });
          });
        }
        list = [];
        await Promise.all(boards.map(async function (p) {
          try {
            var tSnap = await database.collection('boards').doc(p.id).collection('tasks').get();
            tSnap.forEach(function (doc) {
              list.push(Object.assign({ id: doc.id, projectId: p.id, projectName: p.name }, doc.data() || {}));
            });
          } catch (e0) { /* */ }
        }));
      } catch (e) {
        console.warn('[cchPepper] firm tasks digest', e);
        return 'TASKS — could not load tasks.';
      }
    }
    var filter = '';
    try { filter = String(window._allTaskFilter || (cached && cached.filter) || 'active'); } catch (eF) { filter = 'active'; }
    if (forceMine) filter = 'mine';
    var active = list.filter(function (t) { return String(t.status || '') !== 'Done'; });
    var mine = [];
    try {
      var memberName = person.label || (typeof window.currentMemberName === 'function' ? String(window.currentMemberName() || '') : '');
      var first = person.first || memberName.split(/\s+/)[0] || '';
      if (first) {
        mine = active.filter(function (t) {
          return attributionMatchesStaff(String(t.assignee || t.assignedTo || t.owner || ''), person) ||
            String(t.assignee || '').toLowerCase().indexOf(first.toLowerCase()) >= 0;
        });
      }
    } catch (eM) { /* */ }
    var view = active;
    if (filter === 'mine') view = mine;
    else if (filter === 'done') view = list.filter(function (t) { return String(t.status || '') === 'Done'; });
    else if (filter === 'all') view = list;
    var priOrder = { Urgent: 0, High: 1, Medium: 2, Low: 3 };
    view.sort(function (a, b) {
      var pa = priOrder[a.priority] != null ? priOrder[a.priority] : 2;
      var pb = priOrder[b.priority] != null ? priOrder[b.priority] : 2;
      if (pa !== pb) return pa - pb;
      return String(a.dueDate || '').localeCompare(String(b.dueDate || ''));
    });
    lines.push('Filter: ' + filter);
    lines.push('Counts: ' + active.length + ' active · ' + mine.length + ' mine · ' + list.length + ' total loaded');
    lines.push('Top tasks:');
    if (!view.length) {
      lines.push('- (none in this filter)');
    } else {
      view.slice(0, 40).forEach(function (t) {
        lines.push('- [' + (t.priority || 'Medium') + '] ' + (t.projectName || t.projectId || 'project') +
          ' — ' + (t.title || t.name || 'task') +
          ' · ' + (t.status || '—') +
          (t.assignee ? ' · ' + t.assignee : '') +
          (t.dueDate ? ' · due ' + t.dueDate : ''));
      });
      if (view.length > 40) lines.push('- … +' + (view.length - 40) + ' more');
    }
    lines.push('');
    lines.push('When asked what matters most: Urgent/High + overdue + Waiting/In Progress. Name project + task. Draft only; never claim you completed a task.');
    return lines.join('\n');
  }

  async function buildActiveDigest(opts) {
    opts = opts || {};
    var ctx = currentContext();
    if (ctx.poId && !opts.poId) opts.poId = ctx.poId;
    /* Firm-wide on demand — even when a project is open, staff can ask for the whole plate */
    if (opts.forceFirmWide) return buildFirmWideStaffDigest(opts);
    if (ctx.projectId) {
      // On a PO page, always include that PO's lines; skip unbilled noise unless asked.
      if (ctx.poId && opts.includeUnbilled == null) opts.includeUnbilled = false;
      var projDigest = await buildFullDigest(ctx.projectId, opts);
      /* Append firm money snapshot so she is never only project-local for open-items asks */
      if (opts.includeFirmWide !== false) {
        try {
          var firmBit = await buildFirmWideStaffDigest(opts);
          return (projDigest || '') + '\n\n---\n\n' + firmBit;
        } catch (_eFirm) { return projDigest; }
      }
      return projDigest;
    }
    if (ctx.scope === 'followups') {
      return (await buildFirmFollowUpsDigest()) + '\n\n' + (await buildFirmWideStaffDigest(opts));
    }
    if (ctx.scope === 'tasks') {
      return (await buildFirmTasksDigest()) + '\n\n' + (await buildFirmWideStaffDigest(opts));
    }
    if (ctx.scope === 'om') {
      return buildOmDigest(opts) + '\n\n' + (await buildFirmWideStaffDigest(opts));
    }
    if (ctx.scope === 'time') {
      return buildSmartTimeDigest() + '\n\n' + (await buildFirmWideStaffDigest(opts));
    }
    return buildFirmWideStaffDigest(opts);
  }

  var PRESETS = [
    { key: 'my_agenda', label: "What's on my agenda" },
    { key: 'summarize_status', label: 'Summarize status' },
    { key: 'whats_next', label: "What needs attention today" },
    { key: 'unbilled_time', label: 'Unbilled time' },
    { key: 'draft_email', label: 'Draft client email' },
    { key: 'draft_followup', label: 'Draft a follow-up' },
    { key: 'vendor_status_followup', label: 'Vendor status follow-up' },
    { key: 'report_bug', label: 'Report a bug' },
  ];

  var PEPPER_DOCK_KEY = 'cchPepperDock'; /* 'header' | 'float' — legacy minimized/right mapped */
  /* WO-086 Part 2: final handoff face — chip for FAB, full for panel header */
  var PEPPER_AVATAR_SRC = 'assets/pepper-avatar.png?v=20260812';
  var PEPPER_AVATAR_CHIP_SRC = 'assets/pepper-avatar-chip.png?v=20260812';

  /* One-time: leave left-edge tuck; prefer header dock on projects. */
  try {
    if (!localStorage.getItem('cchStudioFabHeader20260728')) {
      localStorage.setItem(PEPPER_DOCK_KEY, 'header');
      localStorage.setItem('cchStudioFabHeader20260728', '1');
    }
  } catch (eTuckOnce) { /* */ }

  function pepperOnProjectPage() {
    try {
      var h = String(location.hash || '');
      return /^#\/project\//.test(h) && h.indexOf('/client') < 0;
    } catch (e) { return false; }
  }

  function pepperGetDock() {
    try {
      var v = localStorage.getItem(PEPPER_DOCK_KEY);
      if (v === 'float' || v === 'right') return 'float';
      if (v === 'minimized') return 'header'; /* migrate old left-edge tuck */
      return 'header';
    } catch (e) { return 'header'; }
  }
  function pepperSetDock(v) {
    try { localStorage.setItem(PEPPER_DOCK_KEY, v === 'float' ? 'float' : 'header'); } catch (e) { /* */ }
    applyPepperDock();
  }

  function pepperAvatarHtml(size, opts) {
    size = size || 28;
    opts = opts || {};
    var src = opts.chip ? PEPPER_AVATAR_CHIP_SRC : PEPPER_AVATAR_SRC;
    return '<img class="cch-pepper-ava-img" src="' + src + '" width="' + size + '" height="' + size +
      '" alt="" decoding="async" />';
  }

  /** Same topbar cluster as project Panel/Tabs — created on any Studio page so FABs stay put. */
  /** Keep Panel/Pepper/Chat on the right edge — never wrap above the 52px topbar clip. */
  function pepperLayoutTopbarCluster(cluster, actions) {
    if (!cluster || !actions) return;
    cluster.style.cssText = 'display:flex;align-items:center;gap:8px;flex-wrap:nowrap;justify-content:flex-end;min-width:0;flex:1 1 auto;';
    actions.style.minWidth = '0';
    actions.style.flex = '1 1 auto';
    actions.style.justifyContent = 'flex-end';
    actions.style.flexWrap = 'nowrap';
    actions.style.overflowX = 'auto';
    if (actions.parentNode !== cluster) cluster.appendChild(actions);
    else if (cluster.firstChild !== actions) cluster.insertBefore(actions, cluster.firstChild);
    var toggleHost = document.getElementById('cchNavPanelToggleHost');
    var assistHost = document.getElementById('cchStudioAssistHost');
    if (toggleHost) cluster.appendChild(toggleHost);
    if (assistHost) cluster.appendChild(assistHost);
  }

  function pepperEnsureTopbarCluster() {
    var actions = document.getElementById('topbarActions');
    var topbar = document.querySelector('.topbar');
    if (!actions || !topbar) return null;
    var cluster = document.getElementById('cchTopbarRightCluster');
    if (!cluster) {
      cluster = document.createElement('div');
      cluster.id = 'cchTopbarRightCluster';
      topbar.insertBefore(cluster, actions);
      cluster.appendChild(actions);
    } else if (actions.parentNode !== cluster) {
      cluster.appendChild(actions);
    }
    pepperLayoutTopbarCluster(cluster, actions);
    return cluster;
  }

  function pepperEnsureAssistHost() {
    var host = document.getElementById('cchStudioAssistHost');
    if (host && host.isConnected) {
      var clusterLive = document.getElementById('cchTopbarRightCluster');
      var actionsLive = document.getElementById('topbarActions');
      if (clusterLive && actionsLive) pepperLayoutTopbarCluster(clusterLive, actionsLive);
      return host;
    }
    var toggleHost = document.getElementById('cchNavPanelToggleHost');
    var cluster = document.getElementById('cchTopbarRightCluster') || pepperEnsureTopbarCluster();
    if (!toggleHost && !cluster) return null;
    host = document.createElement('div');
    host.id = 'cchStudioAssistHost';
    host.style.cssText = 'display:flex;align-items:center;gap:6px;flex-shrink:0;';
    if (toggleHost && toggleHost.parentNode) {
      toggleHost.parentNode.insertBefore(host, toggleHost.nextSibling);
    } else if (cluster) {
      cluster.appendChild(host);
    }
    var actions = document.getElementById('topbarActions');
    if (cluster && actions) pepperLayoutTopbarCluster(cluster, actions);
    return host;
  }

  function applyPepperDock() {
    var dock = pepperGetDock();
    /* Header dock on every Studio page (not project-only) — Cindy Aug 4 */
    var preferHeader = dock === 'header' && !isClientRoute();
    var btn = document.getElementById('cch-pepper-btn');
    var assist = preferHeader ? pepperEnsureAssistHost() : null;
    /* Only treat as header when host exists — otherwise in-header + position:static leaves a ghost */
    var inHeader = !!(preferHeader && assist);

    if (btn) {
      btn.classList.remove('minimized', 'dock-left');
      btn.classList.toggle('in-header', inHeader);
      btn.innerHTML = inHeader
        ? pepperAvatarHtml(36, { chip: true })
        : (pepperAvatarHtml(32, { chip: true }) + '<span class="cch-pepper-label">Pepper</span>');
      btn.title = inHeader
        ? 'Pepper — studio assistant'
        : 'Pepper — staff assistant';
      if (inHeader) {
        if (btn.parentNode !== assist) assist.appendChild(btn);
      } else {
        if (btn.parentNode !== document.body) document.body.appendChild(btn);
      }
    }

    if (panel) {
      panel.classList.remove('dock-left');
      panel.classList.toggle('from-header', inHeader);
    }

    if (typeof window.cchFbApplyDock === 'function') {
      try { window.cchFbApplyDock(inHeader ? 'header' : 'float', assist); } catch (eDock) { /* */ }
    }
  }
  window.cchPepperGetDock = pepperGetDock;
  window.cchPepperSetDock = pepperSetDock;
  window.cchPepperEnsureAssistHost = pepperEnsureAssistHost;
  window.cchStudioAssistMount = function () {
    if (pepperGetDock() !== 'header') pepperSetDock('header');
    else applyPepperDock();
  };
  window.cchStudioAssistUnmount = function () {
    /* Stay header-docked on all Studio pages — do not float when leaving a project. */
    applyPepperDock();
  };

  var css = ''
    + '#cch-pepper-btn{position:fixed;right:88px;bottom:24px;z-index:9998;'
    + 'background:#0A1F3D;color:#C8A97E;border:1px solid #C8A97E;border-radius:0;'
    + 'padding:6px 12px 6px 6px;font-family:"DM Sans",system-ui,sans-serif;font-size:13px;'
    + 'letter-spacing:.08em;text-transform:uppercase;cursor:pointer;box-shadow:0 2px 10px rgba(0,0,0,.25);'
    + 'display:inline-flex;align-items:center;gap:8px;line-height:1;}'
    + '#cch-pepper-btn:hover{background:#0f2a52;}'
    + '#cch-pepper-btn .cch-pepper-ava-img{width:28px;height:28px;object-fit:cover;border-radius:0;'
    + 'border:1px solid #C8A97E;display:block;flex-shrink:0;background:#0A1F3D;}'
    + '#cch-pepper-btn .cch-pepper-label{padding-right:4px;}'
    + '#cch-pepper-btn.in-header{position:static;right:auto;bottom:auto;box-shadow:none;padding:0;'
    + 'border:1px solid #C8A97E;background:#0A1F3D;min-width:38px;min-height:38px;}'
    + '#cch-pepper-btn.in-header .cch-pepper-ava-img{width:36px;height:36px;border:none;}'
    + '#cch-pepper-panel{position:fixed;right:88px;bottom:76px;z-index:9998;width:min(520px,calc(100vw - 32px));'
    + 'max-height:88vh;'
    + 'background:#FFFEFB;border:1px solid #0A1F3D;border-top:3px solid #C4A464;border-radius:0;'
    + 'box-shadow:0 8px 28px rgba(10,31,61,.22);'
    + 'display:none;flex-direction:column;font-family:"DM Sans",system-ui,sans-serif;}'
    + '#cch-pepper-panel.from-header{right:24px;bottom:auto;top:58px;}'
    + '#cch-pepper-panel.open{display:flex;}'
    + '#cch-pepper-head{background:#0A1F3D;color:#fff;padding:16px 16px;font-family:"Playfair Display",serif;'
    + 'font-size:20px;letter-spacing:.02em;display:flex;justify-content:space-between;align-items:center;gap:12px;}'
    + '#cch-pepper-head-brand{display:flex;align-items:center;gap:14px;min-width:0;flex:1;}'
    + '#cch-pepper-head-brand img{width:112px;height:112px;object-fit:cover;border:1px solid #C4A464;border-radius:0;flex-shrink:0;}'
    + '#cch-pepper-head-text{min-width:0;flex:1;}'
    + '#cch-pepper-head small{display:block;color:#C4A464;font-family:"DM Sans",sans-serif;font-size:12px;margin-top:3px;'
    + 'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:280px;}'
    + '#cch-pepper-head-actions{display:flex;align-items:center;gap:8px;flex-shrink:0;}'
    + '#cch-pepper-clear,#cch-pepper-speak{cursor:pointer;color:#C8A97E;font-size:10px;letter-spacing:.04em;text-transform:uppercase;'
    + 'background:none;border:1px solid rgba(200,169,126,.5);padding:4px 8px;font-family:"DM Sans",sans-serif;}'
    + '#cch-pepper-clear:hover,#cch-pepper-speak:hover{background:rgba(200,169,126,.15);}'
    + '#cch-pepper-speak.on{background:rgba(200,169,126,.25);border-color:#C8A97E;}'
    + '#cch-pepper-close{cursor:pointer;color:#C8A97E;font-size:16px;line-height:1;background:none;border:none;}'
    + '#cch-pepper-voicebar{display:none;padding:8px 12px;border-bottom:1px solid #E2E2E2;background:#FAFAF8;'
    + 'flex-direction:column;gap:6px;font-size:11px;color:#5C6B80;}'
    + '#cch-pepper-voicebar.show{display:flex;}'
    + '#cch-pepper-voicebar .cch-pepper-voice-row{display:flex;align-items:center;gap:8px;width:100%;}'
    + '#cch-pepper-voicebar label{flex-shrink:0;text-transform:uppercase;letter-spacing:.04em;font-size:10px;}'
    + '#cch-pepper-voice{flex:1;min-width:0;border:1px solid #E2E2E2;border-radius:0;padding:4px 6px;'
    + 'font-family:"DM Sans",sans-serif;font-size:11px;color:#0A1F3D;background:#fff;}'
    + '#cch-pepper-voice-hint{font-size:10px;line-height:1.35;color:#9CA3AF;}'
    + '#cch-pepper-presets{display:flex;flex-wrap:wrap;gap:8px;padding:14px;border-bottom:1px solid #E2E2E2;}'
    + '.cch-pepper-preset{border:1px solid #0A1F3D;color:#0A1F3D;background:#fff;font-size:11px;padding:8px 10px;'
    + 'cursor:pointer;border-radius:0;text-transform:uppercase;letter-spacing:.04em;}'
    + '.cch-pepper-preset:hover{background:#0A1F3D;color:#fff;}'
    + '#cch-pepper-log{flex:1;overflow-y:auto;padding:16px 16px 12px;font-size:14px;color:#0A1F3D;white-space:pre-wrap;'
    + 'min-height:140px;background:linear-gradient(180deg,#FFFEFB 0%,#F7F4EF 100%);}'
    + '#cch-pepper-log:empty::before{content:"Ask Pepper anything about this page — POs, time, follow-ups, or a bug.";'
    + 'display:block;color:#8A7A62;font-size:13px;line-height:1.45;font-style:italic;padding:8px 2px;}'
    + '.cch-pepper-msg{margin-bottom:10px;}'
    + '.cch-pepper-msg b{color:#C4A464;font-size:10px;text-transform:uppercase;display:block;margin-bottom:2px;}'
    + '.cch-pepper-read-bar{display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;}'
    + '.cch-pepper-read-btn{border:1px solid #0A1F3D;background:#fff;color:#0A1F3D;font-size:10px;'
    + 'text-transform:uppercase;letter-spacing:.06em;padding:6px 10px;cursor:pointer;border-radius:0;'
    + 'font-family:"DM Sans",sans-serif;}'
    + '.cch-pepper-read-btn:hover{background:#0A1F3D;color:#C8A97E;}'
    + '.cch-pepper-read-btn.skip{border-color:#C5C9D1;color:#5C6B80;}'
    + '.cch-pepper-read-btn.skip:hover{background:#F7F4EF;color:#0A1F3D;}'
    + '#cch-pepper-inputrow{display:flex;border-top:1px solid #E2E2E2;align-items:stretch;gap:0;}'
    + '#cch-pepper-input{flex:1;border:none;padding:12px 14px;font-family:"DM Sans",sans-serif;font-size:14px;'
    + 'min-width:0;min-height:128px;max-height:260px;resize:vertical;line-height:1.45;color:#0A1F3D;'
    + 'background:#fff;box-sizing:border-box;}'
    + '#cch-pepper-input:focus{outline:none;background:#FFFEFB;}'
    + '#cch-pepper-sideacts{display:flex;flex-direction:column;border-left:1px solid #E2E2E2;flex-shrink:0;min-width:88px;}'
    + '#cch-pepper-mic{border:none;border-bottom:1px solid #E2E2E2;background:#fff;color:#0A1F3D;padding:12px 16px;'
    + 'cursor:pointer;font-size:16px;line-height:1;flex:0 0 auto;}'
    + '#cch-pepper-mic:hover{background:#F7F4EF;}'
    + '#cch-pepper-mic.listening{background:#0A1F3D;color:#C8A97E;}'
    + '#cch-pepper-mic:disabled{opacity:.4;cursor:not-allowed;}'
    + '#cch-pepper-send{border:none;background:#0A1F3D;color:#C8A97E;padding:18px 20px;cursor:pointer;'
    + 'text-transform:uppercase;font-size:13px;font-weight:700;letter-spacing:.08em;flex:1;min-height:56px;}'
    + '#cch-pepper-send:hover{background:#0f2a52;}'

  function injectStyle() {
    var s = document.getElementById('cch-pepper-styles');
    if (!s) {
      s = document.createElement('style');
      s.id = 'cch-pepper-styles';
      document.head.appendChild(s);
    }
    s.textContent = css;
  }
  function appendMsg(log, who, text) {
    if (!log) return;
    var row = document.createElement('div');
    row.className = 'cch-pepper-msg';
    row.innerHTML = '<b>' + esc(who) + '</b>' + esc(text);
    log.appendChild(row);
    log.scrollTop = log.scrollHeight;
  }

  /** Live log node — never keep a stale ref across await (remount can detach the old panel). */
  function pepperLiveLog() {
    var p = panel || document.getElementById('cch-pepper-panel');
    return p ? p.querySelector('#cch-pepper-log') : null;
  }

  /* ── Feature G (Fable v1.2): browser SpeechRecognition + speechSynthesis ── */
  var pepperRecognition = null;
  var pepperListening = false;
  var pepperBaseTranscript = '';

  function pepperSpeechRecognitionCtor() {
    return window.SpeechRecognition || window.webkitSpeechRecognition || null;
  }
  /** Cindy's three ElevenLabs library voices (Speak via Cloud Function — key never in browser). */
  // Order: Elise default (Cindy favorite), then the other two she added (IDs from her links).
  var PEPPER_EL_VOICES = [
    { id: 'EST9Ui6982FZPSi7gCHi', label: 'Elise – Warm, Natural and Engaging' },
    { id: 'yj30vwTGJxSHezdAGsv9', label: 'Jessa – Easygoing and Effortless' },
    { id: '8DzKSPdgEQPaK5vKG0Rs', label: 'Vanessa – Beach Girl' }
  ];
  var PEPPER_EL_PREFIX = 'el:';
  var pepperAudioEl = null;

  function pepperCanBrowserSpeak() {
    return typeof window.speechSynthesis !== 'undefined' && typeof window.SpeechSynthesisUtterance !== 'undefined';
  }
  function pepperCanSpeak() {
    return (typeof Audio !== 'undefined') || pepperCanBrowserSpeak();
  }
  function pepperElVoiceKey(id) { return PEPPER_EL_PREFIX + id; }
  function pepperParseElVoiceId(key) {
    var k = String(key || '');
    if (k.indexOf(PEPPER_EL_PREFIX) !== 0) return '';
    return k.slice(PEPPER_EL_PREFIX.length);
  }
  function pepperIsElVoiceKey(key) { return !!pepperParseElVoiceId(key); }
  function pepperSpeakEnabled() {
    try { return sessionStorage.getItem('cchPepperSpeak') === '1'; } catch (e) { return false; }
  }
  function pepperSetSpeakEnabled(on) {
    try { sessionStorage.setItem('cchPepperSpeak', on ? '1' : '0'); } catch (e) { /* */ }
  }
  function pepperStopSpeaking() {
    try {
      if (pepperAudioEl) {
        pepperAudioEl.pause();
        pepperAudioEl.removeAttribute('src');
        try { pepperAudioEl.load(); } catch (e0) { /* */ }
        pepperAudioEl = null;
      }
    } catch (e1) { /* */ }
    try { if (pepperCanBrowserSpeak()) window.speechSynthesis.cancel(); } catch (e2) { /* */ }
  }
  /** Chrome often stays "paused" and drops speak() after async work unless resumed / unlocked on a click. */
  function pepperResumeSpeechEngine() {
    if (!pepperCanBrowserSpeak()) return;
    try { window.speechSynthesis.resume(); } catch (e) { /* */ }
  }
  function pepperUnlockSpeechOnGesture() {
    if (!pepperCanBrowserSpeak()) return;
    try {
      pepperResumeSpeechEngine();
      var warm = new window.SpeechSynthesisUtterance(' ');
      warm.volume = 0;
      warm.rate = 1;
      window.speechSynthesis.speak(warm);
      window.speechSynthesis.cancel();
    } catch (e) { /* */ }
  }
  // V3: ElevenLabs keys (el:…) + browser; clears older male-default locks.
  var PEPPER_VOICE_LS_KEY = 'cchPepperVoiceV3';
  function pepperSavedVoiceKey() {
    try { return localStorage.getItem(PEPPER_VOICE_LS_KEY) || ''; } catch (e) { return ''; }
  }
  function pepperSaveVoiceKey(key) {
    try {
      if (key) localStorage.setItem(PEPPER_VOICE_LS_KEY, key);
      else localStorage.removeItem(PEPPER_VOICE_LS_KEY);
      try { localStorage.removeItem('cchPepperVoice'); } catch (e2) { /* */ }
      try { localStorage.removeItem('cchPepperVoiceV2'); } catch (e3) { /* */ }
    } catch (e) { /* */ }
  }
  function pepperDefaultVoiceKey() {
    return pepperElVoiceKey(PEPPER_EL_VOICES[0].id);
  }
  function pepperVoiceKey(v) {
    if (!v) return '';
    return String(v.voiceURI || v.name || '');
  }
  function pepperIsFemaleVoice(v) {
    var name = String((v && v.name) || '').toLowerCase();
    // Explicit female names only — never guess gender from "unknown" system voices.
    return /(female|zira|samantha|karen|moira|fiona|aria|jenny|ava|susan|hazel|serena|tessa|veena|helen|linda|catherine|michelle|victoria|allison|emily|ashley|amy|emma|olivia|sophia|isabella|natasha|heera|lekha|google uk english female|microsoft zira|microsoft aria|microsoft jenny|microsoft ava)/.test(name);
  }
  function pepperIsMaleVoice(v) {
    var name = String((v && v.name) || '').toLowerCase();
    if (pepperIsFemaleVoice(v)) return false;
    return /(male|david|mark|james|george|daniel|fred|ravi|thomas|richard|microsoft david|microsoft mark|google us english$|google uk english male|^alex$|guy|ryan|brandon|matthew)/.test(name);
  }
  function pepperFemaleVoicesOnly(voices) {
    return (voices || []).filter(function (v) {
      return pepperIsFemaleVoice(v) && !pepperIsMaleVoice(v);
    });
  }
  function pepperScoreVoice(v) {
    var name = String(v.name || '').toLowerCase();
    var lang = String(v.lang || '').toLowerCase().replace('_', '-');
    var score = 0;
    if (lang.indexOf('en') === 0) score += 50;
    else score -= 40;
    if (lang === 'en-us') score += 12;
    if (lang === 'en-gb') score += 8;
    if (pepperIsFemaleVoice(v)) score += 80;
    if (pepperIsMaleVoice(v)) score -= 120;
    if (/(natural|neural|online|enhanced|premium|wavenet|studio|hd)/.test(name)) score += 40;
    if (/google/.test(name) && /female/.test(name)) score += 35;
    if (/microsoft/.test(name) && /zira|aria|jenny|ava/.test(name)) score += 40;
    if (/samantha|karen|moira|fiona|zira/.test(name)) score += 30;
    if (v.localService === false && pepperIsFemaleVoice(v)) score += 18;
    return score;
  }
  function pepperListVoices() {
    if (!pepperCanBrowserSpeak()) return [];
    try { return window.speechSynthesis.getVoices() || []; } catch (e) { return []; }
  }
  function pepperPickBestBrowserVoice(voices) {
    voices = voices || pepperListVoices();
    if (!voices.length) return null;
    var en = voices.filter(function (v) {
      return String(v.lang || '').toLowerCase().indexOf('en') === 0;
    });
    var pool = en.length ? en : voices;
    var candidates = pepperFemaleVoicesOnly(pool);
    if (!candidates.length) return null;
    candidates.sort(function (a, b) { return pepperScoreVoice(b) - pepperScoreVoice(a); });
    return candidates[0] || null;
  }
  function pepperResolveSelectedKey(sel) {
    if (sel && sel.value) return String(sel.value);
    var saved = pepperSavedVoiceKey();
    if (saved) return saved;
    return pepperDefaultVoiceKey();
  }
  function pepperPopulateVoiceSelect(sel) {
    if (!sel || !pepperCanSpeak()) return 0;
    sel.innerHTML = '';
    var ogEl = document.createElement('optgroup');
    ogEl.label = 'ElevenLabs (Pepper)';
    PEPPER_EL_VOICES.forEach(function (v) {
      var opt = document.createElement('option');
      opt.value = pepperElVoiceKey(v.id);
      opt.textContent = v.label;
      ogEl.appendChild(opt);
    });
    sel.appendChild(ogEl);

    var all = pepperListVoices().filter(function (v) {
      return String(v.lang || '').toLowerCase().indexOf('en') === 0;
    });
    if (!all.length) all = pepperListVoices();
    var browserVoices = pepperFemaleVoicesOnly(all);
    browserVoices.sort(function (a, b) { return pepperScoreVoice(b) - pepperScoreVoice(a); });
    if (browserVoices.length) {
      var ogBr = document.createElement('optgroup');
      ogBr.label = 'Free browser (robotic)';
      browserVoices.forEach(function (v) {
        var opt = document.createElement('option');
        opt.value = pepperVoiceKey(v);
        opt.textContent = (v.name || 'Voice') + (v.lang ? ' · ' + v.lang : '');
        ogBr.appendChild(opt);
      });
      sel.appendChild(ogBr);
    }

    var lock = pepperSavedVoiceKey() || pepperDefaultVoiceKey();
    if (pepperIsElVoiceKey(lock) || browserVoices.some(function (v) { return pepperVoiceKey(v) === lock; })) {
      sel.value = lock;
    } else {
      sel.value = pepperDefaultVoiceKey();
      pepperSaveVoiceKey(sel.value);
    }
    if (!sel.value) sel.value = pepperDefaultVoiceKey();
    return PEPPER_EL_VOICES.length + browserVoices.length;
  }
  function pepperEnsureVoicesReady(cb) {
    if (!pepperCanBrowserSpeak()) { if (cb) cb([]); return; }
    var voices = pepperListVoices();
    if (voices.length) { if (cb) cb(voices); return; }
    var done = false;
    function finish() {
      if (done) return;
      var list = pepperListVoices();
      if (!list.length) return;
      done = true;
      try { window.speechSynthesis.removeEventListener('voiceschanged', onChanged); } catch (e) { /* */ }
      if (cb) cb(list);
    }
    function onChanged() { finish(); }
    try { window.speechSynthesis.addEventListener('voiceschanged', onChanged); } catch (e2) {
      try { window.speechSynthesis.onvoiceschanged = onChanged; } catch (e3) { /* */ }
    }
    [200, 500, 1000, 2000, 4000].forEach(function (ms) {
      setTimeout(function () {
        if (!done) finish();
        if (!done && ms === 4000 && cb) cb(pepperListVoices());
      }, ms);
    });
  }
  function pepperFillVoiceSelectWithRetries(sel) {
    if (!sel) return;
    // ElevenLabs options are always available; browser list may load late.
    pepperPopulateVoiceSelect(sel);
    pepperEnsureVoicesReady(function () { pepperPopulateVoiceSelect(sel); });
  }
  async function pepperSpeakElevenLabs(text, voiceId) {
    var fn = firebase.app().functions('us-central1').httpsCallable('cchPepperSpeak');
    var res = await fn({ text: text, voiceId: voiceId });
    var data = (res && res.data) || {};
    var b64 = String(data.audioBase64 || '');
    var mime = String(data.mimeType || 'audio/mpeg');
    if (!b64) throw new Error('No audio returned');
    var bin = atob(b64);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    var blob = new Blob([bytes], { type: mime });
    var url = URL.createObjectURL(blob);
    pepperStopSpeaking();
    var audio = new Audio(url);
    pepperAudioEl = audio;
    audio.onended = function () {
      try { URL.revokeObjectURL(url); } catch (e) { /* */ }
      if (pepperAudioEl === audio) pepperAudioEl = null;
    };
    audio.onerror = function () {
      try { URL.revokeObjectURL(url); } catch (e) { /* */ }
      if (pepperAudioEl === audio) pepperAudioEl = null;
    };
    await audio.play();
  }
  function pepperSpeakBrowser(text) {
    if (!pepperCanBrowserSpeak()) return;
    function speakWithVoices() {
      try {
        pepperResumeSpeechEngine();
        var saved = pepperSavedVoiceKey();
        var voice = null;
        if (saved && !pepperIsElVoiceKey(saved)) {
          var list = pepperFemaleVoicesOnly(pepperListVoices());
          for (var i = 0; i < list.length; i++) {
            if (pepperVoiceKey(list[i]) === saved) { voice = list[i]; break; }
          }
        }
        if (!voice) voice = pepperPickBestBrowserVoice();
        if (!voice || pepperIsMaleVoice(voice)) {
          if (typeof window.showToast === 'function') {
            window.showToast('No female browser voice — pick an ElevenLabs voice.', 3500);
          }
          return;
        }
        var u = new window.SpeechSynthesisUtterance(text);
        u.voice = voice;
        if (voice.lang) u.lang = voice.lang;
        else u.lang = 'en-US';
        u.rate = 1.12;
        u.pitch = 1;
        u.onerror = function (ev) {
          console.warn('[cchPepper] utterance error', ev && ev.error);
        };
        window.speechSynthesis.speak(u);
        setTimeout(pepperResumeSpeechEngine, 100);
        setTimeout(pepperResumeSpeechEngine, 400);
      } catch (e) {
        console.warn('[cchPepper] speechSynthesis', e);
      }
    }
    pepperEnsureVoicesReady(function () {
      setTimeout(speakWithVoices, 60);
    });
  }
  function pepperSpeakReply(text, opts) {
    opts = opts || {};
    if (!opts.force && !pepperSpeakEnabled()) return;
    if (!pepperCanSpeak()) return;
    var t = String(text || '').trim();
    if (!t || t === '…' || t === '(no reply)') return;
    pepperStopSpeaking();
    var sel = document.getElementById('cch-pepper-voice');
    var key = pepperResolveSelectedKey(sel);
    pepperSaveVoiceKey(key);
    var elId = pepperParseElVoiceId(key);
    if (elId) {
      pepperSpeakElevenLabs(t, elId).catch(function (e) {
        console.warn('[cchPepper] ElevenLabs speak', e);
        if (typeof window.showToast === 'function') {
          window.showToast('Pepper voice failed — try again or pick a free browser voice. ' + (e.message || ''), 4000);
        }
      });
      return;
    }
    pepperSpeakBrowser(t);
  }
  /** Long / list / number-heavy replies: show text first; ask before reading aloud. */
  function pepperShouldAskBeforeSpeak(text) {
    var t = String(text || '');
    if (!t || t === '(no reply)') return false;
    if (t.length > 280) return true;
    var lines = t.split(/\n/).filter(function (l) { return String(l).trim(); });
    if (lines.length >= 4) return true;
    if ((t.match(/\d/g) || []).length >= 12) return true;
    if (/(^|\n)\s*[-•*]\s/.test(t) && lines.length >= 3) return true;
    return false;
  }
  function pepperAttachReadAloud(msgEl, fullText) {
    if (!msgEl || !fullText) return;
    if (msgEl.querySelector('.cch-pepper-read-bar')) return;
    var bar = document.createElement('div');
    bar.className = 'cch-pepper-read-bar';
    var readBtn = document.createElement('button');
    readBtn.type = 'button';
    readBtn.className = 'cch-pepper-read-btn';
    readBtn.textContent = 'Read aloud';
    readBtn.title = 'Read this reply with Speak';
    readBtn.onclick = function () {
      pepperUnlockSpeechOnGesture();
      pepperSpeakReply(fullText, { force: true });
    };
    var skipBtn = document.createElement('button');
    skipBtn.type = 'button';
    skipBtn.className = 'cch-pepper-read-btn skip';
    skipBtn.textContent = 'Skip';
    skipBtn.title = 'Keep it text-only';
    skipBtn.onclick = function () {
      pepperStopSpeaking();
      if (bar.parentNode) bar.parentNode.removeChild(bar);
    };
    bar.appendChild(readBtn);
    bar.appendChild(skipBtn);
    msgEl.appendChild(bar);
  }
  function pepperSpeakAfterReply(text, msgEl) {
    if (!pepperSpeakEnabled() || !pepperCanSpeak()) return;
    var t = String(text || '').trim();
    if (!t || t === '…' || t === '(no reply)') return;
    if (pepperShouldAskBeforeSpeak(t)) {
      pepperAttachReadAloud(msgEl, t);
      pepperSpeakReply("I've listed that in the chat. Want me to read it? Tap Read aloud.");
      return;
    }
    pepperSpeakReply(t);
  }
  function pepperStopListening(micBtn) {
    pepperListening = false;
    var rec = pepperRecognition;
    pepperRecognition = null;
    if (rec) {
      try { rec.onresult = null; rec.onerror = null; rec.onend = null; } catch (e0) { /* */ }
      try { rec.abort(); } catch (e1) {
        try { rec.stop(); } catch (e2) { /* */ }
      }
    }
    if (micBtn) {
      micBtn.classList.remove('listening');
      micBtn.setAttribute('aria-pressed', 'false');
      micBtn.title = 'Tap to dictate (does not send — hit Send)';
    }
  }
  function pepperStartRecognitionSession(input, micBtn) {
    var Ctor = pepperSpeechRecognitionCtor();
    if (!Ctor || !pepperListening) return;
    var rec = new Ctor();
    pepperRecognition = rec;
    rec.lang = 'en-US';
    // Chrome ends sessions after short pauses; we restart in onend while still listening.
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.onresult = function (ev) {
      if (!pepperListening || !input) return;
      var interim = '';
      var finalBit = '';
      for (var i = ev.resultIndex; i < ev.results.length; i++) {
        var piece = ev.results[i][0] ? (ev.results[i][0].transcript || '') : '';
        if (ev.results[i].isFinal) finalBit += piece;
        else interim += piece;
      }
      if (finalBit) {
        pepperBaseTranscript = (pepperBaseTranscript + finalBit).replace(/\s+/g, ' ');
        if (pepperBaseTranscript && pepperBaseTranscript.charAt(pepperBaseTranscript.length - 1) !== ' ') {
          pepperBaseTranscript += ' ';
        }
      }
      var shown = (pepperBaseTranscript + interim).replace(/\s+/g, ' ').replace(/^\s+/, '');
      input.value = shown;
      try { input.dispatchEvent(new Event('input', { bubbles: true })); } catch (eIn) { /* */ }
    };
    rec.onerror = function (ev) {
      var err = (ev && ev.error) || '';
      console.warn('[cchPepper] speech recognition', err);
      // Normal Chrome noise while holding the mic open — keep listening.
      if (err === 'no-speech' || err === 'aborted' || err === 'audio-capture') {
        return;
      }
      if (err === 'not-allowed') {
        pepperStopListening(micBtn);
        if (typeof window.cchAlert === 'function') {
          window.cchAlert('Microphone blocked for this site. Click the lock icon in the address bar → Site settings → Microphone → Allow.', 'Pepper');
        }
        return;
      }
      if (err === 'network') {
        if (typeof window.showToast === 'function') {
          window.showToast('Mic needs network for Chrome speech — check connection', 3000);
        }
      }
    };
    rec.onend = function () {
      if (pepperRecognition === rec) pepperRecognition = null;
      if (!pepperListening) return;
      // Restart immediately so pauses don't kill dictation.
      setTimeout(function () {
        if (!pepperListening) return;
        try { pepperStartRecognitionSession(input, micBtn); } catch (eR) {
          console.warn('[cchPepper] mic restart', eR);
        }
      }, 80);
    };
    try {
      rec.start();
    } catch (eStart) {
      console.warn('[cchPepper] mic start', eStart);
      setTimeout(function () {
        if (!pepperListening) return;
        try { pepperStartRecognitionSession(input, micBtn); } catch (e2) {
          pepperStopListening(micBtn);
          if (typeof window.cchAlert === 'function') {
            window.cchAlert('Could not start the microphone. Use Chrome on this staging URL, allow mic, then try again.', 'Pepper');
          }
        }
      }, 200);
    }
  }
  function pepperToggleListen(input, micBtn) {
    if (!input || !micBtn) return;
    var Ctor = pepperSpeechRecognitionCtor();
    if (!Ctor) {
      if (typeof window.cchAlert === 'function') {
        window.cchAlert('Voice dictation needs Chrome (Speech Recognition). Edge/Firefox often cannot fill the box.', 'Pepper');
      }
      return;
    }
    if (pepperListening) {
      pepperStopListening(micBtn);
      // Trim trailing space from last final chunk.
      if (input) input.value = String(input.value || '').replace(/\s+$/, '');
      if (typeof window.showToast === 'function') window.showToast('Mic off — edit text or hit Send', 2000);
      return;
    }
    pepperStopSpeaking();
    pepperBaseTranscript = String(input.value || '').replace(/\s+$/, '');
    if (pepperBaseTranscript) pepperBaseTranscript += ' ';
    pepperListening = true;
    micBtn.classList.add('listening');
    micBtn.setAttribute('aria-pressed', 'true');
    micBtn.title = 'Listening — tap to stop (then Send)';
    if (typeof window.showToast === 'function') {
      window.showToast('Mic on — speak now. Words should appear in the box.', 3200);
    }
    pepperStartRecognitionSession(input, micBtn);
  }

  async function callPepper(payload) {
    var fn = firebase.app().functions('us-central1').httpsCallable('cchPepper');
    var body = Object.assign({}, payload || {});
    if (body.activityDigest) body.activityDigest = pepperCapDigest(body.activityDigest, 48000);
    var res = await fn(body);
    return String(((res || {}).data || {}).reply || '').trim();
  }

  async function send(payload, log) {
    pepperStopListening(document.getElementById('cch-pepper-mic'));
    appendMsg(log, 'You', payload.input || (payload.action || '').replace(/_/g, ' '));
    var thinking = document.createElement('div');
    thinking.className = 'cch-pepper-msg';
    thinking.innerHTML = '<b>Pepper</b>…';
    log.appendChild(thinking);
    log.scrollTop = log.scrollHeight;
    var spoken = '';
    try {
      if (payload.action === 'report_bug') {
        var bugText = String(payload.input || '').trim() || 'Bug reported from Pepper (no details).';
        var ctx = (typeof window.cchFbCaptureContext === 'function')
          ? window.cchFbCaptureContext()
          : { route: location.hash || '', pageLabel: 'Pepper' };
        if (typeof window.cchFbQuickSubmit === 'function') {
          await window.cchFbQuickSubmit('bug', bugText, ctx);
          spoken = 'Logged in Bugs & Requests. Cindy/Vanessa will see it there.';
          thinking.innerHTML = '<b>Pepper</b>' + esc(spoken);
        } else {
          spoken = 'Bugs module not loaded — hard refresh (Ctrl+Shift+R).';
          thinking.innerHTML = '<b>Pepper</b>' + esc(spoken);
        }
      } else {
        var reply = await callPepper(payload);
        spoken = reply || '(no reply)';
        thinking.innerHTML = '<b>Pepper</b>' + esc(spoken);
      }
    } catch (e) {
      var msg = String((e && e.message) || e || '');
      var code = String((e && e.code) || '');
      console.warn('[cchPepper] call failed', code, msg);
      if (/API key is not configured/i.test(msg)) {
        spoken = 'Pepper\'s API key needs a re-set (Cindy: ANTHROPIC_API_KEY — key line only).';
      } else if (/unavailable|Could not reach|internal|deadline|503/i.test(msg + code)) {
        spoken = 'Something went wrong: Could not reach Pepper. Try once more; if it keeps failing, the Cloud Function or Anthropic key needs a check.';
      } else {
        spoken = 'Something went wrong: ' + msg;
      }
      thinking.innerHTML = '<b>Pepper</b>' + esc(spoken);
    }
    log.scrollTop = log.scrollHeight;
    pepperSpeakAfterReply(spoken, thinking);
  }

  function projectNameFromDom() {
    var el = document.querySelector('[data-project-name]') || document.querySelector('.page-title');
    var t = el ? (el.textContent || '').trim() : '';
    if (t) return t;
    try {
      if (window._currentProject && (window._currentProject.name || window._currentProject.id)) {
        return String(window._currentProject.name || window._currentProject.id);
      }
    } catch (e) { /* */ }
    return '';
  }

  function currentContext() {
    var projectId = projIdFromHash();
    var poId = poIdFromHash();
    var projectName = projectId ? (projectNameFromDom() || projectId) : '';
    var poNum = poId ? (poNumberFromDom() || '') : '';
    var scope = 'none';
    if (poId && projectId) scope = 'po';
    else if (projectId) scope = 'project';
    else if (isFollowupsRoute()) scope = 'followups';
    else if (isAllTasksRoute()) scope = 'tasks';
    else if (isOmRoute()) scope = 'om';
    else if (isTimeRoute()) scope = 'time';
    var label = 'No project selected';
    if (scope === 'po') {
      label = (poNum || 'PO') + ' · ' + (projectName || projectId);
    } else if (scope === 'project') {
      label = projectName || projectId;
    } else if (scope === 'followups') {
      label = 'Follow-Ups · firm-wide';
    } else if (scope === 'tasks') {
      var tf = '';
      try { tf = String(window._allTaskFilter || 'active'); } catch (eT) { /* */ }
      label = 'Tasks · firm-wide' + (tf ? ' · ' + tf : '');
    } else if (scope === 'om') {
      label = 'Order Management · ' + omTabFromHash();
    } else if (scope === 'time') {
      var tab = '';
      try { tab = String(window.smartTimeTab || ''); } catch (e) { /* */ }
      label = 'Smart Time' + (tab ? ' · ' + tab : '') + (pageTitleText() ? ' · ' + pageTitleText() : '');
    }
    var firmName = '';
    if (scope === 'followups') firmName = 'Follow-Ups (firm-wide)';
    else if (scope === 'tasks') firmName = 'Tasks (firm-wide)';
    else if (scope === 'om') firmName = 'Order Management (firm-wide)';
    else if (scope === 'time') firmName = 'Smart Time';
    return {
      projectId: projectId,
      poId: poId,
      poNumber: poNum,
      projectName: projectName || firmName,
      scope: scope,
      label: label
    };
  }

  function clearChat(panel, opts) {
    opts = opts || {};
    var log = panel && panel.querySelector('#cch-pepper-log');
    if (!log) return;
    log.innerHTML = '';
    if (opts.note) appendMsg(log, 'Pepper', opts.note);
  }

  function syncPanelHeader(panel) {
    if (!panel) return;
    var ctx = currentContext();
    var small = panel.querySelector('#cch-pepper-proj');
    if (small) small.textContent = ctx.label;
  }

  function buildPanel() {
    var panel = document.createElement('div');
    panel.id = 'cch-pepper-panel';
    panel.innerHTML =
      '<div id="cch-pepper-head"><div id="cch-pepper-head-brand">'
      + '<img src="' + PEPPER_AVATAR_SRC + '" width="112" height="112" alt="" />'
      + '<div id="cch-pepper-head-text">Pepper<small id="cch-pepper-proj">No project selected</small></div></div>'
      + '<div id="cch-pepper-head-actions">'
      + '<button type="button" id="cch-pepper-speak" title="Read Pepper replies aloud (off by default)">Speak off</button>'
      + '<button type="button" id="cch-pepper-clear" title="Clear this chat">Clear</button>'
      + '<button type="button" id="cch-pepper-close" title="Close">&times;</button></div></div>'
      + '<div id="cch-pepper-voicebar"><div class="cch-pepper-voice-row">'
      + '<label for="cch-pepper-voice">Voice</label>'
      + '<select id="cch-pepper-voice" title="Elise, Jessa, Vanessa (ElevenLabs), or free browser voices"></select></div>'
      + '<div id="cch-pepper-voice-hint">Elise / Jessa / Vanessa (ElevenLabs — uses credits). Free browser voices below are robotic fallback.</div></div>'
      + '<div id="cch-pepper-presets"></div>'
      + '<div id="cch-pepper-log"></div>'
      + '<div id="cch-pepper-inputrow">'
      + '<textarea id="cch-pepper-input" rows="5" placeholder="Ask Pepper… Enter to send · Shift+Enter for a new line."></textarea>'
      + '<div id="cch-pepper-sideacts">'
      + '<button type="button" id="cch-pepper-mic" title="Tap to dictate (does not send — hit Send)" aria-pressed="false">🎤</button>'
      + '<button type="button" id="cch-pepper-send">Send</button></div></div>';
    document.body.appendChild(panel);

    var presetsWrap = panel.querySelector('#cch-pepper-presets');
    var log = panel.querySelector('#cch-pepper-log');
    PRESETS.forEach(function (p) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cch-pepper-preset';
      btn.textContent = p.label;
      btn.onclick = async function () {
        var ctx = currentContext();
        if (p.key === 'my_agenda') {
          appendMsg(log, 'You', "What's on my agenda");
          appendMsg(log, 'Pepper', 'Pulling your plate…');
          try {
            var brief = await buildMyAgendaBrief({});
            appendMsg(log, 'Pepper', brief.spoken);
            if (pepperSpeakEnabled()) pepperSpeakReply(brief.spoken, { force: true });
            send({
              action: 'whats_next',
              input: 'Staff asked what is on MY agenda. Use the MY AGENDA digest. Stay scoped to the signed-in person. Rank money-first. Draft-only. Do not invent numbers not in the digest.',
              projectName: ctx.projectName || 'Firm',
              activityDigest: brief.digest
            }, log);
          } catch (eAg) {
            console.warn('[cchPepper] my agenda', eAg);
            appendMsg(log, 'Pepper', 'I couldn\'t build your agenda just now. Try again in a moment.');
          }
          return;
        }
        if (p.key === 'report_bug') {
          var input = panel.querySelector('#cch-pepper-input');
          var typed = (input && input.value.trim()) || '';
          if (!typed && typeof window.cchPrompt === 'function') {
            typed = await window.cchPrompt('Describe the bug:', '', 'Report a bug') || '';
          }
          if (!String(typed).trim()) return;
          if (input) input.value = '';
          send({ action: 'report_bug', input: String(typed).trim(), projectName: ctx.projectName }, log);
          return;
        }
        if (p.key === 'unbilled_time' && ctx.scope !== 'project') {
          appendMsg(log, 'You', 'Unbilled time');
          try {
            var ubBrief = await buildMyAgendaBrief({});
            appendMsg(log, 'Pepper', ubBrief.spoken);
            send({
              action: 'unbilled_time',
              input: 'Report MY unbilled hours firm-wide from MY AGENDA. No project required.',
              projectName: 'Firm-wide',
              activityDigest: ubBrief.digest
            }, log);
          } catch (eUb) {
            appendMsg(log, 'Pepper', 'I couldn\'t load your unbilled hours just now.');
          }
          return;
        }
        if (p.key === 'draft_email' && (ctx.scope === 'om' || ctx.scope === 'followups' || ctx.scope === 'tasks')) {
          appendMsg(log, 'Pepper', 'Client email drafts need a project open. On Follow-Ups use Draft a follow-up for a nudge from the firm-wide list.');
          return;
        }
        if ((p.key === 'whats_next' || p.key === 'draft_followup' || p.key === 'summarize_status') &&
            (ctx.scope === 'followups' || ctx.scope === 'tasks')) {
          var firmDigest = await buildActiveDigest({ includeUnbilled: false });
          var firmAsk = ctx.scope === 'followups'
            ? (p.key === 'draft_followup'
              ? 'From the firm-wide Follow-Ups digest, pick the single most important client-lane stall and draft a short client nudge (no subject). Name the project.'
              : 'From the firm-wide Follow-Ups digest, what is the most important thing to do today? Rank top 3 with project names and days stalled.')
            : 'From the firm-wide Tasks digest, what should staff tackle first? Rank top 5 Urgent/High/overdue with project names.';
          send({
            action: p.key === 'draft_followup' ? 'draft_followup' : 'whats_next',
            input: firmAsk,
            projectName: ctx.projectName,
            activityDigest: firmDigest
          }, log);
          return;
        }
        if (p.key === 'vendor_status_followup') {
          if (ctx.scope === 'om') {
            var omDigest = await buildActiveDigest({ includeUnbilled: false });
            send({
              action: 'vendor_status_followup',
              input: 'From Order Management: list which vendors/POs most need a status follow-up (confirmation or ETA). Then draft ONE sample email body for the highest-priority PO (no subject). Remind staff to use the row Follow up button to open mailto.',
              projectName: ctx.projectName,
              activityDigest: omDigest
            }, log);
            return;
          }
          if (ctx.poId && ctx.projectId) {
            var poDigest = await buildActiveDigest({ includeUnbilled: false, poId: ctx.poId });
            send({
              action: 'vendor_status_followup',
              input: 'Staff is on the open PO page (' + (ctx.poNumber || ctx.poId) + '). Draft a short vendor status follow-up email body for THIS PO only (no subject). Do not ask which PO. Remind them the Follow up button opens mailto.',
              projectName: ctx.projectName,
              activityDigest: poDigest
            }, log);
            return;
          }
          if (!ctx.projectId) {
            appendMsg(log, 'Pepper', 'Open Order Management or a project/PO, then try Vendor status follow-up. Or use Follow up on an OM row.');
            return;
          }
          var digestVu = await buildActiveDigest({ includeUnbilled: false });
          send({
            action: 'vendor_status_followup',
            input: 'Draft a short vendor status follow-up for open POs needing ETA or confirmation on this project.',
            projectName: ctx.projectName,
            activityDigest: digestVu
          }, log);
          return;
        }
        var digest = await buildActiveDigest({
          includeUnbilled: p.key === 'unbilled_time' || (p.key === 'summarize_status' && ctx.scope === 'project') || (p.key === 'whats_next' && ctx.scope === 'project')
        });
        send({
          action: p.key,
          input: '',
          projectName: ctx.projectName || ctx.label || '(none selected)',
          activityDigest: digest
        }, log);
      };
      presetsWrap.appendChild(btn);
    });

    panel.querySelector('#cch-pepper-close').onclick = function () {
      closePepperPanel();
    };
    panel.querySelector('#cch-pepper-clear').onclick = function () {
      pepperStopListening(panel.querySelector('#cch-pepper-mic'));
      pepperStopSpeaking();
      clearChat(panel, { note: 'Chat cleared.' });
    };
    applyPepperDock();

    var speakBtn = panel.querySelector('#cch-pepper-speak');
    var voiceBar = panel.querySelector('#cch-pepper-voicebar');
    var voiceSel = panel.querySelector('#cch-pepper-voice');
    function syncVoiceBar() {
      if (!voiceBar) return;
      var show = pepperCanSpeak() && pepperSpeakEnabled();
      voiceBar.classList.toggle('show', show);
      if (show && voiceSel) pepperFillVoiceSelectWithRetries(voiceSel);
    }
    if (voiceSel) {
      voiceSel.onchange = function () {
        pepperSaveVoiceKey(voiceSel.value || '');
        pepperStopSpeaking();
        // Preview the newly chosen voice on change.
        if (pepperSpeakEnabled()) {
          pepperUnlockSpeechOnGesture();
          pepperSpeakReply('Hi, this is Pepper.', { force: true });
        }
      };
    }
    if (speakBtn) {
      if (!pepperCanSpeak()) {
        speakBtn.disabled = true;
        speakBtn.title = 'Read aloud not supported in this browser';
        speakBtn.textContent = 'Speak n/a';
      } else {
        function syncSpeakBtn() {
          var on = pepperSpeakEnabled();
          speakBtn.classList.toggle('on', on);
          speakBtn.textContent = on ? 'Speak on' : 'Speak off';
          speakBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
          speakBtn.title = on
            ? 'Read aloud on — pick Elise or another voice below (ElevenLabs uses credits).'
            : 'Read aloud off (default). Click to hear Pepper replies.';
          syncVoiceBar();
        }
        syncSpeakBtn();
        speakBtn.onclick = function () {
          var next = !pepperSpeakEnabled();
          pepperSetSpeakEnabled(next);
          if (!next) {
            pepperStopSpeaking();
            syncSpeakBtn();
            return;
          }
          // Must unlock inside this click — also forces Chrome to load getVoices().
          pepperUnlockSpeechOnGesture();
          syncSpeakBtn();
          pepperFillVoiceSelectWithRetries(voiceSel);
          pepperEnsureVoicesReady(function () {
            pepperSpeakReply('Hi, this is Pepper.', { force: true });
          });
        };
      }
    }

    var input = panel.querySelector('#cch-pepper-input');
    var sendBtn = panel.querySelector('#cch-pepper-send');
    var micBtn = panel.querySelector('#cch-pepper-mic');
    if (micBtn) {
      if (!pepperSpeechRecognitionCtor()) {
        micBtn.disabled = true;
        micBtn.title = 'Dictation needs Chrome (Speech Recognition)';
      } else {
        micBtn.onclick = function () { pepperToggleListen(input, micBtn); };
      }
    }
    async function submitFree() {
      var val = input.value.trim();
      if (!val) return;
      pepperStopListening(micBtn);
      input.value = '';
      var ctx = currentContext();
      var lower = val.toLowerCase();
      if (/\b(bug|broken|error|fix it)\b/.test(lower) && lower.indexOf('report') >= 0) {
        send({ action: 'report_bug', input: val, projectName: ctx.projectName }, log);
        return;
      }
      if (looksLikeMyAgendaAsk(val)) {
        appendMsg(log, 'You', val);
        try {
          var briefAsk = await buildMyAgendaBrief({ allTeam: /\ball team\b/.test(lower) });
          appendMsg(log, 'Pepper', briefAsk.spoken);
          if (pepperSpeakEnabled()) pepperSpeakReply(briefAsk.spoken, { force: true });
          var firmAskDigest = await buildFirmWideStaffDigest({ allTeam: /\ball team\b/.test(lower) });
          send({
            action: 'whats_next',
            input: 'Staff asked: ' + val + '\n\nUse the FIRM-WIDE STAFF DIGEST and MY AGENDA. No project required. Money-first. Draft-only. Never invent. Never say you are working blind.',
            projectName: 'Firm-wide',
            activityDigest: firmAskDigest
          }, log);
        } catch (eAsk) {
          console.warn('[cchPepper] agenda ask', eAsk);
          appendMsg(log, 'Pepper', 'I couldn\'t pull your agenda just now.');
        }
        return;
      }
      var digest = await buildActiveDigest({
        forceFirmWide: !ctx.projectId || wantsFirmWideAsk(val),
        allTeam: /\ball team\b/.test(lower)
      });
      var task = val;
      if (!ctx.projectId) {
        task = val + '\n\n(Staff has no project selected. Use the FIRM-WIDE STAFF DIGEST. Do not ask them to open a project first. Never say you are working blind.)';
      }
      if (ctx.poId && /\b(follow\s*up|email|status|eta|confirm)/i.test(val)) {
        task = val + '\n\n(Staff is on open PO ' + (ctx.poNumber || ctx.poId) +
          '. Use that PO from the digest. Do not ask which PO. Draft email body only unless they ask to open mailto.)';
      }
      send({
        action: '',
        input: task,
        projectName: ctx.projectId ? (ctx.projectName || ctx.label) : 'Firm-wide',
        activityDigest: digest
      }, log);
    }
    sendBtn.onclick = submitFree;
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        submitFree();
      }
    });
    syncPanelHeader(panel);
    return panel;
  }

  /**
   * Primary vendor follow-up path (Fable v1.1 A): OM row / PO page.
   * Drafts via Pepper, opens mailto (To vendor, Cc orders@), logs like Send to vendor.
   */
  window.cchPepperVendorFollowUp = async function(projectId, poId) {
    if (isClientRoute()) return;
    if (!isStaff()) {
      if (typeof window.cchAlert === 'function') await window.cchAlert('Pepper is for studio staff only.', 'Follow up');
      return;
    }
    if (!projectId || !poId) return;
    try {
      if (typeof window.showToast === 'function') window.showToast('Pepper drafting vendor follow-up…', 2500);
      var database = pepperDb();
      var snap = await database.collection('boards').doc(projectId).collection('purchaseOrders').doc(poId).get();
      if (!snap.exists) {
        if (typeof window.cchAlert === 'function') await window.cchAlert('Purchase order not found.', 'Follow up');
        return;
      }
      var docData = snap.data() || {};
      var projSnap = await database.collection('boards').doc(projectId).get();
      var projData = projSnap.exists ? (projSnap.data() || {}) : {};
      var projName = String(projData.name || projectId).trim();
      var num = String(docData.number || docData.num || poId).trim();

      var contact = { email: String(docData.vendorEmail || '').trim(), name: String(docData.vendor || '').trim() };
      if (typeof window.cchPoVendorContactResolved === 'function') {
        try {
          var resolved = await window.cchPoVendorContactResolved(docData);
          if (resolved && resolved.email) contact.email = resolved.email;
          if (resolved && resolved.name) contact.name = resolved.name;
        } catch (_e) {}
      }
      if (!contact.email && typeof window.cchPrompt === 'function') {
        var typed = await window.cchPrompt(
          'Vendor email (for this send only — not saved to the vendor record):',
          '',
          'Follow up'
        );
        if (typed === null) return;
        contact.email = String(typed || '').trim();
      }
      if (!contact.email) {
        if (typeof window.cchAlert === 'function') {
          await window.cchAlert('No email entered — canceling mailto.', 'Follow up');
        }
        return;
      }

      var digest = await buildFullDigest(projectId, { poId: poId, includeUnbilled: false });
      var reply = await callPepper({
        action: 'vendor_status_followup',
        input: 'Write only the email body (no subject line) asking the vendor for order status / confirmation / ETA on PO ' + num + ' for ' + projName + '.',
        projectName: projName,
        activityDigest: digest
      });
      if (!reply) {
        if (typeof window.cchAlert === 'function') await window.cchAlert('Pepper returned an empty draft.', 'Follow up');
        return;
      }

      var subject = '[' + num + '] CCH Design — status follow-up — ' + projName;
      var sender = (window.currentUser && window.currentUser.displayName) ||
        (window.currentUser && window.currentUser.email) || 'CCH Design';
      var body = reply;
      if (body.toLowerCase().indexOf('reply all') < 0) {
        body += '\n\nPlease Reply All so ' + ORDERS_EMAIL + ' stays on the thread.\n\n' + sender + '\n' + FIRM;
      }

      if (typeof window.cchPoAppendVendorComm === 'function') {
        try {
          await window.cchPoAppendVendorComm(projectId, poId, {
            direction: 'outbound',
            channel: 'mailto',
            from: (window.currentUser && window.currentUser.email) || sender,
            to: contact.email,
            cc: ORDERS_EMAIL,
            subject: subject,
            body: body,
            snippet: body.split('\n').slice(0, 3).join(' ')
          });
        } catch (eLog) {
          console.warn('[cchPepper] vendor comms log', eLog);
        }
      }

      var href = 'mailto:' + encodeURIComponent(contact.email) +
        '?cc=' + encodeURIComponent(ORDERS_EMAIL) +
        '&subject=' + encodeURIComponent(subject) +
        '&body=' + encodeURIComponent(body);
      window.open(href, '_blank');
      if (typeof window.showToast === 'function') window.showToast('Follow-up drafted · opening email', 'success');
    } catch (e) {
      console.error('[cchPepper] vendor follow-up', e);
      if (typeof window.cchAlert === 'function') {
        await window.cchAlert('Could not draft follow-up: ' + (e.message || e), 'Follow up');
      }
    }
  };

  var pepperUiBound = false;
  var panel = null;
  var lastProjectId = '';

  function removePepperUi() {
    pepperStopListening(document.getElementById('cch-pepper-mic'));
    pepperStopSpeaking();
    var btn = document.getElementById('cch-pepper-btn');
    if (btn) btn.remove();
    if (panel) {
      panel.remove();
      panel = null;
    }
  }

  function contextKey() {
    var ctx = currentContext();
    if (ctx.scope === 'po') return 'po:' + ctx.projectId + ':' + ctx.poId;
    if (ctx.scope === 'project') return 'p:' + ctx.projectId;
    if (ctx.scope === 'followups') return 'followups';
    if (ctx.scope === 'tasks') {
      var tf = '';
      try { tf = String(window._allTaskFilter || 'active'); } catch (e0) { /* */ }
      return 'tasks:' + tf;
    }
    if (ctx.scope === 'om') return 'om:' + omTabFromHash();
    if (ctx.scope === 'time') {
      var tab = '';
      try { tab = String(window.smartTimeTab || ''); } catch (e) { /* */ }
      return 'time:' + tab + ':' + (window.location.hash || '');
    }
    return 'none:' + (window.location.hash || '');
  }

  function onPepperRouteChange() {
    if (isClientRoute()) {
      removePepperUi();
      return;
    }
    syncPepperVisibility();
    applyPepperDock();
    /* Cindy Aug 10: do not auto-pop Pepper on dashboard / hashchange — wait until engaged. */
    if (!panel) {
      lastProjectId = contextKey();
      return;
    }
    var nextKey = contextKey();
    if (nextKey !== lastProjectId) {
      lastProjectId = nextKey;
      syncPanelHeader(panel);
      var ctx = currentContext();
      var note = 'Chat cleared.';
      if (ctx.scope === 'po') {
        note = 'Open PO ' + (ctx.poNumber || ctx.poId) + ' — chat cleared. I can see this PO\'s lines and vendor.';
      } else if (ctx.scope === 'project') {
        note = 'Switched project — chat cleared. Ask about ' + (ctx.projectName || ctx.projectId) + '.';
      } else if (ctx.scope === 'followups') {
        note = 'Follow-Ups (firm-wide) — chat cleared. Ask what matters most across projects.';
      } else if (ctx.scope === 'tasks') {
        note = 'Tasks (firm-wide) — chat cleared. Ask about priorities across projects.';
      } else if (ctx.scope === 'om') {
        note = 'Order Management — chat cleared. I can see firm-wide open POs (confirmation / ETA / bills).';
      } else if (ctx.scope === 'time') {
        note = 'Smart Time — chat cleared. I can read Missing Time Alerts from this page.';
      } else if (isStudioHomeRoute()) {
        note = 'Dashboard — here\'s your plate. Ask what\'s on my agenda anytime.';
      } else {
        note = 'Chat cleared. Open Follow-Ups, Tasks, a project, PO, Order Management, or Smart Time for grounded answers.';
      }
      if (!isStudioHomeRoute()) clearChat(panel, { note: note });
      else syncPanelHeader(panel);
    } else {
      syncPanelHeader(panel);
    }
  }

  /** WO-086: close Pepper panel (Team Chat calls this when opening so panels do not stack). */
  var staffUserDismissedPanel = false;

  function closePepperPanel() {
    var p = panel || document.getElementById('cch-pepper-panel');
    if (!p) return;
    try {
      pepperStopListening(p.querySelector('#cch-pepper-mic'));
      pepperStopSpeaking();
    } catch (_eStop) { /* */ }
    p.classList.remove('open');
    p.style.display = 'none';
    staffUserDismissedPanel = true;
  }
  window.cchPepperClosePanel = closePepperPanel;

  function openPepperPanel() {
    if (isClientRoute() || !isStaff()) return null;
    if (!panel) panel = buildPanel();
    syncPanelHeader(panel);
    applyPepperDock();
    if (typeof window.cchFbCloseTeamPanel === 'function') {
      try { window.cchFbCloseTeamPanel(); } catch (_eCloseFb) { /* */ }
    }
    panel.classList.add('open');
    panel.style.display = 'flex';
    panel.style.zIndex = '100050';
    staffUserDismissedPanel = false;
    return panel;
  }

  /** Dashboard / Projects home — used when user opens Pepper (no auto-pop). */
  function isStudioHomeRoute() {
    var h = String(window.location.hash || '');
    if (isClientRoute()) return false;
    if (/#\/project\//i.test(h)) return false;
    if (/#\/dashboard(\/|$|\?)/i.test(h)) return true;
    if (/#\/projects(\/|$|\?)/i.test(h)) return true;
    if (!h || h === '#' || h === '#/') return true;
    return false;
  }

  var dashboardPopInFlight = false;
  var lastDashboardPopKey = '';

  /**
   * Fill plate / greet — only when engaged (clicked Pepper or asked for agenda).
   * Cindy Aug 10: no unsolicited dashboard pop / "hi".
   */
  async function maybeDashboardPepperPop(opts) {
    opts = opts || {};
    if (!opts.engaged) return;
    if (isClientRoute() || !isStaff()) return;
    if (!isStudioHomeRoute()) return;
    var key = agendaDayKey() + ':' + String(window.location.hash || '#/dashboard');
    if (lastDashboardPopKey === key && panel && panel.classList.contains('open')) {
      var existing = pepperLiveLog();
      if (existing && existing.querySelector('.cch-pepper-msg')) return;
    }
    if (dashboardPopInFlight) return;
    dashboardPopInFlight = true;
    try {
      var p = openPepperPanel();
      if (!p) return;
      lastDashboardPopKey = key;
      var log = pepperLiveLog();
      if (log) log.innerHTML = '';
      appendMsg(log, 'Pepper', 'Hi — pulling what\'s on your plate…');
      var brief = await buildMyAgendaBrief({});
      p = openPepperPanel();
      log = pepperLiveLog();
      if (log) {
        log.innerHTML = '';
        appendMsg(log, 'Pepper', brief.spoken);
      }
      markAgendaSurfacedToday();
      /* Speak only if Speak is already on — never force voice on open. */
      if (pepperSpeakEnabled()) {
        try { pepperSpeakReply(brief.spoken); } catch (_eSp) { /* */ }
      }
      console.info('[CCH Pepper] engaged plate for', brief.person.first, BUILD);
    } catch (e) {
      console.warn('[CCH Pepper] engaged plate', e);
      try {
        openPepperPanel();
        var errLog = pepperLiveLog();
        if (errLog) {
          errLog.innerHTML = '';
          appendMsg(errLog, 'Pepper', 'Hi — I couldn\'t build your plate just now. Tap What\'s on my agenda.');
        }
      } catch (_e2) { /* */ }
    } finally {
      dashboardPopInFlight = false;
    }
  }

  /** @deprecated name kept — no auto morning pop; use engaged click */
  async function maybeMorningAgendaBrief() {
    return;
  }

  function mountPepperUi() {
    if (document.getElementById('cch-pepper-btn')) {
      applyPepperDock();
      return;
    }
    if (isClientRoute() || !isStaff()) return;

    injectStyle();
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'cch-pepper-btn';
    btn.innerHTML = pepperAvatarHtml(28, { chip: true }) + '<span class="cch-pepper-label">Pepper</span>';
    btn.title = 'Pepper — staff assistant';
    document.body.appendChild(btn);
    applyPepperDock();

    lastProjectId = contextKey();

    btn.onclick = function () {
      if (!panel) panel = buildPanel();
      syncPanelHeader(panel);
      applyPepperDock();
      var willOpen = !panel.classList.contains('open');
      // WO-086 Part 1: only one assist panel open — Team Chat shares the same from-header slot
      if (willOpen && typeof window.cchFbCloseTeamPanel === 'function') {
        try { window.cchFbCloseTeamPanel(); } catch (_eCloseFb) { /* */ }
      }
      if (willOpen) {
        staffUserDismissedPanel = false;
        panel.classList.add('open');
        panel.style.display = 'flex';
        /* Engaged: fill plate on home; elsewhere leave empty for presets / ask. */
        if (isStudioHomeRoute()) {
          setTimeout(function () { void maybeDashboardPepperPop({ engaged: true }); }, 50);
        }
      } else {
        closePepperPanel();
      }
    };
    if (!pepperUiBound) {
      window.addEventListener('hashchange', onPepperRouteChange);
      pepperUiBound = true;
    }
  }

  function syncPepperVisibility() {
    if (isClientRoute() || !isStaff()) {
      removePepperUi();
      return;
    }
    mountPepperUi();
  }

  function init() {
    // Match Bugs/Fix-It: wait for auth — DOMContentLoaded often runs before currentUser exists.
    try {
      var a = (typeof auth !== 'undefined' && auth) || firebase.auth();
      if (a && typeof a.onAuthStateChanged === 'function') {
        a.onAuthStateChanged(function () {
          syncPepperVisibility();
        });
      }
    } catch (eAuth) { /* */ }
    var tries = 0;
    var wt = setInterval(function () {
      if (isStaff()) {
        syncPepperVisibility();
        clearInterval(wt);
      }
      if (++tries > 40) clearInterval(wt);
    }, 500);
    syncPepperVisibility();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  console.info('[CCH Pepper] build ' + BUILD + ' — dashboard auto-pop + person-scoped plate');
})();
