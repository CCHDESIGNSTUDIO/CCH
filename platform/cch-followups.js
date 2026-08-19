// ==================== CCH FOLLOW-UPS COMMAND CENTER (WO-010) ====================
// Cross-project + per-project stall tracker — two lanes, pipeline-legal actions.
// Spec: loop/WO-010_followups-module_CW_Jul11.md + Docs/NAV_SUBPANEL_SPEC_CW_Jul11_v1.2.html
// Build 20260726fu8 — Houzz IN-band normalize; design-service invoices skip no-PO detector

(function() {
  'use strict';

  if (window._cchFollowupsLoaded) return;
  window._cchFollowupsLoaded = true;

  var BUILD = '20260726fu9';
  var META_STALL_DAYS = 7;
  var PORTAL_STALE_DAYS = 14;
  var SCAN_BATCH = 12;
  var CACHE_TTL_MS = 180000;
  var SHARED_TIME_TTL_MS = 300000;

  var fuState = {
    globalStalls: [],
    byProject: {},
    loading: false,
    lastScan: 0,
    scanGen: 0
  };

  var fuCache = { globalAt: 0, globalStalls: null, byProject: {}, sharedTimeAt: 0, sharedTimeByProj: null };

  function fuDb() {
    try { return (typeof db !== 'undefined' && db) || firebase.firestore(); } catch (e) { return null; }
  }

  function fuEsc(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function fuEscAttr(s) { return fuEsc(s).replace(/"/g, '&quot;'); }

  function fuMoney(n) {
    if (typeof formatMoney === 'function') return formatMoney(n);
    var v = parseFloat(n) || 0;
    return '$' + v.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }

  function fuEnabled() {
    try {
      if (localStorage.getItem('cchFollowups') === '0') return false;
      return true;
    } catch (e) { return true; }
  }

  function fuIsAdmin() {
    try {
      return !!(currentUser && typeof ADMIN_EMAILS !== 'undefined' &&
        ADMIN_EMAILS.includes((currentUser.email || '').toLowerCase()));
    } catch (e) { return false; }
  }

  function fuTs(val) {
    if (!val) return 0;
    if (val && val.toDate) { try { return val.toDate().getTime(); } catch (e) {} }
    var ms = Date.parse(val);
    return isFinite(ms) ? ms : 0;
  }

  function fuDaysSince(val) {
    var ms = fuTs(val);
    if (!ms) return -1;
    return Math.floor((Date.now() - ms) / 86400000);
  }

  function fuNormalizeDocNum(d) {
    var n = String((d && (d.invoiceNum || d.number || d.num || d.houzzInvoice || d.displayNumber || d.proposalNum || d.poNum || d.poNumber)) || '').trim();
    if (!n) return '';
    n = n.toUpperCase().replace(/\s+/g, '');
    if (/^INV/i.test(n)) n = 'IN' + n.slice(3);
    return n;
  }

  function fuIsLegacyHouzzInvoiceBand(d) {
    var n = fuNormalizeDocNum(d);
    if (!n) return false;
    // Houzz legacy IN-11xxx / IN-12xxx (handles IN-12788, IN12788, IN 12788, INV-12788)
    return /^IN-?1[12]\d{2,}$/.test(n);
  }

  /** WO-019 — Houzz detector aligned with cchOmIsHouzzSourcePo (Order Management). */
  function fuDocIsHouzzSource(d) {
    if (!d) return false;
    if (fuIsLegacyHouzzInvoiceBand(d)) return true;
    if (typeof window.cchOmIsHouzzSourcePo === 'function') {
      try { if (window.cchOmIsHouzzSourcePo(d)) return true; } catch (e) {}
    }
    if (d.houzzImport === true) return true;
    if (d.houzzId) return true;
    if (d.isHouzz) return true;
    if (d.houzzInvoice || d.houzzProposal) return true;
    var src = String(d.source || d.Source || d.dataSource || d.origin || d.importedFrom || '').trim().toLowerCase();
    if (src === 'houzz-import' || src === 'houzz_import' || src.indexOf('houzz') >= 0) return true;
    if (d.houzzBalance != null && d.houzzBalance !== '') return true;
    if (String(d._qbIdSource || '').toLowerCase() === 'houzz-import') return true;
    var mem = String(d.member || d.importedBy || '').toLowerCase();
    if (mem.indexOf('houzz') >= 0) return true;
    var pays = d.payments || [];
    for (var pi = 0; pi < pays.length; pi++) {
      var pm = String((pays[pi] || {}).method || '').toLowerCase();
      if (pm.indexOf('houzz') >= 0) return true;
    }
    if (typeof window.cchOmIsLegacyHouzzNumber === 'function') {
      try { if (window.cchOmIsLegacyHouzzNumber(d)) return true; } catch (e) {}
    } else {
      var poN = fuNormalizeDocNum(d);
      if (/^(?:PO)?400\d+$/i.test(poN)) return true;
    }
    return false;
  }

  /** Paid invoices with only design/labor/expense lines never need a merchandise PO. */
  function fuInvoiceExpectsPo(inv) {
    if (!inv) return false;
    var items = inv.items || [];
    if (!items.length) return true;
    var hasProduct = false;
    for (var i = 0; i < items.length; i++) {
      var it = items[i] || {};
      if (typeof window.isProposalGroupHeaderItem === 'function' && window.isProposalGroupHeaderItem(it)) continue;
      var et = String(it.expenseType || '').toLowerCase();
      if (et === 'sales_tax' || et === 'shipping' || et === 'handling' || et === 'discount' || et === 'retainer_credit') continue;
      if (typeof window._cchSidebarClassifyItem === 'function') {
        var cls = window._cchSidebarClassifyItem(it);
        if (cls === 'product' || cls === 'bundle') { hasProduct = true; break; }
        continue;
      }
      if (et === 'product') { hasProduct = true; break; }
      if (!et && typeof window.isRealProduct === 'function' && window.isRealProduct(it)) { hasProduct = true; break; }
    }
    return hasProduct;
  }

  /** Studio-native only — excludes all Houzz-sourced docs (every Follow-Ups lane). */
  function fuDocIsStudioNative(d) {
    return !fuDocIsHouzzSource(d);
  }
  window.cchDocIsStudioNative = fuDocIsStudioNative;
  window.cchIsHouzzSourceDoc = fuDocIsHouzzSource;

  function fuFmtDate(val) {
    var ms = fuTs(val);
    if (!ms) return '';
    return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function fuAgeClass(days) {
    if (days <= 3) return 'a1';
    if (days <= 7) return 'a2';
    return 'a3';
  }

  function fuAgeLabel(days) {
    if (days < 0) return '—';
    if (!days || days >= 365) return '—';
    if (days >= 90) return '90d+';
    if (days <= 0) return 'today';
    if (days === 1) return '1d';
    return days + 'd';
  }

  function fuSnoozeStore() {
    try {
      var raw = localStorage.getItem('cchFollowupsSnooze');
      return raw ? JSON.parse(raw) : {};
    } catch (e) { return {}; }
  }

  function fuIsSnoozed(id) {
    var s = fuSnoozeStore()[id];
    if (!s) return false;
    if (s.until && Date.now() < s.until) return true;
    return false;
  }

  function fuSnooze(id, days) {
    var store = fuSnoozeStore();
    store[id] = { until: Date.now() + (days || 3) * 86400000, at: new Date().toISOString() };
    try { localStorage.setItem('cchFollowupsSnooze', JSON.stringify(store)); } catch (e) {}
    fuRefreshVisible();
  }

  function fuHoldNote(id, note) {
    var store = fuSnoozeStore();
    store[id] = { hold: true, note: note || '', at: new Date().toISOString() };
    try { localStorage.setItem('cchFollowupsSnooze', JSON.stringify(store)); } catch (e) {}
    fuRefreshVisible();
  }

  function fuBoardName(doc) {
    var d = doc.data ? doc.data() : doc;
    return String((d && (d.name || d.title)) || doc.id || '').trim();
  }

  function fuIsActiveProject(status) {
    var st = String(status || 'In Progress').trim();
    return st !== 'Completed' && st !== 'Archived';
  }

  function fuSnapRows(snap) {
    var rows = [];
    if (!snap || !snap.forEach) return rows;
    snap.forEach(function(d) { rows.push({ id: d.id, ...d.data() }); });
    return rows;
  }

  function fuEmptySnap() { return { forEach: function() {} }; }

  async function fuLoadSharedTimeIndex() {
    if (fuCache.sharedTimeByProj && Date.now() - fuCache.sharedTimeAt < SHARED_TIME_TTL_MS) {
      return fuCache.sharedTimeByProj;
    }
    var database = fuDb();
    if (!database) return {};
    var byProj = {};
    var byName = {};
    try {
      var snap = await database.collection('timeEntries').orderBy('date', 'desc').limit(600).get();
      snap.forEach(function(d) {
        var x = d.data() || {};
        var row = { id: d.id, ...x };
        var pid = String(x.projectId || '').trim();
        if (pid) {
          if (!byProj[pid]) byProj[pid] = [];
          if (byProj[pid].length < 40) byProj[pid].push(row);
        }
        var nm = String(x.project || x.projectName || '').trim().toLowerCase();
        if (nm) {
          if (!byName[nm]) byName[nm] = [];
          if (byName[nm].length < 40) byName[nm].push(row);
        }
      });
    } catch (e) {
      console.warn('[follow-ups] shared time index', e);
    }
    fuCache.sharedTimeByProj = { byProj: byProj, byName: byName };
    fuCache.sharedTimeAt = Date.now();
    return fuCache.sharedTimeByProj;
  }

  function fuTimeForProject(projId, projName, sharedIdx) {
    if (!sharedIdx) return [];
    var rows = (sharedIdx.byProj[projId] || []).slice();
    var nm = String(projName || '').trim().toLowerCase();
    if (nm && sharedIdx.byName[nm]) {
      sharedIdx.byName[nm].forEach(function(r) {
        if (!rows.some(function(x) { return x.id === r.id; })) rows.push(r);
      });
    }
    rows.sort(function(a, b) { return (b.date || '').localeCompare(a.date || ''); });
    return rows.slice(0, 40);
  }

  async function fuLoadProjectBundle(projId, projName, clientName, opts) {
    opts = opts || {};
    var light = !!opts.light;
    var sharedIdx = opts.sharedTimeIdx || null;
    var database = fuDb();
    if (!database) return null;
    var bundle = {
      projId: projId,
      projName: projName || projId,
      clientName: clientName || '',
      decisions: [],
      tasks: [],
      proposals: [],
      invoices: [],
      pos: [],
      ideabooks: [],
      whatsNew: [],
      clips: [],
      designBoards: [],
      activity: [],
      timeEntries: []
    };

    var board = database.collection('boards').doc(projId);
    try {
      var core = await Promise.all([
        board.collection('clientDecisions').get().catch(function() { return fuEmptySnap(); }),
        board.collection('tasks').get().catch(function() { return fuEmptySnap(); }),
        board.collection('proposals').get().catch(function() { return fuEmptySnap(); }),
        board.collection('invoices').get().catch(function() { return fuEmptySnap(); }),
        board.collection('purchaseOrders').get().catch(function() { return fuEmptySnap(); }),
        board.collection('whatsNew').orderBy('createdAt', 'desc').limit(10).get()
          .catch(function() { return board.collection('whatsNew').limit(10).get(); })
          .catch(function() { return fuEmptySnap(); }),
        database.collection('activity').where('projectId', '==', projId).orderBy('timestamp', 'desc').limit(40).get()
          .catch(function() { return database.collection('activity').where('projectId', '==', projId).limit(40).get(); })
          .catch(function() { return fuEmptySnap(); })
      ]);
      bundle.decisions = fuSnapRows(core[0]);
      bundle.tasks = fuSnapRows(core[1]);
      bundle.proposals = fuSnapRows(core[2]);
      bundle.invoices = fuSnapRows(core[3]);
      bundle.pos = fuSnapRows(core[4]);
      bundle.whatsNew = fuSnapRows(core[5]);
      bundle.activity = fuSnapRows(core[6]);

      if (!light) {
        var extra = await Promise.all([
          board.collection('ideabooks').get().catch(function() { return fuEmptySnap(); }),
          board.collection('clips').limit(250).get().catch(function() { return fuEmptySnap(); }),
          board.collection('designBoards').get().catch(function() { return fuEmptySnap(); })
        ]);
        bundle.ideabooks = fuSnapRows(extra[0]);
        bundle.clips = fuSnapRows(extra[1]);
        bundle.designBoards = fuSnapRows(extra[2]);
      }
    } catch (e) {
      console.warn('[follow-ups] bundle load', projId, e);
    }

    if (sharedIdx) {
      bundle.timeEntries = fuTimeForProject(projId, projName, sharedIdx);
    } else {
      try {
        var teSnap = await database.collection('timeEntries').where('projectId', '==', projId).orderBy('date', 'desc').limit(40).get()
          .catch(function() { return database.collection('timeEntries').where('projectId', '==', projId).limit(40).get(); })
          .catch(function() { return null; });
        if (teSnap && teSnap.size) bundle.timeEntries = fuSnapRows(teSnap);
      } catch (e) { /* optional */ }
    }

    return bundle;
  }

  function fuLastWhatsNewMs(bundle) {
    var best = 0;
    bundle.whatsNew.forEach(function(w) {
      var ms = fuTs(w.createdAt || w.postedAt || w.date);
      if (ms > best) best = ms;
    });
    return best;
  }

  function fuLastPortalOpenMs(bundle) {
    var best = 0;
    bundle.activity.forEach(function(a) {
      var act = String(a.action || '').toLowerCase();
      if (act.indexOf('portal_open') >= 0 || act === 'client_first_visit') {
        var ms = fuTs(a.timestamp || a.createdAt);
        if (ms > best) best = ms;
      }
    });
    return best;
  }

  function fuOpenItemCount(bundle) {
    var n = 0;
    bundle.decisions.forEach(function(d) {
      var st = String(d.status || 'open').toLowerCase();
      if (st === 'open' || st === 'changes_requested') n++;
    });
    bundle.tasks.forEach(function(t) {
      if (String(t.clientFlag || '') === 'needs_input' && !t.clientResponse) n++;
    });
    bundle.proposals.forEach(function(p) {
      if (String(p.status || '') === 'Sent' && !p.clientApprovedTotalAt) n++;
    });
    bundle.invoices.forEach(function(inv) {
      var bal = parseFloat(inv.balance);
      if (isNaN(bal)) bal = parseFloat(inv.total) - parseFloat(inv.paid || 0);
      var st = String(inv.status || '');
      if ((st === 'Sent' || st === 'Partially Paid') && bal > 0.01) n++;
    });
    return n;
  }

  function fuHoursLast30(bundle) {
    var cutoff = Date.now() - 30 * 86400000;
    return bundle.timeEntries.reduce(function(s, t) {
      var ms = fuTs(t.date);
      if (ms && ms >= cutoff) return s + (parseFloat(t.hours) || 0);
      return s;
    }, 0);
  }

  function fuLastTimeEntryMs(bundle) {
    var best = 0;
    bundle.timeEntries.forEach(function(t) {
      var ms = fuTs(t.date);
      if (ms > best) best = ms;
    });
    return best;
  }

  function fuProposalLinesCoverRoom(proposals, room) {
    if (!room) return false;
    var rLow = String(room).toLowerCase();
    return proposals.some(function(p) {
      if (['Invoiced', 'Cancelled', 'Converted'].indexOf(String(p.status || '')) >= 0) return false;
      return (p.items || []).some(function(it) {
        return String(it.room || it.tag || '').toLowerCase() === rLow;
      });
    });
  }

  function fuDetectStalls(bundle) {
    var stalls = [];
    var admin = fuIsAdmin();
    var clientLabel = bundle.clientName || 'Client';
    var lastWn = fuLastWhatsNewMs(bundle);
    var lastPortal = fuLastPortalOpenMs(bundle);
    var openCount = fuOpenItemCount(bundle);

    function add(row) {
      row.projId = bundle.projId;
      row.projName = bundle.projName;
      row.clientName = bundle.clientName;
      if (!row.id) row.id = bundle.projId + ':' + row.detector + ':' + (row.refId || row.title);
      if (fuIsSnoozed(row.id)) return;
      stalls.push(row);
    }

    // Lane A — waiting on client
    bundle.proposals.forEach(function(p) {
      if (!fuDocIsStudioNative(p)) return;
      if (String(p.status || '') !== 'Sent') return;
      if (p.clientApprovedTotalAt) return;
      var ageFrom = p.sentAt || p.updatedAt || p.createdAt;
      var days = fuDaysSince(ageFrom);
      add({
        lane: 'client',
        detector: 1,
        refId: p.id,
        icon: '📋',
        title: (p.proposalNum || p.name || 'Proposal') + (p.total ? ' · ' + fuMoney(p.total) : '') + ' — sent, no client response',
        sub: 'Sent ' + (fuFmtDate(ageFrom) || '—') + ' · waiting on ' + clientLabel,
        days: days,
        primary: { label: 'Open proposal', action: 'nav', hash: '#/project/' + bundle.projId + '/proposal/' + p.id },
        options: [
          { label: 'Copy nudge', action: 'copy', text: 'Hi — just checking in on proposal ' + (p.proposalNum || p.name || '') + ' (' + fuMoney(p.total) + '). Let us know if you have questions!' },
          { label: 'Snooze 3 days', action: 'snooze', days: 3 },
          { label: 'Hold with note', action: 'hold' }
        ]
      });
    });

    bundle.decisions.forEach(function(d) {
      var st = String(d.status || 'open').toLowerCase();
      if (st !== 'open' && st !== 'changes_requested') return;
      var days = fuDaysSince(d.createdAt || d.updatedAt);
      add({
        lane: 'client',
        detector: 2,
        refId: d.id,
        icon: '◆',
        title: (d.title || 'Decision') + ' — open, unanswered',
        sub: 'Posted ' + (fuFmtDate(d.createdAt) || '—') + ' · ' + clientLabel,
        days: days,
        primary: { label: 'Copy nudge', action: 'copy', text: 'Hi — we posted "' + (d.title || 'a decision') + '" for your review. When you have a moment, please take a look in the client portal.' },
        options: [
          { label: 'Open decisions', action: 'nav', hash: '#/clientview/' + bundle.projId + '/decisions' },
          { label: 'Snooze 3 days', action: 'snooze', days: 3 },
          { label: 'Hold with note', action: 'hold' }
        ]
      });
    });

    bundle.invoices.forEach(function(inv) {
      if (!fuDocIsStudioNative(inv)) return;
      var st = String(inv.status || '');
      if (st !== 'Sent' && st !== 'Partially Paid') return;
      var bal = parseFloat(inv.balance);
      if (isNaN(bal)) bal = (parseFloat(inv.total) || 0) - (parseFloat(inv.paid) || 0);
      if (bal <= 0.01) return;
      var ageFrom = inv.sentAt || inv.createdAt;
      var days = fuDaysSince(ageFrom);
      if (days < 0) return;
      add({
        lane: 'client',
        detector: 3,
        refId: inv.id,
        icon: '🧾',
        title: (inv.invoiceNum || inv.number || 'Invoice') + ' · ' + fuMoney(bal) + ' balance open',
        sub: (st === 'Partially Paid' ? 'Partially paid' : 'Sent') + ' ' + (fuFmtDate(ageFrom) || '—'),
        days: days,
        primary: { label: 'Follow up', action: 'nav', hash: '#/project/' + bundle.projId + '/invoice/' + inv.id },
        options: [
          { label: 'Copy nudge', action: 'copy', text: 'Hi — friendly reminder: invoice ' + (inv.invoiceNum || inv.number || '') + ' has an open balance of ' + fuMoney(bal) + '.' },
          { label: 'Snooze 7 days', action: 'snooze', days: 7 },
          { label: 'Hold with note', action: 'hold' }
        ]
      });
    });

    if (openCount > 0 && lastPortal && fuDaysSince(lastPortal) > PORTAL_STALE_DAYS) {
      add({
        lane: 'client',
        detector: 4,
        refId: 'portal-stale',
        icon: '👁',
        title: 'No client portal visit in ' + fuDaysSince(lastPortal) + ' days',
        sub: openCount + ' open item(s) waiting · last visit ' + fuFmtDate(lastPortal),
        days: fuDaysSince(lastPortal),
        primary: { label: 'Copy nudge', action: 'copy', text: 'Hi — we have updates waiting for you in the client portal. Here is your link to review when convenient.' },
        options: [
          { label: 'Preview portal', action: 'nav', hash: '#/clientview/' + bundle.projId },
          { label: 'Snooze 7 days', action: 'snooze', days: 7 }
        ]
      });
    }

    bundle.tasks.forEach(function(t) {
      if (String(t.clientFlag || '') !== 'needs_input') return;
      if (t.clientResponse) return;
      var days = fuDaysSince(t.dueDate || t.createdAt);
      add({
        lane: 'client',
        detector: 5,
        refId: t.id,
        icon: '✅',
        title: (t.title || t.name || 'Task') + ' — needs client input',
        sub: 'Flagged needs_input · due ' + (fuFmtDate(t.dueDate) || '—'),
        days: days,
        primary: { label: 'Open tasks', action: 'nav', hash: '#/project/' + bundle.projId + '/tasks' },
        options: [
          { label: 'Copy nudge', action: 'copy', text: 'Hi — we need your input on: ' + (t.title || t.name || 'a project task') + '.' },
          { label: 'Snooze 3 days', action: 'snooze', days: 3 }
        ]
      });
    });

    // Lane B — waiting on studio
    bundle.proposals.forEach(function(p) {
      if (!fuDocIsStudioNative(p)) return;
      if (!p.clientApprovedTotalAt) return;
      if (String(p.status || '') === 'Invoiced') return;
      if (p.linkedInvoiceId) return;
      var days = fuDaysSince(p.clientApprovedTotalAt);
      if (days < 0) return;
      add({
        lane: 'studio',
        detector: 6,
        refId: p.id,
        icon: '📋',
        title: (p.proposalNum || p.name || 'Proposal') + ' approved · not invoiced',
        sub: 'Client approved ' + fuFmtDate(p.clientApprovedTotalAt) + ' · ' + fuMoney(p.total),
        days: days,
        primary: { label: 'Create invoice', action: 'nav', hash: '#/project/' + bundle.projId + '/proposal/' + p.id },
        options: [
          { label: 'Open proposal', action: 'nav', hash: '#/project/' + bundle.projId + '/proposal/' + p.id },
          { label: 'Assign to Vanessa', action: 'toast', msg: 'Noted — assign Vanessa (no write in v1)' },
          { label: 'Snooze 3 days', action: 'snooze', days: 3 },
          { label: 'Request quote first', action: 'nav', hash: '#/project/' + bundle.projId + '/workorders', disabled: true, reason: 'Pipeline: quote before invoice when specs incomplete' }
        ]
      });
    });

    bundle.invoices.forEach(function(inv) {
      if (!fuDocIsStudioNative(inv)) return;
      if (!fuInvoiceExpectsPo(inv)) return;
      if (String(inv.status || '') !== 'Paid') return;
      var hasPo = bundle.pos.some(function(po) {
        return po.linkedInvoiceId === inv.id || po.invoiceId === inv.id;
      });
      if (hasPo) return;
      var days = fuDaysSince(inv.paidAt || inv.updatedAt || inv.createdAt);
      if (days < 0) return;
      add({
        lane: 'studio',
        detector: 7,
        refId: inv.id,
        icon: '📦',
        title: (inv.invoiceNum || inv.number || 'Invoice') + ' paid · no PO placed',
        sub: 'Paid ' + fuFmtDate(inv.paidAt || inv.updatedAt) + ' · ' + fuMoney(inv.total),
        days: days,
        primary: { label: 'Create PO', action: 'nav', hash: '#/project/' + bundle.projId + '/pos' },
        options: [
          { label: 'Open invoice', action: 'nav', hash: '#/project/' + bundle.projId + '/invoice/' + inv.id },
          { label: 'Snooze 3 days', action: 'snooze', days: 3 }
        ]
      });
    });

    bundle.decisions.forEach(function(d) {
      if (!fuDocIsStudioNative(d)) return;
      var st = String(d.status || '').toLowerCase();
      if (st !== 'answered' && st !== 'approved' && st !== 'declined') return;
      if (d.studioFollowedUp) return;
      var respMs = fuTs(d.clientRespondedAt || d.answeredAt || d.updatedAt);
      if (!respMs) return;
      var days = fuDaysSince(respMs);
      if (days < 0) return;
      add({
        lane: 'studio',
        detector: 8,
        refId: d.id,
        icon: '◆',
        title: (d.title || 'Decision') + ' — client responded, no studio follow-through',
        sub: 'Response ' + fuFmtDate(respMs) + ' · check selections / proposal lines',
        days: days,
        primary: { label: 'Open selections', action: 'nav', hash: '#/project/' + bundle.projId + '/selections' },
        options: [
          { label: 'Open decisions', action: 'nav', hash: '#/clientview/' + bundle.projId + '/decisions' },
          { label: 'Snooze 3 days', action: 'snooze', days: 3 }
        ]
      });
    });

    bundle.designBoards.forEach(function(dbRow) {
      var upd = fuTs(dbRow.updatedAt || dbRow.createdAt);
      if (!upd) return;
      var posted = bundle.decisions.some(function(d) {
        var dMs = fuTs(d.createdAt);
        return dMs >= upd - 86400000 && String(d.title || '').toLowerCase().indexOf(String(dbRow.name || '').toLowerCase()) >= 0;
      });
      if (posted) return;
      var days = fuDaysSince(upd);
      if (days < 2) return;
      add({
        lane: 'studio',
        detector: 9,
        refId: dbRow.id,
        icon: '🎨',
        title: (dbRow.name || 'Design board') + ' edited · not posted as decision',
        sub: 'Updated ' + fuFmtDate(upd) + ' · share with client when ready',
        days: days,
        primary: { label: 'Open design board', action: 'nav', hash: '#/project/' + bundle.projId + '/designboard/' + dbRow.id },
        options: [
          { label: 'Post decision', action: 'nav', hash: '#/clientview/' + bundle.projId + '/decisions' },
          { label: 'Snooze 3 days', action: 'snooze', days: 3 }
        ]
      });
    });

    var roomsWithClips = {};
    bundle.clips.forEach(function(c) {
      var room = String(c.room || '').trim();
      if (!room || room.toLowerCase() === 'unassigned') return;
      if (!roomsWithClips[room]) roomsWithClips[room] = 0;
      roomsWithClips[room]++;
    });
    Object.keys(roomsWithClips).forEach(function(room) {
      if (roomsWithClips[room] < 2) return;
      if (fuProposalLinesCoverRoom(bundle.proposals, room)) return;
      add({
        lane: 'studio',
        detector: 10,
        refId: 'room-' + room,
        icon: '🛍️',
        title: room + ' selections complete · no proposal coverage',
        sub: roomsWithClips[room] + ' items in room · draft or send a proposal',
        days: 14,
        primary: { label: 'Open proposals', action: 'nav', hash: '#/project/' + bundle.projId + '/proposals' },
        options: [
          { label: 'View selections', action: 'nav', hash: '#/project/' + bundle.projId + '/selections' },
          { label: 'Snooze 7 days', action: 'snooze', days: 7 }
        ]
      });
    });

    bundle.ideabooks.forEach(function(ib) {
      var ibMs = fuTs(ib.updatedAt || ib.createdAt);
      if (!ibMs) return;
      if (lastWn && ibMs <= lastWn) return;
      var days = fuDaysSince(ibMs);
      if (days < 2) return;
      add({
        lane: 'studio',
        detector: 11,
        refId: ib.id,
        icon: '💡',
        title: (ib.name || ib.title || 'Inspiration') + ' updated · not shared via What\'s New',
        sub: 'Updated ' + fuFmtDate(ibMs) + (lastWn ? ' · last client update ' + fuFmtDate(lastWn) : ''),
        days: days,
        primary: { label: 'Post What\'s New', action: 'nav', hash: '#/project/' + bundle.projId + '/comms' },
        options: [
          { label: 'Open inspiration', action: 'nav', hash: '#/project/' + bundle.projId + '/ideabooks' },
          { label: 'Snooze 3 days', action: 'snooze', days: 3 }
        ]
      });
    });

    var weekAgo = Date.now() - 7 * 86400000;
    var hrsWeek = bundle.timeEntries.reduce(function(s, t) {
      var ms = fuTs(t.date);
      return (ms >= weekAgo) ? s + (parseFloat(t.hours) || 0) : s;
    }, 0);
    if (hrsWeek >= 0.5 && lastWn && fuTs(bundle.timeEntries[0] && bundle.timeEntries[0].date) > lastWn) {
      add({
        lane: 'studio',
        detector: 12,
        refId: 'hours-no-wn',
        icon: '⏱',
        title: hrsWeek.toFixed(1) + 'h logged this week · no What\'s New posted',
        sub: 'Client may not see recent studio work',
        days: fuDaysSince(lastWn),
        primary: { label: 'Post update', action: 'nav', hash: '#/project/' + bundle.projId + '/comms' },
        options: [
          { label: 'Open time', action: 'nav', hash: '#/project/' + bundle.projId + '/time' },
          { label: 'Snooze 3 days', action: 'snooze', days: 3 }
        ]
      });
    }

    var lastTime = fuLastTimeEntryMs(bundle);
    var noTimeDays = lastTime ? fuDaysSince(lastTime) : -1;
    if (lastTime && noTimeDays >= 0 && noTimeDays > META_STALL_DAYS) {
      add({
        lane: 'studio',
        detector: 13,
        refId: 'no-time',
        icon: '⏱',
        title: 'No hours logged in ' + noTimeDays + ' days on active project',
        sub: 'Last entry ' + fuFmtDate(lastTime),
        days: noTimeDays,
        primary: { label: 'Open Time Ledger', action: 'nav', hash: '#/project/' + bundle.projId + '/time' },
        options: [
          { label: 'Log time', action: 'fn', call: 'showNewTimeEntryModal', args: { project: bundle.projName } },
          { label: 'Snooze 7 days', action: 'snooze', days: 7 }
        ]
      });
    }

    stalls.sort(function(a, b) { return (b.days || 0) - (a.days || 0); });
    return stalls;
  }

  async function fuScanProjects(scopeProjId, onProgress, opts) {
    opts = opts || {};
    var force = !!opts.force;
    var gen = ++fuState.scanGen;
    fuState.loading = true;

    if (!force && scopeProjId && fuCache.byProject[scopeProjId] && Date.now() - fuCache.byProject[scopeProjId].at < CACHE_TTL_MS) {
      var cachedOne = fuCache.byProject[scopeProjId];
      fuState.byProject[scopeProjId] = cachedOne.pack;
      fuState.loading = false;
      return cachedOne.stalls;
    }
    if (!force && !scopeProjId && fuCache.globalStalls && Date.now() - fuCache.globalAt < CACHE_TTL_MS) {
      fuState.globalStalls = fuCache.globalStalls;
      fuState.byProject = fuCache.byProject || {};
      fuState.loading = false;
      fuState.lastScan = fuCache.globalAt;
      fuInjectNavBadge();
      return fuCache.globalStalls;
    }

    var projects = [];
    try {
      if (typeof getCachedBoards === 'function') {
        var snap = await getCachedBoards();
        snap.forEach(function(d) {
          if (scopeProjId && d.id !== scopeProjId) return;
          if (d.id === '_lib_designer') return;
          var data = d.data() || {};
          if (!scopeProjId && !fuIsActiveProject(data.status)) return;
          projects.push({ id: d.id, name: data.name || d.id, clientName: data.clientName || data.client || '', status: data.status });
        });
      }
    } catch (e) {
      console.warn('[follow-ups] boards', e);
    }

    if (scopeProjId && !projects.length) {
      projects.push({ id: scopeProjId, name: scopeProjId, clientName: '', status: 'In Progress' });
    }

    var light = !scopeProjId;
    var sharedIdx = null;
    if (light || projects.length > 1) sharedIdx = await fuLoadSharedTimeIndex();
    if (gen !== fuState.scanGen) return fuState.globalStalls;

    var allStalls = [];
    if (!scopeProjId) fuState.byProject = {};
    var done = 0;
    var total = projects.length;

    async function scanOne(p) {
      if (gen !== fuState.scanGen) return;
      var bundle = await fuLoadProjectBundle(p.id, p.name, p.clientName, { light: light, sharedTimeIdx: sharedIdx });
      if (!bundle || gen !== fuState.scanGen) return;
      var stalls = fuDetectStalls(bundle);
      fuState.byProject[p.id] = { project: p, bundle: bundle, stalls: stalls };
      stalls.forEach(function(s) { allStalls.push(s); });
      fuCache.byProject[p.id] = { at: Date.now(), stalls: stalls, pack: fuState.byProject[p.id] };
    }

    try {
      for (var i = 0; i < projects.length; i += SCAN_BATCH) {
        if (gen !== fuState.scanGen) break;
        var batch = projects.slice(i, i + SCAN_BATCH);
        await Promise.all(batch.map(scanOne));
        done = Math.min(i + SCAN_BATCH, total);
        if (typeof onProgress === 'function') onProgress(done, total);
      }
    } finally {
      if (gen === fuState.scanGen) {
        allStalls.sort(function(a, b) { return (b.days || 0) - (a.days || 0); });
        fuState.globalStalls = scopeProjId ? allStalls : allStalls;
        if (!scopeProjId) {
          fuCache.globalStalls = allStalls;
          fuCache.globalAt = Date.now();
          fuCache.byProject = fuState.byProject;
        }
        fuState.loading = false;
        fuState.lastScan = Date.now();
        fuInjectNavBadge();
      }
    }
    return scopeProjId ? (fuState.byProject[scopeProjId] && fuState.byProject[scopeProjId].stalls) || [] : allStalls;
  }

  function fuStatCard(value, label, accent) {
    return '<div class="fu-stat" style="border-left:3px solid ' + accent + ';">' +
      '<b>' + fuEsc(String(value)) + '</b><span>' + fuEsc(label) + '</span></div>';
  }

  function fuRenderBoard(stalls, opts) {
    opts = opts || {};
    var admin = fuIsAdmin();
    var clientLane = stalls.filter(function(s) { return s.lane === 'client'; });
    var studioLane = stalls.filter(function(s) { return s.lane === 'studio'; });
    var oldest = stalls.length ? Math.max.apply(null, stalls.map(function(s) { return s.days || 0; })) : 0;
    var hrs30 = 0;
    if (opts.bundle) hrs30 = fuHoursLast30(opts.bundle);

    var subtitle = opts.scopeName
      ? (stalls.length + ' stalled handoff' + (stalls.length === 1 ? '' : 's') + ' · ' + opts.scopeName)
      : (stalls.length + ' stalled handoffs across ' + Object.keys(fuState.byProject).length + ' active projects');

    var adminExtra = admin && opts.showLeakage
      ? fuStatCard('—', 'Revenue at risk (admin)', '#0E1629')
      : '';

    var oldestAccent = oldest > 30 ? '#7C2D12' : oldest > 7 ? '#8A7030' : '#9CA3AF';
    var oldestVal = oldest >= 90 ? '90d+' : (oldest ? (oldest + 'd') : '—');

    var html = '<div class="fu-wrap">' +
      '<div class="fu-header"><h1>Follow-Ups</h1><div class="fu-sub">' + fuEsc(subtitle) + '</div></div>' +
      '<div class="fu-statrow">' +
        fuStatCard(clientLane.length, 'Waiting on client', '#C9A96E') +
        fuStatCard(studioLane.length, 'Waiting on you', '#0E1629') +
        (opts.bundle ? fuStatCard(hrs30.toFixed(1), 'Hrs · 30 days', '#0E1629') : '') +
        fuStatCard(oldestVal, 'Oldest stall', oldestAccent) +
        adminExtra +
      '</div>';

    html += fuLaneHtml('Waiting on ' + (opts.clientLabel || 'client'), clientLane, opts);
    html += fuLaneHtml('Waiting on you & studio', studioLane, opts);
    html += '</div>';
    return html;
  }

  function fuLaneHtml(title, rows, opts) {
    if (!rows.length) {
      return '<div class="fu-lane-h"><h2>' + fuEsc(title) + '</h2></div>' +
        '<div class="fu-card"><div class="fu-row fu-empty">No stalls in this lane.</div></div>';
    }
    var html = '<div class="fu-lane-h"><h2>' + fuEsc(title) + '</h2></div><div class="fu-card">';
    rows.forEach(function(r) {
      var ageCls = fuAgeClass(r.days || 0);
      var projPrefix = opts.crossProject ? '<span class="fu-proj">' + fuEsc(r.projName) + ' · </span>' : '';
      html += '<div class="fu-row" data-fu-id="' + fuEscAttr(r.id) + '">' +
        '<div class="fu-ic">' + r.icon + '</div>' +
        '<div class="fu-rmain">' +
          '<div class="fu-rtitle">' + projPrefix + fuEsc(r.title) + '</div>' +
          '<div class="fu-rsub">' + fuEsc(r.sub || '') + '</div>' +
        '</div>' +
        '<span class="fu-age ' + ageCls + '">' + fuAgeLabel(r.days || 0) + '</span>' +
        '<button type="button" class="fu-btn primary" onclick="window._cchFuAction(\'' + fuEscAttr(r.id) + '\',\'primary\')">' + fuEsc(r.primary.label) + '</button>' +
        '<button type="button" class="fu-btn fu-menu" onclick="window._cchFuToggleMenu(\'' + fuEscAttr(r.id) + '\')" title="More actions">⋯</button>' +
        '<div class="fu-menu-pop" id="fuMenu-' + fuEscAttr(r.id) + '" style="display:none;"></div>' +
      '</div>';
    });
    html += '</div>';
    return html;
  }

  function fuFindRow(id) {
    var all = fuState.globalStalls || [];
    for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i];
    return null;
  }

  window._cchFuAction = function(id, which, optIdx) {
    var row = fuFindRow(id);
    if (!row) return;
    var act = which === 'primary' ? row.primary : (row.options && row.options[optIdx]);
    if (!act || act.disabled) {
      if (act && act.reason && typeof showToast === 'function') showToast(act.reason, 'info');
      return;
    }
    if (act.action === 'nav' && act.hash && typeof navigate === 'function') navigate(act.hash);
    else if (act.action === 'copy' && act.text) {
      try {
        navigator.clipboard.writeText(act.text);
        if (typeof showToast === 'function') showToast('Copied to clipboard', 'success');
      } catch (e) {
        prompt('Copy:', act.text);
      }
    } else if (act.action === 'snooze') fuSnooze(id, act.days || 3);
    else if (act.action === 'hold') {
      var note = prompt('Hold note (optional):', '');
      if (note !== null) fuHoldNote(id, note);
    } else if (act.action === 'toast' && typeof showToast === 'function') showToast(act.msg || 'Noted', 'info');
    else if (act.action === 'fn' && act.call && typeof window[act.call] === 'function') window[act.call](act.args || {});
    window._cchFuCloseMenus();
  };

  window._cchFuToggleMenu = function(id) {
    window._cchFuCloseMenus();
    var row = fuFindRow(id);
    var pop = document.getElementById('fuMenu-' + id);
    if (!row || !pop) return;
    var html = '';
    (row.options || []).forEach(function(opt, idx) {
      var dis = opt.disabled ? ' disabled' : '';
      html += '<button type="button" class="fu-menu-item' + dis + '" onclick="window._cchFuAction(\'' + fuEscAttr(id) + '\',\'opt\',' + idx + ')">' + fuEsc(opt.label) + '</button>';
    });
    pop.innerHTML = html;
    pop.style.display = 'block';
  };

  window._cchFuCloseMenus = function() {
    document.querySelectorAll('.fu-menu-pop').forEach(function(el) { el.style.display = 'none'; });
  };

  function fuInjectStyles() {
    if (document.getElementById('cchFollowupsStyles')) return;
    var st = document.createElement('style');
    st.id = 'cchFollowupsStyles';
    st.textContent =
      '.fu-wrap{font-family:var(--font-body,"DM Sans",sans-serif);color:#1B3352;}' +
      '.fu-header{margin-bottom:18px;}' +
      '.fu-header h1{font-family:var(--font-display,"Playfair Display",serif);font-size:26px;font-weight:600;color:#0A1F3D;margin:0;}' +
      '.fu-sub{font-size:12px;color:#6B7280;margin-top:4px;}' +
      '.fu-statrow{display:flex;gap:12px;margin:18px 0 24px;flex-wrap:wrap;}' +
      '.fu-stat{background:#fff;border:1px solid #E2E2E2;padding:10px 16px;min-width:130px;}' +
      '.fu-stat b{display:block;font-size:20px;font-family:var(--font-mono,monospace);font-weight:600;color:#0A1F3D;}' +
      '.fu-stat span{font-size:9.5px;letter-spacing:.1em;text-transform:uppercase;color:#9CA3AF;}' +
      '.fu-lane-h{display:flex;align-items:center;gap:10px;margin:22px 0 8px;}' +
      '.fu-lane-h h2{font-size:10.5px;letter-spacing:.16em;text-transform:uppercase;font-weight:600;color:#0A1F3D;margin:0;}' +
      '.fu-lane-h::after{content:"";flex:1;height:1px;background:#E2E2E2;}' +
      '.fu-card{background:#fff;border:1px solid #E2E2E2;}' +
      '.fu-row{display:flex;align-items:center;gap:14px;padding:13px 18px;border-bottom:1px solid #F0F0F0;position:relative;flex-wrap:wrap;}' +
      '.fu-row:last-child{border-bottom:none;}' +
      '.fu-row.fu-empty{color:#9CA3AF;font-size:13px;justify-content:center;}' +
      '.fu-ic{width:34px;height:34px;min-width:34px;display:flex;align-items:center;justify-content:center;border:1px solid #E2E2E2;font-size:14px;background:#FAFAFA;}' +
      '.fu-rmain{flex:1;min-width:180px;}' +
      '.fu-rtitle{font-size:13.5px;font-weight:600;color:#0A1F3D;}' +
      '.fu-rsub{font-size:11.5px;color:#6B7280;margin-top:2px;}' +
      '.fu-proj{color:#9CA3AF;font-weight:500;}' +
      '.fu-age{font-family:var(--font-mono,monospace);font-size:11px;font-weight:600;padding:3px 9px;white-space:nowrap;border-radius:2px;}' +
      '.fu-age.a1{color:#6B5A3E;background:#F7F4ED;}' +
      '.fu-age.a2{color:#7C5E2A;background:#F3EFE6;}' +
      '.fu-age.a3{color:#5C4033;background:#EDE9E4;}' +
      '.fu-btn{font:600 11px var(--font-body,"DM Sans",sans-serif);padding:6px 12px;cursor:pointer;border:1px solid #D1D5DB;background:#fff;color:#0A1F3D;white-space:nowrap;border-radius:2px;}' +
      '.fu-btn:hover{background:#F9FAFB;border-color:#9CA3AF;}' +
      '.fu-btn.primary{background:#fff;color:#0A1F3D;border:1px solid #0A1F3D;font-weight:600;}' +
      '.fu-btn.primary:hover{background:#0A1F3D;color:#fff;}' +
      '.fu-btn.fu-menu{padding:6px 10px;min-width:32px;color:#6B7280;}' +
      '.fu-menu-pop{position:absolute;right:18px;top:100%;background:#fff;border:1px solid #E2E2E2;box-shadow:0 4px 12px rgba(0,0,0,.08);z-index:20;min-width:180px;}' +
      '.fu-menu-item{display:block;width:100%;text-align:left;padding:8px 12px;border:none;background:#fff;font-size:12px;cursor:pointer;}' +
      '.fu-menu-item:hover{background:#FBF7EE;}' +
      '.fu-menu-item:disabled{opacity:.45;cursor:not-allowed;}';
    document.head.appendChild(st);
  }

  async function fuRenderGlobal() {
    if (!fuEnabled()) return;
    fuInjectStyles();
    var T = document.getElementById('contentArea');
    if (!T) return;
    if (typeof setBreadcrumb === 'function') setBreadcrumb([{ label: 'Follow-Ups' }]);
    if (typeof setTopbarActions === 'function') setTopbarActions('<button class="btn btn-secondary btn-sm" onclick="window._cchFuRefresh(true)">↻ Refresh</button>');

    var cached = fuCache.globalStalls && Date.now() - fuCache.globalAt < CACHE_TTL_MS;
    if (cached) {
      fuState.globalStalls = fuCache.globalStalls;
      fuState.byProject = fuCache.byProject || {};
      T.innerHTML = fuRenderBoard(fuCache.globalStalls, { crossProject: true, showLeakage: true }) +
        '<div style="font-size:11px;color:#9CA3AF;margin-top:8px;">Cached · refreshing in background…</div>';
      fuScanProjects(null, null, { force: true }).then(function(stalls) {
        if (T && (location.hash || '').indexOf('followups') >= 0) {
          T.innerHTML = fuRenderBoard(stalls, { crossProject: true, showLeakage: true });
        }
      }).catch(function() {});
      return;
    }

    T.innerHTML = '<div style="text-align:center;padding:60px;color:#9CA3AF;">Scanning active projects…</div>';
    try {
      var stalls = await fuScanProjects(null, function(done, total) {
        if (T) T.innerHTML = '<div style="text-align:center;padding:60px;color:#9CA3AF;">Scanning… ' + done + ' / ' + total + ' projects</div>';
      }, { force: true });
      T.innerHTML = fuRenderBoard(stalls, { crossProject: true, showLeakage: true });
    } catch (e) {
      console.error('[follow-ups]', e);
      T.innerHTML = '<div style="padding:40px;color:#B91C1C;">Could not load Follow-Ups. <button class="btn btn-secondary btn-sm" onclick="window._cchFuRefresh(true)">Retry</button></div>';
    }
  }
  window.__cchFuRenderGlobal = fuRenderGlobal;

  async function fuRenderProject(T, proj) {
    if (!fuEnabled() || !T || !proj) return;
    fuInjectStyles();
    var cached = fuCache.byProject[proj.id] && Date.now() - fuCache.byProject[proj.id].at < CACHE_TTL_MS;
    if (cached) {
      var pack0 = fuCache.byProject[proj.id].pack;
      T.innerHTML = fuRenderBoard(pack0.stalls || [], {
        scopeName: proj.name || proj.id,
        clientLabel: proj.clientName || 'client',
        bundle: pack0.bundle
      });
      fuScanProjects(proj.id, null, { force: true }).then(function() {
        var pack = fuState.byProject[proj.id] || pack0;
        if (T && typeof currentProjectTab !== 'undefined' && currentProjectTab === 'followups') {
          T.innerHTML = fuRenderBoard(pack.stalls || [], {
            scopeName: proj.name || proj.id,
            clientLabel: proj.clientName || 'client',
            bundle: pack.bundle
          });
        }
      }).catch(function() {});
      return;
    }
    T.innerHTML = '<div style="text-align:center;padding:40px;color:#9CA3AF;">Loading follow-ups…</div>';
    try {
      await fuScanProjects(proj.id, null, { force: true });
      var pack = fuState.byProject[proj.id] || { stalls: [], bundle: null };
      T.innerHTML = fuRenderBoard(pack.stalls || [], {
        scopeName: proj.name || proj.id,
        clientLabel: proj.clientName || 'client',
        bundle: pack.bundle
      });
    } catch (e) {
      console.error('[follow-ups] project', e);
      T.innerHTML = '<div style="padding:40px;color:#B91C1C;">Could not load follow-ups.</div>';
    }
  }
  window.__cchFuRenderProjectTab = fuRenderProject;

  window._cchFuRefresh = function(force) {
    if (force) {
      fuCache.globalAt = 0;
      if (typeof currentProjectId !== 'undefined' && currentProjectId) delete fuCache.byProject[currentProjectId];
    }
    var parts = (location.hash || '').replace(/^#\/?/, '').split('/').filter(Boolean);
    if (parts[0] === 'followups') fuRenderGlobal();
    else if (parts[0] === 'project' && parts[2] === 'followups' && typeof renderProjectDetail === 'function') renderProjectDetail();
  };

  window._cchFuPrefetch = function(projId) {
    if (!fuEnabled() || !projId) return Promise.resolve();
    if (fuCache.byProject[projId] && Date.now() - fuCache.byProject[projId].at < CACHE_TTL_MS) return Promise.resolve();
    return fuScanProjects(projId);
  };

  function fuRefreshVisible() {
    window._cchFuRefresh();
  }

  window._cchFuGetBadgeCounts = function(projId) {
    if (!fuEnabled()) return { total: 0, hot: 0 };
    if (projId && fuState.byProject[projId]) {
      var n = fuState.byProject[projId].stalls.length;
      return { total: n, hot: n };
    }
    var t = fuState.globalStalls.length;
    return { total: t, hot: t };
  };

  /** Plain-text Follow-Ups stalls for Pepper digests (read-only). Pass projId for one project; omit/empty for firm-wide. */
  window._cchFuPepperDigest = async function(projId) {
    if (!fuEnabled()) return '';
    var firm = !projId;
    try {
      var stalls = await fuScanProjects(firm ? null : projId);
      if (!stalls || !stalls.length) {
        return firm
          ? 'FIRM-WIDE FOLLOW-UPS — no stalled handoffs across active projects.'
          : 'Follow-Ups: no stalled handoffs.';
      }
      var client = stalls.filter(function(s) { return s.lane === 'client'; });
      var studio = stalls.filter(function(s) { return s.lane === 'studio'; });
      var lines = firm
        ? [
            'FIRM-WIDE FOLLOW-UPS — staff is on the overall Follow-Ups page. Answer the big picture. Do not ask them to open a project first.',
            'Stalls: ' + stalls.length + ' across active projects.'
          ]
        : ['Follow-Ups (' + stalls.length + ' stalls):'];
      function addLane(label, rows) {
        if (!rows.length) return;
        lines.push(label + ' (' + rows.length + '):');
        rows.slice(0, firm ? 40 : 25).forEach(function(s) {
          var projBit = firm && s.projName ? (s.projName + ' · ') : '';
          lines.push('- [' + (s.days != null ? s.days + 'd' : '?') + '] ' + projBit + (s.title || 'stall') + (s.sub ? ' — ' + s.sub : ''));
        });
        if (rows.length > (firm ? 40 : 25)) {
          lines.push('- … +' + (rows.length - (firm ? 40 : 25)) + ' more in ' + label.toLowerCase());
        }
      }
      addLane('Waiting on client', client);
      addLane('Waiting on studio', studio);
      if (firm) {
        lines.push('');
        lines.push('When asked what matters most: prioritize oldest days + client-lane stalls that block money or approvals. Name project + item. Draft nudges only; never claim you emailed.');
      }
      return lines.join('\n');
    } catch (e) {
      console.warn('[follow-ups] pepper digest', e);
      return '';
    }
  };

  function fuInjectNavItem() {
    if (document.getElementById('navFollowUps')) return;
    if (document.querySelector('.nav-item[data-page="followups"]')) return;
    var dash = document.querySelector('.nav-item[data-page="dashboard"]');
    if (!dash || !dash.parentNode) return;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'nav-item';
    btn.id = 'navFollowUps';
    btn.setAttribute('data-page', 'followups');
    btn.innerHTML = '<span class="nav-icon">◎</span><span class="nav-label">Follow-Ups</span><span class="nav-badge" id="fuNavBadge" style="display:none;"></span>';
    btn.onclick = function(e) {
      e.stopImmediatePropagation();
      if (typeof navigate === 'function') navigate('#/followups');
    };
    dash.parentNode.insertBefore(btn, dash.nextSibling);
  }

  function fuInjectNavBadge() {
    var badge = document.getElementById('fuNavBadge');
    if (!badge) return;
    var n = fuState.globalStalls.length;
    if (n > 0) {
      badge.textContent = String(n);
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

  function fuWrapNavigate() {
    if (!window.navigate || window.navigate._fuWrapped) return;
    var orig = window.navigate;
    window.navigate = function(hash) {
      if (!fuEnabled()) return orig.apply(this, arguments);
      var rawHash = String(hash || '#/projects').trim();
      if (rawHash.startsWith('#') && !rawHash.startsWith('#/')) {
        if (/^#(project|clientview|clientboard|clientportal)\//i.test(rawHash)) rawHash = '#/' + rawHash.slice(1);
      }
      var parts = rawHash.replace(/^#\/?/, '').split('/').filter(Boolean);
      var page = (parts[0] || 'projects').toLowerCase();
      if (page === 'followups') {
        if (!currentUser) return;
        document.querySelectorAll('.nav-item').forEach(function(n) { n.classList.remove('active'); });
        var activeNav = document.querySelector('.nav-item[data-page="followups"]');
        if (activeNav) activeNav.classList.add('active');
        window.location.hash = rawHash;
        fuRenderGlobal();
        return;
      }
      return orig.apply(this, arguments);
    };
    window.navigate._fuWrapped = true;
  }

  function fuWrapRenderProjectDetail() {
    if (!window.renderProjectDetail || window.renderProjectDetail._fuWrapped) return;
    var orig = window.renderProjectDetail;
    window.renderProjectDetail = async function() {
      await orig.apply(this, arguments);
      try {
        if (typeof currentProjectTab !== 'undefined' && currentProjectTab === 'followups' && fuEnabled()) {
          var T = document.getElementById('projectTabContent');
          var proj = window._currentProject;
          if (T && proj) await fuRenderProject(T, proj);
        }
      } catch (e) { console.warn('[follow-ups] project hook', e); }
    };
    window.renderProjectDetail._fuWrapped = true;
  }

  function fuOnHash() {
    if (!fuEnabled()) return;
    var parts = (location.hash || '').replace(/^#\/?/, '').split('/').filter(Boolean);
    if (parts[0] === 'followups') fuRenderGlobal();
  }

  function fuInit() {
    if (!fuEnabled()) return;
    fuInjectNavItem();
    fuInjectStyles();
    fuWrapNavigate();
    fuWrapRenderProjectDetail();
    document.addEventListener('click', function(e) {
      if (!e.target.closest('.fu-menu') && !e.target.closest('.fu-menu-pop')) window._cchFuCloseMenus();
    });
    window.addEventListener('hashchange', fuOnHash);
    if ((location.hash || '').indexOf('followups') >= 0) setTimeout(fuOnHash, 300);
    var tries = 0;
    var wt = setInterval(function() {
      fuWrapNavigate();
      fuWrapRenderProjectDetail();
      if (++tries > 24) clearInterval(wt);
    }, 500);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fuInit);
  else fuInit();

  console.info('[CCH Follow-Ups] build ' + BUILD + ' — localStorage cchFollowups=0 to disable');
})();
