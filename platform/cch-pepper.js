/**
 * Pepper — floating staff assistant panel.
 * Digests: decisions, Follow-Ups, activity, unbilled time, OM firm-wide (Fable D/B + Bugletrail).
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
  function pepperIsBillableEntry(t) {
    if (typeof window._isBillableEntry === 'function') return window._isBillableEntry(t);
    if (t && t.billable === false) return false;
    return true;
  }

  async function pepperFetchProjectActivity(database, projId) {
    var items = [];
    var lastDoc = null;
    var page = 0;
    while (page < 8) {
      var snap;
      try {
        var q = database.collection('activity').where('projectId', '==', projId).orderBy('timestamp', 'desc').limit(500);
        if (lastDoc) q = q.startAfter(lastDoc);
        snap = await q.get();
      } catch (eOrder) {
        if (page > 0) break;
        snap = await database.collection('activity').where('projectId', '==', projId).limit(500).get();
      }
      if (!snap || snap.empty) break;
      snap.forEach(function (doc) {
        var d = doc.data() || {};
        if (pepperIsClientDoc(d) || PEPPER_DECISION_ACTIONS[String(d.action || '')] ||
            String(d.action || '').toLowerCase().indexOf('decision') >= 0) {
          items.push({ id: doc.id, data: d });
        }
      });
      if (snap.size < 500) break;
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
      if (!items.length) return 'Recent client activity: (none in filter).';
      var lines = ['Recent client activity:'];
      items.slice(0, 30).forEach(function (it) {
        var d = it.data || {};
        var detail = d.summary || d.title || d.docType || d.description || '';
        lines.push('- [' + pepperFormatWhen(d) + '] ' + (d.action || 'activity') + ': ' + detail);
      });
      return lines.join('\n');
    } catch (e) {
      console.warn('[cchPepper] activity digest', e);
      return '';
    }
  }

  async function buildFollowUpsDigest(projectId) {
    if (!projectId) return '';
    if (typeof window._cchFuPepperDigest === 'function') {
      try { return await window._cchFuPepperDigest(projectId); } catch (e) { /* fall through */ }
    }
    return '';
  }

  async function buildUnbilledTimeDigest(projectId) {
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

      var unbilled = Object.keys(byId).map(function (k) { return byId[k]; }).filter(function (t) {
        if (!pepperIsBillableEntry(t)) return false;
        if (invoiced[String(t.id)]) return false;
        if (t.invoiced === true || t.invoiceId) return false;
        return (parseFloat(t.hours) || 0) > 0;
      });

      if (!unbilled.length) {
        return 'Unbilled time: none found (billable hours not already on an invoice).';
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
        'Unbilled billable time (' + unbilled.length + ' entries, ' + totalH.toFixed(1) + ' hrs' +
          (total$ > 0 ? ', ~$' + Math.round(total$) : '') + '):'
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

  async function buildPoNudgeDigest(projectId, poId) {
    if (!projectId || !poId) return '';
    try {
      var snap = await pepperDb().collection('boards').doc(projectId).collection('purchaseOrders').doc(poId).get();
      if (!snap.exists) return '';
      var po = Object.assign({ id: snap.id }, snap.data() || {});
      var num = po.number || po.num || po.id;
      var needsConf = typeof window.cchOmNeedsConfirmation === 'function' && window.cchOmNeedsConfirmation(po);
      var missEta = typeof window.cchOmMissingEtaLineCount === 'function' ? window.cchOmMissingEtaLineCount(po) : 0;
      var lines = [
        'OPEN PO PAGE — staff is viewing this purchase order right now. Do not ask which PO.',
        'PO for vendor follow-up / status:',
        '- PO #: ' + num,
        '- Firestore id: ' + poId,
        '- Vendor: ' + (po.vendor || po._displayVendor || '—'),
        '- Status: ' + (po.status || '—'),
        '- Needs confirmation: ' + (needsConf ? 'yes' : 'no'),
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
      var a = await buildDecisionsDigest(projectId);
      var b = await buildFollowUpsDigest(projectId);
      var c = await buildActivityDigest(projectId);
      var d = await buildUnbilledTimeDigest(projectId);
      if (a) parts.push(a);
      if (b) parts.push(b);
      if (c) parts.push(c);
      if (d && (opts.includeUnbilled !== false)) parts.push(d);
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
      'Studio page context (no firm-wide or project digest for this route):',
      'Title: ' + title,
      'Route: ' + h,
      '',
      'Pepper cannot see screen pixels. For grounded answers, open Follow-Ups, Tasks, a project, Order Management, or Smart Time, then ask again.',
      'Do not ask the user to paste a digest.'
    ].join('\n');
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

  async function buildFirmTasksDigest() {
    var lines = [
      'FIRM-WIDE TASKS — staff is on the overall Tasks page. Answer the big picture. Do not ask them to open a project first.'
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
        return 'FIRM-WIDE TASKS — could not load tasks. Stay on Tasks and try again.';
      }
    }
    var filter = '';
    try { filter = String(window._allTaskFilter || (cached && cached.filter) || 'active'); } catch (eF) { filter = 'active'; }
    var active = list.filter(function (t) { return String(t.status || '') !== 'Done'; });
    var mine = [];
    try {
      var memberName = typeof window.currentMemberName === 'function' ? String(window.currentMemberName() || '') : '';
      var first = memberName.split(/\s+/)[0] || '';
      if (first) {
        mine = active.filter(function (t) {
          return String(t.assignee || '').toLowerCase().indexOf(first.toLowerCase()) >= 0;
        });
      }
    } catch (eM) { /* */ }
    var view = active;
    if (filter === 'mine') view = mine.length ? mine : active;
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
    if (ctx.projectId) {
      // On a PO page, always include that PO's lines; skip unbilled noise unless asked.
      if (ctx.poId && opts.includeUnbilled == null) opts.includeUnbilled = false;
      return buildFullDigest(ctx.projectId, opts);
    }
    if (ctx.scope === 'followups') return buildFirmFollowUpsDigest();
    if (ctx.scope === 'tasks') return buildFirmTasksDigest();
    if (ctx.scope === 'om') return buildOmDigest(opts);
    if (ctx.scope === 'time') return buildSmartTimeDigest();
    return buildGenericPageDigest();
  }

  var PRESETS = [
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
  var PEPPER_AVATAR_SRC = 'assets/pepper-avatar.png?v=20260806final2';
  var PEPPER_AVATAR_CHIP_SRC = 'assets/pepper-avatar-chip.png?v=20260806final2';

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
    var row = document.createElement('div');
    row.className = 'cch-pepper-msg';
    row.innerHTML = '<b>' + esc(who) + '</b>' + esc(text);
    log.appendChild(row);
    log.scrollTop = log.scrollHeight;
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
    var res = await fn(payload);
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
      spoken = 'Something went wrong: ' + (e.message || e);
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
          appendMsg(log, 'Pepper', 'Unbilled time is project-scoped. Open a project, then ask again.');
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
      var digest = await buildActiveDigest({});
      var task = val;
      if (ctx.poId && /\b(follow\s*up|email|status|eta|confirm)/i.test(val)) {
        task = val + '\n\n(Staff is on open PO ' + (ctx.poNumber || ctx.poId) +
          '. Use that PO from the digest. Do not ask which PO. Draft email body only unless they ask to open mailto.)';
      }
      send({
        action: '',
        input: task,
        projectName: ctx.projectName || ctx.label || '(none selected)',
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
      } else {
        note = 'Chat cleared. Open Follow-Ups, Tasks, a project, PO, Order Management, or Smart Time for grounded answers.';
      }
      clearChat(panel, { note: note });
    } else {
      syncPanelHeader(panel);
    }
  }

  /** WO-086: close Pepper panel (Team Chat calls this when opening so panels do not stack). */
  function closePepperPanel() {
    var p = panel || document.getElementById('cch-pepper-panel');
    if (!p) return;
    try {
      pepperStopListening(p.querySelector('#cch-pepper-mic'));
      pepperStopSpeaking();
    } catch (_eStop) { /* */ }
    p.classList.remove('open');
  }
  window.cchPepperClosePanel = closePepperPanel;

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
      panel.classList.toggle('open');
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
        a.onAuthStateChanged(function () { syncPepperVisibility(); });
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

  console.info('[CCH Pepper] build 20260806dock1 — topbar icons nowrap (Overview clip fix)');
})();
