/**
 * Order Management — firm-wide PO operations dashboard (staging Phase 1).
 * Does not modify renderPODetail, project PO tabs, or vendor bill variance UI.
 */
(function() {
  'use strict';

  var OM_BUILD = '20260602om2';

  function esc(t) {
    if (typeof window.esc === 'function') return window.esc(t);
    if (t == null) return '';
    var d = document.createElement('div');
    d.textContent = String(t);
    return d.innerHTML;
  }

  function escAttr(t) {
    if (typeof window.escAttr === 'function') return window.escAttr(t);
    return esc(t).replace(/"/g, '&quot;');
  }

  function fmtDate(d) {
    if (typeof window.formatDate === 'function') return window.formatDate(d);
    if (!d) return '—';
    try {
      var dt = new Date(d);
      if (isNaN(dt.getTime())) return String(d);
      return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch (_e) {
      return String(d);
    }
  }

  window.cchOmPageEnabled = function() {
    return window._cchEnv === 'staging' ||
      (location.hostname || '').indexOf('staging') >= 0 ||
      location.hostname === 'localhost' ||
      location.hostname === '127.0.0.1';
  };

  /** Houzz legacy import POs — excluded from Order Management (Studio workflow only). */
  window.cchOmIsHouzzPo = function(po) {
    if (!po) return false;
    if (po.houzzImport === true) return true;
    var src = String(po.source || po.dataSource || po.origin || '').trim().toLowerCase();
    if (src === 'houzz-import' || src === 'houzz_import' || src.indexOf('houzz') >= 0) return true;
    if (po.houzzBalance != null && po.houzzBalance !== '') return true;
    if (String(po._qbIdSource || '').toLowerCase() === 'houzz-import') return true;
    var pays = po.payments || [];
    for (var i = 0; i < pays.length; i++) {
      var m = String((pays[i] || {}).method || '').toLowerCase();
      if (m.indexOf('houzz') >= 0) return true;
    }
    return false;
  };

  window.cchOmIsStudioPo = function(po) {
    return !window.cchOmIsHouzzPo(po);
  };

  function poTotal(po) {
    if (typeof window.cchPoListPoTotal === 'function') return window.cchPoListPoTotal(po);
    if (typeof window.cchPoMerchandiseTotal === 'function') return window.cchPoMerchandiseTotal(po);
    return parseFloat(po.total) || 0;
  }

  function poIssueDate(po) {
    return po.issueDate || po.orderDate || po.poDate || po.date || po.createdAt || '';
  }

  function poAgeDays(po) {
    var raw = poIssueDate(po);
    if (!raw) return null;
    var dt = new Date(raw);
    if (isNaN(dt.getTime())) return null;
    return Math.floor((Date.now() - dt.getTime()) / 86400000);
  }

  window.cchOmIsOpenPo = function(po) {
    if (!po) return false;
    var st = (po.status || '').toLowerCase();
    var paySt = (po.paymentStatus || '').toLowerCase();
    if (st === 'received' || st === 'cancelled' || st === 'installed' ||
        st === 'paid' || st === 'closed' || st === 'delivered') return false;
    if (paySt === 'paid') return false;
    return true;
  };

  function poSentToVendor(po) {
    if (!po) return false;
    if (po.poSentAt || po.sentAt) return true;
    var st = (po.status || '').toLowerCase();
    return st.indexOf('sent') >= 0 || st === 'waiting for confirmation' ||
      st === 'ordered' || st === 'shipped' || st === 'at receiver' ||
      st === 'at workroom' || st === 'partially received';
  }

  function hasVendorAck(po) {
    if (!po) return false;
    var st = (po.status || '').toLowerCase();
    if (st === 'ordered' || st === 'shipped' || st === 'partially received' ||
        st === 'at receiver' || st === 'at workroom' || st === 'delivered') return true;
    var bill = po.bill || {};
    var rows = bill.vendorInvoices || po.vendorInvoices || [];
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i] || {};
      if (r.confirmedDate || r.confirmedAt || r.orderConfirmation || r.orderConfirmed) return true;
    }
    return false;
  }

  window.cchOmNeedsConfirmation = function(po) {
    if (!window.cchOmIsOpenPo(po)) return false;
    var st = (po.status || '').toLowerCase();
    if (st === 'waiting for confirmation') return true;
    if (!poSentToVendor(po)) return false;
    return !hasVendorAck(po);
  };

  function lineMissingEta(po, item, idx, items) {
    if (!item) return false;
    if (typeof window.isProposalGroupHeaderItem === 'function' &&
        window.isProposalGroupHeaderItem(item)) return false;
    if (typeof window.cchPoLineIsBillOnlyExpense === 'function' &&
        window.cchPoLineIsBillOnlyExpense(item)) return false;
    var et = String(item.expenseType || item.itemType || 'product').trim().toLowerCase();
    if (et === 'freight' || et === 'service' || et === 'expense' || et === 'sales_tax') return false;
    if (po.eta) return false;
    var meta = null;
    if (typeof window.cchPoLineEtaMetaForItem === 'function') {
      meta = window.cchPoLineEtaMetaForItem(po, item, idx, items);
    }
    if (meta && (meta.etaDate || meta.estimatedShipDate || meta.confirmedDate || meta.actualShipDate)) {
      return false;
    }
    if (item.etaDate || item.estimatedShipDate || item.confirmedDate || item.eta) return false;
    return true;
  }

  window.cchOmMissingEtaLineCount = function(po) {
    if (!po || !window.cchOmIsOpenPo(po)) return 0;
    var items = po.items || [];
    var n = 0;
    for (var i = 0; i < items.length; i++) {
      if (lineMissingEta(po, items[i], i, items)) n++;
    }
    return n;
  };

  function poEtaDisplay(po) {
    if (po.eta) return po.eta;
    var bill = po.bill || {};
    if (bill.etaDate) return fmtDate(bill.etaDate);
    return '—';
  }

  function agingBucket(days) {
    if (days == null) return 'unknown';
    if (days <= 7) return '0-7';
    if (days <= 14) return '8-14';
    if (days <= 30) return '15-30';
    return '31+';
  }

  function agingLabel(bucket) {
    if (bucket === '0-7') return '0–7 days';
    if (bucket === '8-14') return '8–14 days';
    if (bucket === '15-30') return '15–30 days';
    if (bucket === '31+') return '31+ days';
    return 'No date';
  }

  function kpiCard(label, value, sub, color) {
    return '<div style="flex:1;padding:18px 22px;background:linear-gradient(135deg,rgba(196,164,100,0.06),rgba(196,164,100,0.02));border-right:1px solid rgba(196,164,100,0.1);min-width:160px;">' +
      '<div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:var(--gray-400);margin-bottom:6px;">' + esc(label) + '</div>' +
      '<div style="font-size:24px;font-weight:700;color:' + color + ';font-family:var(--font-mono);">' + esc(value) + '</div>' +
      (sub ? '<div style="font-size:11px;color:var(--gray-500);margin-top:4px;">' + esc(sub) + '</div>' : '') +
      '</div>';
  }

  function tabBar(active) {
    var tabs = [
      { id: 'open', label: 'Open POs', hash: '#/ordermanagement/open' },
      { id: 'noeta', label: 'Missing ETA', hash: '#/ordermanagement/noeta' },
      { id: 'noconfirm', label: 'Missing confirmations', hash: '#/ordermanagement/noconfirm' },
      { id: 'receiving', label: 'Receiving status', hash: '#/ordermanagement/receiving' }
    ];
    return '<div style="display:flex;gap:0;margin:20px 0 16px;border-bottom:2px solid rgba(196,164,100,0.15);">' +
      tabs.map(function(t) {
        var on = active === t.id;
        return '<button type="button" class="btn btn-sm" style="border:none;border-bottom:3px solid ' +
          (on ? '#C4A464' : 'transparent') + ';background:' + (on ? 'rgba(196,164,100,0.08)' : 'transparent') +
          ';color:' + (on ? '#C4A464' : 'var(--gray-500)') + ';font-weight:' + (on ? '700' : '500') +
          ';padding:10px 16px;margin-bottom:-2px;" onclick="navigate(\'' + t.hash + '\')">' + esc(t.label) + '</button>';
      }).join('') +
      '</div>';
  }

  window.cchOmSortBy = function(field) {
    if (window._omSortField === field) {
      window._omSortDir = window._omSortDir === 'asc' ? 'desc' : 'asc';
    } else {
      window._omSortField = field;
      window._omSortDir = (field === 'age' || field === 'amount' || field === 'missingEta') ? 'desc' : 'asc';
    }
    window.renderOrderManagementPage();
  };

  function sortArrow(field) {
    if (window._omSortField !== field) return ' ▾';
    return window._omSortDir === 'asc' ? ' ▲' : ' ▼';
  }

  function sortOmRows(rows) {
    var field = window._omSortField || 'age';
    var dir = window._omSortDir === 'asc' ? 1 : -1;
    return rows.slice().sort(function(a, b) {
      var va;
      var vb;
      if (field === 'number') {
        va = String(a.number || a.id || '');
        vb = String(b.number || b.id || '');
      } else if (field === 'vendor') {
        va = String(a._displayVendor || a.vendor || '').toLowerCase();
        vb = String(b._displayVendor || b.vendor || '').toLowerCase();
      } else if (field === 'project') {
        va = String(a.projectName || a.projectId || '').toLowerCase();
        vb = String(b.projectName || b.projectId || '').toLowerCase();
      } else if (field === 'status') {
        va = String(a.status || 'Draft').toLowerCase();
        vb = String(b.status || 'Draft').toLowerCase();
      } else if (field === 'age') {
        va = poAgeDays(a);
        vb = poAgeDays(b);
        if (va == null) va = -1;
        if (vb == null) vb = -1;
      } else if (field === 'eta') {
        va = String(poEtaDisplay(a)).toLowerCase();
        vb = String(poEtaDisplay(b)).toLowerCase();
      } else if (field === 'missingEta') {
        va = window.cchOmMissingEtaLineCount(a);
        vb = window.cchOmMissingEtaLineCount(b);
      } else if (field === 'amount') {
        va = poTotal(a);
        vb = poTotal(b);
      } else {
        va = poIssueDate(a);
        vb = poIssueDate(b);
      }
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
  }

  function filterToolbar(projList, vendors, statuses, totalCount, filteredCount) {
    var fp = window._omFilterProject || '';
    var fv = window._omFilterVendor || '';
    var fs = window._omFilterStatus || '';
    var fa = window._omFilterAging || '';
    var kw = window._omFilterKeyword || '';
    return '<p style="color:var(--gray-400);margin:0 0 8px;font-size:12px;">' +
      (filteredCount === totalCount
        ? esc(String(totalCount) + ' open Studio PO' + (totalCount !== 1 ? 's' : ''))
        : 'Showing ' + filteredCount + ' of ' + totalCount + ' open Studio POs') +
      ' · Houzz legacy imports excluded</p>' +
      '<div style="display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap;align-items:center;">' +
      '<input type="search" placeholder="Search PO #, vendor, project…" class="form-input" ' +
      'value="' + escAttr(kw) + '" oninput="window._omFilterKeyword=this.value;window.cchOmDebounceRender()" ' +
      'style="flex:1;min-width:220px;">' +
      '<select class="form-input" style="width:180px;" onchange="window._omFilterProject=this.value;window.renderOrderManagementPage()">' +
      '<option value="">All projects</option>' +
      projList.map(function(p) {
        return '<option value="' + escAttr(p.id) + '"' + (fp === p.id ? ' selected' : '') + '>' + esc(p.name || p.id) + '</option>';
      }).join('') +
      '</select>' +
      '<select class="form-input" style="width:160px;" onchange="window._omFilterVendor=this.value;window.renderOrderManagementPage()">' +
      '<option value="">All vendors</option>' +
      vendors.map(function(v) {
        return '<option value="' + escAttr(v) + '"' + (fv === v ? ' selected' : '') + '>' + esc(v) + '</option>';
      }).join('') +
      '</select>' +
      '<select class="form-input" style="width:150px;" onchange="window._omFilterStatus=this.value;window.renderOrderManagementPage()">' +
      '<option value="">All statuses</option>' +
      statuses.map(function(s) {
        return '<option value="' + escAttr(s) + '"' + (fs === s ? ' selected' : '') + '>' + esc(s) + '</option>';
      }).join('') +
      '</select>' +
      '<select class="form-input" style="width:130px;" onchange="window._omFilterAging=this.value;window.renderOrderManagementPage()">' +
      '<option value="">All ages</option>' +
      ['0-7', '8-14', '15-30', '31+', 'unknown'].map(function(b) {
        return '<option value="' + b + '"' + (fa === b ? ' selected' : '') + '>' + esc(agingLabel(b)) + '</option>';
      }).join('') +
      '</select>' +
      '</div>';
  }

  function applyFilters(openPos) {
    var fp = window._omFilterProject || '';
    var fv = window._omFilterVendor || '';
    var fs = window._omFilterStatus || '';
    var fa = window._omFilterAging || '';
    var kw = (window._omFilterKeyword || '').trim().toLowerCase();
    return openPos.filter(function(po) {
      if (fp && po.projectId !== fp) return false;
      var vend = String(po._displayVendor || po.vendor || '').trim();
      if (fv && vend !== fv) return false;
      var st = po.status || 'Draft';
      if (fs && st !== fs) return false;
      var bucket = agingBucket(poAgeDays(po));
      if (fa && bucket !== fa) return false;
      if (kw) {
        var blob = [po.number, po.id, vend, po.projectName, st, po.eta].join(' ').toLowerCase();
        if (blob.indexOf(kw) < 0) return false;
      }
      return true;
    });
  }

  function thSort(label, field, extraStyle) {
    var st = 'padding:10px 12px;text-align:left;font-size:10px;text-transform:uppercase;color:var(--gray-400);font-weight:600;cursor:pointer;user-select:none;white-space:nowrap;' + (extraStyle || '');
    return '<th style="' + st + '" onclick="window.cchOmSortBy(\'' + field + '\')">' + esc(label) + sortArrow(field) + '</th>';
  }

  function openPosTable(rows) {
    if (!rows.length) {
      return '<div class="empty-state"><div class="empty-icon">📦</div><div class="empty-text">No open Studio POs match your filters.</div></div>';
    }
    var sorted = sortOmRows(rows);
    var td = 'padding:10px 12px;font-size:13px;';
    var body = sorted.map(function(po) {
      var age = poAgeDays(po);
      var ageTxt = age != null ? age + 'd' : '—';
      var ageColor = age == null ? 'var(--gray-400)' : (age > 30 ? '#E16A5B' : (age > 14 ? '#C4A464' : 'var(--gray-500)'));
      var missEta = window.cchOmMissingEtaLineCount(po);
      var statusHtml = typeof window.cchPoFulfillmentStatusBadgeHtml === 'function'
        ? window.cchPoFulfillmentStatusBadgeHtml(po, { projectId: po.projectId, poId: po.id, clickable: false })
        : esc(po.status || 'Draft');
      return '<tr style="border-bottom:1px solid var(--gray-100);cursor:pointer;" onclick="navigate(\'#/project/' +
        escAttr(po.projectId) + '/po/' + escAttr(po.id) + '\')">' +
        '<td style="' + td + 'font-weight:600;font-family:monospace;color:var(--gold);">' + esc(po.number || po.id.substring(0, 8)) + '</td>' +
        '<td style="' + td + '">' + esc(po._displayVendor || po.vendor || '—') + '</td>' +
        '<td style="' + td + 'color:var(--gray-500);">' + esc(po.projectName || po.projectId) + '</td>' +
        '<td style="' + td + '">' + statusHtml + '</td>' +
        '<td style="' + td + 'font-size:12px;color:' + ageColor + ';font-weight:600;">' + esc(ageTxt) + '</td>' +
        '<td style="' + td + 'font-size:12px;color:var(--gray-500);">' + esc(poEtaDisplay(po)) + '</td>' +
        '<td style="' + td + 'text-align:center;font-size:12px;">' +
        (missEta > 0 ? '<span style="color:#E16A5B;font-weight:600;">' + missEta + '</span>' : '—') + '</td>' +
        '<td style="' + td + 'text-align:right;font-weight:600;font-family:monospace;">$' +
        poTotal(po).toLocaleString('en-US', { minimumFractionDigits: 2 }) + '</td>' +
        '</tr>';
    }).join('');
    return '<div class="card" style="overflow:hidden;overflow-x:auto;">' +
      '<table style="width:100%;min-width:880px;border-collapse:collapse;font-size:13px;">' +
      '<thead><tr style="border-bottom:2px solid var(--gray-200);">' +
      thSort('PO #', 'number') +
      thSort('Vendor', 'vendor') +
      thSort('Project', 'project') +
      thSort('Status', 'status') +
      thSort('Age', 'age') +
      thSort('ETA', 'eta') +
      thSort('Lines w/o ETA', 'missingEta', 'text-align:center;') +
      thSort('Total', 'amount', 'text-align:right;') +
      '</tr></thead><tbody>' + body + '</tbody></table></div>';
  }

  function missingEtaReport(allOpen) {
    var lines = [];
    allOpen.forEach(function(po) {
      var items = po.items || [];
      for (var i = 0; i < items.length; i++) {
        if (!lineMissingEta(po, items[i], i, items)) continue;
        var it = items[i] || {};
        lines.push({
          po: po,
          title: it.title || it.name || 'Line ' + (i + 1)
        });
      }
    });
    if (!lines.length) {
      return '<div class="empty-state"><div class="empty-icon">✓</div><div class="empty-text">No open line items missing ETA.</div></div>';
    }
    var th = 'padding:10px 12px;text-align:left;font-size:10px;text-transform:uppercase;color:var(--gray-400);font-weight:600;';
    var td = 'padding:10px 12px;font-size:13px;';
    var body = lines.slice(0, 500).map(function(row) {
      var po = row.po;
      return '<tr style="border-bottom:1px solid var(--gray-100);cursor:pointer;" onclick="navigate(\'#/project/' +
        escAttr(po.projectId) + '/po/' + escAttr(po.id) + '\')">' +
        '<td style="' + td + 'font-family:monospace;color:var(--gold);font-weight:600;">' + esc(po.number || po.id) + '</td>' +
        '<td style="' + td + '">' + esc(po._displayVendor || po.vendor || '—') + '</td>' +
        '<td style="' + td + '">' + esc(po.projectName || '') + '</td>' +
        '<td style="' + td + '">' + esc(row.title) + '</td>' +
        '<td style="' + td + 'font-size:12px;">' + esc(po.status || '') + '</td>' +
        '</tr>';
    }).join('');
    var more = lines.length > 500 ? '<p style="font-size:12px;color:var(--gray-500);margin:12px 0;">Showing first 500 of ' + lines.length + ' lines. Click a row to open the PO.</p>' : '';
    return more + '<div class="card" style="overflow-x:auto;margin-top:8px;"><table style="width:100%;border-collapse:collapse;">' +
      '<thead><tr style="border-bottom:2px solid var(--gray-200);">' +
      '<th style="' + th + '">PO #</th><th style="' + th + '">Vendor</th><th style="' + th + '">Project</th>' +
      '<th style="' + th + '">Line item</th><th style="' + th + '">PO status</th></tr></thead><tbody>' + body + '</tbody></table></div>';
  }

  function missingConfirmReport(rows) {
    if (!rows.length) {
      return '<div class="empty-state"><div class="empty-icon">✓</div><div class="empty-text">No Studio POs waiting on vendor confirmation.</div></div>';
    }
    return openPosTable(rows);
  }

  function comingSoonPanel(title, desc) {
    return '<div class="card" style="padding:28px 24px;margin-top:8px;">' +
      '<h3 style="margin:0 0 8px;font-size:16px;">' + esc(title) + '</h3>' +
      '<p style="color:var(--gray-500);font-size:13px;line-height:1.5;margin:0;">' + esc(desc) + '</p>' +
      '<p style="font-size:12px;color:var(--gray-400);margin:16px 0 0;">Phase 1 staging — report ships in a follow-up slice.</p></div>';
  }

  window.cchOmDebounceRender = function() {
    if (window._omDebounceTimer) clearTimeout(window._omDebounceTimer);
    window._omDebounceTimer = setTimeout(function() {
      window.renderOrderManagementPage();
    }, 280);
  };

  window.renderOrderManagementPage = async function() {
    var T = document.getElementById('contentArea');
    if (!T) return;

    if (!window.cchOmPageEnabled()) {
      T.innerHTML = '<h1 class="page-title">Order Management</h1>' +
        '<div class="card" style="padding:24px;margin-top:16px;"><p style="margin:0;color:var(--gray-500);">Order Management is enabled on <strong>staging</strong> first. Open ' +
        '<a href="https://cch-platform-staging.web.app/#/ordermanagement" style="color:var(--cyan);">cch-platform-staging.web.app</a>.</p></div>';
      if (typeof window.setBreadcrumb === 'function') window.setBreadcrumb([{ label: 'Order Management' }]);
      if (typeof window.setTopbarActions === 'function') window.setTopbarActions('');
      return;
    }

    if (typeof isClientProjectGuestSession === 'function' && isClientProjectGuestSession()) {
      if (typeof showToast === 'function') showToast('Order Management is not available for your account.', 'warning');
      navigate('#/projects');
      return;
    }

    if (!window._omSortField) {
      window._omSortField = 'age';
      window._omSortDir = 'desc';
    }

    var hash = window.location.hash || '';
    var tab = 'open';
    if (hash.indexOf('/noeta') >= 0) tab = 'noeta';
    else if (hash.indexOf('/noconfirm') >= 0) tab = 'noconfirm';
    else if (hash.indexOf('/receiving') >= 0) tab = 'receiving';
    window._omTab = tab;

    T.innerHTML = '<div style="padding:40px;color:var(--gray-500);">Loading order management…</div>';
    if (typeof window.setBreadcrumb === 'function') window.setBreadcrumb([{ label: 'Order Management' }]);
    if (typeof window.setTopbarActions === 'function') {
      window.setTopbarActions(
        '<a class="btn btn-secondary btn-sm" style="margin-right:8px;" href="#/allpos" onclick="event.preventDefault();navigate(\'#/allpos\')">All POs list</a>' +
        '<span style="font-size:11px;color:var(--gray-400);">build ' + OM_BUILD + '</span>'
      );
    }

    var pos = [];
    var projList = [];
    try {
      if (typeof window.cchPoLoadAllPosForVendorBills === 'function') {
        var loaded = await window.cchPoLoadAllPosForVendorBills();
        pos = loaded.pos || [];
        var projNames = loaded.projNames || {};
        projList = Object.keys(projNames).map(function(id) {
          return { id: id, name: projNames[id] };
        }).sort(function(a, b) {
          return String(a.name).localeCompare(String(b.name));
        });
      } else if (window._cachedPOs) {
        pos = window._cachedPOs;
        var seen = {};
        pos.forEach(function(p) {
          if (!seen[p.projectId]) {
            seen[p.projectId] = true;
            projList.push({ id: p.projectId, name: p.projectName || p.projectId });
          }
        });
      }
    } catch (err) {
      T.innerHTML = '<h1 class="page-title">Order Management</h1>' +
        '<div class="card" style="padding:24px;color:#B45309;">Could not load purchase orders: ' + esc(err.message || err) + '</div>';
      return;
    }

    var studioPos = pos.filter(window.cchOmIsStudioPo);
    var allOpen = studioPos.filter(window.cchOmIsOpenPo);
    var noConfirm = allOpen.filter(window.cchOmNeedsConfirmation);
    var missingEtaLines = 0;
    allOpen.forEach(function(po) { missingEtaLines += window.cchOmMissingEtaLineCount(po); });
    var openValue = allOpen.reduce(function(s, p) { return s + poTotal(p); }, 0);
    var houzzExcluded = pos.length - studioPos.length;

    var vendors = [];
    var statusSet = {};
    allOpen.forEach(function(po) {
      var v = String(po._displayVendor || po.vendor || '').trim();
      if (v && vendors.indexOf(v) < 0) vendors.push(v);
      statusSet[po.status || 'Draft'] = true;
    });
    vendors.sort();
    var statuses = Object.keys(statusSet).sort();

    var filteredOpen = applyFilters(allOpen);
    var panel = '';
    if (tab === 'open') {
      panel = filterToolbar(projList, vendors, statuses, allOpen.length, filteredOpen.length) + openPosTable(filteredOpen);
    } else if (tab === 'noeta') {
      panel = missingEtaReport(allOpen);
    } else if (tab === 'noconfirm') {
      panel = missingConfirmReport(noConfirm);
    } else {
      panel = comingSoonPanel('Receiving status',
        'Per-PO and per-project view of received vs outstanding line quantities — linked to existing PO receive workflow, not a duplicate editor.');
    }

    T.innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:4px;">' +
      '<div><h1 class="page-title" style="margin:0;">Order Management</h1>' +
      '<p style="font-size:13px;color:var(--gray-500);margin:8px 0 0;max-width:640px;">Studio PO operations — status, aging, and ETA gaps. ' +
      'Click a row to open the existing PO page. Houzz legacy imports are excluded' +
      (houzzExcluded > 0 ? ' (' + houzzExcluded + ' hidden)' : '') + '.</p></div></div>' +
      '<div style="display:flex;gap:0;margin-bottom:20px;border-radius:0;overflow:hidden;border:1px solid rgba(196,164,100,0.15);flex-wrap:wrap;">' +
      kpiCard('Open POs', String(allOpen.length), 'Studio docs only', '#C4A464') +
      kpiCard('Missing confirmation', String(noConfirm.length), 'Sent — no vendor ack', '#E16A5B') +
      kpiCard('Lines without ETA', String(missingEtaLines), 'On open POs', '#C4A464') +
      kpiCard('Open PO value', '$' + openValue.toLocaleString('en-US', { minimumFractionDigits: 2 }), 'Merchandise total', '#1B3352') +
      '</div>' +
      tabBar(tab) +
      panel;
  };

  document.addEventListener('DOMContentLoaded', function() {
    if (window.cchOmPageEnabled()) {
      var nav = document.getElementById('navOrderManagement');
      if (nav) nav.style.display = '';
    }
  });

  console.log('[CCH Order Management] loaded', OM_BUILD);
})();
