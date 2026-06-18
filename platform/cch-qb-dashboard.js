/**
 * QuickBooks hub — sync dashboard, account mapping, connection (CCH Studio).
 * Loaded after index.html globals (esc, getQbId, pushDocToQB, loadFinancialData, …).
 */
(function() {
  'use strict';

  var CCH_QB_PRODUCT_CATEGORIES = [
    'Lighting', 'Mirrors & Accessories', 'Accessories', 'Furniture & Upholstery',
    'Fabric & Trim', 'Cabinet Hardware', 'Window Hardware', 'Bedding & Pillows',
    'Custom Pillows & Bedding', 'Custom Window Treatments', 'Windows', 'Wall',
    'Wall Covering', 'Appliances & Plumbing', 'Floor Covering', 'Rugs', 'Stone & Tile',
    'Cabinets', 'Florals', 'Art', 'Architectural', 'Design Services', 'Freight', 'Labor'
  ];

  /** Service / non-FFE categories — match QB P&L (R2 design fees, R3 shipping, C2 freight COGS, C6 cost of labor). */
  var CCH_QB_CATEGORY_BUILTIN = {
    'Design Services': { income: 'R2', expense: 'C4' },
    'Freight': { income: 'R3', expense: 'C2' },
    'Labor': { income: 'R2', expense: 'C6' }
  };

  var QB_CHART_ACCOUNTS = [
    { code: 'R1', label: 'R1 — Studio Product Sales', kind: 'income' },
    { code: 'R2', label: 'R2 — Studio Design Fees', kind: 'income' },
    { code: 'R3', label: 'R3 — Studio Shipping', kind: 'income' },
    { code: 'R4', label: 'R4 — Studio Prepaid Tax', kind: 'income' },
    { code: 'R5', label: 'R5 — Studio Reimbursable', kind: 'income' },
    { code: 'C1', label: 'C1 — Studio Product Cost', kind: 'expense' },
    { code: 'C2', label: 'C2 — Studio Freight/Shipping', kind: 'expense' },
    { code: 'C3', label: 'C3 — Studio Sales Tax Paid', kind: 'expense' },
    { code: 'C4', label: 'C4 — Studio Subcontractors', kind: 'expense' },
    { code: 'C5', label: 'C5 — Studio Samples', kind: 'expense' },
    { code: 'C6', label: 'C6 — Cost of Labor', kind: 'expense' }
  ];

  window._qbHub = window._qbHub || {
    tab: 'dashboard',
    connectionOk: null,
    filter: { q: '', type: 'all', status: 'all', project: '' },
    rows: []
  };

  function esc(s) { return typeof window.esc === 'function' ? window.esc(s) : String(s == null ? '' : s); }
  function escAttr(s) { return typeof window.escAttr === 'function' ? window.escAttr(s) : esc(s); }
  function formatMoney(n) { return typeof window.formatMoney === 'function' ? window.formatMoney(n) : String(n); }

  function qbIncomeOptions(selected) {
    return QB_CHART_ACCOUNTS.filter(function(a) { return a.kind === 'income'; })
      .map(function(a) {
        return '<option value="' + escAttr(a.code) + '"' + (a.code === selected ? ' selected' : '') + '>' + esc(a.label) + '</option>';
      }).join('');
  }

  function qbExpenseOptions(selected) {
    return QB_CHART_ACCOUNTS.filter(function(a) { return a.kind === 'expense'; })
      .map(function(a) {
        return '<option value="' + escAttr(a.code) + '"' + (a.code === selected ? ' selected' : '') + '>' + esc(a.label) + '</option>';
      }).join('');
  }

  /** Income/expense R#/C# for a Studio category — built-ins for service lines; migrates stale R1/C1 bulk saves. */
  function qbResolvedCategoryAccounts(cat, map, defaults) {
    defaults = defaults || {};
    var incDef = defaults.income || 'R1';
    var expDef = defaults.expense || 'C1';
    var built = CCH_QB_CATEGORY_BUILTIN[cat];
    var m = (map && map[cat]) || {};
    if (built) {
      var inc = m.income || built.income;
      var exp = m.expense || built.expense;
      if (m.income === incDef && built.income !== incDef) inc = built.income;
      if (m.expense === expDef && built.expense !== expDef) exp = built.expense;
      return { income: inc, expense: exp };
    }
    return {
      income: m.income || incDef,
      expense: m.expense || expDef
    };
  }
  window.qbResolvedCategoryAccounts = qbResolvedCategoryAccounts;

  function qbDocNumber(doc, type) {
    if (type === 'invoice') {
      return doc.invoiceNum || doc.number || doc.name || doc.num || (doc.id || '').slice(0, 8);
    }
    return doc.poNum || doc.number || doc.name || doc.num || (doc.id || '').slice(0, 8);
  }

  function qbSyncStatusForDoc(doc, type, opts) {
    opts = opts || {};
    var conn = opts.connectionOk === true;
    var getQbId = window.getQbId || function() { return ''; };
    var qbId = getQbId(doc);
    var items = doc.items || [];
    var st = String(doc.status || '').toLowerCase();

    if (opts.connectionOk === false) {
      return {
        key: 'connection',
        label: 'QB disconnected',
        detail: 'Open the Connection tab and reconnect QuickBooks. Sync is blocked until the firm link works.',
        color: '#B45309',
        icon: '⚠'
      };
    }
    if (qbId) {
      var paidNote = '';
      if (type === 'invoice' && typeof window.invoiceCanRefreshFromQb === 'function' && window.invoiceCanRefreshFromQb(doc)) {
        paidNote = ' Use ↻ Sync QB paid on the invoice to pull payments from QuickBooks.';
      }
      return {
        key: 'synced',
        label: 'Synced',
        detail: 'QuickBooks id ' + qbId + '.' + paidNote,
        color: '#15803D',
        icon: '✓',
        qbId: qbId
      };
    }
    if (doc.voided || st === 'void' || st === 'voided') {
      return { key: 'disabled', label: 'Excluded', detail: 'Void documents are not pushed to QuickBooks.', color: '#9CA3AF', icon: '—' };
    }
    if (!items.length) {
      return {
        key: 'blocked',
        label: 'Not ready',
        detail: 'Add at least one line item with a QuickBooks category before pushing.',
        color: '#6B7280',
        icon: '—'
      };
    }
    if (doc.qbPushPending) {
      return {
        key: 'queued',
        label: 'Queued',
        detail: 'Push is in progress. Refresh this page in about a minute.',
        color: '#D97706',
        icon: '⏳'
      };
    }
    if (doc.qbPushError) {
      return {
        key: 'error',
        label: 'Push failed',
        detail: String(doc.qbPushError).slice(0, 200),
        color: '#B45309',
        icon: '✗'
      };
    }
    var missingQbCat = 0;
    items.forEach(function(it) {
      var q = String(it.qbCategory || it.category || '').trim();
      if (!q) missingQbCat++;
    });
    if (missingQbCat > 0) {
      return {
        key: 'blocked',
        label: 'Not ready',
        detail: missingQbCat + ' line(s) missing QuickBooks category. Edit lines or use Account Mapping defaults.',
        color: '#6B7280',
        icon: '—'
      };
    }
    if (type === 'po') {
      var vend = String(doc.vendor || doc.vendorName || '').trim();
      if (!vend) {
        return { key: 'blocked', label: 'Not ready', detail: 'Set a vendor on this PO before pushing to QuickBooks.', color: '#6B7280', icon: '—' };
      }
    }
    return {
      key: 'ready',
      label: 'Ready to sync',
      detail: 'Use Push on this row or open the document and use ⋮ → Push to QuickBooks.',
      color: '#CA8A04',
      icon: '◷',
      canPush: true
    };
  }

  function qbBuildDashboardRows(invoices, pos, connectionOk) {
    var rows = [];
    (invoices || []).forEach(function(inv) {
      if (String(inv.invoiceNum || inv.number || '').toUpperCase().match(/^RR-/)) return;
      rows.push({
        type: 'invoice',
        typeLabel: 'Invoice',
        doc: inv,
        projectId: inv.projectId,
        projectName: inv.projectName || inv.project || '',
        code: qbDocNumber(inv, 'invoice'),
        created: inv.date || inv.issueDate || inv.createdAt || '',
        status: qbSyncStatusForDoc(inv, 'invoice', { connectionOk: connectionOk }),
        total: parseFloat(inv.total) || 0
      });
    });
    (pos || []).forEach(function(po) {
      rows.push({
        type: 'po',
        typeLabel: 'Purchase Order',
        doc: po,
        projectId: po.projectId,
        projectName: po.projectName || po.project || '',
        code: qbDocNumber(po, 'po'),
        created: po.date || po.issueDate || po.createdAt || '',
        status: qbSyncStatusForDoc(po, 'po', { connectionOk: connectionOk }),
        total: parseFloat(po.total) || 0
      });
    });
    rows.sort(function(a, b) {
      var sa = a.status.key === 'ready' ? 0 : a.status.key === 'error' ? 1 : a.status.key === 'queued' ? 2 : 3;
      var sb = b.status.key === 'ready' ? 0 : b.status.key === 'error' ? 1 : b.status.key === 'queued' ? 2 : 3;
      if (sa !== sb) return sa - sb;
      return String(b.created || '').localeCompare(String(a.created || ''));
    });
    return rows;
  }

  function qbFilterRows(rows, f) {
    f = f || {};
    var q = String(f.q || '').trim().toLowerCase();
    return rows.filter(function(r) {
      if (f.type && f.type !== 'all' && r.type !== f.type) return false;
      if (f.status && f.status !== 'all' && r.status.key !== f.status) return false;
      if (f.project && r.projectId !== f.project && r.projectName !== f.project) return false;
      if (!q) return true;
      var blob = (r.code + ' ' + r.projectName + ' ' + r.typeLabel + ' ' + r.status.label + ' ' + r.status.detail).toLowerCase();
      return blob.indexOf(q) >= 0;
    });
  }

  function qbTabBtn(id, label, active) {
    return '<button type="button" class="btn btn-sm' + (active ? ' btn-primary' : ' btn-secondary') + '" style="' + (active ? 'background:#2CA01C;border-color:#2CA01C;' : '') + 'margin-right:6px;" onclick="renderQuickBooksTab(\'' + id + '\')">' + label + '</button>';
  }

  async function qbLoadConnectionMeta() {
    var isBillingAdmin = window.currentUser && window.ADMIN_EMAILS && window.ADMIN_EMAILS.includes((window.currentUser.email || '').toLowerCase());
    var meta = {};
    if (isBillingAdmin) {
      try {
        var snap = await firebase.firestore().collection('admin').doc('qb').get();
        if (snap.exists) meta = snap.data() || {};
      } catch (_e) {}
    }
    return { meta: meta, isBillingAdmin: isBillingAdmin };
  }

  async function qbProbeConnection(isBillingAdmin) {
    if (!isBillingAdmin) return null;
    try {
      if (typeof window.preflightCloudFunctionsUsCentral1 === 'function') {
        var pre = await window.preflightCloudFunctionsUsCentral1();
        if (!pre.ok) return false;
      }
      var fn = firebase.app().functions('us-central1').httpsCallable('qbConnectionStatus');
      var res = await fn({});
      return !!(res && res.data && res.data.ok);
    } catch (_e) {
      return false;
    }
  }

  window.renderQuickBooksTab = async function(tab) {
    window._qbHub.tab = tab || 'dashboard';
    var T = document.getElementById('contentArea');
    if (!T) return;

    var canPush = typeof window.userCanPushToQB === 'function' && window.userCanPushToQB();
    var connPack = await qbLoadConnectionMeta();
    var isBillingAdmin = connPack.isBillingAdmin;
    var qbMeta = connPack.meta;

    if (window._qbHub.connectionOk === null && isBillingAdmin) {
      T.innerHTML = '<div style="padding:48px;text-align:center;color:var(--gray-500);">Checking QuickBooks connection…</div>';
      window._qbHub.connectionOk = await qbProbeConnection(isBillingAdmin);
    }

    var tabBar =
      '<div style="display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-bottom:20px;">' +
        qbTabBtn('dashboard', 'Sync dashboard', tab === 'dashboard') +
        qbTabBtn('mapping', 'Account mapping', tab === 'mapping') +
        qbTabBtn('connection', 'Connection', tab === 'connection') +
      '</div>';

    if (tab === 'connection') {
      window.renderQuickBooksConnectionPanel(T, tabBar, qbMeta, isBillingAdmin, canPush);
      return;
    }
    if (tab === 'mapping') {
      window.renderQuickBooksMappingPanel(T, tabBar, qbMeta, isBillingAdmin);
      return;
    }
    await window.renderQuickBooksDashboardPanel(T, tabBar, canPush, isBillingAdmin);
  };

  window.renderQuickBooksConnectionPanel = function(T, tabBar, qbMeta, isBillingAdmin, canPush) {
    var hasStoredToken = !!(qbMeta.refreshToken);
    var realmId = String(qbMeta.realmId || '1389735275').trim();
    var tokenUpdated = qbMeta.tokenUpdatedAt;
    var tokenUpdatedStr = '';
    if (tokenUpdated && tokenUpdated.toDate) tokenUpdatedStr = tokenUpdated.toDate().toLocaleString();
    else if (qbMeta.connectedAt) tokenUpdatedStr = String(qbMeta.connectedAt);
    var connOk = window._qbHub.connectionOk;

    T.innerHTML =
      '<h1 class="page-title">QuickBooks</h1>' +
      '<p style="font-size:13px;color:var(--gray-500);max-width:800px;line-height:1.55;margin:-8px 0 16px;">One firm-wide link to QuickBooks Online. Invoices and POs sync after this is healthy.</p>' +
      tabBar +
      '<div class="card" style="padding:22px 24px;border-left:3px solid #2CA01C;">' +
        '<div style="font-size:15px;font-weight:700;color:#0F1A2E;margin-bottom:8px;">Firm connection</div>' +
        (isBillingAdmin
          ? '<div style="font-size:13px;margin-bottom:12px;">' +
              '<span style="display:inline-flex;align-items:center;gap:8px;padding:6px 12px;border-radius:4px;background:' + (connOk ? 'rgba(21,128,61,0.12)' : 'rgba(180,83,9,0.12)') + ';color:' + (connOk ? '#15803D' : '#B45309') + ';font-weight:600;">' +
              (connOk ? '✓ Connected' : '⚠ Not connected — reconnect below') + '</span></div>' +
              '<div id="qbConnStatusBox" style="padding:12px 14px;background:var(--gray-50);border:1px solid var(--gray-100);margin-bottom:14px;font-size:13px;line-height:1.5;">' +
                '<div><strong>Stored token:</strong> ' + (hasStoredToken ? 'Yes' : '<span style="color:#B45309;">No</span>') + '</div>' +
                '<div style="margin-top:6px;"><strong>Realm id:</strong> <code>' + esc(realmId) + '</code></div>' +
                (tokenUpdatedStr ? '<div style="margin-top:6px;"><strong>Last token update:</strong> ' + esc(tokenUpdatedStr) + '</div>' : '') +
                '<div id="qbConnLiveResult" style="margin-top:10px;font-size:12px;"></div>' +
              '</div>' +
              '<div style="display:flex;flex-wrap:wrap;gap:10px;">' +
                '<a class="btn btn-primary" href="https://cch-platform.web.app/qbauth.html" target="_blank" rel="noopener" style="background:#2CA01C;border-color:#2CA01C;">Connect to QuickBooks</a>' +
                '<button type="button" class="btn btn-secondary" onclick="testQuickBooksConnection()">Test connection</button>' +
              '</div>' +
            '</div>'
          : '<p style="font-size:12px;color:#92400E;">Only billing admins can reconnect. Ask Cindy to use this tab.</p>') +
      '</div>';
  };

  window.renderQuickBooksMappingPanel = function(T, tabBar, qbMeta, isBillingAdmin) {
    var defaults = (qbMeta && qbMeta.categoryDefaults) || { income: 'R1', expense: 'C1' };
    var map = (qbMeta && qbMeta.categoryAccountMap) || {};
    var acctMap = (qbMeta && qbMeta.accountMap && typeof qbMeta.accountMap === 'object') ? qbMeta.accountMap : {};
    var acctRows = ['R1', 'R2', 'R3', 'R4', 'R5', 'C1', 'C2', 'C3', 'C4', 'C5', 'C6'].map(function(k) {
      var id = acctMap[k];
      return '<tr><td style="padding:6px 10px;font-family:ui-monospace,Menlo,monospace;font-size:12px;">' + esc(k) + '</td>' +
        '<td style="padding:6px 10px;font-size:12px;">' + (id ? esc(String(id)) : '<span style="color:var(--gray-400);">—</span>') + '</td></tr>';
    }).join('');
    var incDef = defaults.income || 'R1';
    var expDef = defaults.expense || 'C1';

    var rows = CCH_QB_PRODUCT_CATEGORIES.map(function(cat) {
      var m = qbResolvedCategoryAccounts(cat, map, defaults);
      var svcHint = CCH_QB_CATEGORY_BUILTIN[cat]
        ? ' title="Recommended for ' + cat + ' — matches QuickBooks chart (design fees / shipping / labor)"'
        : '';
      return '<tr style="border-bottom:1px solid var(--gray-100);"' + svcHint + '>' +
        '<td style="padding:10px 12px;font-size:13px;font-weight:600;">' + esc(cat) + '</td>' +
        '<td style="padding:8px 10px;"><select class="form-input qb-map-inc" data-cat="' + escAttr(cat) + '" style="font-size:12px;width:100%;"' + (isBillingAdmin ? '' : ' disabled') + '>' + qbIncomeOptions(m.income) + '</select></td>' +
        '<td style="padding:8px 10px;"><select class="form-input qb-map-exp" data-cat="' + escAttr(cat) + '" style="font-size:12px;width:100%;"' + (isBillingAdmin ? '' : ' disabled') + '>' + qbExpenseOptions(m.expense) + '</select></td>' +
      '</tr>';
    }).join('');

    T.innerHTML =
      '<h1 class="page-title">QuickBooks</h1>' +
      '<p style="font-size:13px;color:var(--gray-500);max-width:820px;line-height:1.55;margin:-8px 0 16px;">Map Studio product categories to CCH chart accounts (R1–R5 income, C1–C6 cost). Houzz showed this per category — here it is tied to your canonical taxonomy and stored for the whole firm.</p>' +
      tabBar +
      '<div class="card" style="padding:20px 24px;margin-bottom:16px;">' +
        '<div style="font-size:14px;font-weight:700;margin-bottom:10px;">Default mapping</div>' +
        '<p style="font-size:12px;color:var(--gray-500);margin:0 0 12px;">Used when a line has no category-specific override.</p>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;max-width:640px;">' +
          '<div><label class="form-label">Default income account</label><select id="qbDefaultIncome" class="form-input" style="width:100%;"' + (isBillingAdmin ? '' : ' disabled') + '>' + qbIncomeOptions(incDef) + '</select></div>' +
          '<div><label class="form-label">Default expense / COGS account</label><select id="qbDefaultExpense" class="form-input" style="width:100%;"' + (isBillingAdmin ? '' : ' disabled') + '>' + qbExpenseOptions(expDef) + '</select></div>' +
        '</div>' +
      '</div>' +
      '<div class="card" style="padding:20px 24px;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">' +
          '<div style="font-size:14px;font-weight:700;">Mapping by category</div>' +
          (isBillingAdmin ? '<button type="button" class="btn btn-primary btn-sm" style="background:#2CA01C;border-color:#2CA01C;" onclick="saveQbCategoryAccountMap()">Save mapping</button>' : '') +
        '</div>' +
        '<table style="width:100%;border-collapse:collapse;"><thead><tr style="background:var(--gray-50);">' +
          '<th style="text-align:left;padding:8px 12px;font-size:11px;">Studio category</th>' +
          '<th style="text-align:left;padding:8px 12px;font-size:11px;">Income (R#)</th>' +
          '<th style="text-align:left;padding:8px 12px;font-size:11px;">Expense (C#)</th>' +
        '</tr></thead><tbody>' + rows + '</tbody></table>' +
      '</div>' +
      (Object.keys(acctMap).length
        ? '<div class="card" style="padding:20px 24px;margin-top:16px;">' +
            '<div style="font-size:14px;font-weight:700;margin-bottom:8px;">QuickBooks account ids (firm setup)</div>' +
            '<p style="font-size:12px;color:var(--gray-500);margin:0 0 10px;">Numeric ids from Intuit — R#/C# codes above map to these in Cloud Functions.</p>' +
            '<table style="width:100%;max-width:480px;border-collapse:collapse;"><thead><tr style="background:var(--gray-50);">' +
              '<th style="text-align:left;padding:6px 10px;font-size:11px;">Code</th><th style="text-align:left;padding:6px 10px;font-size:11px;">QB account id</th>' +
            '</tr></thead><tbody>' + acctRows + '</tbody></table></div>'
        : '') +
      '<div class="card" style="padding:20px 24px;margin-top:16px;">' +
        '<div style="font-size:14px;font-weight:700;margin-bottom:8px;">Other connectors</div>' +
        '<table style="width:100%;border-collapse:collapse;font-size:13px;">' +
          '<tr style="border-bottom:1px solid var(--gray-100);"><td style="padding:8px;font-weight:600;width:32%;">QB customer</td><td style="padding:8px;color:var(--gray-600);">Project edit → QuickBooks customer Id (<code style="font-size:10px;">nameId=</code> in Intuit URL).</td></tr>' +
          '<tr><td style="padding:8px;font-weight:600;">Line on invoice</td><td style="padding:8px;color:var(--gray-600);">Per-line QuickBooks category when editing invoice lines (drives R# on push).</td></tr>' +
        '</table></div>';
  };

  window.renderQuickBooksDashboardPanel = async function(T, tabBar, canPush, isBillingAdmin) {
    T.innerHTML = '<h1 class="page-title">QuickBooks</h1>' + tabBar + '<div style="padding:40px;text-align:center;color:var(--gray-500);">Loading sync queue…</div>';

    try {
      if (typeof window.loadFinancialData === 'function') await window.loadFinancialData(true);
    } catch (eLoad) {
      T.innerHTML = '<div class="empty-state"><div class="empty-text">Could not load invoices/POs: ' + esc(eLoad.message || eLoad) + '</div></div>';
      return;
    }

    var docs = typeof window.cchQbDashboardGetDocs === 'function' ? window.cchQbDashboardGetDocs() : {};
    var invoices = docs.invoices || [];
    var pos = docs.pos || [];
    var connOk = window._qbHub.connectionOk;
    var rows = qbBuildDashboardRows(invoices, pos, connOk);
    window._qbHub.rows = rows;

    var readyCount = rows.filter(function(r) { return r.status.key === 'ready'; }).length;
    var syncedCount = rows.filter(function(r) { return r.status.key === 'synced'; }).length;
    var errCount = rows.filter(function(r) { return r.status.key === 'error'; }).length;

    var projects = {};
    rows.forEach(function(r) {
      var k = r.projectId || r.projectName || '';
      if (k) projects[k] = r.projectName || k;
    });
    var projOpts = '<option value="">All projects</option>' + Object.keys(projects).sort().map(function(k) {
      return '<option value="' + escAttr(k) + '">' + esc(projects[k]) + '</option>';
    }).join('');

    var f = window._qbHub.filter;
    var filtered = qbFilterRows(rows, f);

    var banner = '';
    if (connOk === false) {
      banner = '<div style="padding:12px 16px;background:rgba(180,83,9,0.12);border:1px solid rgba(180,83,9,0.35);margin-bottom:16px;font-size:13px;line-height:1.45;color:#92400E;">' +
        '<strong>QuickBooks is disconnected.</strong> Sync is blocked until you reconnect on the <a href="#" onclick="renderQuickBooksTab(\'connection\');return false;" style="color:#B45309;font-weight:600;">Connection</a> tab.</div>';
    } else if (readyCount > 0) {
      banner = '<div style="padding:12px 16px;background:rgba(202,138,4,0.12);border:1px solid rgba(202,138,4,0.35);margin-bottom:16px;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px;">' +
        '<span style="font-size:13px;color:#92400E;"><strong>' + readyCount + '</strong> document' + (readyCount > 1 ? 's' : '') + ' ready to push to QuickBooks</span>' +
        (canPush ? '<button type="button" class="btn btn-primary btn-sm" style="background:#2CA01C;border-color:#2CA01C;" onclick="qbDashboardPushReady()">Push ready (' + readyCount + ')</button>' : '') +
        '</div>';
    }

    var th = 'padding:10px 12px;text-align:left;font-size:10px;text-transform:uppercase;color:var(--gray-500);font-weight:600;border-bottom:2px solid var(--gray-200);';
    var body = filtered.slice(0, 400).map(function(r) {
      var st = r.status;
      var openHash = r.type === 'invoice'
        ? '#/project/' + encodeURIComponent(r.projectId) + '/invoice/' + encodeURIComponent(r.doc.id)
        : '#/project/' + encodeURIComponent(r.projectId) + '/po/' + encodeURIComponent(r.doc.id);
      var actions = '<a href="' + escAttr(openHash) + '" onclick="navigate(\'' + escAttr(openHash) + '\');return false;" style="font-size:12px;font-weight:600;">Open</a>';
      if (canPush && st.canPush) {
        actions += ' · <a href="#" onclick="qbDashboardPushOne(\'' + escAttr(r.type) + '\',\'' + escAttr(r.projectId) + '\',\'' + escAttr(r.doc.id) + '\');return false;" style="font-size:12px;">Push</a>';
      }
      if (r.type === 'invoice' && st.key === 'synced' && typeof window.syncInvoiceBalanceFromQB === 'function') {
        actions += ' · <a href="#" onclick="syncInvoiceBalanceFromQB(\'' + escAttr(r.projectId) + '\',\'' + escAttr(r.doc.id) + '\');return false;" style="font-size:12px;">↻ Paid</a>';
      }
      var qbLink = st.qbId
        ? '<a href="https://qbo.intuit.com/app/invoice?txnId=' + escAttr(st.qbId) + '" target="_blank" rel="noopener" style="font-size:11px;">View in QB</a>'
        : '—';
      return '<tr style="border-bottom:1px solid var(--gray-100);">' +
        '<td style="padding:10px 12px;font-size:12px;">' + esc(r.typeLabel) + '</td>' +
        '<td style="padding:10px 12px;font-size:13px;font-weight:600;"><a href="#" onclick="navigate(\'' + escAttr(openHash) + '\');return false;">' + esc(r.code) + '</a></td>' +
        '<td style="padding:10px 12px;font-size:12px;">' + esc(r.projectName) + '</td>' +
        '<td style="padding:10px 12px;font-size:12px;color:var(--gray-600);">' + esc(String(r.created).slice(0, 10)) + '</td>' +
        '<td style="padding:10px 12px;"><span style="font-size:12px;font-weight:600;color:' + st.color + ';">' + st.icon + ' ' + esc(st.label) + '</span></td>' +
        '<td style="padding:10px 12px;font-size:11px;color:var(--gray-600);line-height:1.4;max-width:280px;">' + esc(st.detail) + '</td>' +
        '<td style="padding:10px 12px;font-size:12px;">' + qbLink + '</td>' +
        '<td style="padding:10px 12px;font-size:12px;">' + actions + '</td>' +
      '</tr>';
    }).join('');

    T.innerHTML =
      '<h1 class="page-title">QuickBooks Online</h1>' +
      '<p style="font-size:13px;color:var(--gray-500);max-width:900px;line-height:1.55;margin:-8px 0 12px;">' +
        'Firm sync queue — clearer than Houzz: every row explains <em>why</em> it is ready, blocked, or synced. ' +
        syncedCount + ' synced · ' + readyCount + ' ready' + (errCount ? ' · ' + errCount + ' failed' : '') + '.</p>' +
      tabBar +
      banner +
      '<div class="card" style="padding:14px 16px;margin-bottom:12px;">' +
        '<div style="display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end;">' +
          '<div style="flex:1;min-width:160px;"><label class="form-label">Search</label><input class="form-input" id="qbDashSearch" value="' + escAttr(f.q || '') + '" placeholder="Invoice #, project, detail…" oninput="qbDashboardApplyFilters()"></div>' +
          '<div><label class="form-label">Type</label><select class="form-input" id="qbDashType" onchange="qbDashboardApplyFilters()"><option value="all">All</option><option value="invoice"' + (f.type === 'invoice' ? ' selected' : '') + '>Invoices</option><option value="po"' + (f.type === 'po' ? ' selected' : '') + '>POs</option></select></div>' +
          '<div><label class="form-label">Status</label><select class="form-input" id="qbDashStatus" onchange="qbDashboardApplyFilters()"><option value="all">All</option><option value="ready"' + (f.status === 'ready' ? ' selected' : '') + '>Ready</option><option value="synced"' + (f.status === 'synced' ? ' selected' : '') + '>Synced</option><option value="blocked"' + (f.status === 'blocked' ? ' selected' : '') + '>Not ready</option><option value="error"' + (f.status === 'error' ? ' selected' : '') + '>Failed</option></select></div>' +
          '<div style="min-width:140px;"><label class="form-label">Project</label><select class="form-input" id="qbDashProject" onchange="qbDashboardApplyFilters()">' + projOpts + '</select></div>' +
          '<button type="button" class="btn btn-secondary btn-sm" onclick="generateQBSyncReport()">Export XLSX</button>' +
          (canPush ? '<button type="button" class="btn btn-secondary btn-sm" onclick="batchSyncInvoiceBalancesFromQB()">↻ Sync all paid</button>' : '') +
        '</div>' +
      '</div>' +
      '<div class="card" style="overflow:auto;">' +
        '<table style="width:100%;border-collapse:collapse;min-width:960px;">' +
          '<thead><tr>' +
            '<th style="' + th + '">Type</th><th style="' + th + '">Code</th><th style="' + th + '">Project</th><th style="' + th + '">Created</th>' +
            '<th style="' + th + '">Sync status</th><th style="' + th + '">Details</th><th style="' + th + '">QuickBooks</th><th style="' + th + '">Actions</th>' +
          '</tr></thead><tbody>' + (body || '<tr><td colspan="8" style="padding:24px;text-align:center;color:var(--gray-500);">No rows match filters.</td></tr>') +
          '</tbody></table>' +
        (filtered.length > 400 ? '<div style="padding:10px 14px;font-size:11px;color:var(--gray-500);">Showing first 400 of ' + filtered.length + ' — narrow filters.</div>' : '') +
      '</div>';
    if (document.getElementById('qbDashProject') && f.project) {
      document.getElementById('qbDashProject').value = f.project;
    }
  };

  window.qbDashboardApplyFilters = function() {
    window._qbHub.filter = {
      q: (document.getElementById('qbDashSearch') && document.getElementById('qbDashSearch').value) || '',
      type: (document.getElementById('qbDashType') && document.getElementById('qbDashType').value) || 'all',
      status: (document.getElementById('qbDashStatus') && document.getElementById('qbDashStatus').value) || 'all',
      project: (document.getElementById('qbDashProject') && document.getElementById('qbDashProject').value) || ''
    };
    renderQuickBooksTab('dashboard');
  };

  window.qbDashboardPushOne = async function(type, projectId, docId) {
    if (typeof pushDocToQB !== 'function') return;
    await pushDocToQB(type, projectId, docId);
    window._qbHub.connectionOk = null;
    await renderQuickBooksTab('dashboard');
  };

  window.qbDashboardPushReady = async function() {
    var ready = (window._qbHub.rows || []).filter(function(r) { return r.status.key === 'ready'; });
    if (!ready.length) {
      if (typeof window.showToast === 'function') window.showToast('Nothing ready to push', 'info');
      return;
    }
    var ok = true;
    if (typeof window.cchConfirm === 'function') {
      ok = await window.cchConfirm('Push ' + ready.length + ' document(s) to QuickBooks? This may take a few minutes.', 'Push ready', { confirmText: 'Push', cancelText: 'Cancel' });
    }
    if (!ok) return;
    var n = 0;
    for (var i = 0; i < ready.length && i < 25; i++) {
      var r = ready[i];
      try {
        if (typeof pushDocToQB === 'function') await pushDocToQB(r.type, r.projectId, r.doc.id);
        n++;
      } catch (e) {
        console.warn('[qbDashboardPushReady]', r.code, e);
      }
    }
    if (typeof window.showToast === 'function') window.showToast('Pushed ' + n + ' of ' + Math.min(ready.length, 25) + ' (cap 25 per run)', n ? 'success' : 'warning');
    window._qbHub.connectionOk = null;
    await renderQuickBooksTab('dashboard');
  };

  window.saveQbCategoryAccountMap = async function() {
    var isBillingAdmin = window.currentUser && window.ADMIN_EMAILS && window.ADMIN_EMAILS.includes((window.currentUser.email || '').toLowerCase());
    if (!isBillingAdmin) return;
    var categoryAccountMap = {};
    document.querySelectorAll('.qb-map-inc').forEach(function(el) {
      var cat = el.getAttribute('data-cat');
      if (!cat) return;
      if (!categoryAccountMap[cat]) categoryAccountMap[cat] = {};
      categoryAccountMap[cat].income = el.value;
    });
    document.querySelectorAll('.qb-map-exp').forEach(function(el) {
      var cat = el.getAttribute('data-cat');
      if (!cat) return;
      if (!categoryAccountMap[cat]) categoryAccountMap[cat] = {};
      categoryAccountMap[cat].expense = el.value;
    });
    var categoryDefaults = {
      income: (document.getElementById('qbDefaultIncome') && document.getElementById('qbDefaultIncome').value) || 'R1',
      expense: (document.getElementById('qbDefaultExpense') && document.getElementById('qbDefaultExpense').value) || 'C1'
    };
    CCH_QB_PRODUCT_CATEGORIES.forEach(function(cat) {
      var resolved = qbResolvedCategoryAccounts(cat, categoryAccountMap, categoryDefaults);
      categoryAccountMap[cat] = resolved;
    });
    try {
      await firebase.firestore().collection('admin').doc('qb').set({
        categoryAccountMap: categoryAccountMap,
        categoryDefaults: categoryDefaults,
        categoryMapUpdatedAt: new Date().toISOString()
      }, { merge: true });
      if (typeof window.showToast === 'function') window.showToast('QuickBooks category mapping saved', 'success');
    } catch (e) {
      if (typeof window.cchAlert === 'function') await window.cchAlert('Save failed: ' + (e.message || e), 'QuickBooks');
    }
  };

  window.renderQuickBooksPage = async function() {
    var canPush = typeof window.userCanPushToQB === 'function' && window.userCanPushToQB();
    var isBillingAdmin = window.currentUser && window.ADMIN_EMAILS && window.ADMIN_EMAILS.includes((window.currentUser.email || '').toLowerCase());
    if (!canPush && !isBillingAdmin) {
      document.getElementById('contentArea').innerHTML =
        '<div class="empty-state"><div class="empty-icon">🔒</div><div class="empty-text">QuickBooks tools are for billing admins and authorized invoice push users.</div></div>';
      return;
    }
    if (typeof window.setBreadcrumb === 'function') window.setBreadcrumb([{ label: 'QuickBooks' }]);
    if (typeof window.setTopbarActions === 'function') window.setTopbarActions('');
    window._qbHub.connectionOk = null;
    await window.renderQuickBooksTab(window._qbHub.tab || 'dashboard');
  };

  window.testQuickBooksConnection = async function() {
    var box = document.getElementById('qbConnLiveResult');
    if (box) box.innerHTML = '<span style="color:var(--gray-500);">Testing…</span>';
    try {
      if (typeof window.preflightCloudFunctionsUsCentral1 === 'function') {
        var pre = await window.preflightCloudFunctionsUsCentral1();
        if (!pre.ok) {
          if (box) box.innerHTML = '<span style="color:#B45309;">' + esc(pre.text) + '</span>';
          window._qbHub.connectionOk = false;
          return;
        }
      }
      var fn = firebase.app().functions('us-central1').httpsCallable('qbConnectionStatus');
      var res = await fn({});
      var d = res && res.data;
      if (d && d.ok) {
        window._qbHub.connectionOk = true;
        if (box) box.innerHTML = '<span style="color:#15803D;font-weight:600;">✓ Connection OK</span> — realm ' + esc(String(d.realmId || ''));
        if (typeof window.showToast === 'function') window.showToast('QuickBooks connection is working', 'success');
        if (window._qbHub.tab === 'dashboard') await window.renderQuickBooksTab('dashboard');
      } else {
        window._qbHub.connectionOk = false;
        var msg = (d && d.message) ? String(d.message) : 'Connection test failed';
        if (box) box.innerHTML = '<span style="color:#B45309;">' + esc(msg.split('\n')[0]) + '</span>';
        if (typeof window.cchAlert === 'function') await window.cchAlert('QuickBooks connection test failed:\n\n' + msg, 'QuickBooks');
      }
    } catch (err) {
      window._qbHub.connectionOk = false;
      var em = typeof window.formatQbPaidSyncError === 'function' ? window.formatQbPaidSyncError(err) : String(err.message || err);
      if (box) box.innerHTML = '<span style="color:#B45309;">' + esc(em.split('\n')[0]) + '</span>';
      if (typeof window.cchAlert === 'function') await window.cchAlert('QuickBooks connection test failed:\n' + em, 'QuickBooks');
    }
  };

})();
