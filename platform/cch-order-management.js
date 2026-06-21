/**
 * Order Management — firm-wide PO operations dashboard (staging Phase 1).
 * Does not modify renderPODetail, project PO tabs, or vendor bill variance UI.
 */
(function() {
  'use strict';

  var OM_BUILD = '20260602om5';

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
      { id: 'receiving', label: 'Receiving status', hash: '#/ordermanagement/receiving' },
      { id: 'qb', label: 'QuickBooks', hash: '#/ordermanagement/qb' }
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
      window._omSortTouched = true;
      window._omSortDir = (field === 'age' || field === 'amount' || field === 'missingEta' ||
        field === 'outstanding' || field === 'bills') ? 'desc' : 'asc';
      if (field === 'date') window._omSortDir = 'desc';
    }
    window.renderOrderManagementPage();
  };

  function sortArrow(field) {
    if (window._omSortField !== field) return ' ▾';
    return window._omSortDir === 'asc' ? ' ▲' : ' ▼';
  }

  function omCompareDates(a, b, dir) {
    var ta = new Date(a || 0).getTime();
    var tb = new Date(b || 0).getTime();
    if (isNaN(ta)) ta = 0;
    if (isNaN(tb)) tb = 0;
    return (ta - tb) * dir;
  }

  function sortOmRows(rows) {
    var field = window._omSortField || 'date';
    var dir = window._omSortDir === 'asc' ? 1 : -1;
    if (field === 'date') {
      return rows.slice().sort(function(a, b) {
        return omCompareDates(poIssueDate(a), poIssueDate(b), dir);
      });
    }
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
      } else if (field === 'confirm') {
        va = window.cchOmPoConfirmDate(a) || '';
        vb = window.cchOmPoConfirmDate(b) || '';
      } else if (field === 'bills') {
        va = window.cchOmBillsInfo(a).count;
        vb = window.cchOmBillsInfo(b).count;
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
        '<td style="' + td + '">' + omConfirmCellHtml(po) + '</td>' +
        '<td style="' + td + '" onclick="event.stopPropagation()">' + omBillsCellHtml(po) + '</td>' +
        '<td style="' + td + 'font-size:12px;color:var(--gray-500);white-space:nowrap;">' + esc(fmtDate(poIssueDate(po))) + '</td>' +
        '<td style="' + td + 'font-size:12px;color:' + ageColor + ';font-weight:600;">' + esc(ageTxt) + '</td>' +
        '<td style="' + td + 'font-size:12px;color:var(--gray-500);">' + esc(poEtaDisplay(po)) + '</td>' +
        '<td style="' + td + 'text-align:center;font-size:12px;">' +
        (missEta > 0 ? '<span style="color:#E16A5B;font-weight:600;">' + missEta + '</span>' : '—') + '</td>' +
        '<td style="' + td + 'text-align:right;font-weight:600;font-family:monospace;">$' +
        poTotal(po).toLocaleString('en-US', { minimumFractionDigits: 2 }) + '</td>' +
        '</tr>';
    }).join('');
    return '<div class="card" style="overflow:hidden;overflow-x:auto;">' +
      '<table style="width:100%;min-width:1040px;border-collapse:collapse;font-size:13px;">' +
      '<thead><tr style="border-bottom:2px solid var(--gray-200);">' +
      thSort('PO #', 'number') +
      thSort('Vendor', 'vendor') +
      thSort('Project', 'project') +
      thSort('Status', 'status') +
      thSort('Confirm', 'confirm') +
      thSort('Bills', 'bills', 'text-align:center;') +
      thSort('Date', 'date') +
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

  function poNumber(po) {
    return String(po.number || po.num || po.poNum || po.name || '').trim();
  }

  /** Vendor invoice rows on this PO (same sources as Vendor Bills list). */
  window.cchOmBillsInfo = function(po) {
    po = po || {};
    var bill = po.bill || {};
    var items = po.items || [];
    var hasBill = !!(bill.received || bill.qbBillId);
    var sent = typeof window.cchPoWasSentToVendor === 'function'
      ? window.cchPoWasSentToVendor(po).sent
      : !!(po.poSentAt || po.sentAt);
    var groups = typeof window.cchPoVendorInvoiceGroupsDisplay === 'function'
      ? window.cchPoVendorInvoiceGroupsDisplay(po, items)
      : (Array.isArray(po.vendorInvoiceGroups) ? po.vendorInvoiceGroups : []);
    var bills = groups.map(function(g) {
      return {
        invNum: String(g.vendorInvoiceNumber || g.label || '').trim() || 'Vendor invoice',
        groupId: String(g.id || '').trim()
      };
    }).filter(function(b) { return b.groupId || b.invNum; });
    if (!bills.length && hasBill) {
      var inv = String(bill.vendorInvoiceNumber || '').trim();
      var blRef = typeof window.cchPoQbBillDocNumberFromPo === 'function'
        ? window.cchPoQbBillDocNumberFromPo(po) : '';
      bills.push({
        invNum: inv || blRef || 'Vendor bill',
        groupId: 'vig_from_bill_primary'
      });
    }
    return {
      count: bills.length,
      hasBill: hasBill,
      awaitingBill: sent && !hasBill,
      bills: bills
    };
  };

  /** Earliest vendor confirmation date on the PO (vendor invoice groups / line meta). */
  window.cchOmPoConfirmDate = function(po) {
    po = po || {};
    var items = po.items || [];
    var dates = [];
    var groups = typeof window.cchPoVendorInvoiceGroupsDisplay === 'function'
      ? window.cchPoVendorInvoiceGroupsDisplay(po, items)
      : (po.vendorInvoiceGroups || []);
    groups.forEach(function(g) {
      var d = String(g.confirmedDate || '').trim();
      if (d) dates.push(d);
    });
    if (!dates.length) {
      for (var i = 0; i < items.length; i++) {
        var d2 = '';
        if (typeof window.cchPoLineEtaMetaForItem === 'function') {
          d2 = String(window.cchPoLineEtaMetaForItem(po, items[i], i, items).confirmedDate || '').trim();
        }
        if (!d2) d2 = String(items[i].confirmedDate || '').trim();
        if (d2) dates.push(d2);
      }
    }
    if (!dates.length) return '';
    dates.sort();
    return dates[0];
  };

  window.cchOmOpenPoBill = function(projectId, poId, groupId) {
    groupId = String(groupId || '').trim();
    if (groupId && typeof window.cchPoOpenVendorInvoiceGroupModal === 'function') {
      return window.cchPoOpenVendorInvoiceGroupModal(projectId, poId, groupId);
    }
    if (typeof window.cchPoOpenReceiveBillModal === 'function') {
      return window.cchPoOpenReceiveBillModal(projectId, poId, groupId ? 'edit' : '');
    }
    navigate('#/project/' + projectId + '/po/' + poId);
  };

  function omConfirmCellHtml(po) {
    var raw = window.cchOmPoConfirmDate(po);
    if (!raw) return '<span style="color:var(--gray-400);">—</span>';
    return '<span style="font-size:12px;color:var(--gray-600);white-space:nowrap;" title="Vendor order confirmation">' +
      esc(fmtDate(raw)) + '</span>';
  }

  function omBillsCellHtml(po) {
    var info = window.cchOmBillsInfo(po);
    var pid = escAttr(po.projectId);
    var poid = escAttr(po.id);
    if (!info.count) {
      if (info.awaitingBill) {
        return '<button type="button" class="btn btn-secondary btn-sm" style="font-size:10px;padding:3px 8px;" ' +
          'onclick="event.stopPropagation();window.cchOmOpenPoBill(\'' + pid + '\',\'' + poid + '\',\'\')">Receive bill</button>';
      }
      return '<span style="color:var(--gray-400);font-size:12px;">—</span>';
    }
    if (info.count === 1) {
      var b0 = info.bills[0];
      var gid0 = escAttr(b0.groupId || '');
      return '<button type="button" class="btn btn-link btn-sm" style="font-size:12px;font-weight:700;color:var(--gold);padding:0;" ' +
        'onclick="event.stopPropagation();window.cchOmOpenPoBill(\'' + pid + '\',\'' + poid + '\',\'' + gid0 + '\')" ' +
        'title="Open vendor invoice ' + escAttr(b0.invNum) + '">1</button>';
    }
    var links = info.bills.map(function(b) {
      return '<button type="button" class="btn btn-link btn-sm" style="font-size:10px;padding:0 4px 0 0;color:#1B3352;font-weight:600;" ' +
        'onclick="event.stopPropagation();window.cchOmOpenPoBill(\'' + pid + '\',\'' + poid + '\',\'' + escAttr(b.groupId || '') + '\')" ' +
        'title="Open ' + escAttr(b.invNum) + '">' + esc(b.invNum.length > 12 ? b.invNum.slice(0, 11) + '…' : b.invNum) + '</button>';
    }).join('<span style="color:var(--gray-300);"> · </span>');
    return '<div style="line-height:1.4;" onclick="event.stopPropagation()">' +
      '<span style="font-size:11px;font-weight:700;color:var(--gold);margin-right:6px;">' + info.count + '</span>' +
      '<span style="font-size:10px;">' + links + '</span></div>';
  }

  function poNumbersMatch(a, b) {
    a = String(a || '').trim().replace(/\s+/g, '');
    b = String(b || '').trim().replace(/\s+/g, '');
    if (!a || !b) return false;
    return a === b || a.replace(/^PO-?/i, '') === b.replace(/^PO-?/i, '');
  }

  function countPoMerchLines(po) {
    var items = po.items || [];
    var n = 0;
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (typeof window.isProposalGroupHeaderItem === 'function' &&
          window.isProposalGroupHeaderItem(it)) continue;
      if (typeof window.cchPoLineIsBillOnlyExpense === 'function' &&
          window.cchPoLineIsBillOnlyExpense(it)) continue;
      n++;
    }
    return n;
  }

  function orderStatusBucket(st) {
    st = String(st || '').trim().toLowerCase();
    if (st === 'received' || st === 'installed') return 'received';
    if (st === 'shipped' || st === 'at receiver' || st === 'at workroom' ||
        st === 'partially received' || st === 'delivered') return 'intransit';
    return 'outstanding';
  }

  function findLinkedClipsForPo(po, clipRows) {
    if (!clipRows || !clipRows.length) return [];
    var poId = po.id;
    var num = poNumber(po);
    return clipRows.filter(function(row) {
      var c = row.data || {};
      var linked = (c.poId === poId || c.purchaseOrderId === poId);
      if (!linked && num) {
        var cn = String(c.poNum || c.houzzPO || c.purchaseOrderNum || c.po || '').trim();
        linked = poNumbersMatch(cn, num);
      }
      return linked;
    });
  }

  window.cchOmReceivingSummary = function(po, clipRows) {
    var linked = findLinkedClipsForPo(po, clipRows || []);
    var received = 0;
    var intransit = 0;
    var outstanding = 0;
    linked.forEach(function(row) {
      var b = orderStatusBucket((row.data || {}).orderStatus || (row.data || {}).status);
      if (b === 'received') received++;
      else if (b === 'intransit') intransit++;
      else outstanding++;
    });
    var poLines = countPoMerchLines(po);
    var unlinkedLines = Math.max(0, poLines - linked.length);
    var poBucket = orderStatusBucket(po.status);
    var needsAttention = outstanding > 0 || intransit > 0 || unlinkedLines > 0 ||
      (linked.length === 0 && poLines > 0 && poBucket !== 'received');
    return {
      received: received,
      intransit: intransit,
      outstanding: outstanding,
      linked: linked.length,
      poLines: poLines,
      unlinkedLines: unlinkedLines,
      poBucket: poBucket,
      needsAttention: needsAttention,
      location: po.receiver || po.workroom || po.location || po.shipTo || ''
    };
  };

  async function cchOmLoadClipsByProject(projectIds) {
    var map = {};
    if (!projectIds.length || typeof firebase === 'undefined') return map;
    await Promise.all(projectIds.map(async function(pid) {
      try {
        var snap = await firebase.firestore().collection('boards').doc(pid).collection('clips').get();
        var rows = [];
        snap.forEach(function(d) {
          rows.push({ id: d.id, data: d.data() || {} });
        });
        map[pid] = rows;
      } catch (_e) {
        map[pid] = [];
      }
    }));
    return map;
  }

  function recvCountPill(label, count, color) {
    if (!count) return '';
    return '<span style="font-size:11px;font-weight:600;color:' + color + ';margin-right:8px;white-space:nowrap;">' +
      esc(String(count)) + ' ' + esc(label) + '</span>';
  }

  function receivingFilterToolbar(projList, vendors, totalCount, filteredCount) {
    var fp = window._omFilterProject || '';
    var fv = window._omFilterVendor || '';
    var fr = window._omRecvFilter || 'attention';
    var kw = window._omFilterKeyword || '';
    return '<p style="color:var(--gray-400);margin:0 0 8px;font-size:12px;">' +
      (filteredCount === totalCount
        ? esc(String(totalCount) + ' PO' + (totalCount !== 1 ? 's' : '') + ' in receiving view')
        : 'Showing ' + filteredCount + ' of ' + totalCount + ' POs') +
      ' · Linked room-board selections + PO status · click a row to open PO</p>' +
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
      '<select class="form-input" style="width:200px;" onchange="window._omRecvFilter=this.value;window.renderOrderManagementPage()">' +
      '<option value="attention"' + (fr === 'attention' ? ' selected' : '') + '>Needs attention</option>' +
      '<option value="all"' + (fr === 'all' ? ' selected' : '') + '>All open POs</option>' +
      '<option value="intransit"' + (fr === 'intransit' ? ' selected' : '') + '>In transit</option>' +
      '<option value="noclips"' + (fr === 'noclips' ? ' selected' : '') + '>No linked selections</option>' +
      '</select>' +
      '</div>';
  }

  function applyReceivingFilters(rows) {
    var fp = window._omFilterProject || '';
    var fv = window._omFilterVendor || '';
    var fr = window._omRecvFilter || 'attention';
    var kw = (window._omFilterKeyword || '').trim().toLowerCase();
    return rows.filter(function(row) {
      var po = row.po;
      var r = row.recv;
      if (fp && po.projectId !== fp) return false;
      var vend = String(po._displayVendor || po.vendor || '').trim();
      if (fv && vend !== fv) return false;
      if (fr === 'attention' && !r.needsAttention) return false;
      if (fr === 'intransit' && !(r.intransit > 0 || r.poBucket === 'intransit')) return false;
      if (fr === 'noclips' && !(r.linked === 0 && r.poLines > 0)) return false;
      if (kw) {
        var blob = [po.number, po.id, vend, po.projectName, po.status, r.location].join(' ').toLowerCase();
        if (blob.indexOf(kw) < 0) return false;
      }
      return true;
    });
  }

  function sortReceivingRows(rows) {
    var field = window._omSortField || 'outstanding';
    var dir = window._omSortDir === 'asc' ? 1 : -1;
    return rows.slice().sort(function(a, b) {
      var poA = a.po;
      var poB = b.po;
      var rA = a.recv;
      var rB = b.recv;
      var va;
      var vb;
      if (field === 'number') {
        va = poNumber(poA);
        vb = poNumber(poB);
      } else if (field === 'vendor') {
        va = String(poA._displayVendor || poA.vendor || '').toLowerCase();
        vb = String(poB._displayVendor || poB.vendor || '').toLowerCase();
      } else if (field === 'project') {
        va = String(poA.projectName || poA.projectId || '').toLowerCase();
        vb = String(poB.projectName || poB.projectId || '').toLowerCase();
      } else if (field === 'status') {
        va = String(poA.status || '').toLowerCase();
        vb = String(poB.status || '').toLowerCase();
      } else if (field === 'received') {
        va = rA.received;
        vb = rB.received;
      } else if (field === 'intransit') {
        va = rA.intransit;
        vb = rB.intransit;
      } else if (field === 'outstanding') {
        va = rA.outstanding + rA.unlinkedLines;
        vb = rB.outstanding + rB.unlinkedLines;
      } else if (field === 'confirm') {
        va = window.cchOmPoConfirmDate(poA) || '';
        vb = window.cchOmPoConfirmDate(poB) || '';
      } else if (field === 'bills') {
        va = window.cchOmBillsInfo(poA).count;
        vb = window.cchOmBillsInfo(poB).count;
      } else if (field === 'poLines') {
        va = rA.poLines;
        vb = rB.poLines;
      } else if (field === 'amount') {
        va = poTotal(poA);
        vb = poTotal(poB);
      } else {
        va = poAgeDays(poA);
        vb = poAgeDays(poB);
        if (va == null) va = -1;
        if (vb == null) vb = -1;
      }
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
  }

  function receivingStatusReport(allOpen, clipsByProject, projList, vendors) {
    var enriched = allOpen.map(function(po) {
      var clips = clipsByProject[po.projectId] || [];
      return { po: po, recv: window.cchOmReceivingSummary(po, clips) };
    });
    var totalPool = enriched.length;
    var filtered = applyReceivingFilters(enriched);
    if (!filtered.length) {
      return receivingFilterToolbar(projList, vendors, totalPool, 0) +
        '<div class="empty-state"><div class="empty-icon">✓</div><div class="empty-text">No POs match this receiving filter.</div></div>';
    }
    var sorted = sortReceivingRows(filtered);
    var td = 'padding:10px 12px;font-size:13px;';
    var body = sorted.map(function(row) {
      var po = row.po;
      var r = row.recv;
      var statusHtml = typeof window.cchPoFulfillmentStatusBadgeHtml === 'function'
        ? window.cchPoFulfillmentStatusBadgeHtml(po, { projectId: po.projectId, poId: po.id, clickable: false })
        : esc(po.status || 'Draft');
      var clipSummary = r.linked
        ? recvCountPill('received', r.received, '#5FA56B') +
          recvCountPill('in transit', r.intransit, '#C4A464') +
          recvCountPill('outstanding', r.outstanding, '#E16A5B')
        : '<span style="font-size:11px;color:var(--gray-400);">No linked selections</span>';
      var unlinked = r.unlinkedLines > 0
        ? '<span style="font-size:11px;color:#E16A5B;font-weight:600;">+' + r.unlinkedLines + ' unlinked line' + (r.unlinkedLines !== 1 ? 's' : '') + '</span>'
        : '—';
      return '<tr style="border-bottom:1px solid var(--gray-100);cursor:pointer;" onclick="navigate(\'#/project/' +
        escAttr(po.projectId) + '/po/' + escAttr(po.id) + '\')">' +
        '<td style="' + td + 'font-weight:600;font-family:monospace;color:var(--gold);">' + esc(po.number || po.id.substring(0, 8)) + '</td>' +
        '<td style="' + td + '">' + esc(po._displayVendor || po.vendor || '—') + '</td>' +
        '<td style="' + td + 'color:var(--gray-500);">' + esc(po.projectName || po.projectId) + '</td>' +
        '<td style="' + td + '">' + statusHtml + '</td>' +
        '<td style="' + td + '">' + omConfirmCellHtml(po) + '</td>' +
        '<td style="' + td + '" onclick="event.stopPropagation()">' + omBillsCellHtml(po) + '</td>' +
        '<td style="' + td + 'font-size:12px;line-height:1.5;">' + clipSummary + '</td>' +
        '<td style="' + td + 'text-align:center;font-size:12px;">' + esc(String(r.poLines || '—')) + '</td>' +
        '<td style="' + td + 'text-align:center;font-size:12px;">' + unlinked + '</td>' +
        '<td style="' + td + 'font-size:12px;color:var(--gray-500);">' + esc(r.location || '—') + '</td>' +
        '<td style="' + td + 'text-align:right;font-weight:600;font-family:monospace;">$' +
        poTotal(po).toLocaleString('en-US', { minimumFractionDigits: 2 }) + '</td>' +
        '</tr>';
    }).join('');
    return receivingFilterToolbar(projList, vendors, totalPool, filtered.length) +
      '<div class="card" style="overflow:hidden;overflow-x:auto;">' +
      '<table style="width:100%;min-width:1160px;border-collapse:collapse;font-size:13px;">' +
      '<thead><tr style="border-bottom:2px solid var(--gray-200);">' +
      thSort('PO #', 'number') +
      thSort('Vendor', 'vendor') +
      thSort('Project', 'project') +
      thSort('PO status', 'status') +
      thSort('Confirm', 'confirm') +
      thSort('Bills', 'bills', 'text-align:center;') +
      '<th style="padding:10px 12px;text-align:left;font-size:10px;text-transform:uppercase;color:var(--gray-400);font-weight:600;">Linked selections</th>' +
      thSort('PO lines', 'poLines', 'text-align:center;') +
      thSort('Unlinked', 'outstanding', 'text-align:center;') +
      '<th style="padding:10px 12px;text-align:left;font-size:10px;text-transform:uppercase;color:var(--gray-400);font-weight:600;">Location</th>' +
      thSort('Total', 'amount', 'text-align:right;') +
      '</tr></thead><tbody>' + body + '</tbody></table></div>';
  }

  window.cchOmQbInfo = function(po) {
    po = po || {};
    var bill = po.bill || {};
    var billOnly = typeof window.cchPoQbBillOnlyMode === 'function' && window.cchPoQbBillOnlyMode();
    var pushAllowed = typeof window.cchPoQbBillPushAllowed === 'function' ? window.cchPoQbBillPushAllowed() : true;
    var qbBillId = String(bill.qbBillId || '').trim();
    var legQb = typeof window.getQbId === 'function' ? window.getQbId(po) : String(po.qbDocId || '').trim();
    var hasBill = !!(bill.received || bill.qbBillId);
    var sent = typeof window.cchPoWasSentToVendor === 'function'
      ? window.cchPoWasSentToVendor(po).sent
      : !!(po.poSentAt || po.sentAt);
    var blRef = typeof window.cchPoQbBillDocNumberFromPo === 'function'
      ? window.cchPoQbBillDocNumberFromPo(po) : '';
    var bucket = 'draft';
    if (billOnly) {
      if (qbBillId) bucket = 'synced';
      else if (hasBill && pushAllowed) bucket = 'ready';
      else if (hasBill) bucket = 'ready_staging';
      else if (sent) bucket = 'awaiting_bill';
    } else if (legQb) {
      bucket = 'synced';
    } else if (hasBill || sent) {
      bucket = 'ready';
    }
    return {
      bucket: bucket,
      needsAttention: bucket === 'ready' || bucket === 'ready_staging',
      blRef: blRef,
      qbBillId: qbBillId,
      legQb: legQb,
      hasBill: hasBill,
      sent: sent,
      billOnly: billOnly,
      pushAllowed: pushAllowed
    };
  };

  function cchOmPoQbRelevant(po) {
    if (!window.cchOmIsStudioPo(po)) return false;
    var q = window.cchOmQbInfo(po);
    return !!(q.sent || q.hasBill || q.qbBillId || q.legQb);
  }

  function qbFilterToolbar(projList, vendors, totalCount, filteredCount, stats) {
    var fp = window._omFilterProject || '';
    var fv = window._omFilterVendor || '';
    var fq = window._omQbFilter || 'attention';
    var kw = window._omFilterKeyword || '';
    stats = stats || {};
    var stagingNote = stats.pushBlocked
      ? ' · Bill push to QuickBooks is disabled on staging — use production to sync'
      : '';
    return '<p style="color:var(--gray-400);margin:0 0 8px;font-size:12px;">' +
      (filteredCount === totalCount
        ? esc(String(totalCount) + ' Studio PO' + (totalCount !== 1 ? 's' : '') + ' in QB view')
        : 'Showing ' + filteredCount + ' of ' + totalCount + ' POs') +
      ' · ' + (stats.ready || 0) + ' ready to push · ' + (stats.synced || 0) + ' synced' + stagingNote + '</p>' +
      '<div style="display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap;align-items:center;">' +
      '<input type="search" placeholder="Search PO #, vendor, bill #…" class="form-input" ' +
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
      '<select class="form-input" style="width:190px;" onchange="window._omQbFilter=this.value;window.renderOrderManagementPage()">' +
      '<option value="attention"' + (fq === 'attention' ? ' selected' : '') + '>Needs QB action</option>' +
      '<option value="ready"' + (fq === 'ready' ? ' selected' : '') + '>Ready to push</option>' +
      '<option value="synced"' + (fq === 'synced' ? ' selected' : '') + '>Synced to QB</option>' +
      '<option value="all"' + (fq === 'all' ? ' selected' : '') + '>All sent / billed POs</option>' +
      '</select>' +
      '<a class="btn btn-secondary btn-sm" href="#/quickbooks" onclick="event.preventDefault();navigate(\'#/quickbooks\')">Full QB hub</a>' +
      '</div>';
  }

  function applyQbFilters(rows) {
    var fp = window._omFilterProject || '';
    var fv = window._omFilterVendor || '';
    var fq = window._omQbFilter || 'attention';
    var kw = (window._omFilterKeyword || '').trim().toLowerCase();
    return rows.filter(function(row) {
      var po = row.po;
      var q = row.qb;
      if (fp && po.projectId !== fp) return false;
      var vend = String(po._displayVendor || po.vendor || '').trim();
      if (fv && vend !== fv) return false;
      if (fq === 'attention' && !q.needsAttention) return false;
      if (fq === 'ready' && q.bucket !== 'ready' && q.bucket !== 'ready_staging') return false;
      if (fq === 'synced' && q.bucket !== 'synced') return false;
      if (kw) {
        var blob = [po.number, po.id, vend, po.projectName, q.blRef, q.qbBillId, q.legQb].join(' ').toLowerCase();
        if (blob.indexOf(kw) < 0) return false;
      }
      return true;
    });
  }

  function sortQbRows(rows) {
    var field = window._omSortField || 'date';
    var dir = window._omSortDir === 'asc' ? 1 : -1;
    if (field === 'date') {
      return rows.slice().sort(function(a, b) {
        return omCompareDates(poIssueDate(a.po), poIssueDate(b.po), dir);
      });
    }
    return rows.slice().sort(function(a, b) {
      var poA = a.po;
      var poB = b.po;
      var qA = a.qb;
      var qB = b.qb;
      var va;
      var vb;
      if (field === 'number') {
        va = poNumber(poA);
        vb = poNumber(poB);
      } else if (field === 'vendor') {
        va = String(poA._displayVendor || poA.vendor || '').toLowerCase();
        vb = String(poB._displayVendor || poB.vendor || '').toLowerCase();
      } else if (field === 'project') {
        va = String(poA.projectName || poA.projectId || '').toLowerCase();
        vb = String(poB.projectName || poB.projectId || '').toLowerCase();
      } else if (field === 'amount') {
        va = poTotal(poA);
        vb = poTotal(poB);
      } else {
        va = String(qA.blRef || qA.qbBillId || qA.legQb || '').toLowerCase();
        vb = String(qB.blRef || qB.qbBillId || qB.legQb || '').toLowerCase();
      }
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
  }

  function qbStatusReport(studioPos, projList) {
    var pool = studioPos.filter(cchOmPoQbRelevant);
    var enriched = pool.map(function(po) {
      return { po: po, qb: window.cchOmQbInfo(po) };
    });
    var stats = { ready: 0, synced: 0, pushBlocked: false };
    enriched.forEach(function(row) {
      if (row.qb.bucket === 'synced') stats.synced++;
      if (row.qb.bucket === 'ready' || row.qb.bucket === 'ready_staging') stats.ready++;
      if (row.qb.bucket === 'ready_staging') stats.pushBlocked = true;
    });
    var vendors = [];
    pool.forEach(function(po) {
      var v = String(po._displayVendor || po.vendor || '').trim();
      if (v && vendors.indexOf(v) < 0) vendors.push(v);
    });
    vendors.sort();
    var filtered = applyQbFilters(enriched);
    if (!filtered.length) {
      return qbFilterToolbar(projList, vendors, pool.length, 0, stats) +
        '<div class="empty-state"><div class="empty-icon">✓</div><div class="empty-text">No POs match this QuickBooks filter.</div></div>';
    }
    var sorted = sortQbRows(filtered);
    var td = 'padding:10px 12px;font-size:13px;';
    var canPush = typeof window.userCanPushToQB === 'function' && window.userCanPushToQB();
    var body = sorted.map(function(row) {
      var po = row.po;
      var q = row.qb;
      var pid = escAttr(po.projectId);
      var poid = escAttr(po.id);
      var qbHtml = typeof window.cchPoQbListCellHtml === 'function'
        ? window.cchPoQbListCellHtml(po)
        : esc(q.bucket);
      var action = '';
      if (q.bucket === 'ready' && canPush && q.pushAllowed && typeof window.cchPoPushBillToQB === 'function') {
        action = '<button type="button" class="btn btn-primary btn-sm" style="font-size:10px;padding:4px 10px;" ' +
          'onclick="event.stopPropagation();window.cchPoPushBillToQB(\'' + pid + '\',\'' + poid + '\',null)">Push bill</button>';
      } else if (q.bucket === 'ready_staging') {
        action = '<span style="font-size:10px;color:var(--gray-400);">Prod only</span>';
      } else if (q.bucket === 'awaiting_bill') {
        action = '<button type="button" class="btn btn-secondary btn-sm" style="font-size:10px;padding:4px 10px;" ' +
          'onclick="event.stopPropagation();window.cchOmOpenPoBill(\'' + pid + '\',\'' + poid + '\',\'\')">Receive bill</button>';
      }
      return '<tr style="border-bottom:1px solid var(--gray-100);cursor:pointer;" onclick="navigate(\'#/project/' +
        pid + '/po/' + poid + '\')">' +
        '<td style="' + td + 'font-weight:600;font-family:monospace;color:var(--gold);">' + esc(po.number || po.id.substring(0, 8)) + '</td>' +
        '<td style="' + td + '">' + esc(po._displayVendor || po.vendor || '—') + '</td>' +
        '<td style="' + td + 'color:var(--gray-500);">' + esc(po.projectName || po.projectId) + '</td>' +
        '<td style="' + td + 'font-size:12px;color:var(--gray-500);white-space:nowrap;">' + esc(fmtDate(poIssueDate(po))) + '</td>' +
        '<td style="' + td + 'font-family:monospace;font-size:12px;font-weight:600;color:#1B3352;">' +
        (q.blRef ? esc(q.blRef) : '<span style="color:var(--gray-400);font-weight:400;">—</span>') + '</td>' +
        '<td style="' + td + '">' + qbHtml + '</td>' +
        '<td style="' + td + 'text-align:right;font-weight:600;font-family:monospace;">$' +
        poTotal(po).toLocaleString('en-US', { minimumFractionDigits: 2 }) + '</td>' +
        '<td style="' + td + 'text-align:center;" onclick="event.stopPropagation()">' + action + '</td>' +
        '</tr>';
    }).join('');
    return qbFilterToolbar(projList, vendors, pool.length, filtered.length, stats) +
      '<div class="card" style="overflow:hidden;overflow-x:auto;">' +
      '<table style="width:100%;min-width:980px;border-collapse:collapse;font-size:13px;">' +
      '<thead><tr style="border-bottom:2px solid var(--gray-200);">' +
      thSort('PO #', 'number') +
      thSort('Vendor', 'vendor') +
      thSort('Project', 'project') +
      thSort('Date', 'date') +
      '<th style="padding:10px 12px;text-align:left;font-size:10px;text-transform:uppercase;color:var(--gray-400);font-weight:600;">Bill #</th>' +
      '<th style="padding:10px 12px;text-align:left;font-size:10px;text-transform:uppercase;color:var(--gray-400);font-weight:600;">QB status</th>' +
      thSort('Total', 'amount', 'text-align:right;') +
      '<th style="padding:10px 12px;text-align:center;font-size:10px;text-transform:uppercase;color:var(--gray-400);font-weight:600;">Action</th>' +
      '</tr></thead><tbody>' + body + '</tbody></table></div>';
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
      window._omSortField = 'date';
      window._omSortDir = 'desc';
    }

    var hash = window.location.hash || '';
    var tab = 'open';
    if (hash.indexOf('/noeta') >= 0) tab = 'noeta';
    else if (hash.indexOf('/noconfirm') >= 0) tab = 'noconfirm';
    else if (hash.indexOf('/receiving') >= 0) tab = 'receiving';
    else if (hash.indexOf('/qb') >= 0) tab = 'qb';
    if (tab === 'receiving' && window._omLastTab !== 'receiving') {
      window._omSortField = 'outstanding';
      window._omSortDir = 'desc';
      if (!window._omRecvFilter) window._omRecvFilter = 'attention';
    } else if ((tab === 'open' || tab === 'qb') && window._omLastTab !== tab && !window._omSortTouched) {
      window._omSortField = 'date';
      window._omSortDir = 'desc';
    }
    if (tab === 'qb' && !window._omQbFilter) window._omQbFilter = 'attention';
    window._omLastTab = tab;
    window._omTab = tab;

    var loadingMsg = tab === 'receiving'
      ? 'Loading receiving status across projects…'
      : tab === 'qb'
        ? 'Loading QuickBooks status…'
        : 'Loading order management…';
    T.innerHTML = '<div style="padding:40px;color:var(--gray-500);">' + loadingMsg + '</div>';
    if (typeof window.setBreadcrumb === 'function') window.setBreadcrumb([{ label: 'Order Management' }]);
    if (typeof window.setTopbarActions === 'function') {
      window.setTopbarActions(
        '<a class="btn btn-secondary btn-sm" style="margin-right:8px;" href="#/allpos" onclick="event.preventDefault();navigate(\'#/allpos\')">All POs list</a>' +
        '<a class="btn btn-secondary btn-sm" style="margin-right:8px;" href="#/quickbooks" onclick="event.preventDefault();navigate(\'#/quickbooks\')">QB settings</a>' +
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
    var recvVendors = [];
    allOpen.forEach(function(po) {
      var v = String(po._displayVendor || po.vendor || '').trim();
      if (v && recvVendors.indexOf(v) < 0) recvVendors.push(v);
    });
    recvVendors.sort();

    var panel = '';
    if (tab === 'open') {
      panel = filterToolbar(projList, vendors, statuses, allOpen.length, filteredOpen.length) + openPosTable(filteredOpen);
    } else if (tab === 'noeta') {
      panel = missingEtaReport(allOpen);
    } else if (tab === 'noconfirm') {
      panel = missingConfirmReport(noConfirm);
    } else if (tab === 'receiving') {
      var recvProjectIds = [];
      allOpen.forEach(function(po) {
        if (po.projectId && recvProjectIds.indexOf(po.projectId) < 0) recvProjectIds.push(po.projectId);
      });
      var clipsByProject = await cchOmLoadClipsByProject(recvProjectIds);
      panel = receivingStatusReport(allOpen, clipsByProject, projList, recvVendors);
    } else if (tab === 'qb') {
      panel = qbStatusReport(studioPos, projList);
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
